import { describe, it, expect } from "vitest";
import { supportGroups, type StudentRow } from "./scoring";

const base: StudentRow = {
  id: "1",
  roll_no: "T1",
  name: "T",
  department: "CSE",
  year: 3,
  cgpa: 8,
  attendance: 90,
  lms_activity: 80,
  engagement: 70,
  placement_readiness: 80,
  skills_score: 80,
  feedback_score: 80,
  backlogs: 0,
};

describe("support groups", () => {
  it("both risks high → urgent", () =>
    expect(
      supportGroups({
        ...base,
        cgpa: 4,
        attendance: 50,
        placement_readiness: 20,
        skills_score: 20,
        feedback_score: 20,
      }),
    ).toContain("Urgent support"));

  it("CGPA 7+, attendance under 75 → poor attendance", () =>
    expect(supportGroups({ ...base, cgpa: 7, attendance: 74 })).toContain(
      "Good academics, poor attendance",
    ));

  it("attendance 75 is not poor", () =>
    expect(supportGroups({ ...base, attendance: 75 })).not.toContain(
      "Good academics, poor attendance",
    ));

  it("strong academics, placement under 60", () =>
    expect(
      supportGroups({ ...base, placement_readiness: 40, skills_score: 40, feedback_score: 50 }),
    ).toContain("Strong academics, low placement"));

  it("both risks low → placement-ready", () =>
    expect(supportGroups(base)).toContain("Placement-ready, low risk"));

  it("zero LMS and engagement are valid (poor performance, not missing data)", () =>
    // Zero is valid performance — should NOT trigger "Insufficient data"
    expect(supportGroups({ ...base, lms_activity: 0, engagement: 0 })).not.toContain(
      "Insufficient data",
    ));

  it("two NULL indicators → only insufficient data", () =>
    // null/undefined is truly missing
    expect(supportGroups({ ...base, lms_activity: null as any, engagement: null as any })).toEqual([
      "Insufficient data",
    ]));

  it("one null indicator still classified normally", () =>
    expect(supportGroups({ ...base, engagement: null as any })).not.toContain("Insufficient data"));
});
