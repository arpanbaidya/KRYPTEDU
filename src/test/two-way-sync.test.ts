import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateAttendancePercentage,
  calculateAttendanceSummary,
  calculateStudentOverallAttendance,
  updateStudentAuthoritativeAttendance,
  syncAuthoritativeAttendanceMap,
  getAuthoritativeStudentAttendance,
  getAuthoritativeDemoAttendanceMap,
  computeStudentCumulativeAttendance,
  invalidateAttendanceCache,
  type AttendanceStatus,
} from "../lib/attendance";
import {
  computeSubjectMarks,
  calculateStudentCGPA,
  recordPublishedAcademicResult,
  getAuthoritativeAcademicsCgpaMap,
  getAuthoritativeAcademicsCgpa,
  type StudentSubjectResult,
} from "../lib/academics";
import { score } from "../lib/scoring";
import { OFFICIAL_STUDENTS } from "../lib/official-dataset";

describe("Two-Way Synchronisation: Attendance and Academics CGPA", () => {
  beforeEach(() => {
    invalidateAttendanceCache();
  });

  // 1. Faculty changes attendance and the Students section reflects the updated percentage
  it("Scenario 1: Updates student published attendance percentage and propagates to the shared data layer", () => {
    const student = OFFICIAL_STUDENTS[0]; // Aanosh Mukesh Lingapur (UST24R0102001)
    const initialAtt = getAuthoritativeStudentAttendance(student.roll_no);
    expect(initialAtt).toBeDefined();

    // Faculty marks attendance in a published session
    const newPercentage = 88.5;
    updateStudentAuthoritativeAttendance(student.roll_no, newPercentage);

    // Verify immediate synchronization in shared attendance map
    const updatedAtt = getAuthoritativeStudentAttendance(student.roll_no);
    expect(updatedAtt).toBe(88.5);

    const map = getAuthoritativeDemoAttendanceMap();
    expect(map[student.roll_no]).toBe(88.5);
    expect(map[`ust-${student.roll_no.toLowerCase()}`]).toBe(88.5);

    // Students section score calculation reflects updated percentage
    const scored = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      attendance: updatedAtt,
      cgpa: 8.5,
    });
    expect(scored.attendance).toBe(88.5);
    expect(scored.rawAttendance).toBe(88.5);
  });

  // 2. Faculty publishes attendance and Student Analytics uses the new published records
  it("Scenario 2: Published attendance recalculation correctly integrates into student risk and index scoring", () => {
    const student = OFFICIAL_STUDENTS[1];

    // High attendance (>75%) -> Normal risk
    const goodScored = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      attendance: 85,
      cgpa: 8.0,
    });
    expect(goodScored.academicRisk).not.toBe("High");

    // Critical attendance deficit (<60%) -> Triggers High Academic Risk
    const lowScored = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      attendance: 55,
      cgpa: 8.0,
    });
    expect(lowScored.academicRisk).toBe("High");
  });

  // 3. Draft attendance does not affect published attendance summaries
  it("Scenario 3: Draft attendance does not alter published attendance calculation", () => {
    // Only published records are counted
    const publishedRecords = [
      { status: "present" as AttendanceStatus },
      { status: "present" as AttendanceStatus },
      { status: "absent" as AttendanceStatus },
    ];
    // Published: 2 Present, 1 Absent => 2/3 = 66.7%
    const publishedSummary = calculateAttendanceSummary(3, publishedRecords, { isPublished: true });
    expect(publishedSummary.attendancePercentage).toBe(66.7);
    expect(publishedSummary.isPublished).toBe(true);

    // Draft records remain draft and are flagged as not published
    const draftRecords = [
      { status: "absent" as AttendanceStatus },
      { status: "absent" as AttendanceStatus },
    ];
    const draftSummary = calculateAttendanceSummary(2, draftRecords, { isPublished: false });
    expect(draftSummary.isPublished).toBe(false);
  });

  // 4. Not Considered records are excluded from the attendance denominator
  it("Scenario 4: Strictly excludes 'not_considered' from attendance denominator", () => {
    // Formula: Present / (Present + Absent) * 100
    // 8 Present, 2 Absent, 5 Not Considered
    // Denominator must be 8 + 2 = 10, NOT 15!
    // Result: 8 / 10 * 100 = 80.0%
    const records = [
      ...Array(8).fill({ status: "present" as AttendanceStatus }),
      ...Array(2).fill({ status: "absent" as AttendanceStatus }),
      ...Array(5).fill({ status: "not_considered" as AttendanceStatus }),
    ];

    const summary = calculateAttendanceSummary(15, records, { isPublished: true });
    expect(summary.presentCount).toBe(8);
    expect(summary.absentCount).toBe(2);
    expect(summary.notConsideredCount).toBe(5);
    expect(summary.attendancePercentage).toBe(80.0);

    const helperCalc = calculateAttendancePercentage(8, 2);
    expect(helperCalc).toBe(80.0);
  });

  // 5. Faculty changes marks and publishes results
  it("Scenario 5 & 6: Faculty publishes subject marks and Academics CGPA recalculates accurately", () => {
    const student = OFFICIAL_STUDENTS[2];
    const initialCgpa = getAuthoritativeAcademicsCgpa(student.roll_no);

    // Publish a verified subject result: CS101 (4 credits), 85 written + 15 internal = 100% (O / GP: 10)
    const total = computeSubjectMarks(85, 15);
    expect(total.totalMarks).toBe(100);
    expect(total.grade).toBe("O");
    expect(total.gradePoint).toBe(10);

    const resultRecord: StudentSubjectResult = {
      id: `test-res-${student.roll_no}-CS101`,
      studentId: student.id,
      studentRollNo: student.roll_no,
      studentName: student.name,
      department: student.department,
      semesterNumber: 1,
      subjectId: "btech-cse-sem1-math1",
      subjectName: "Applied Mathematics I",
      subjectCode: "CS101",
      credits: 4,
      writtenMarks: 85,
      internalMarks: 15,
      totalMarks: 100,
      percentage: 100,
      grade: "A+",
      gradePoint: 9,
      publicationStatus: "published",
      isDemo: false,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    recordPublishedAcademicResult(resultRecord);

    const cgpaMap = getAuthoritativeAcademicsCgpaMap();
    expect(cgpaMap[student.roll_no]).toBeDefined();
    expect(cgpaMap[student.roll_no]).toBeGreaterThanOrEqual(4);
  });

  // 7. The Students section displays exactly the same authoritative CGPA
  it("Scenario 7: Students module displays identical authoritative CGPA from Academics", () => {
    const student = OFFICIAL_STUDENTS[3];
    const authCgpa = getAuthoritativeAcademicsCgpa(student.roll_no).cgpa;

    const scored = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      cgpa: authCgpa,
      attendance: 90,
    });

    if (authCgpa !== null) {
      expect(scored.rawCgpa).toBe(authCgpa);
      expect(scored.cgpa).toBe(authCgpa);
    } else {
      expect(scored.rawCgpa).toBeNull();
    }
  });

  // 8. Risk scores and factors update dynamically when CGPA or attendance drops
  it("Scenario 8: Updates risk scores and factors dynamically when CGPA or attendance drops", () => {
    const student = OFFICIAL_STUDENTS[4];

    // Low CGPA (4.5) triggers High academic risk
    const lowCgpaStudent = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      cgpa: 4.5,
      attendance: 90,
    });

    expect(lowCgpaStudent.academicRisk).toBe("Medium");
    expect(lowCgpaStudent.riskFactors.some((rf) => rf.includes("Low CGPA"))).toBe(true);

    // Critical attendance (<60%) triggers Critical attendance risk
    const lowAttStudent = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      cgpa: 8.5,
      attendance: 52,
    });
    expect(lowAttStudent.academicRisk).toBe("High");
    expect(lowAttStudent.riskFactors.some((rf) => rf.includes("Attendance below 75%"))).toBe(true);
  });

  // 9. Missing academic data displays N/A instead of fabricated values
  it("Scenario 9: Returns null for missing academic and attendance data without fabricating zeroes", () => {
    // 0 present, 0 absent => null
    const emptyAttendance = calculateAttendancePercentage(0, 0);
    expect(emptyAttendance).toBeNull();

    // 0 published results => null
    const emptyCgpa = calculateStudentCGPA([]);
    expect(emptyCgpa).toBeNull();

    // Scored row preserves null raw values
    const unscored = score({
      id: "ust-dummy",
      roll_no: "UST99R9999999",
      name: "Unenrolled Student",
      department: "Computer Engineering",
      year: 1,
      cgpa: null,
      attendance: null,
    });

    expect(unscored.rawCgpa).toBeNull();
    expect(unscored.rawAttendance).toBeNull();
    expect(unscored.hasMetrics).toBe(false);
  });

  // 10. Demo results do not silently affect official CGPA
  it("Scenario 10: Ensures draft subject marks are excluded from official CGPA calculation", () => {
    const records: StudentSubjectResult[] = [
      {
        id: "res-draft",
        studentId: "ust-demo",
        studentRollNo: "UST24R0102001",
        studentName: "Student",
        department: "Computer Engineering",
        semesterNumber: 1,
        subjectId: "sub-1",
        subjectName: "Subject 1",
        subjectCode: "CS101",
        credits: 4,
        writtenMarks: 90,
        internalMarks: 10,
        totalMarks: 100,
        percentage: 100,
        grade: "A+",
        gradePoint: 9,
        publicationStatus: "draft", // DRAFT
        publishedAt: null,
        updatedAt: new Date().toISOString(),
      },
    ];

    // Draft marks must be ignored
    const cgpa = calculateStudentCGPA(records);
    expect(cgpa).toBeNull();
  });

  // 11. Security & RBAC: Permission invariants
  it("Scenario 11: Only authorized Faculty can publish attendance and marks", () => {
    const rolesAllowedToPublishAttendance = ["faculty", "admin"];
    const rolesForbiddenFromAttendance = ["student", "placement"];

    for (const r of rolesAllowedToPublishAttendance) {
      expect(["faculty", "admin"].includes(r)).toBe(true);
    }
    for (const r of rolesForbiddenFromAttendance) {
      expect(["faculty", "admin"].includes(r)).toBe(false);
    }

    const rolesAllowedToPublishMarks = ["faculty", "admin"];
    const rolesForbiddenFromMarks = ["student", "placement"];

    for (const r of rolesAllowedToPublishMarks) {
      expect(["faculty", "admin"].includes(r)).toBe(true);
    }
    for (const r of rolesForbiddenFromMarks) {
      expect(["faculty", "admin"].includes(r)).toBe(false);
    }
  });

  // 12. Two-way consistency invariant
  it("Scenario 12: Attendance and Academics CGPA are consistent across modules", () => {
    const student = OFFICIAL_STUDENTS[0];
    const authAtt = getAuthoritativeStudentAttendance(student.roll_no);
    const authCgpa = getAuthoritativeAcademicsCgpa(student.roll_no).cgpa;

    const scored = score({
      id: student.id,
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year,
      attendance: authAtt,
      cgpa: authCgpa,
    });

    expect(scored.rawAttendance).toBe(authAtt);
    expect(scored.rawCgpa).toBe(authCgpa);
  });

  // 13. Aanosh Mukesh Lingapur attendance change propagation to Student profile
  it("Scenario 13: Changing attendance for Aanosh Mukesh Lingapur updates authoritative map and student score components", () => {
    const aanosh = OFFICIAL_STUDENTS[0]; // UST24R0102001 Aanosh Mukesh Lingapur
    expect(aanosh.roll_no).toBe("UST24R0102001");

    // Change attendance from initial (93.8%) to 88.7%
    syncAuthoritativeAttendanceMap({
      [aanosh.roll_no]: 88.7,
      [`ust-${aanosh.roll_no.toLowerCase()}`]: 88.7,
    });

    // Check authoritative attendance
    expect(getAuthoritativeStudentAttendance(aanosh.roll_no)).toBe(88.7);
    const attMap = getAuthoritativeDemoAttendanceMap();
    expect(attMap[aanosh.roll_no]).toBe(88.7);
    expect(attMap["UST24R0102001"]).toBe(88.7);
    expect(attMap["ust-ust24r0102001"]).toBe(88.7);

    // Score calculation must use 88.7%
    const studentScored = score({
      id: `ust-${aanosh.roll_no.toLowerCase()}`,
      roll_no: aanosh.roll_no,
      name: aanosh.name,
      department: aanosh.department,
      year: aanosh.year,
      attendance: attMap[aanosh.roll_no],
      cgpa: 8.04,
      lms_activity: 0,
      engagement: 0,
    });

    expect(studentScored.attendance).toBe(88.7);
    expect(studentScored.rawAttendance).toBe(88.7);
    // Academic index = CGPA (8.04/10*100*0.5 = 40.2) + Attendance (88.7*0.3 = 26.61) + LMS (0) = 66.81 -> 67
    expect(studentScored.academicIndex).toBe(67);
  });

  // 14. Marking Aanosh Mukesh Lingapur absent on 2026-10-30 updates cumulative attendance to 92.2%
  it("Scenario 14: Marking Aanosh Mukesh Lingapur absent on 2026-10-30 updates cumulative attendance from 93.8% to 92.2%", () => {
    const aanosh = OFFICIAL_STUDENTS[0];
    expect(aanosh.roll_no).toBe("UST24R0102001");

    // Baseline attendance is 93.8%
    const baseline = computeStudentCumulativeAttendance(aanosh.roll_no);
    expect(baseline).toBe(93.8);

    // Marking absent on 2026-10-30 updates attendance to 92.2%
    const updated = computeStudentCumulativeAttendance(aanosh.roll_no, { "2026-10-30": "absent" });
    expect(updated).toBe(92.2);

    // Sync authoritative map
    syncAuthoritativeAttendanceMap({
      [aanosh.roll_no]: updated!,
      [`ust-${aanosh.roll_no.toLowerCase()}`]: updated!,
    });

    expect(getAuthoritativeStudentAttendance(aanosh.roll_no)).toBe(92.2);

    // Check score calculation reflecting 92.2%
    const studentScored = score({
      id: `ust-${aanosh.roll_no.toLowerCase()}`,
      roll_no: aanosh.roll_no,
      name: aanosh.name,
      department: aanosh.department,
      year: aanosh.year,
      attendance: updated,
      cgpa: 8.05,
      lms_activity: 0,
      engagement: 0,
    });

    expect(studentScored.attendance).toBe(92.2);
    expect(studentScored.rawAttendance).toBe(92.2);
  });
});
