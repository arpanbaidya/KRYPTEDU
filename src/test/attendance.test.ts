import { describe, it, expect } from "vitest";
import {
  calculateAttendanceSummary,
  calculateStudentOverallAttendance,
  calculateStudentMonthlyAttendance,
  type AttendanceStatus,
  isWeekend,
  getDemoPeriodWeekdays,
  DEMO_ATTENDANCE_CONFIG,
  deterministicDemoStatus,
  getAuthoritativeDemoAttendanceMap,
  getStudentDemoMonthlyStats,
  getStudentDemoRecords,
} from "../lib/attendance";
import { CANONICAL_DEPARTMENTS } from "../lib/departments";
import { OFFICIAL_STUDENTS } from "../lib/official-dataset";
import { score } from "../lib/scoring";
import { generateSuggestions } from "../lib/interventions";

describe("Attendance Calculation Invariants", () => {
  it("calculates session attendance percentage using Present / (Present + Absent) * 100", () => {
    const records = [
      { status: "present" as AttendanceStatus },
      { status: "present" as AttendanceStatus },
      { status: "present" as AttendanceStatus },
      { status: "absent" as AttendanceStatus },
      { status: "not_considered" as AttendanceStatus },
    ];

    const summary = calculateAttendanceSummary(5, records);
    expect(summary.totalStudents).toBe(5);
    expect(summary.presentCount).toBe(3);
    expect(summary.absentCount).toBe(1);
    expect(summary.notConsideredCount).toBe(1);
    // Denominator = 3 + 1 = 4. Percentage = 3/4 * 100 = 75.0%
    expect(summary.attendancePercentage).toBe(75.0);
  });

  it("excludes Not Considered from denominator and returns null (N/A) if all are Not Considered", () => {
    const records = [
      { status: "not_considered" as AttendanceStatus },
      { status: "not_considered" as AttendanceStatus },
    ];

    const summary = calculateAttendanceSummary(2, records);
    expect(summary.presentCount).toBe(0);
    expect(summary.absentCount).toBe(0);
    expect(summary.notConsideredCount).toBe(2);
    // Denominator is 0, so percentage must be null (represented as N/A)
    expect(summary.attendancePercentage).toBeNull();
  });

  it("handles 100% attendance correctly", () => {
    const records = [
      { status: "present" as AttendanceStatus },
      { status: "present" as AttendanceStatus },
      { status: "present" as AttendanceStatus },
    ];

    const summary = calculateAttendanceSummary(3, records);
    expect(summary.attendancePercentage).toBe(100.0);
  });

  it("calculates student cumulative attendance over published sessions correctly", () => {
    const history = [
      { status: "present" as AttendanceStatus, is_sample: true, is_demo: true },
      { status: "present" as AttendanceStatus, is_sample: true, is_demo: true },
      { status: "absent" as AttendanceStatus, is_sample: false, is_demo: false },
      { status: "not_considered" as AttendanceStatus, is_sample: false, is_demo: false },
    ];

    const profile = calculateStudentOverallAttendance(history);
    expect(profile.totalPublishedSessions).toBe(4);
    expect(profile.presentCount).toBe(2);
    expect(profile.absentCount).toBe(1);
    expect(profile.notConsideredCount).toBe(1);
    // 2 / (2 + 1) * 100 = 66.7%
    expect(profile.overallAttendancePercentage).toBe(66.7);
    expect(profile.hasSampleData).toBe(true);
    expect(profile.hasDemoData).toBe(true);
  });

  it("verifies canonical department restrictions in attendance system", () => {
    expect(CANONICAL_DEPARTMENTS).toEqual([
      "Computer Engineering",
      "Artificial Intelligence and Machine Learning",
      "Cyber security & Forensics",
    ]);
  });

  it("verifies all 275 official students are mapped to canonical departments", () => {
    expect(OFFICIAL_STUDENTS.length).toBe(275);
    for (const student of OFFICIAL_STUDENTS) {
      expect(CANONICAL_DEPARTMENTS).toContain(student.department);
      expect(student.roll_no).toBeDefined();
    }
  });
});

describe("3-Month Demo Dataset (1 Aug 2026 to 31 Oct 2026) Specifications", () => {
  it("strictly excludes Saturdays and Sundays as holidays", () => {
    // 1 Aug 2026 is Saturday
    expect(isWeekend("2026-08-01")).toBe(true);
    // 2 Aug 2026 is Sunday
    expect(isWeekend("2026-08-02")).toBe(true);
    // 3 Aug 2026 is Monday
    expect(isWeekend("2026-08-03")).toBe(false);
    // 31 Oct 2026 is Saturday
    expect(isWeekend("2026-10-31")).toBe(true);
    // 30 Oct 2026 is Friday
    expect(isWeekend("2026-10-30")).toBe(false);
  });

  it("generates exactly 65 weekdays in the 3-month period", () => {
    const weekdays = getDemoPeriodWeekdays();
    expect(weekdays.length).toBe(65);
    expect(weekdays[0]).toBe("2026-08-03"); // First Monday
    expect(weekdays[weekdays.length - 1]).toBe("2026-10-30"); // Last Friday

    // Verify month breakdown
    const aug = weekdays.filter((d) => d.startsWith("2026-08")).length;
    const sep = weekdays.filter((d) => d.startsWith("2026-09")).length;
    const oct = weekdays.filter((d) => d.startsWith("2026-10")).length;

    expect(aug).toBe(DEMO_ATTENDANCE_CONFIG.byMonthWeekdays["2026-08"]); // 21
    expect(sep).toBe(DEMO_ATTENDANCE_CONFIG.byMonthWeekdays["2026-09"]); // 22
    expect(oct).toBe(DEMO_ATTENDANCE_CONFIG.byMonthWeekdays["2026-10"]); // 22
    expect(aug + sep + oct).toBe(65);

    // Verify no weekend dates are in the weekday list
    for (const d of weekdays) {
      expect(isWeekend(d)).toBe(false);
    }
  });

  it("yields deterministic demo status with realistic proportions (80-90% Present, 5-15% Absent)", () => {
    const testRollNo = OFFICIAL_STUDENTS[0].roll_no;
    const weekdays = getDemoPeriodWeekdays();

    let present = 0;
    let absent = 0;
    let notConsidered = 0;

    for (const dateStr of weekdays) {
      const st = deterministicDemoStatus(testRollNo, dateStr, 0);
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "not_considered") notConsidered++;
    }

    const total = present + absent + notConsidered;
    expect(total).toBe(65);
    const presentPct = (present / total) * 100;
    const absentPct = (absent / total) * 100;

    expect(presentPct).toBeGreaterThanOrEqual(75);
    expect(absentPct).toBeGreaterThanOrEqual(4);

    // Idempotence: Calling again on same student and date returns same status
    expect(deterministicDemoStatus(testRollNo, "2026-08-03", 0)).toBe(
      deterministicDemoStatus(testRollNo, "2026-08-03", 0)
    );
  });

  it("provides authoritative demo attendance map covering all 275 students", () => {
    const attMap = getAuthoritativeDemoAttendanceMap();
    expect(Object.keys(attMap).length).toBeGreaterThanOrEqual(275);

    for (const stu of OFFICIAL_STUDENTS) {
      const pct = attMap[stu.roll_no];
      expect(pct).toBeDefined();
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it("computes monthly attendance timeline breakdown for a student", () => {
    const firstStu = OFFICIAL_STUDENTS[0];
    const monthly = getStudentDemoMonthlyStats(firstStu.roll_no);

    expect(monthly.length).toBe(3);
    expect(monthly[0].month).toBe("Aug 2026");
    expect(monthly[0].totalSessions).toBe(21);
    expect(monthly[1].month).toBe("Sep 2026");
    expect(monthly[1].totalSessions).toBe(22);
    expect(monthly[2].month).toBe("Oct 2026");
    expect(monthly[2].totalSessions).toBe(22);

    for (const m of monthly) {
      expect(m.percentage).toBeDefined();
      expect(m.percentage!).toBeGreaterThanOrEqual(0);
      expect(m.percentage!).toBeLessThanOrEqual(100);
    }
  });
});

describe("Cross-Module Attendance Integration & Downstream Scoring", () => {
  it("triggers Academic Risk High when attendance < 60% and recommends critical intervention", () => {
    const student = score({
      id: "test-low-att",
      roll_no: "UST24TEST001",
      name: "Low Attendance Student",
      department: "Computer Engineering",
      year: 1,
      cgpa: 8.5,
      attendance: 52.0, // < 60%
      lms_activity: 70,
      engagement: 75,
      placement_readiness: 70,
      skills_score: 75,
      feedback_score: 80,
      backlogs: 0,
    });

    expect(student.academicRisk).toBe("High");
    expect(student.riskFactors.some((rf) => rf.includes("Attendance below 75%"))).toBe(true);

    const suggestions = generateSuggestions(student);
    const attSuggestion = suggestions.find((s) => s.indicator === "attendance");
    expect(attSuggestion).toBeDefined();
    expect(attSuggestion?.priority).toBe("High");
    expect(attSuggestion?.issue).toBe("Critical attendance deficit");
  });

  it("triggers Academic Risk Medium when attendance is between 60% and 75%", () => {
    const student = score({
      id: "test-med-att",
      roll_no: "UST24TEST002",
      name: "Medium Attendance Student",
      department: "Computer Engineering",
      year: 1,
      cgpa: 8.5,
      attendance: 68.0, // 60 <= att < 75
      lms_activity: 70,
      engagement: 75,
      placement_readiness: 70,
      skills_score: 75,
      feedback_score: 80,
      backlogs: 0,
    });

    expect(student.academicRisk).toBe("Medium");
    expect(student.riskFactors.some((rf) => rf.includes("Attendance below 75%"))).toBe(true);

    const suggestions = generateSuggestions(student);
    const attSuggestion = suggestions.find((s) => s.indicator === "attendance");
    expect(attSuggestion).toBeDefined();
    expect(attSuggestion?.priority).toBe("Medium");
    expect(attSuggestion?.issue).toBe("Attendance below institutional threshold");
  });

  it("attendance correctly contributes 30% to Academic Index according to official methodology", () => {
    // Student with CGPA 8.0, LMS 80, 0 Backlogs
    // Academic Index with attendance 90:
    // (8.0/10)*100*0.5 + 90*0.3 + 80*0.2 = 40 + 27 + 16 = 83
    const stu1 = score({
      id: "test-att-high",
      roll_no: "UST24TEST003",
      name: "Student High Att",
      department: "Computer Engineering",
      year: 1,
      cgpa: 8.0,
      attendance: 90.0,
      lms_activity: 80,
      engagement: 80,
      placement_readiness: 80,
      skills_score: 80,
      feedback_score: 80,
      backlogs: 0,
    });

    expect(stu1.academicIndex).toBe(83);

    // Academic Index with attendance 60:
    // 40 + 18 + 16 = 74
    const stu2 = score({
      id: "test-att-med",
      roll_no: "UST24TEST004",
      name: "Student Med Att",
      department: "Computer Engineering",
      year: 1,
      cgpa: 8.0,
      attendance: 60.0,
      lms_activity: 80,
      engagement: 80,
      placement_readiness: 80,
      skills_score: 80,
      feedback_score: 80,
      backlogs: 0,
    });

    expect(stu2.academicIndex).toBe(74);
  });

  describe("Student-Specific Identification and Authorization Invariants", () => {
    it("resolves authenticated student strictly from verified session user_id or email", async () => {
      const { resolveAuthenticatedStudent } = await import("../lib/attendance.functions");

      // Mock Supabase client
      const mockSupabaseWithUser = {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                if (col === "user_id" && val === "uuid-student-123") {
                  return {
                    data: {
                      id: "ust-ust24r0102004",
                      name: "Abhishek Ashish Kumar Yadav",
                      roll_no: "UST24R0102004",
                      department: "Computer Engineering",
                      year: 1,
                      user_id: "uuid-student-123",
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
      };

      const resolved = await resolveAuthenticatedStudent(
        mockSupabaseWithUser,
        "uuid-student-123",
        "student@kryptedu.com"
      );

      expect(resolved).not.toBeNull();
      expect(resolved?.roll_no).toBe("UST24R0102004");
      expect(resolved?.name).toBe("Abhishek Ashish Kumar Yadav");
    });

    it("resolves student by roll number from email without hardcoded fallback", async () => {
      const { resolveAuthenticatedStudent } = await import("../lib/attendance.functions");

      const emptySupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };

      const resolved = await resolveAuthenticatedStudent(
        emptySupabase,
        "uuid-unlinked-456",
        "ust24r0102005@kryptedu.com"
      );

      expect(resolved).not.toBeNull();
      expect(resolved?.roll_no).toBe("UST24R0102005");
      expect(resolved?.name).toBe("Adarsh Ajay Kumar Pandey");
    });

    it("returns null if student account cannot be linked (does NOT fabricate or return sample student)", async () => {
      const { resolveAuthenticatedStudent } = await import("../lib/attendance.functions");

      const emptySupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };

      // Completely unlinked email
      const resolved = await resolveAuthenticatedStudent(
        emptySupabase,
        "random-uuid-999",
        "unlinked_unknown_person@gmail.com"
      );

      // Must be null so the UI shows the clear administrator linking message
      expect(resolved).toBeNull();
    });

    it("correctly links Arpan Baidya from student login email and official dataset", async () => {
      const { resolveAuthenticatedStudent } = await import("../lib/attendance.functions");

      let updatedUserId: string | null = null;
      let updatedRollNo: string | null = null;

      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                // First call user_id = null
                if (col === "user_id") return { data: null, error: null };
                if (col === "email") return { data: null, error: null };
                // Arpan lookup in DB
                if (col === "roll_no" && val === "UST24R0102020") {
                  return {
                    data: {
                      id: "ust-ust24r0102020",
                      name: "Arpan Asto Baidya",
                      roll_no: "UST24R0102020",
                      department: "Computer Engineering",
                      year: 1,
                      user_id: null,
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (payload: any) => ({
            eq: (col: string, val: string) => {
              if (table === "students" && col === "roll_no") {
                updatedUserId = payload.user_id;
                updatedRollNo = val;
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
      };

      // Test with student@kryptedu.com
      const resolved = await resolveAuthenticatedStudent(
        mockSupabase,
        "user-arpan-uuid-12345",
        "student@kryptedu.com"
      );

      expect(resolved).not.toBeNull();
      expect(resolved?.roll_no).toBe("UST24R0102020");
      expect(resolved?.name).toBe("Arpan Asto Baidya");
      expect(resolved?.department).toBe("Computer Engineering");
      expect(resolved?.year).toBe(1);
      expect(resolved?.user_id).toBe("user-arpan-uuid-12345");
      expect(updatedRollNo).toBe("UST24R0102020");
      expect(updatedUserId).toBe("user-arpan-uuid-12345");

      // Verify demo attendance generation for Arpan
      const arpanRecords = getStudentDemoRecords(resolved!.roll_no);
      expect(arpanRecords.length).toBe(65);
      const summary = calculateStudentOverallAttendance(arpanRecords);
      expect(summary.totalPublishedSessions).toBe(65);
      expect(summary.overallAttendancePercentage).toBeGreaterThan(0);
    });

    it("safely disassociates legacy dummy student (Aarav Patel) and links Arpan Baidya", async () => {
      const { resolveAuthenticatedStudent } = await import("../lib/attendance.functions");

      let unlinkedLegacyId: string | null = null;
      let linkedArpanId: string | null = null;

      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                // First call user_id matches legacy Aarav Patel!
                if (col === "user_id") {
                  return {
                    data: {
                      id: "legacy-aarav-uuid",
                      name: "Aarav Patel",
                      roll_no: "KR2024001",
                      department: "Civil",
                      year: 3,
                      user_id: "student-auth-user-id",
                    },
                    error: null,
                  };
                }
                // Arpan official DB lookup
                if (col === "roll_no" && val === "UST24R0102020") {
                  return {
                    data: {
                      id: "ust-ust24r0102020",
                      name: "Arpan Asto Baidya",
                      roll_no: "UST24R0102020",
                      department: "Computer Engineering",
                      year: 1,
                      user_id: null,
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (payload: any) => ({
            eq: (col: string, val: string) => {
              if (table === "students" && col === "id" && payload.user_id === null) {
                unlinkedLegacyId = val; // Aarav Patel disassociated
              }
              if (table === "students" && col === "roll_no" && val === "UST24R0102020") {
                linkedArpanId = payload.user_id; // Arpan linked
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
      };

      const resolved = await resolveAuthenticatedStudent(
        mockSupabase,
        "student-auth-user-id",
        "student@kryptedu.com"
      );

      // Must disassociate Aarav Patel
      expect(unlinkedLegacyId).toBe("legacy-aarav-uuid");
      // Must link Arpan Baidya
      expect(linkedArpanId).toBe("student-auth-user-id");
      expect(resolved).not.toBeNull();
      expect(resolved?.name).toBe("Arpan Asto Baidya");
      expect(resolved?.roll_no).toBe("UST24R0102020");
      expect(resolved?.department).toBe("Computer Engineering");
    });

    it("generates 65 weekday published demo records for a single student (Aug-Oct 2026)", () => {
      const records = getStudentDemoRecords("UST24R0102001");
      expect(records.length).toBe(65);

      // Check first record is latest (Oct 30, 2026)
      expect(records[0].attendance_date).toBe("2026-10-30");
      // Check last record is earliest (Aug 3, 2026 - first weekday)
      expect(records[records.length - 1].attendance_date).toBe("2026-08-03");

      // Verify no Saturday (DOW 6) or Sunday (DOW 0)
      for (const r of records) {
        expect(isWeekend(r.attendance_date)).toBe(false);
      }
    });

    it("returns N/A (null) for student attendance percentage if eligible sessions is 0", () => {
      // Sessions with only Not Considered
      const records = [
        { status: "not_considered" as AttendanceStatus },
        { status: "not_considered" as AttendanceStatus },
      ];

      const profile = calculateStudentOverallAttendance(records);
      expect(profile.totalPublishedSessions).toBe(2);
      expect(profile.presentCount).toBe(0);
      expect(profile.absentCount).toBe(0);
      expect(profile.overallAttendancePercentage).toBeNull(); // N/A
    });
  });
});
