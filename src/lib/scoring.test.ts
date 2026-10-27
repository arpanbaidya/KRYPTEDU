import { describe, it, expect } from "vitest";
import {
  score,
  dataCompleteness,
  academicIndex,
  placementIndex,
  successScore,
  SCORING_CONFIG,
  type StudentRow,
} from "./scoring";

const base: StudentRow = {
  id: "1",
  roll_no: "R1",
  name: "A",
  department: "CS",
  year: 2,
  cgpa: 8,
  attendance: 80,
  lms_activity: 70,
  engagement: 60,
  placement_readiness: 70,
  skills_score: 60,
  feedback_score: 80,
  backlogs: 0,
};

describe("scoring", () => {
  it("computes academic index from weighted CGPA, attendance, LMS", () => {
    // CGPA 8/10 → 80% × 0.50 = 40; Attendance 80 × 0.30 = 24; LMS 70 × 0.20 = 14 → 78
    expect(academicIndex(base)).toBe(78);
  });

  it("computes placement index from readiness, skills, feedback", () => {
    // readiness 70 × 0.50 = 35; skills 60 × 0.30 = 18; feedback 80 × 0.20 = 16 → 69
    expect(placementIndex(base)).toBe(69);
  });

  it("computes success score from academic, placement, engagement", () => {
    // 78 × 0.45 + 69 × 0.35 + 60 × 0.20 = 35.1 + 24.15 + 12 = 71.25 → 71
    const s = score(base);
    expect(s.successScore).toBe(71);
  });

  it("flags high academic risk with 2+ backlogs", () => {
    expect(score({ ...base, backlogs: 2 }).academicRisk).toBe("High");
  });

  it("flags high placement risk when placement index < 45", () => {
    expect(
      score({ ...base, placement_readiness: 20, skills_score: 20, feedback_score: 40 })
        .placementRisk,
    ).toBe("High");
  });

  it("assigns segment", () => {
    expect(score(base).segment).toBe("High Academic / High Placement");
  });

  // Missing-data handling
  it("null/undefined/NaN fields produce valid numbers, not NaN", () => {
    const s = score({
      ...base,
      cgpa: undefined as any,
      attendance: null as any,
      lms_activity: NaN,
    });
    expect(Number.isNaN(s.academicIndex)).toBe(false);
    expect(s.academicIndex).toBe(0);
  });

  // Zero is valid performance, not missing
  it("zero value is treated as poor performance, NOT missing data", () => {
    const comp = dataCompleteness({ ...base, cgpa: 0, attendance: 0 });
    expect(comp.missing).not.toContain("cgpa");
    expect(comp.missing).not.toContain("attendance");
    expect(comp.filled).toBe(comp.total);
  });

  // Null is missing
  it("null value IS missing data", () => {
    const comp = dataCompleteness({ ...base, cgpa: null as any, attendance: null as any });
    expect(comp.missing).toContain("cgpa");
    expect(comp.missing).toContain("attendance");
    expect(comp.filled).toBe(comp.total - 2);
    expect(comp.quality).toBe("Low confidence");
  });

  it("All-zero student: score should be 0", () => {
    const s = score({
      ...base,
      cgpa: 0,
      attendance: 0,
      lms_activity: 0,
      engagement: 0,
      placement_readiness: 0,
      skills_score: 0,
      feedback_score: 0,
      backlogs: 0,
    });
    expect(s.successScore).toBe(0);
  });

  it("Boundary values: attendance at exactly 60 is not High risk (≥60 is the threshold)", () => {
    expect(score({ ...base, attendance: 60, cgpa: 10, lms_activity: 100 }).academicRisk).not.toBe(
      "High",
    );
    expect(score({ ...base, attendance: 59, cgpa: 10, lms_activity: 100 }).academicRisk).toBe(
      "High",
    );
  });

  it("Boundary values: attendance at 75 is not Medium risk", () => {
    expect(score({ ...base, attendance: 75, cgpa: 10, lms_activity: 100 }).academicRisk).toBe(
      "Low",
    );
    expect(score({ ...base, attendance: 74, cgpa: 10, lms_activity: 100 }).academicRisk).toBe(
      "Medium",
    );
  });

  it("Backlogs: 1 backlog with high index is Low risk; 2 backlogs is always High", () => {
    expect(
      score({ ...base, backlogs: 1, cgpa: 10, attendance: 100, lms_activity: 100 }).academicRisk,
    ).toBe("Low");
    expect(
      score({ ...base, backlogs: 2, cgpa: 10, attendance: 100, lms_activity: 100 }).academicRisk,
    ).toBe("High");
  });

  it("dataCompleteness: all fields filled → 'Complete'", () => {
    const c = dataCompleteness(base);
    expect(c.filled).toBe(c.total);
    expect(c.quality).toBe("Complete");
  });

  it("dataCompleteness: 1 missing → 'Partial'", () => {
    const c = dataCompleteness({ ...base, engagement: null as any });
    expect(c.quality).toBe("Partial");
    expect(c.missing).toContain("engagement");
  });

  it("riskFactors: verify specific factors for a student with known issues", () => {
    const factors = score({ ...base, cgpa: 5, backlogs: 1 }).riskFactors;
    expect(factors).toContain("Low CGPA (5)");
    expect(factors).toContain("1 active backlog");
  });

  it("Segment assignment for all 4 quadrants", () => {
    expect(score({ ...base, cgpa: 10, placement_readiness: 100 }).segment).toBe(
      "High Academic / High Placement",
    );
    expect(
      score({ ...base, cgpa: 10, placement_readiness: 0, skills_score: 0, feedback_score: 0 })
        .segment,
    ).toBe("High Academic / Low Placement");
    expect(
      score({ ...base, cgpa: 0, attendance: 0, lms_activity: 0, placement_readiness: 100 }).segment,
    ).toBe("Low Academic / High Placement");
    expect(
      score({
        ...base,
        cgpa: 0,
        attendance: 0,
        lms_activity: 0,
        placement_readiness: 0,
        skills_score: 0,
        feedback_score: 0,
      }).segment,
    ).toBe("Low Academic / Low Placement");
  });

  it("Maximum score with all perfect values", () => {
    const perfect = score({
      ...base,
      cgpa: 10,
      attendance: 100,
      lms_activity: 100,
      engagement: 100,
      placement_readiness: 100,
      skills_score: 100,
      feedback_score: 100,
    });
    expect(perfect.academicIndex).toBe(100);
    expect(perfect.placementIndex).toBe(100);
    expect(perfect.successScore).toBe(100);
  });

  it("Score with only 2 of 3 academic indicators available rescales weights correctly", () => {
    // Missing LMS: CGPA 10→100 × (0.5/0.8) + Attendance 100 × (0.3/0.8) = 62.5 + 37.5 = 100
    const s = score({ ...base, cgpa: 10, attendance: 100, lms_activity: null as any });
    expect(s.academicIndex).toBe(100);
    expect(Number.isNaN(s.academicIndex)).toBe(false);
  });

  it("SCORING_CONFIG weights sum correctly within each group", () => {
    const cfg = SCORING_CONFIG;
    expect(cfg.academic.cgpa + cfg.academic.attendance + cfg.academic.lmsActivity).toBeCloseTo(
      1.0,
      5,
    );
    expect(cfg.placement.readiness + cfg.placement.skills + cfg.placement.feedback).toBeCloseTo(
      1.0,
      5,
    );
    expect(cfg.academicWeight + cfg.placementWeight + cfg.engagementWeight).toBeCloseTo(1.0, 5);
  });

  it("score() output includes explanation with non-empty strings", () => {
    const s = score(base);
    expect(s.explanation).toBeDefined();
    expect(typeof s.explanation.topStrength).toBe("string");
    expect(s.explanation.topStrength.length).toBeGreaterThan(0);
    expect(s.explanation.factors.length).toBeGreaterThan(0);
    expect(s.explanation.dataQuality).toBe("Complete");
  });

  it("placementRisk boundary: exactly 45 is Medium not High", () => {
    // Need exactly placementIndex = 45: e.g. readiness=90 × 0.5=45, skills=0, feedback=0
    expect(
      score({ ...base, placement_readiness: 90, skills_score: 0, feedback_score: 0 }).placementRisk,
    ).toBe("Medium");
    expect(
      score({ ...base, placement_readiness: 88, skills_score: 0, feedback_score: 0 }).placementRisk,
    ).toBe("High");
  });

  it("all missing fields → all zero output → score 0", () => {
    const s = score({
      ...base,
      cgpa: null as any,
      attendance: null as any,
      lms_activity: null as any,
      engagement: null as any,
      placement_readiness: null as any,
      skills_score: null as any,
      feedback_score: null as any,
    });
    expect(s.successScore).toBe(0);
    expect(s.explanation.dataQuality).toBe("Low confidence");
  });
});
