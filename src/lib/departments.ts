/**
 * Canonical Department List
 * Strictly restricted to departments in the authoritative institutional dataset.
 * No other departments are permitted.
 */

export const CANONICAL_DEPARTMENTS = [
  "Computer Engineering",
  "Artificial Intelligence and Machine Learning",
  "Cyber security & Forensics",
] as const;

export type CanonicalDepartment = (typeof CANONICAL_DEPARTMENTS)[number];

export function isCanonicalDepartment(dept: string): dept is CanonicalDepartment {
  return (CANONICAL_DEPARTMENTS as readonly string[]).includes(dept);
}

export function normalizeDepartment(raw: string): CanonicalDepartment | null {
  const trimmed = raw.trim();
  if (isCanonicalDepartment(trimmed)) return trimmed;
  if (/computer/i.test(trimmed)) return "Computer Engineering";
  if (/artificial|ai|machine|aiml/i.test(trimmed)) return "Artificial Intelligence and Machine Learning";
  if (/cyber|forensic/i.test(trimmed)) return "Cyber security & Forensics";
  return null;
}
