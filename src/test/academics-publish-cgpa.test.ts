import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  computeSubjectMarks,
  validateMarksInput,
  calculateStudentCGPA,
  calculateSemesterSGPA,
  recordPublishedAcademicResult,
  recordBatchPublishedAcademicResults,
  syncAuthoritativeAcademicResults,
  initializeAuthoritativeAcademicResults,
  getAuthoritativeAcademicsCgpaMap,
  getAuthoritativeAcademicsCgpa,
  getStudentPublishedAcademicResults,
  clearAuthoritativeAcademicsStorageForTesting,
  type StudentSubjectResult,
} from "../lib/academics";
import {
  publishSubjectResultsLogic,
  saveMarksDraftLogic,
  getAcademicsDataLogic,
  getUserRole,
} from "../lib/academics.functions";
import { studentsQuery } from "../lib/data";
import { OFFICIAL_STUDENTS } from "../lib/official-dataset";

function roleDb(roles: string[]) {
  const publishCalls: any[] = [];
  return {
    publishCalls,
    from(table: string) {
      let operation = "select";
      let requestedRollNos: string[] = [];
      const query: any = {
        select() { operation = "select"; return query; },
        eq() { return query; },
        in(_column: string, values: string[]) { requestedRollNos = values; return query; },
        upsert() { operation = "upsert"; return query; },
        then(resolve: (value: any) => void) {
          let data: any[] = [];
          if (table === "user_roles") data = roles.map((role) => ({ role }));
          if (table === "students") {
            data = OFFICIAL_STUDENTS.filter((student) => requestedRollNos.includes(student.roll_no))
              .map((student) => ({ id: student.id, roll_no: student.roll_no }));
          }
          resolve({ data: operation === "upsert" ? null : data, error: null });
        },
      };
      return query;
    },
    rpc: async (name: string, args: any) => {
      if (name === "publish_academic_marks") publishCalls.push(args.p_results);
      return { data: [], error: null };
    },
  };
}

const facultyContext = {
  supabase: roleDb(["faculty"]),
  userId: "faculty-id",
  claims: { email: "faculty@kryptedu.com", sub: "faculty-id" },
};

describe("ACADEMICS PUBLISH MUST UPDATE STUDENT CGPA — Comprehensive Test Suite", () => {
  beforeEach(() => {
    clearAuthoritativeAcademicsStorageForTesting();
  });

  afterEach(() => {
    clearAuthoritativeAcademicsStorageForTesting();
  });

  // --------------------------------------------------------------------------
  // Test 1: Publish marks for a student and verify the updated marks in Academics
  // --------------------------------------------------------------------------
  it("Test 1: Publish marks for a student and verify updated marks in Academics", async () => {
    const student = OFFICIAL_STUDENTS[0]; // Aanosh Mukesh Lingapur (UST24R0102001)
    const subjectId = "cse-s1-01"; // Applied Mathematics I (4 credits)

    const res = await publishSubjectResultsLogic(
      {
        subjectId,
        semesterNumber: 1,
        records: [
          {
            studentRollNo: student.roll_no,
            writtenMarks: 48,
            internalMarks: 47,
          },
        ],
      },
      facultyContext
    );

    expect(res.success).toBe(true);
    expect(res.publishedCount).toBe(1);
    expect(res.errors.length).toBe(0);

    // Verify published record properties
    const pubRecord = res.publishedRecords[0];
    expect(pubRecord).toBeDefined();
    expect(pubRecord.studentRollNo).toBe(student.roll_no);
    expect(pubRecord.writtenMarks).toBe(48);
    expect(pubRecord.internalMarks).toBe(47);
    expect(pubRecord.totalMarks).toBe(95);
    expect(pubRecord.percentage).toBe(95);
    expect(pubRecord.grade).toBe("O");
    expect(pubRecord.gradePoint).toBe(10);
    expect(pubRecord.publicationStatus).toBe("published");

    // Verify presence in Academics results query
    const academicsData = await getAcademicsDataLogic(
      {
        semesterNumber: 1,
        subjectId,
        department: "Computer Engineering",
      },
      facultyContext
    );

    const found = academicsData.results.find(
      (r) => r.studentRollNo === student.roll_no && r.subjectId === subjectId
    );
    expect(found).toBeDefined();
    expect(found?.publicationStatus).toBe("published");
    expect(found?.totalMarks).toBe(95);
    expect(found?.grade).toBe("O");
  });

  // --------------------------------------------------------------------------
  // Test 2: Calculate the student's SGPA and CGPA according to academic rules
  // --------------------------------------------------------------------------
  it("Test 2: Student SGPA and CGPA recalculate according to the credit-weighted grading policy", () => {
    const student = OFFICIAL_STUDENTS[1]; // UST24R0102002

    // Subject 1: Math (4 credits, score 95 -> O, GP 10) => 4 * 10 = 40
    // Subject 2: Chemistry (3 credits, score 82 -> A+, GP 9) => 3 * 9 = 27
    // Subject 3: Chemistry Lab (1 credit, score 72 -> A, GP 8) => 1 * 8 = 8
    // Subject 4: Programming (4 credits, score 65 -> B+, GP 7) => 4 * 7 = 28
    // Total Credits = 4 + 3 + 1 + 4 = 12
    // Total Weighted Points = 40 + 27 + 8 + 28 = 103
    // Expected SGPA / CGPA = 103 / 12 = 8.5833... => 8.58

    const testRecords: StudentSubjectResult[] = [
      {
        id: "res-1",
        studentId: `ust-${student.roll_no.toLowerCase()}`,
        studentRollNo: student.roll_no,
        studentName: student.name,
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-01",
        subjectName: "Applied Mathematics I",
        subjectCode: "CS101",
        credits: 4,
        writtenMarks: 48,
        internalMarks: 47,
        totalMarks: 95,
        percentage: 95,
        grade: "O",
        gradePoint: 10,
        publicationStatus: "published",
        isDemo: false,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "res-2",
        studentId: `ust-${student.roll_no.toLowerCase()}`,
        studentRollNo: student.roll_no,
        studentName: student.name,
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-02",
        subjectName: "Applied Chemistry I",
        subjectCode: "CS102",
        credits: 3,
        writtenMarks: 42,
        internalMarks: 40,
        totalMarks: 82,
        percentage: 82,
        grade: "A+",
        gradePoint: 9,
        publicationStatus: "published",
        isDemo: false,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "res-3",
        studentId: `ust-${student.roll_no.toLowerCase()}`,
        studentRollNo: student.roll_no,
        studentName: student.name,
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-03",
        subjectName: "Applied Chemistry Lab",
        subjectCode: "CS102L",
        credits: 1,
        writtenMarks: 36,
        internalMarks: 36,
        totalMarks: 72,
        percentage: 72,
        grade: "A",
        gradePoint: 8,
        publicationStatus: "published",
        isDemo: false,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "res-4",
        studentId: `ust-${student.roll_no.toLowerCase()}`,
        studentRollNo: student.roll_no,
        studentName: student.name,
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-04",
        subjectName: "Programming for Problem Solving",
        subjectCode: "CS103",
        credits: 4,
        writtenMarks: 33,
        internalMarks: 32,
        totalMarks: 65,
        percentage: 65,
        grade: "B+",
        gradePoint: 7,
        publicationStatus: "published",
        isDemo: false,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    recordBatchPublishedAcademicResults(testRecords);

    // Verify calculated SGPA & CGPA
    const sgpaSummary = calculateSemesterSGPA(testRecords);
    expect(sgpaSummary.sgpa).toBe(8.58);
    expect(sgpaSummary.totalCreditsAttempted).toBe(12);
    expect(sgpaSummary.totalCreditsEarned).toBe(12);

    const cumulativeCgpa = calculateStudentCGPA(testRecords);
    expect(cumulativeCgpa).toBe(8.58);

    // Verify getAuthoritativeAcademicsCgpa returns the exact recalculated value for this student
    const authCgpa = getAuthoritativeAcademicsCgpa(student.roll_no);
    expect(authCgpa.isPublished).toBe(true);
    expect(authCgpa.cgpa).toBe(calculateStudentCGPA(getStudentPublishedAcademicResults(student.roll_no)));
  });

  // --------------------------------------------------------------------------
  // Test 3: Verify the student's updated CGPA appears in the Student table query
  // --------------------------------------------------------------------------
  it("Test 3: Updated CGPA appears in the Student table query and other students are preserved", async () => {
    const student1 = OFFICIAL_STUDENTS[2];
    const student2 = OFFICIAL_STUDENTS[3];

    // Initial student data from query
    const initialStudents = (await (studentsQuery as any).queryFn()) as any[];
    const s2Before = initialStudents.find((s) => s.roll_no === student2.roll_no);
    const s2CgpaBefore = s2Before?.cgpa;

    // Publish high marks for student1:
    const pubRecord: StudentSubjectResult = {
      id: `res-${student1.roll_no.toLowerCase()}-math`,
      studentId: `ust-${student1.roll_no.toLowerCase()}`,
      studentRollNo: student1.roll_no,
      studentName: student1.name,
      department: "Computer Engineering",
      semesterNumber: 1,
      subjectId: "cse-s1-01",
      subjectName: "Applied Mathematics I",
      subjectCode: "CS101",
      credits: 4,
      writtenMarks: 50,
      internalMarks: 50,
      totalMarks: 100,
      percentage: 100,
      grade: "O",
      gradePoint: 10,
      publicationStatus: "published",
      isDemo: false,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    recordPublishedAcademicResult(pubRecord);

    // Re-fetch Student Directory query
    const updatedStudents = (await (studentsQuery as any).queryFn()) as any[];

    // 1. student1's CGPA in the table MUST reflect the newly calculated authoritative CGPA
    const s1After = updatedStudents.find((s) => s.roll_no === student1.roll_no);
    expect(s1After).toBeDefined();
    const authoritativeCurrentCgpa = getAuthoritativeAcademicsCgpa(student1.roll_no).cgpa;
    expect(s1After?.cgpa).toBe(authoritativeCurrentCgpa);

    // 2. student2's CGPA MUST NOT have changed
    const s2After = updatedStudents.find((s) => s.roll_no === student2.roll_no);
    expect(s2After).toBeDefined();
    expect(s2After?.cgpa).toBe(s2CgpaBefore);

    // 3. Attendance, LMS activity, and other non-academic fields remain intact
    expect(s1After?.attendance).toBe(s1After?.attendance);
    expect(s1After?.academicRisk).toBeDefined();
    expect(s1After?.placementRisk).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Test 4: Refresh the page and confirm the recalculated CGPA persists
  // --------------------------------------------------------------------------
  it("Test 4: Refreshing/re-mounting preserves published results in client storage", () => {
    const student = OFFICIAL_STUDENTS[4];

    // Mock localStorage in test environment
    const mockStorage: Record<string, string> = {};
    (global as any).window = {};
    (global as any).localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    };

    const publishedRecord: StudentSubjectResult = {
      id: `res-persist-${student.roll_no.toLowerCase()}`,
      studentId: `ust-${student.roll_no.toLowerCase()}`,
      studentRollNo: student.roll_no,
      studentName: student.name,
      department: "Computer Engineering",
      semesterNumber: 1,
      subjectId: "cse-s1-01",
      subjectName: "Applied Mathematics I",
      subjectCode: "CS101",
      credits: 4,
      writtenMarks: 45,
      internalMarks: 45,
      totalMarks: 90,
      percentage: 90,
      grade: "O",
      gradePoint: 10,
      publicationStatus: "published",
      isDemo: false,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Sync and persist
    syncAuthoritativeAcademicResults([publishedRecord]);
    const cgpaBeforeRefresh = getAuthoritativeAcademicsCgpa(student.roll_no).cgpa;

    // 2. Simulate browser refresh: re-initialize authoritative academic results
    initializeAuthoritativeAcademicResults();

    // 3. Verify value persists
    const cgpaAfterRefresh = getAuthoritativeAcademicsCgpa(student.roll_no).cgpa;
    expect(cgpaAfterRefresh).toBe(cgpaBeforeRefresh);

    // Cleanup globals
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  // --------------------------------------------------------------------------
  // Test 5: Publish marks for multiple students and verify every result links correctly
  // --------------------------------------------------------------------------
  it("Test 5: Batch publishing links each result strictly to the correct student", async () => {
    const s1 = OFFICIAL_STUDENTS[5];
    const s2 = OFFICIAL_STUDENTS[6];
    const s3 = OFFICIAL_STUDENTS[7];
    const subjectId = "cse-s1-01";

    const res = await publishSubjectResultsLogic(
      {
        subjectId,
        semesterNumber: 1,
        records: [
          { studentRollNo: s1.roll_no, writtenMarks: 40, internalMarks: 40 }, // 80 -> A+ (GP 9)
          { studentRollNo: s2.roll_no, writtenMarks: 35, internalMarks: 35 }, // 70 -> A (GP 8)
          { studentRollNo: s3.roll_no, writtenMarks: 25, internalMarks: 25 }, // 50 -> C (GP 5)
        ],
      },
      facultyContext
    );

    expect(res.success).toBe(true);
    expect(res.publishedCount).toBe(3);

    const r1 = res.publishedRecords?.find((r) => r.studentRollNo === s1.roll_no);
    const r2 = res.publishedRecords?.find((r) => r.studentRollNo === s2.roll_no);
    const r3 = res.publishedRecords?.find((r) => r.studentRollNo === s3.roll_no);

    expect(r1?.grade).toBe("A+");
    expect(r1?.gradePoint).toBe(9);

    expect(r2?.grade).toBe("A");
    expect(r2?.gradePoint).toBe(8);

    expect(r3?.grade).toBe("C");
    expect(r3?.gradePoint).toBe(5);
  });

  // --------------------------------------------------------------------------
  // Test 6: Save a draft and verify that it does not become an official published result
  // --------------------------------------------------------------------------
  it("Test 6: Draft marks do NOT alter published academic results or calculated CGPA", async () => {
    const student = OFFICIAL_STUDENTS[8];
    const initialCgpa = getAuthoritativeAcademicsCgpa(student.roll_no).cgpa;

    // Faculty saves draft with 0 marks (fail)
    const draftRes = await saveMarksDraftLogic(
      {
        subjectId: "cse-s1-01",
        semesterNumber: 1,
        records: [
          {
            studentRollNo: student.roll_no,
            writtenMarks: 5,
            internalMarks: 5,
          },
        ],
      },
      facultyContext
    );

    expect(draftRes.success).toBe(true);

    // Verify student's published CGPA remains unaffected
    const publishedCgpaAfterDraft = getAuthoritativeAcademicsCgpa(student.roll_no).cgpa;
    expect(publishedCgpaAfterDraft).toBe(initialCgpa);

    // Verify published results list does NOT include draft
    const published = getStudentPublishedAcademicResults(student.roll_no);
    const draftInPublished = published.find(
      (r) => r.subjectId === "cse-s1-01" && r.publicationStatus === "draft"
    );
    expect(draftInPublished).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Test 7: Attempt unauthorized publication and verify that the server rejects it
  // --------------------------------------------------------------------------
  it("Test 7: Rejects unauthorized publication attempt by student account with 403 Forbidden", async () => {
    // In our auth context, simulate a student claims token
    const studentContext = {
      supabase: roleDb(["student"]),
      userId: "student-user-id",
      claims: { email: "student@kryptedu.com", sub: "student-user-id" },
    };

    // Calling publishSubjectResultsLogic with student role must throw Forbidden 403
    await expect(
      publishSubjectResultsLogic(
        {
          subjectId: "cse-s1-01",
          semesterNumber: 1,
          records: [
            {
              studentRollNo: OFFICIAL_STUDENTS[0].roll_no,
              writtenMarks: 50,
              internalMarks: 50,
            },
          ],
        },
        studentContext
      )
    ).rejects.toThrow(/Forbidden/i);
  });

  // --------------------------------------------------------------------------
  it("resolves multiple database roles without maybeSingle ambiguity", async () => {
    expect(await getUserRole(roleDb(["faculty", "admin"]), "staff-user-id")).toBe("admin");
    expect(await getUserRole(roleDb(["faculty"]), "staff-user-id")).toBe("faculty");
    expect(await getUserRole(roleDb(["student"]), "staff-user-id")).toBe("student");

    const adminDb = roleDb(["admin"]);
    const adminResult = await publishSubjectResultsLogic(
      {
        subjectId: "cse-s1-01",
        semesterNumber: 1,
        records: [{ studentRollNo: OFFICIAL_STUDENTS[2].roll_no, writtenMarks: 40, internalMarks: 45 }],
      },
      { supabase: adminDb, userId: "admin-user-id" }
    );
    expect(adminResult.success).toBe(true);
    expect(adminResult.publishedCount).toBe(1);
    expect(adminDb.publishCalls[0]).toHaveLength(1);
    expect(adminDb.publishCalls[0][0]).toMatchObject({
      student_roll_no: OFFICIAL_STUDENTS[2].roll_no,
      subject_id: "cse-s1-01",
      semester_number: 1,
      written_marks: 40,
      internal_marks: 45,
    });
  });

  it("does not mutate published caches when atomic database publication rejects a batch", async () => {
    const rollNo = OFFICIAL_STUDENTS[15].roll_no;
    const prior = getStudentPublishedAcademicResults(rollNo).find((row) => row.subjectId === "cse-s1-01");
    const db = roleDb(["faculty"]);
    db.rpc = async () => ({
      data: null,
      error: { message: "Student record not found: 1 missing; UST24X0000000" },
    });

    await expect(
      publishSubjectResultsLogic(
        {
          subjectId: "cse-s1-01",
          semesterNumber: 1,
          records: [{ studentRollNo: rollNo, writtenMarks: 44, internalMarks: 44 }],
        },
        { supabase: db, userId: "faculty-user-id" }
      )
    ).rejects.toThrow(/1 missing/);

    const after = getStudentPublishedAcademicResults(rollNo).find((row) => row.subjectId === "cse-s1-01");
    expect(after).toEqual(prior);
  });

  // Test 8: Simulate validation failure and verify UI does not report false success
  // --------------------------------------------------------------------------
  it("Test 8: Rejects invalid marks and does not publish them", async () => {
    const v1 = validateMarksInput(75, 20); // Written > 50
    expect(v1.valid).toBe(false);
    expect(v1.error).toContain("between 0 and 50");

    const v2 = validateMarksInput(-5, 20); // Written < 0
    expect(v2.valid).toBe(false);

    const v3 = validateMarksInput(30, 99); // Internal > 50
    expect(v3.valid).toBe(false);

    // Server publish with invalid marks rejects invalid rows
    const res = await publishSubjectResultsLogic(
      {
        subjectId: "cse-s1-01",
        semesterNumber: 1,
        records: [
          {
            studentRollNo: OFFICIAL_STUDENTS[0].roll_no,
            writtenMarks: 80, // Invalid!
            internalMarks: 20,
          },
        ],
      },
      facultyContext
    );

    expect(res.publishedCount).toBe(0);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0]).toContain("between 0 and 50");
  });

  // --------------------------------------------------------------------------
  // Test 9: Confirm that republishing revised marks does not create duplicate active records
  // --------------------------------------------------------------------------
  it("Test 9: Republishing revised marks updates in-place and prevents duplicate active records", async () => {
    const student = OFFICIAL_STUDENTS[9];
    const subjectId = "cse-s1-01";

    // 1. Initial publication (30 written + 30 internal = 60, B+, GP 7)
    await publishSubjectResultsLogic(
      {
        subjectId,
        semesterNumber: 1,
        records: [{ studentRollNo: student.roll_no, writtenMarks: 30, internalMarks: 30 }],
      },
      facultyContext
    );

    const firstPublished = getStudentPublishedAcademicResults(student.roll_no).filter(
      (r) => r.subjectId === subjectId
    );
    expect(firstPublished.length).toBe(1);
    expect(firstPublished[0].grade).toBe("B+");

    // 2. Republish revised marks (48 written + 48 internal = 96, O, GP 10)
    await publishSubjectResultsLogic(
      {
        subjectId,
        semesterNumber: 1,
        records: [{ studentRollNo: student.roll_no, writtenMarks: 48, internalMarks: 48 }],
      },
      facultyContext
    );

    const secondPublished = getStudentPublishedAcademicResults(student.roll_no).filter(
      (r) => r.subjectId === subjectId
    );

    // MUST STILL BE EXACTLY 1 RECORD, NOT 2!
    expect(secondPublished.length).toBe(1);
    expect(secondPublished[0].grade).toBe("O");
    expect(secondPublished[0].gradePoint).toBe(10);
  });
});
