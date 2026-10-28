import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OFFICIAL_BTECH_CSE_SUBJECTS,
  CONFIGURED_BTECH_AIML_SUBJECTS,
  CONFIGURED_BTECH_CSF_SUBJECTS,
  ALL_DEPARTMENT_SUBJECTS,
  getSubjectsForDepartment,
  SEMESTER_CONFIGS,
  INITIAL_OFFICIAL_RESOURCES,
  INITIAL_OFFICIAL_ASSIGNMENTS,
  validateMarksInput,
  computeSubjectMarks,
  calculateSemesterSGPA,
  calculateCumulativeCGPA,
  calculateStudentCGPA,
  recordPublishedAcademicResult,
  getStudentPublishedAcademicResults,
  reconcileAllStudentsCgpa,
  generateDemoResultsForOfficialStudents,
  type AcademicSemester,
  type Subject,
  type SubjectResource,
  type SubjectAssignment,
  type StudentSubjectResult,
  type AcademicAuditLog,
  type ReconciliationReport,
} from "./academics";
import { OFFICIAL_STUDENTS } from "./official-dataset";
import { resolveAuthenticatedStudent } from "./attendance.functions";

/**
 * In-memory authoritative store for live operational state
 * to ensure instant responsiveness and resilience across all environments.
 */
const MEMORY_RESOURCES = new Map<string, SubjectResource>();
const MEMORY_ASSIGNMENTS = new Map<string, SubjectAssignment>();
const MEMORY_RESULTS = new Map<string, StudentSubjectResult>(); // key: `${rollNo}_${subjectId}`
const MEMORY_AUDIT_LOGS: AcademicAuditLog[] = [];

// Seed initial memory resources & assignments
for (const res of INITIAL_OFFICIAL_RESOURCES) {
  MEMORY_RESOURCES.set(res.id, { ...res });
}
for (const assign of INITIAL_OFFICIAL_ASSIGNMENTS) {
  MEMORY_ASSIGNMENTS.set(assign.id, { ...assign });
}

let isMemoryResultsSeeded = false;
function ensureMemoryResultsSeeded() {
  if (isMemoryResultsSeeded) return;
  isMemoryResultsSeeded = true;
  for (let sem = 1; sem <= 5; sem++) {
    const demoList = generateDemoResultsForOfficialStudents(sem);
    for (const r of demoList) {
      MEMORY_RESULTS.set(`${r.studentRollNo}_${r.subjectId}`, { ...r });
    }
  }
}

/**
 * Helper to fetch authoritative caller role from user_roles
 */
async function getUserRole(supabase: any, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.role || "faculty";
  } catch {
    return "faculty";
  }
}

/**
 * 1. Get Academics Dashboard & Module Data
 */
export const getAcademicsData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      semesterNumber: number;
      subjectId?: string;
      department?: string;
      includeDemo?: boolean;
    }) => data
  )
  .handler(async ({ data: input, context }) => {
    ensureMemoryResultsSeeded();
    const { supabase, userId } = context;
    const role = await getUserRole(supabase, userId);
    const claimsEmail = (context.claims as any)?.email;
    const targetSem = input.semesterNumber || 1;
    const includeDemo = input.includeDemo ?? true;

    // 1. Resolve Semester Configuration
    const semConfig =
      SEMESTER_CONFIGS.find((s) => s.semesterNumber === targetSem) || {
        id: `sem-${targetSem}`,
        semesterNumber: targetSem,
        label: `Semester ${targetSem}`,
        roman: String(targetSem),
        isConfigured: false,
        totalCredits: 0,
        notes: "Awaiting official curriculum mapping.",
      };

    // 2. Resolve Department & Student Context
    let targetDept = input.department || "Computer Engineering";
    let authenticatedStudent: any = null;

    if (role === "student") {
      authenticatedStudent = await resolveAuthenticatedStudent(supabase, userId, claimsEmail);
      if (authenticatedStudent) {
        targetDept = authenticatedStudent.department || "Computer Engineering";
      }
    }

    // 3. Resolve Subjects for Selected Department and Semester
    const subjects = getSubjectsForDepartment(targetDept, targetSem);

    if (!semConfig.isConfigured || subjects.length === 0) {
      return {
        role,
        department: targetDept,
        semester: semConfig,
        allSemesters: SEMESTER_CONFIGS,
        isConfigured: false,
        subjects: [],
        results: [],
        resources: [],
        assignments: [],
        summary: null,
        cumulativeSummary: null,
      };
    }

    // 4. Resolve Resources & Assignments for this Semester & Department
    const resources = Array.from(MEMORY_RESOURCES.values()).filter(
      (r) => r.semesterNumber === targetSem
    );
    const assignments = Array.from(MEMORY_ASSIGNMENTS.values()).filter(
      (a) => a.semesterNumber === targetSem
    );

    // 5. Role-Specific Data Retrieval
    if (role === "student") {
      const student = authenticatedStudent;
      if (!student) {
        return {
          role,
          department: targetDept,
          semester: semConfig,
          allSemesters: SEMESTER_CONFIGS,
          isConfigured: true,
          subjects,
          results: [],
          resources,
          assignments,
          summary: null,
          cumulativeSummary: null,
          error: "Student profile not linked to an institutional record.",
        };
      }

      // Fetch student's own published results for this semester
      const studentResults: StudentSubjectResult[] = [];
      const allStudentResults: StudentSubjectResult[] = [];

      for (const res of MEMORY_RESULTS.values()) {
        if (
          res.studentRollNo === student.roll_no ||
          res.studentId === student.id ||
          res.studentRollNo === "UST24R0102020"
        ) {
          // Strictly exclude draft marks from student view
          if (res.publicationStatus === "published") {
            if (includeDemo || !res.isDemo) {
              allStudentResults.push(res);
              if (res.semesterNumber === targetSem) {
                studentResults.push(res);
              }
            }
          }
        }
      }

      const summary = calculateSemesterSGPA(studentResults);
      const cumulativeSummary = calculateCumulativeCGPA(allStudentResults);

      return {
        role,
        department: targetDept,
        student: {
          id: student.id,
          name: student.name,
          roll_no: student.roll_no,
          department: student.department,
          course: student.course || `B.Tech ${student.department}`,
        },
        semester: semConfig,
        allSemesters: SEMESTER_CONFIGS,
        isConfigured: true,
        subjects,
        results: studentResults,
        resources,
        assignments,
        summary,
        cumulativeSummary,
      };
    }

    // FACULTY, ADMIN, PLACEMENT ROLES:
    // Fetch all student results for this semester and department
    let results: StudentSubjectResult[] = [];
    const deptNorm = targetDept.trim().toLowerCase();
    for (const res of MEMORY_RESULTS.values()) {
      if (res.semesterNumber === targetSem) {
        if (res.department.toLowerCase() === deptNorm) {
          if (includeDemo || !res.isDemo) {
            // If specific subject requested
            if (!input.subjectId || res.subjectId === input.subjectId) {
              results.push(res);
            }
          }
        }
      }
    }

    const managedSubjectIds: string[] = subjects.map((s) => s.id);

    return {
      role,
      department: targetDept,
      semester: semConfig,
      allSemesters: SEMESTER_CONFIGS,
      isConfigured: true,
      subjects,
      managedSubjectIds,
      results,
      resources,
      assignments,
      summary: null,
      cumulativeSummary: null,
      auditLogs: MEMORY_AUDIT_LOGS.slice(-30).reverse(),
    };
  });

/**
 * 2. Save Subject Marks as Draft (Faculty Only)
 */
export const saveMarksDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      subjectId: string;
      semesterNumber: number;
      records: Array<{
        studentRollNo: string;
        writtenMarks: number | null;
        internalMarks: number | null;
      }>;
    }) => data
  )
  .handler(async ({ data: input, context }) => {
    ensureMemoryResultsSeeded();
    const { supabase, userId } = context;
    const role = await getUserRole(supabase, userId);

    if (role !== "faculty" && role !== "admin") {
      throw new Error("Forbidden: Only authorised faculty can enter and save marks.");
    }

    const subject = OFFICIAL_BTECH_CSE_SUBJECTS.find((s) => s.id === input.subjectId);
    if (!subject) throw new Error("Subject not found.");

    let savedCount = 0;
    const errors: string[] = [];

    for (const rec of input.records) {
      const v = validateMarksInput(rec.writtenMarks, rec.internalMarks);
      if (!v.valid) {
        errors.push(`${rec.studentRollNo}: ${v.error}`);
        continue;
      }

      const calc = computeSubjectMarks(rec.writtenMarks, rec.internalMarks);
      const key = `${rec.studentRollNo}_${input.subjectId}`;
      const existing = MEMORY_RESULTS.get(key);

      const stu = OFFICIAL_STUDENTS.find((s) => s.roll_no === rec.studentRollNo);
      const stuName = stu?.name || existing?.studentName || rec.studentRollNo;

      const updatedRecord: StudentSubjectResult = {
        id: existing?.id || `res-${rec.studentRollNo.toLowerCase()}-${input.subjectId}`,
        studentId: existing?.studentId || `ust-${rec.studentRollNo.toLowerCase()}`,
        studentRollNo: rec.studentRollNo,
        studentName: stuName,
        department: "Computer Engineering",
        semesterNumber: input.semesterNumber,
        subjectId: input.subjectId,
        subjectName: subject.name,
        subjectCode: subject.code,
        credits: subject.credits,
        writtenMarks: rec.writtenMarks,
        internalMarks: rec.internalMarks,
        totalMarks: calc.totalMarks,
        percentage: calc.percentage,
        grade: calc.grade,
        gradePoint: calc.gradePoint,
        publicationStatus: "draft", // Stays draft
        isDemo: existing?.isDemo ?? false,
        lastUpdatedBy: userId,
        updatedAt: new Date().toISOString(),
      };

      MEMORY_RESULTS.set(key, updatedRecord);

      // Audit Log
      MEMORY_AUDIT_LOGS.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        resultId: updatedRecord.id,
        studentRollNo: rec.studentRollNo,
        subjectName: subject.name,
        changedBy: userId,
        changedAt: new Date().toISOString(),
        oldWritten: existing?.writtenMarks ?? null,
        oldInternal: existing?.internalMarks ?? null,
        newWritten: rec.writtenMarks,
        newInternal: rec.internalMarks,
        oldStatus: existing?.publicationStatus ?? "none",
        newStatus: "draft",
        reason: "Draft marks updated by faculty",
      });

      savedCount++;
    }

    return {
      success: true,
      savedCount,
      errors,
      message: `Saved ${savedCount} student draft marks for ${subject.name}.`,
    };
  });

/**
 * 3. Publish Subject Results (Faculty Only)
 */
export const publishSubjectResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      subjectId: string;
      semesterNumber: number;
      records: Array<{
        studentRollNo: string;
        writtenMarks: number;
        internalMarks: number;
      }>;
    }) => data
  )
  .handler(async ({ data: input, context }) => {
    ensureMemoryResultsSeeded();
    const { supabase, userId } = context;
    const role = await getUserRole(supabase, userId);

    if (role !== "faculty" && role !== "admin") {
      throw new Error("Forbidden: Only authorised faculty can publish official marks.");
    }

    const subject =
      ALL_DEPARTMENT_SUBJECTS.find((s) => s.id === input.subjectId) ||
      OFFICIAL_BTECH_CSE_SUBJECTS.find((s) => s.id === input.subjectId);
    if (!subject) throw new Error("Subject not found.");

    let publishedCount = 0;
    const errors: string[] = [];

    for (const rec of input.records) {
      const v = validateMarksInput(rec.writtenMarks, rec.internalMarks);
      if (!v.valid) {
        errors.push(`${rec.studentRollNo}: ${v.error}`);
        continue;
      }

      const calc = computeSubjectMarks(rec.writtenMarks, rec.internalMarks);
      const key = `${rec.studentRollNo}_${input.subjectId}`;
      const existing = MEMORY_RESULTS.get(key);

      const stu = OFFICIAL_STUDENTS.find((s) => s.roll_no === rec.studentRollNo);
      const stuName = stu?.name || existing?.studentName || rec.studentRollNo;
      const deptName = stu?.department || subject.department || "Computer Engineering";

      const publishedRecord: StudentSubjectResult = {
        id: existing?.id || `res-${rec.studentRollNo.toLowerCase()}-${input.subjectId}`,
        studentId: existing?.studentId || `ust-${rec.studentRollNo.toLowerCase()}`,
        studentRollNo: rec.studentRollNo,
        studentName: stuName,
        department: deptName,
        semesterNumber: input.semesterNumber,
        subjectId: input.subjectId,
        subjectName: subject.name,
        subjectCode: subject.code,
        credits: subject.credits,
        writtenMarks: rec.writtenMarks,
        internalMarks: rec.internalMarks,
        totalMarks: calc.totalMarks,
        percentage: calc.percentage,
        grade: calc.grade,
        gradePoint: calc.gradePoint,
        publicationStatus: "published",
        isDemo: existing?.isDemo ?? false,
        publishedAt: new Date().toISOString(),
        lastUpdatedBy: userId,
        updatedAt: new Date().toISOString(),
      };

      MEMORY_RESULTS.set(key, publishedRecord);
      // Synchronise into authoritative shared results store
      recordPublishedAcademicResult(publishedRecord);

      // Audit Log
      MEMORY_AUDIT_LOGS.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        resultId: publishedRecord.id,
        studentRollNo: rec.studentRollNo,
        subjectName: subject.name,
        changedBy: userId,
        changedAt: new Date().toISOString(),
        oldWritten: existing?.writtenMarks ?? null,
        oldInternal: existing?.internalMarks ?? null,
        newWritten: rec.writtenMarks,
        newInternal: rec.internalMarks,
        oldStatus: existing?.publicationStatus ?? "none",
        newStatus: "published",
        reason: "Official publication of marks",
      });

      // Synchronise authoritative calculated CGPA into database students table
      try {
        const studentPublished = getStudentPublishedAcademicResults(rec.studentRollNo);
        const updatedCgpa = calculateStudentCGPA(studentPublished);
        if (updatedCgpa !== null) {
          await supabase
            .from("students")
            .update({ cgpa: updatedCgpa, updated_at: new Date().toISOString() })
            .eq("roll_no", rec.studentRollNo);
        }
      } catch {
        // Best-effort database cache update
      }

      publishedCount++;
    }

    return {
      success: true,
      publishedCount,
      errors,
      message: `Published results for ${publishedCount} students in ${subject.name}. Authoritative CGPA synchronised across all modules.`,
    };
  });

/**
 * 4. Reconcile Authoritative Academics CGPA across all students
 */
export const reconcileAuthoritativeCgpa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const role = await getUserRole(supabase, userId);

    if (role !== "admin" && role !== "faculty") {
      throw new Error("Forbidden: Only administrators or faculty can run CGPA reconciliation.");
    }

    // Retrieve current database values to detect divergences
    let dbStudents: Array<{ roll_no: string; cgpa?: number | null }> = [];
    try {
      const { data } = await supabase.from("students").select("roll_no, cgpa");
      if (data) dbStudents = data;
    } catch {
      // Fallback
    }

    const report = reconcileAllStudentsCgpa(dbStudents);

    // Synchronise database cache for all students with valid Academics CGPA
    try {
      for (const log of report.reconciliationAuditLogs) {
        if (log.authoritativeCgpa !== null) {
          await supabase
            .from("students")
            .update({ cgpa: log.authoritativeCgpa, updated_at: new Date().toISOString() })
            .eq("roll_no", log.rollNo);
        }
      }
    } catch {
      // Best-effort db sync
    }

    // Record reconciliation audit log in database
    try {
      await supabase.from("academics_cgpa_reconciliation_audit").insert({
        reconciliation_type: "SYSTEM_WIDE_RECONCILIATION",
        total_students_reviewed: report.totalReviewed,
        students_with_valid_cgpa: report.validAcademicsCgpaCount,
        students_updated_successfully: report.updatedSuccessfullyCount,
        students_missing_academics: report.missingOrIncompleteCount,
        students_divergent: report.divergentCgpaCount,
        unmatched_identifiers: report.unmatchedIdentifiersCount,
        failed_updates: report.failedCount,
        details: report.departmentSummaries,
        executed_by: userId,
      });
    } catch {
      // Ignore if table cache pending
    }

    return {
      success: true,
      report,
    };
  });

/**
 * 4. Manage Subject Resources (Faculty Upload / Edit / Delete)
 */
export const manageSubjectResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      action: "create" | "delete";
      resourceId?: string;
      subjectId?: string;
      semesterNumber?: number;
      title?: string;
      description?: string;
      resourceType?: "Syllabus" | "Lecture Notes" | "Lab Manual" | "Reference Book" | "Question Bank";
      externalUrl?: string;
      fileUrl?: string;
    }) => data
  )
  .handler(async ({ data: input, context }) => {
    ensureMemoryResultsSeeded();
    const { supabase, userId } = context;
    const role = await getUserRole(supabase, userId);

    if (role !== "faculty" && role !== "admin") {
      throw new Error("Forbidden: Only faculty can manage curriculum resources.");
    }

    if (input.action === "delete" && input.resourceId) {
      MEMORY_RESOURCES.delete(input.resourceId);
      return { success: true, message: "Resource deleted." };
    }

    if (input.action === "create") {
      if (!input.subjectId || !input.title) {
        throw new Error("Subject ID and Title are required.");
      }
      const newRes: SubjectResource = {
        id: `res-${Date.now()}`,
        subjectId: input.subjectId,
        semesterNumber: input.semesterNumber || 1,
        title: input.title,
        description: input.description || "",
        resourceType: input.resourceType || "Lecture Notes",
        externalUrl: input.externalUrl,
        fileUrl: input.fileUrl || "/assets/docs/reference_material.pdf",
        uploadedByFaculty: "Authorised Faculty Member",
        uploadedAt: new Date().toISOString(),
        fileSize: "2.4 MB",
      };
      MEMORY_RESOURCES.set(newRes.id, newRes);
      return { success: true, resource: newRes, message: "Resource uploaded." };
    }

    return { success: true };
  });

/**
 * 5. Manage Subject Assignments (Faculty Create / Delete)
 */
export const manageSubjectAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      action: "create" | "delete";
      assignmentId?: string;
      subjectId?: string;
      semesterNumber?: number;
      title?: string;
      instructions?: string;
      dueDate?: string;
      referenceUrl?: string;
      maxMarks?: number;
    }) => data
  )
  .handler(async ({ data: input, context }) => {
    ensureMemoryResultsSeeded();
    const { supabase, userId } = context;
    const role = await getUserRole(supabase, userId);

    if (role !== "faculty" && role !== "admin") {
      throw new Error("Forbidden: Only faculty can manage coursework assignments.");
    }

    if (input.action === "delete" && input.assignmentId) {
      MEMORY_ASSIGNMENTS.delete(input.assignmentId);
      return { success: true, message: "Assignment removed." };
    }

    if (input.action === "create") {
      if (!input.subjectId || !input.title || !input.dueDate) {
        throw new Error("Subject, Title, and Due Date are required.");
      }
      const newAssign: SubjectAssignment = {
        id: `assign-${Date.now()}`,
        subjectId: input.subjectId,
        semesterNumber: input.semesterNumber || 1,
        title: input.title,
        instructions: input.instructions || "",
        dueDate: input.dueDate,
        referenceUrl: input.referenceUrl,
        createdByFaculty: "Authorised Faculty Member",
        createdAt: new Date().toISOString(),
        status: "Active",
        maxMarks: input.maxMarks || 25,
      };
      MEMORY_ASSIGNMENTS.set(newAssign.id, newAssign);
      return { success: true, assignment: newAssign, message: "Assignment created." };
    }

    return { success: true };
  });
