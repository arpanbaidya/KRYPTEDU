/**
 * csv.ts — CSV parsing and validation for student data import.
 *
 * MISSING-DATA POLICY:
 * - An empty CSV cell is treated as a missing (not-provided) value and is
 *   excluded from the validated row (the DB column retains its existing value
 *   on update, or the DB default on insert).
 * - A cell containing "0" is a valid zero value (e.g., 0 backlogs, 0% attendance).
 * - Validation rejects values outside the defined range for each field.
 * - Duplicate roll numbers within a single upload are skipped with an error.
 * - Unknown roll numbers for update-only categories are reported with guidance.
 */

export const CATEGORIES = {
  Academic: ["cgpa", "backlogs"],
  Attendance: ["attendance"],
  LMS: ["lms_activity"],
  Engagement: ["engagement"],
  Placement: ["placement_readiness"],
  "Skills and Feedback": ["skills_score", "feedback_score"],
} as const;

export type Category = keyof typeof CATEGORIES;

/** Valid inclusive [min, max] range for each numeric field. */
const RANGE: Record<string, [number, number]> = {
  cgpa: [0, 10],
  backlogs: [0, 30],
  attendance: [0, 100],
  lms_activity: [0, 100],
  engagement: [0, 100],
  placement_readiness: [0, 100],
  skills_score: [0, 100],
  feedback_score: [0, 100],
  year: [1, 6],
};

import Papa from "papaparse";

export function parseCsv(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (!parsed.data.length || !parsed.meta.fields) {
    return { headers: [] as string[], rows: [] as Record<string, string>[] };
  }

  return { headers: parsed.meta.fields, rows: parsed.data };
}

export type Validated = {
  valid: Record<string, string | number>[];
  errors: string[];
  /** Count of cells that were empty (skipped, not an error). */
  skippedEmptyCells: number;
};

export function validate(
  category: Category,
  headers: string[],
  rows: Record<string, string>[],
): Validated {
  const errors: string[] = [];
  const needed = ["roll_no", ...CATEGORIES[category]];
  const missing = needed.filter((h) => !headers.includes(h));
  if (missing.length)
    return {
      valid: [],
      errors: [`Missing column(s): ${missing.join(", ")}`],
      skippedEmptyCells: 0,
    };

  const valid: Record<string, string | number>[] = [];
  const seen = new Map<string, number>();
  let skippedEmptyCells = 0;

  rows.forEach((r, idx) => {
    const line = idx + 2; // header is row 1
    const roll = (r["roll_no"] ?? "").trim();

    if (!roll) {
      errors.push(`Row ${line}: roll_no is empty — row skipped`);
      return;
    }

    const firstOccurrence = seen.get(roll);
    if (firstOccurrence !== undefined) {
      errors.push(
        `Row ${line}: duplicate roll_no "${roll}" (already in row ${firstOccurrence}) — row skipped`,
      );
      return;
    }
    seen.set(roll, line);

    const out: Record<string, string | number> = { roll_no: roll };
    let rowHasError = false;

    const checkFields = [...CATEGORIES[category], ...(headers.includes("year") ? ["year"] : [])];
    for (const f of checkFields) {
      if (!(f in r)) continue;
      const raw = r[f];
      // Empty cell = missing value; skip gracefully (not an error)
      if (raw === undefined || raw === "") {
        skippedEmptyCells++;
        continue;
      }
      const num = Number(raw);
      const [lo, hi] = RANGE[f] ?? [0, 100];
      if (Number.isNaN(num) || num < lo || num > hi) {
        errors.push(
          `Row ${line}: "${f}" value "${raw}" is invalid — must be a number between ${lo} and ${hi}`,
        );
        rowHasError = true;
        return; // skip this row entirely on field error
      }
      // Preserve cgpa decimal precision; round integers
      out[f] = f === "cgpa" ? num : Math.round(num);
    }

    if (rowHasError) return;

    if (r["name"]) out["name"] = String(r["name"]).trim();
    if (r["department"]) out["department"] = String(r["department"]).trim();
    valid.push(out);
  });

  return { valid, errors, skippedEmptyCells };
}
