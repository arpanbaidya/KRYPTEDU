/**
 * scoring.ts — Student Success Score, risk classification, segmentation, and explainability.
 *
 * METHODOLOGY (KPMG Smart Campus Analytics challenge):
 *
 * Student Success Score = Academic Index × 0.45 + Placement Index × 0.35 + Engagement × 0.20
 *
 * Academic Index  = (CGPA/10)×100 × 0.50 + Attendance × 0.30 + LMS Activity × 0.20 − Backlogs × 5
 * Placement Index = Placement Readiness × 0.50 + Skills Score × 0.30 + Feedback Score × 0.20
 *
 * All sub-scores are on 0–100. The final score is clamped [0, 100] and rounded to the nearest integer.
 *
 * MISSING-DATA POLICY:
 * - A field is considered MISSING only when its raw value is null, undefined, or NaN.
 * - A value of 0 is valid and means genuinely poor performance, not absence of data.
 * - When a weighted indicator is missing, it is excluded from the calculation and the remaining
 *   weights are rescaled proportionally so the score stays on [0, 100].
 * - Students with ≥2 missing indicators receive a "Low confidence" data quality warning.
 * - Comparing students with very different data completeness requires caution.
 *
 * RISK THRESHOLDS (configurable via SCORING_CONFIG):
 * - Academic High: Academic Index < 55 OR Backlogs ≥ 2 OR Attendance < 60
 * - Academic Medium: Academic Index < 70 OR Attendance < 75
 * - Placement High: Placement Index < 45
 * - Placement Medium: Placement Index < 65
 *
 * IMPORTANT:
 * - These weights are an initial baseline, not scientifically validated.
 * - No ML model is trained; all classifications are rule-based and fully explainable.
 * - Scores support human decision-making and must not be used to automatically disadvantage students.
 */

export type StudentRow = {
  id: string;
  roll_no: string;
  name: string;
  department: string;
  year: number;
  cgpa: number | null | undefined;
  attendance: number | null | undefined;
  lms_activity: number | null | undefined;
  engagement: number | null | undefined;
  placement_readiness: number | null | undefined;
  skills_score: number | null | undefined;
  feedback_score: number | null | undefined;
  backlogs: number | null | undefined;
};

export type Risk = "High" | "Medium" | "Low";
export type Segment =
  | "High Academic / High Placement"
  | "High Academic / Low Placement"
  | "Low Academic / High Placement"
  | "Low Academic / Low Placement";

export type DataQualityLevel = "Complete" | "Partial" | "Low confidence";

export type ScoreExplanation = {
  /** Plain-language statement of the strongest positive contributor. */
  topStrength: string;
  /** Plain-language statement of the strongest negative contributor. */
  topWeakness: string;
  /** All contributing factors with direction and magnitude. */
  factors: {
    name: string;
    value: number | null;
    contribution: number;
    direction: "positive" | "negative" | "neutral";
  }[];
  /** Data quality summary. */
  dataQuality: DataQualityLevel;
  /** Human-readable note about missing data, if any. */
  missingDataNote: string;
};

export type Scored = Omit<
  StudentRow,
  | "cgpa"
  | "attendance"
  | "lms_activity"
  | "engagement"
  | "placement_readiness"
  | "skills_score"
  | "feedback_score"
  | "backlogs"
> & {
  cgpa: number;
  attendance: number;
  lms_activity: number;
  engagement: number;
  placement_readiness: number;
  skills_score: number;
  feedback_score: number;
  backlogs: number;
  academicIndex: number;
  placementIndex: number;
  successScore: number;
  academicRisk: Risk;
  placementRisk: Risk;
  segment: Segment;
  riskFactors: string[];
  explanation: ScoreExplanation;
};

/**
 * Configurable scoring weights. To change weights institutionally, update this object.
 * Weights within each group must sum to 1.0.
 */
export const SCORING_CONFIG = {
  /** Weight of Academic Index in the overall Success Score. */
  academicWeight: 0.45,
  /** Weight of Placement Index in the overall Success Score. */
  placementWeight: 0.35,
  /** Weight of Engagement in the overall Success Score. */
  engagementWeight: 0.2,

  /** Sub-weights within Academic Index (must sum to 1.0). */
  academic: {
    cgpa: 0.5,
    attendance: 0.3,
    lmsActivity: 0.2,
  },
  /** Sub-weights within Placement Index (must sum to 1.0). */
  placement: {
    readiness: 0.5,
    skills: 0.3,
    feedback: 0.2,
  },

  /** Penalty per backlog (subtracted from Academic Index before clamping). */
  backlogPenalty: 5,

  /** Academic risk thresholds. */
  risk: {
    academicHighIndex: 55,
    academicMediumIndex: 70,
    academicHighAttendance: 60,
    academicMediumAttendance: 75,
    academicHighBacklogs: 2,
    placementHighIndex: 45,
    placementMediumIndex: 65,
  },

  /** Segmentation thresholds. */
  segment: {
    academicHigh: 65,
    placementHigh: 60,
  },

  /** Number of missing indicators that triggers "Low confidence" warning. */
  lowConfidenceThreshold: 2,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const clamp = (num: number) => Math.max(0, Math.min(100, num));
const round = (num: number) => Math.round(num);

/**
 * Parse a raw student field to a number.
 * Returns null if the value is null, undefined, or NaN.
 * Returns 0 for a genuine zero.
 */
function parseField(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Coerce to 0 when used in arithmetic (missing already handled upstream). */
function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// ─── Data completeness ───────────────────────────────────────────────────────

const SCORED_FIELDS = [
  "cgpa",
  "attendance",
  "lms_activity",
  "engagement",
  "placement_readiness",
  "skills_score",
  "feedback_score",
] as const;

/**
 * Determine which indicator fields are truly missing (null/undefined/NaN).
 * A value of 0 is NOT missing — it represents genuinely poor performance.
 */
export function dataCompleteness(s: StudentRow): {
  filled: number;
  total: number;
  missing: string[];
  quality: DataQualityLevel;
} {
  const missing = SCORED_FIELDS.filter((f) => parseField(s[f]) === null);
  const filled = SCORED_FIELDS.length - missing.length;
  const quality: DataQualityLevel =
    missing.length === 0
      ? "Complete"
      : missing.length < SCORING_CONFIG.lowConfidenceThreshold
        ? "Partial"
        : "Low confidence";
  return { filled, total: SCORED_FIELDS.length, missing: [...missing], quality };
}

// ─── Academic Index ──────────────────────────────────────────────────────────

/**
 * Academic Index (0–100).
 * Missing indicators are excluded and remaining sub-weights are rescaled.
 */
export function academicIndex(s: StudentRow): number {
  const cfg = SCORING_CONFIG.academic;
  const cgpaRaw = parseField(s.cgpa);
  const attRaw = parseField(s.attendance);
  const lmsRaw = parseField(s.lms_activity);

  // Build active contributions
  const parts: { weight: number; value: number }[] = [];
  if (cgpaRaw !== null) parts.push({ weight: cfg.cgpa, value: (cgpaRaw / 10) * 100 });
  if (attRaw !== null) parts.push({ weight: cfg.attendance, value: attRaw });
  if (lmsRaw !== null) parts.push({ weight: cfg.lmsActivity, value: lmsRaw });

  if (parts.length === 0) return 0;

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const rawIndex = parts.reduce((a, p) => a + (p.weight / totalWeight) * p.value, 0);
  const backlogs = n(s.backlogs);
  return round(clamp(rawIndex - backlogs * SCORING_CONFIG.backlogPenalty));
}

// ─── Placement Index ─────────────────────────────────────────────────────────

/**
 * Placement Index (0–100).
 * Missing indicators are excluded and remaining sub-weights are rescaled.
 */
export function placementIndex(s: StudentRow): number {
  const cfg = SCORING_CONFIG.placement;
  const readRaw = parseField(s.placement_readiness);
  const sklRaw = parseField(s.skills_score);
  const fbRaw = parseField(s.feedback_score);

  const parts: { weight: number; value: number }[] = [];
  if (readRaw !== null) parts.push({ weight: cfg.readiness, value: readRaw });
  if (sklRaw !== null) parts.push({ weight: cfg.skills, value: sklRaw });
  if (fbRaw !== null) parts.push({ weight: cfg.feedback, value: fbRaw });

  if (parts.length === 0) return 0;

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  return round(clamp(parts.reduce((a, p) => a + (p.weight / totalWeight) * p.value, 0)));
}

// ─── Student Success Score ───────────────────────────────────────────────────

/**
 * Student Success Score (0–100).
 * Missing top-level indicators are excluded and remaining weights are rescaled.
 */
export function successScore(s: StudentRow): number {
  const cfg = SCORING_CONFIG;
  const ai = academicIndex(s);
  const pi = placementIndex(s);
  const engRaw = parseField(s.engagement);

  const parts: { weight: number; value: number }[] = [
    { weight: cfg.academicWeight, value: ai },
    { weight: cfg.placementWeight, value: pi },
  ];
  if (engRaw !== null) parts.push({ weight: cfg.engagementWeight, value: engRaw });

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  return round(clamp(parts.reduce((a, p) => a + (p.weight / totalWeight) * p.value, 0)));
}

// ─── Risk classification ──────────────────────────────────────────────────────

export function academicRisk(s: StudentRow): Risk {
  const a = academicIndex(s);
  const att = n(s.attendance);
  const bl = n(s.backlogs);
  const { risk } = SCORING_CONFIG;
  if (
    a < risk.academicHighIndex ||
    bl >= risk.academicHighBacklogs ||
    att < risk.academicHighAttendance
  )
    return "High";
  if (a < risk.academicMediumIndex || att < risk.academicMediumAttendance) return "Medium";
  return "Low";
}

export function placementRisk(s: StudentRow): Risk {
  const p = placementIndex(s);
  const { risk } = SCORING_CONFIG;
  if (p < risk.placementHighIndex) return "High";
  if (p < risk.placementMediumIndex) return "Medium";
  return "Low";
}

// ─── Segmentation ────────────────────────────────────────────────────────────

export function segmentOf(s: StudentRow): Segment {
  const { segment } = SCORING_CONFIG;
  const hiA = academicIndex(s) >= segment.academicHigh;
  const hiP = placementIndex(s) >= segment.placementHigh;
  return `${hiA ? "High" : "Low"} Academic / ${hiP ? "High" : "Low"} Placement` as Segment;
}

// ─── Risk factors ────────────────────────────────────────────────────────────

export function riskFactors(s: StudentRow): string[] {
  const f: string[] = [];
  const cgpa = parseField(s.cgpa);
  const att = parseField(s.attendance);
  const bl = parseField(s.backlogs);
  const lms = parseField(s.lms_activity);
  const eng = parseField(s.engagement);
  const plc = parseField(s.placement_readiness);
  const skl = parseField(s.skills_score);

  if (cgpa !== null && cgpa < 6) f.push(`Low CGPA (${cgpa})`);
  if (att !== null && att < 75) f.push(`Attendance below 75% (${att}%)`);
  if (bl !== null && bl > 0) f.push(`${bl} active backlog${bl > 1 ? "s" : ""}`);
  if (lms !== null && lms < 45) f.push(`Low LMS activity (${lms})`);
  if (eng !== null && eng < 40) f.push(`Low campus engagement (${eng})`);
  if (plc !== null && plc < 45) f.push(`Low placement readiness (${plc})`);
  if (skl !== null && skl < 40) f.push(`Skill gaps (${skl})`);
  return f;
}

// ─── Explainability ──────────────────────────────────────────────────────────

/**
 * Generate a structured, human-readable explanation of the student's score.
 * All explanations are derived from the same calculation — no fabrication.
 */
export function explainScore(s: StudentRow): ScoreExplanation {
  const { filled, missing, quality } = dataCompleteness(s);
  const ai = academicIndex(s);
  const pi = placementIndex(s);
  const engVal = parseField(s.engagement);
  const cgpa = parseField(s.cgpa);
  const att = parseField(s.attendance);
  const lms = parseField(s.lms_activity);
  const plc = parseField(s.placement_readiness);
  const skl = parseField(s.skills_score);
  const fb = parseField(s.feedback_score);
  const bl = n(s.backlogs);

  const cfg = SCORING_CONFIG;
  // Normalised contribution of each component to total score
  const factors: ScoreExplanation["factors"] = [
    {
      name: "CGPA",
      value: cgpa,
      contribution:
        cgpa !== null ? Math.round((cgpa / 10) * 100 * cfg.academic.cgpa * cfg.academicWeight) : 0,
      direction:
        cgpa !== null && cgpa >= 7
          ? "positive"
          : cgpa !== null && cgpa < 6
            ? "negative"
            : "neutral",
    },
    {
      name: "Attendance",
      value: att,
      contribution:
        att !== null ? Math.round(att * cfg.academic.attendance * cfg.academicWeight) : 0,
      direction:
        att !== null && att >= 75 ? "positive" : att !== null && att < 60 ? "negative" : "neutral",
    },
    {
      name: "LMS activity",
      value: lms,
      contribution:
        lms !== null ? Math.round(lms * cfg.academic.lmsActivity * cfg.academicWeight) : 0,
      direction:
        lms !== null && lms >= 60 ? "positive" : lms !== null && lms < 45 ? "negative" : "neutral",
    },
    {
      name: "Backlogs",
      value: bl,
      contribution: -Math.min(50, bl * cfg.backlogPenalty),
      direction: bl > 0 ? "negative" : "neutral",
    },
    {
      name: "Placement readiness",
      value: plc,
      contribution:
        plc !== null ? Math.round(plc * cfg.placement.readiness * cfg.placementWeight) : 0,
      direction:
        plc !== null && plc >= 65 ? "positive" : plc !== null && plc < 45 ? "negative" : "neutral",
    },
    {
      name: "Skills score",
      value: skl,
      contribution: skl !== null ? Math.round(skl * cfg.placement.skills * cfg.placementWeight) : 0,
      direction:
        skl !== null && skl >= 60 ? "positive" : skl !== null && skl < 40 ? "negative" : "neutral",
    },
    {
      name: "Feedback score",
      value: fb,
      contribution: fb !== null ? Math.round(fb * cfg.placement.feedback * cfg.placementWeight) : 0,
      direction:
        fb !== null && fb >= 60 ? "positive" : fb !== null && fb < 40 ? "negative" : "neutral",
    },
    {
      name: "Engagement",
      value: engVal,
      contribution: engVal !== null ? Math.round(engVal * cfg.engagementWeight) : 0,
      direction:
        engVal !== null && engVal >= 60
          ? "positive"
          : engVal !== null && engVal < 40
            ? "negative"
            : "neutral",
    },
  ];

  const positives = factors
    .filter((f) => f.direction === "positive")
    .sort((a, b) => b.contribution - a.contribution);
  const negatives = factors
    .filter((f) => f.direction === "negative")
    .sort((a, b) => a.contribution - b.contribution);

  const topStrength = positives[0]
    ? `${positives[0].name} (${positives[0].value !== null ? positives[0].value : "—"}) is contributing positively to the score`
    : "No strong positive indicators identified";
  const topWeakness = negatives[0]
    ? `${negatives[0].name} (${negatives[0].value !== null ? negatives[0].value : "—"}) is reducing the score`
    : "No significant risk factors identified";

  const missingDataNote =
    missing.length === 0
      ? "All indicator data is available."
      : `${missing.length} indicator(s) missing: ${missing.join(", ")}. Score calculated from available data (${filled}/${filled + missing.length} indicators).`;

  return { topStrength, topWeakness, factors, dataQuality: quality, missingDataNote };
}

// ─── Composite scorer ────────────────────────────────────────────────────────

export function score(s: StudentRow): Scored {
  // Normalise nulls to 0 for fields that are stored as non-null in the output type
  const cgpa = parseField(s.cgpa) ?? 0;
  const att = parseField(s.attendance) ?? 0;
  const lms = parseField(s.lms_activity) ?? 0;
  const eng = parseField(s.engagement) ?? 0;
  const plc = parseField(s.placement_readiness) ?? 0;
  const skl = parseField(s.skills_score) ?? 0;
  const fb = parseField(s.feedback_score) ?? 0;
  const bl = parseField(s.backlogs) ?? 0;

  // Build a normalised version of the row for consistent downstream use
  const normalised: StudentRow = {
    ...s,
    cgpa,
    attendance: att,
    lms_activity: lms,
    engagement: eng,
    placement_readiness: plc,
    skills_score: skl,
    feedback_score: fb,
    backlogs: bl,
  };

  return {
    ...normalised,
    cgpa,
    attendance: att,
    lms_activity: lms,
    engagement: eng,
    placement_readiness: plc,
    skills_score: skl,
    feedback_score: fb,
    backlogs: bl,
    academicIndex: academicIndex(s),
    placementIndex: placementIndex(s),
    successScore: successScore(s),
    academicRisk: academicRisk(s),
    placementRisk: placementRisk(s),
    segment: segmentOf(s),
    riskFactors: riskFactors(s),
    explanation: explainScore(s),
  };
}

// ─── Segment catalogue ───────────────────────────────────────────────────────

export const SEGMENTS: Segment[] = [
  "High Academic / High Placement",
  "High Academic / Low Placement",
  "Low Academic / High Placement",
  "Low Academic / Low Placement",
];

// ─── Support groups ──────────────────────────────────────────────────────────

/**
 * Named support groups for actionable intervention planning.
 * A student may belong to multiple groups (except "Insufficient data",
 * which is exclusive when assigned).
 */
export type SupportGroup =
  | "Urgent support"
  | "Strong academics, low placement"
  | "Good academics, poor attendance"
  | "Placement-ready, low risk"
  | "Insufficient data";

export const SUPPORT_GROUPS: { id: SupportGroup; rule: string }[] = [
  { id: "Urgent support", rule: "High academic risk and high placement risk" },
  { id: "Strong academics, low placement", rule: "Academic index ≥ 65, placement index < 60" },
  { id: "Good academics, poor attendance", rule: "CGPA ≥ 7 and attendance < 75%" },
  { id: "Placement-ready, low risk", rule: "Low placement risk and low academic risk" },
  {
    id: "Insufficient data",
    rule: `${SCORING_CONFIG.lowConfidenceThreshold}+ indicators missing (null/undefined)`,
  },
];

export function supportGroups(s: StudentRow): SupportGroup[] {
  const { missing } = dataCompleteness(s);
  if (missing.length >= SCORING_CONFIG.lowConfidenceThreshold) return ["Insufficient data"];
  const g: SupportGroup[] = [];
  const aR = academicRisk(s),
    pR = placementRisk(s);
  if (aR === "High" && pR === "High") g.push("Urgent support");
  if (
    academicIndex(s) >= SCORING_CONFIG.segment.academicHigh &&
    placementIndex(s) < SCORING_CONFIG.segment.placementHigh
  )
    g.push("Strong academics, low placement");
  const cgpa = parseField(s.cgpa);
  const att = parseField(s.attendance);
  if (cgpa !== null && cgpa >= 7 && att !== null && att < 75)
    g.push("Good academics, poor attendance");
  if (aR === "Low" && pR === "Low") g.push("Placement-ready, low risk");
  return g;
}
