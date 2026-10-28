import { describe, it, expect } from "vitest";
import {
  score,
  dataCompleteness,
  academicIndex,
  placementIndex,
  evaluatePlacementRisk,
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

  it("computes placement index from multi-indicator model (CGPA, skills, interview, readiness, attendance)", () => {
    // CGPA 8 (80) × 0.25 = 20; skills 60 × 0.25 = 15; interview 80 × 0.20 = 16; readiness 70 × 0.20 = 14; att 80 × 0.10 = 8 → 73
    expect(placementIndex(base)).toBe(73);
  });

  it("computes success score from academic, placement, engagement", () => {
    // 78 × 0.45 + 73 × 0.35 + 60 × 0.20 = 35.1 + 25.55 + 12 = 72.65 → 73
    const s = score(base);
    expect(s.successScore).toBe(73);
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
      score({
        ...base,
        cgpa: 0,
        attendance: 0,
        lms_activity: 0,
        placement_readiness: 100,
        skills_score: 100,
        feedback_score: 100,
      }).segment,
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
    expect(
      cfg.placement.cgpa +
        cfg.placement.skills +
        cfg.placement.interview +
        cfg.placement.readiness +
        cfg.placement.attendance,
    ).toBeCloseTo(1.0, 5);
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

  it("placementRisk boundary: exactly 50 is Medium not High, exactly 75 is Low not Medium", () => {
    // Skills 50, interview 50, readiness 50, cgpa 5.0 (50), att 50 => R = 50 => Medium
    const med50 = score({
      ...base,
      cgpa: 5.0,
      skills_score: 50,
      feedback_score: 50,
      placement_readiness: 50,
      attendance: 50,
    });
    expect(med50.placementRisk).toBe("Medium");
    expect(med50.placementReadinessScore).toBe(50);
    expect(med50.placementRiskScore).toBe(50);

    // Below 50 is High
    const high49 = score({
      ...base,
      cgpa: 4.9,
      skills_score: 49,
      feedback_score: 49,
      placement_readiness: 49,
      attendance: 49,
    });
    expect(high49.placementRisk).toBe("High");
    expect(high49.placementReadinessScore).toBe(49);
    expect(high49.placementRiskScore).toBe(51);

    // At 75 is Low
    const low75 = score({
      ...base,
      cgpa: 7.5,
      skills_score: 75,
      feedback_score: 75,
      placement_readiness: 75,
      attendance: 75,
    });
    expect(low75.placementRisk).toBe("Low");
    expect(low75.placementReadinessScore).toBe(75);
    expect(low75.placementRiskScore).toBe(25);
  });

  it("computes user recommended placement-risk model with exact example values", () => {
    // CGPA 7.5 (G=75) × 0.25 = 18.75
    // Skills 60 (T=60) × 0.25 = 15.00
    // Interview 50 (I=50) × 0.20 = 10.00
    // Readiness 70 (P=70) × 0.20 = 14.00
    // Attendance 80 (C=80) × 0.10 = 8.00
    // Total R = 65.75 → rounded to 65.8, Risk Score = 34.25 → rounded to 34.3 (Medium risk)
    const exampleStudent: StudentRow = {
      ...base,
      cgpa: 7.5,
      skills_score: 60,
      feedback_score: 50,
      placement_readiness: 70,
      attendance: 80,
    };
    const evalRes = evaluatePlacementRisk(exampleStudent);
    expect(evalRes.readinessScore).toBe(65.8);
    expect(evalRes.riskScore).toBe(34.2);
    expect(evalRes.riskLevel).toBe("Medium");
    expect(evalRes.reasons.length).toBeGreaterThan(0);
  });

  it("rescales weights when indicators are missing without assuming zero", () => {
    // If only CGPA 8.0 (80) and attendance 90 are available (total active weight = 0.25 + 0.10 = 0.35)
    // R = (0.25/0.35) * 80 + (0.10/0.35) * 90 = 57.14 + 25.71 = 82.86 → 82.9 (Low risk >= 75)
    const partial: StudentRow = {
      ...base,
      cgpa: 8.0,
      attendance: 90,
      skills_score: null,
      feedback_score: null,
      placement_readiness: null,
    };
    const evalRes = evaluatePlacementRisk(partial);
    expect(evalRes.readinessScore).toBe(82.9);
    expect(evalRes.riskScore).toBe(17.1);
    expect(evalRes.riskLevel).toBe("Low");
  });

  it("marks Insufficient Data when all 5 placement indicators are missing", () => {
    const empty: StudentRow = {
      ...base,
      cgpa: null,
      attendance: null,
      skills_score: null,
      feedback_score: null,
      placement_readiness: null,
    };
    const evalRes = evaluatePlacementRisk(empty);
    expect(evalRes.riskLevel).toBe("Insufficient Data");
    expect(evalRes.readinessScore).toBeNull();
    expect(evalRes.riskScore).toBeNull();
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
