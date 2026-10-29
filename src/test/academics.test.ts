import { describe, it, expect } from "vitest";
import {
  validateMarksInput,
  computeSubjectMarks,
  calculateSemesterSGPA,
  calculateCumulativeCGPA,
  calculateStudentCGPA,
  SEMESTER_CONFIGS,
  OFFICIAL_BTECH_CSE_SUBJECTS,
  generateDemoResultsForOfficialStudents,
  getAuthoritativeAcademicsCgpaMap,
  reconcileAllStudentsCgpa,
  getStudentPublishedAcademicResults,
  recordPublishedAcademicResult,
  type StudentSubjectResult,
} from "../lib/academics";
import { OFFICIAL_STUDENTS } from "../lib/official-dataset";
import { score } from "../lib/scoring";

describe("Academics Module — Core Logic & CGPA Conversions", () => {
  it("Semester configurations reflect verified Semesters I-V and unconfigured Semesters VI-VIII", () => {
    const sems = SEMESTER_CONFIGS;
    expect(sems).toHaveLength(8);
    expect(sems.filter((s) => s.isConfigured)).toHaveLength(5);
    expect(sems.filter((s) => !s.isConfigured)).toHaveLength(3);
    expect(sems.find((s) => s.semesterNumber === 6)?.isConfigured).toBe(false);
    expect(sems.find((s) => s.semesterNumber === 7)?.isConfigured).toBe(false);
    expect(sems.find((s) => s.semesterNumber === 8)?.isConfigured).toBe(false);
  });

  it("Imports exact subject counts for each semester as specified in Word document", () => {
    const sem1 = OFFICIAL_BTECH_CSE_SUBJECTS.filter((s) => s.semesterNumber === 1);
    const sem2 = OFFICIAL_BTECH_CSE_SUBJECTS.filter((s) => s.semesterNumber === 2);
    const sem3 = OFFICIAL_BTECH_CSE_SUBJECTS.filter((s) => s.semesterNumber === 3);
    const sem4 = OFFICIAL_BTECH_CSE_SUBJECTS.filter((s) => s.semesterNumber === 4);
    const sem5 = OFFICIAL_BTECH_CSE_SUBJECTS.filter((s) => s.semesterNumber === 5);

    expect(sem1).toHaveLength(8);
    expect(sem2).toHaveLength(10);
    expect(sem3).toHaveLength(11);
    expect(sem4).toHaveLength(11);
    expect(sem5).toHaveLength(10);

    // Verify preservation of spelling inconsistency with flag
    const ds = sem3.find((s) => s.name === "Data Structure");
    expect(ds?.facultyName).toBe("Jitnedra Satruwar");
    expect(ds?.inconsistencyFlag).toBeDefined();

    const dslab = sem3.find((s) => s.name === "Data Structure Lab");
    expect(dslab?.facultyName).toBe("Jitendra Satruwar");
  });

  it("Validates written and internal marks strictly within [0, 50] range", () => {
    expect(validateMarksInput(40, 45).valid).toBe(true);
    expect(validateMarksInput(0, 0).valid).toBe(true);
    expect(validateMarksInput(50, 50).valid).toBe(true);

    // Negative marks rejected
    expect(validateMarksInput(-1, 40).valid).toBe(false);
    expect(validateMarksInput(40, -5).valid).toBe(false);

    // Exceeding 50 rejected
    expect(validateMarksInput(51, 40).valid).toBe(false);
    expect(validateMarksInput(30, 55).valid).toBe(false);

    // Non-numeric input
    expect(validateMarksInput(NaN, 40).valid).toBe(false);
  });

  it("Computes total marks, percentage, and 10-point grade correctly", () => {
    // 40 + 45 = 85 (A+, 9 grade points)
    const res1 = computeSubjectMarks(40, 45);
    expect(res1.totalMarks).toBe(85);
    expect(res1.percentage).toBe(85);
    expect(res1.grade).toBe("A+");
    expect(res1.gradePoint).toBe(9);

    // 50 + 50 = 100 (O, 10 grade points)
    const res2 = computeSubjectMarks(50, 50);
    expect(res2.totalMarks).toBe(100);
    expect(res2.percentage).toBe(100);
    expect(res2.grade).toBe("O");
    expect(res2.gradePoint).toBe(10);

    // 30 + 35 = 65 (B+, 7 grade points)
    const res3 = computeSubjectMarks(30, 35);
    expect(res3.totalMarks).toBe(65);
    expect(res3.percentage).toBe(65);
    expect(res3.grade).toBe("B+");
    expect(res3.gradePoint).toBe(7);

    // Missing marks do not become zero
    const resEmpty = computeSubjectMarks(null, 40);
    expect(resEmpty.totalMarks).toBeNull();
    expect(resEmpty.grade).toBeNull();
  });

  it("Calculates SGPA correctly using weighted credit formula: Σ(GP × Credits) / Σ(Credits)", () => {
    const mockResults: StudentSubjectResult[] = [
      {
        id: "1",
        studentId: "s1",
        studentRollNo: "UST24R0102020",
        studentName: "Arpan Baidya",
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-01",
        subjectName: "Applied Mathematics I",
        subjectCode: "CS101",
        credits: 4,
        writtenMarks: 40,
        internalMarks: 45,
        totalMarks: 85,
        percentage: 85,
        grade: "A+",
        gradePoint: 9, // 9 * 4 = 36
        publicationStatus: "published",
        isDemo: false,
        updatedAt: "2026-10-25T10:00:00Z",
      },
      {
        id: "2",
        studentId: "s1",
        studentRollNo: "UST24R0102020",
        studentName: "Arpan Baidya",
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-02",
        subjectName: "Applied Chemistry I",
        subjectCode: "CS102",
        credits: 3,
        writtenMarks: 35,
        internalMarks: 40,
        totalMarks: 75,
        percentage: 75,
        grade: "A",
        gradePoint: 8, // 8 * 3 = 24
        publicationStatus: "published",
        isDemo: false,
        updatedAt: "2026-10-25T10:00:00Z",
      },
      {
        id: "3",
        studentId: "s1",
        studentRollNo: "UST24R0102020",
        studentName: "Arpan Baidya",
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-03",
        subjectName: "Applied Chemistry Lab",
        subjectCode: "CS102L",
        credits: 1,
        writtenMarks: 45,
        internalMarks: 48,
        totalMarks: 93,
        percentage: 93,
        grade: "O",
        gradePoint: 10, // 10 * 1 = 10
        publicationStatus: "published",
        isDemo: false,
        updatedAt: "2026-10-25T10:00:00Z",
      },
    ];

    // Total weighted = 36 + 24 + 10 = 70
    // Total credits = 4 + 3 + 1 = 8
    // SGPA = 70 / 8 = 8.75
    const calc = calculateSemesterSGPA(mockResults);
    expect(calc.sgpa).toBe(8.75);
    expect(calc.totalCreditsEarned).toBe(8);
  });

  it("Excludes draft marks from SGPA and CGPA calculations", () => {
    const mockResults: StudentSubjectResult[] = [
      {
        id: "1",
        studentId: "s1",
        studentRollNo: "UST24R0102020",
        studentName: "Arpan Baidya",
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-01",
        subjectName: "Applied Mathematics I",
        subjectCode: "CS101",
        credits: 4,
        writtenMarks: 40,
        internalMarks: 45,
        totalMarks: 85,
        percentage: 85,
        grade: "A+",
        gradePoint: 9,
        publicationStatus: "draft", // DRAFT: Must be excluded!
        isDemo: false,
        updatedAt: "2026-10-25T10:00:00Z",
      },
    ];

    const calc = calculateSemesterSGPA(mockResults);
    expect(calc.sgpa).toBeNull();
    expect(calc.totalCreditsEarned).toBe(0);
  });

  it("Calculates cumulative CGPA across completed semesters", () => {
    const mockResults: StudentSubjectResult[] = [
      // Sem 1: 4 credits with GP 9 (36 points)
      {
        id: "1",
        studentId: "s1",
        studentRollNo: "UST24R0102020",
        studentName: "Arpan Baidya",
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "cse-s1-01",
        subjectName: "Applied Mathematics I",
        subjectCode: "CS101",
        credits: 4,
        writtenMarks: 40,
        internalMarks: 45,
        totalMarks: 85,
        percentage: 85,
        grade: "A+",
        gradePoint: 9,
        publicationStatus: "published",
        isDemo: false,
        updatedAt: "2026-10-25T10:00:00Z",
      },
      // Sem 2: 4 credits with GP 8 (32 points)
      {
        id: "2",
        studentId: "s1",
        studentRollNo: "UST24R0102020",
        studentName: "Arpan Baidya",
        department: "Computer Engineering",
        semesterNumber: 2,
        subjectId: "cse-s2-05",
        subjectName: "Applied Physics I",
        subjectCode: "CS203",
        credits: 4,
        writtenMarks: 35,
        internalMarks: 40,
        totalMarks: 75,
        percentage: 75,
        grade: "A",
        gradePoint: 8,
        publicationStatus: "published",
        isDemo: false,
        updatedAt: "2026-10-25T10:00:00Z",
      },
    ];

    // Total points = 36 + 32 = 68
    // Total credits = 8
    // CGPA = 68 / 8 = 8.5
    const cgpaCalc = calculateCumulativeCGPA(mockResults);
    expect(cgpaCalc.cgpa).toBe(8.5);
    expect(cgpaCalc.completedSemestersCount).toBe(2);
    expect(cgpaCalc.isProvisional).toBe(true);
  });

  it("Generates clearly labeled demo results for eligible official students", () => {
    const demoRes = generateDemoResultsForOfficialStudents(1);
    expect(demoRes.length).toBeGreaterThan(0);
    expect(demoRes.every((r) => r.isDemo === true)).toBe(true);
    expect(demoRes.every((r) => (r.writtenMarks ?? 0) <= 50)).toBe(true);
    expect(demoRes.every((r) => (r.internalMarks ?? 0) <= 50)).toBe(true);
    expect(demoRes.every((r) => (r.totalMarks ?? 0) <= 100)).toBe(true);
  });

  it("Authoritative Academics CGPA map calculates weighted CGPA strictly for students with published results", () => {
    const cgpaMap = getAuthoritativeAcademicsCgpaMap();
    // Arpan Baidya must have authoritative CGPA
    expect(cgpaMap["UST24R0102020"]).toBeDefined();
    expect(typeof cgpaMap["UST24R0102020"]).toBe("number");
    expect(cgpaMap["UST24R0102020"]).toBeGreaterThanOrEqual(5.0);
    expect(cgpaMap["UST24R0102020"]).toBeLessThanOrEqual(10.0);

    // All-department coverage: AIML and Cyber security students also have authoritative CGPAs
    const aimlStudent = OFFICIAL_STUDENTS.find((s) => s.department === "Artificial Intelligence and Machine Learning");
    expect(aimlStudent).toBeDefined();
    expect(cgpaMap[aimlStudent!.roll_no]).toBeDefined();
    expect(cgpaMap[aimlStudent!.roll_no]).toBeGreaterThanOrEqual(5.0);

    const cyberStudent = OFFICIAL_STUDENTS.find((s) => s.department === "Cyber security & Forensics");
    expect(cyberStudent).toBeDefined();
    expect(cgpaMap[cyberStudent!.roll_no]).toBeDefined();
    expect(cgpaMap[cyberStudent!.roll_no]).toBeGreaterThanOrEqual(5.0);

    // Non-existent students must be undefined
    expect(cgpaMap["NONEXISTENT_ROLL_NO"]).toBeUndefined();
  });

  it("Reconciliation accurately audits all 275 students and computes departmental metrics without zero-coercion", () => {
    const report = reconcileAllStudentsCgpa();
    const cseStudents = OFFICIAL_STUDENTS.filter((s) => s.department === "Computer Engineering");
    const aimlStudents = OFFICIAL_STUDENTS.filter((s) => s.department === "Artificial Intelligence and Machine Learning");
    const cyberStudents = OFFICIAL_STUDENTS.filter((s) => s.department === "Cyber security & Forensics");

    expect(report.totalReviewed).toBe(275);
    expect(report.coveredByConfiguredCurricula).toBe(275);
    expect(report.validAcademicsCgpaCount).toBe(275); // All 275 students covered across all 3 departments
    expect(report.missingOrIncompleteCount).toBe(0);
    expect(report.unmatchedIdentifiersCount).toBe(0);
    expect(report.failedCount).toBe(0);

    // Department summaries
    const cse = report.departmentSummaries["Computer Engineering"];
    expect(cse.totalStudents).toBe(cseStudents.length);
    expect(cse.studentsWithCgpa).toBe(cseStudents.length);
    expect(cse.averageCgpa).toBeGreaterThan(7.0);

    const aiml = report.departmentSummaries["Artificial Intelligence and Machine Learning"];
    expect(aiml.totalStudents).toBe(aimlStudents.length);
    expect(aiml.studentsWithCgpa).toBe(aimlStudents.length);
    expect(aiml.averageCgpa).toBeGreaterThan(7.0);

    const cyber = report.departmentSummaries["Cyber security & Forensics"];
    expect(cyber.totalStudents).toBe(cyberStudents.length);
    expect(cyber.studentsWithCgpa).toBe(cyberStudents.length);
    expect(cyber.averageCgpa).toBeGreaterThan(7.0);
  });

  it("Draft marks never contaminate authoritative published CGPA", () => {
    const arpanPublishedBefore = getStudentPublishedAcademicResults("UST24R0102020");
    const cgpaBefore = calculateStudentCGPA(arpanPublishedBefore);

    // Create a draft with a failing score of 0
    const draftRecord: StudentSubjectResult = {
      id: "draft-test-1",
      studentId: "ust-ust24r0102020",
      studentRollNo: "UST24R0102020",
      studentName: "Arpan Baidya",
      department: "Computer Engineering",
      semesterNumber: 1,
      subjectId: "cse-s1-01",
      subjectName: "Applied Mathematics I",
      subjectCode: "CS101",
      credits: 4,
      writtenMarks: 0,
      internalMarks: 0,
      totalMarks: 0,
      percentage: 0,
      grade: "F",
      gradePoint: 0,
      publicationStatus: "draft", // DRAFT
      isDemo: false,
      updatedAt: new Date().toISOString(),
    };

    // recordPublishedAcademicResult ignores drafts
    recordPublishedAcademicResult(draftRecord);

    const arpanPublishedAfter = getStudentPublishedAcademicResults("UST24R0102020");
    const cgpaAfter = calculateStudentCGPA(arpanPublishedAfter);
    expect(cgpaAfter).toBe(cgpaBefore);
  });

  it("Missing CGPA prevents false low-CGPA academic risk factors", () => {
    // Student with missing CGPA (rawCgpa is null)
    const unscoredStudent = {
      id: "ust-test",
      roll_no: "UST24R0101001",
      name: "Abhimanyu Suraj Dubey",
      department: "Artificial Intelligence and Machine Learning",
      year: 1,
      cgpa: null,
      attendance: 85,
      lms_activity: 70,
      engagement: 75,
      placement_readiness: 80,
      skills_score: 80,
      feedback_score: null,
      backlogs: 0,
    };

    const scored = score(unscoredStudent);
    expect(scored.rawCgpa).toBeNull();
    // Must NOT trigger low CGPA risk factor for missing data!
    expect(scored.riskFactors.some((r) => r.toLowerCase().includes("cgpa"))).toBe(false);
  });

  it("getSubjectsForDepartment resolves correct curriculum subjects for all 3 departments", async () => {
    const { getSubjectsForDepartment } = await import("../lib/academics");

    const cseSem1 = getSubjectsForDepartment("Computer Engineering", 1);
    expect(cseSem1.length).toBe(8);
    expect(cseSem1[0].code).toBe("CS101");

    const aimlSem1 = getSubjectsForDepartment("Artificial Intelligence and Machine Learning", 1);
    expect(aimlSem1.length).toBe(7);
    expect(aimlSem1[0].code).toBe("AIML101");

    const csfSem1 = getSubjectsForDepartment("Cyber security & Forensics", 1);
    expect(csfSem1.length).toBe(7);
    expect(csfSem1[0].code).toBe("CSF101");

    // All semesters 1 through 5 exist for each department
    for (let sem = 1; sem <= 5; sem++) {
      expect(getSubjectsForDepartment("Computer Engineering", sem).length).toBeGreaterThan(0);
      expect(getSubjectsForDepartment("Artificial Intelligence and Machine Learning", sem).length).toBeGreaterThan(0);
      expect(getSubjectsForDepartment("Cyber security & Forensics", sem).length).toBeGreaterThan(0);
    }
  });
});
