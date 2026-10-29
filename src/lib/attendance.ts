import { CANONICAL_DEPARTMENTS, type CanonicalDepartment } from "./departments";
import { OFFICIAL_STUDENTS } from "./official-dataset";

export type AttendanceStatus = "present" | "absent" | "not_considered";
export type SessionStatus = "draft" | "published";

export interface AttendanceSession {
  id: string;
  department: CanonicalDepartment;
  attendance_date: string; // YYYY-MM-DD
  status: SessionStatus;
  created_by?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  is_sample: boolean;
  is_demo?: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecordItem {
  id: string;
  session_id: string;
  student_id: string;
  student_name: string;
  student_roll_no: string;
  student_dept: CanonicalDepartment;
  status: AttendanceStatus;
  attendance_date: string;
  updated_at?: string;
  is_sample?: boolean;
  is_demo?: boolean;
}

export interface AttendanceSummary {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  notConsideredCount: number;
  attendancePercentage: number | null; // null represents N/A
  isPublished: boolean;
  isSample: boolean;
  isDemo?: boolean;
  sessionDate: string;
  department: string;
}

export interface StudentAttendanceProfile {
  studentId: string;
  studentName: string;
  studentRollNo: string;
  department: CanonicalDepartment;
  totalPublishedSessions: number;
  presentCount: number;
  absentCount: number;
  notConsideredCount: number;
  overallAttendancePercentage: number | null;
  records: AttendanceRecordItem[];
  hasSampleData: boolean;
  hasDemoData?: boolean;
}

export interface MonthlyAttendanceStat {
  month: string; // e.g. "Aug 2026"
  monthKey: string; // e.g. "2026-08"
  presentCount: number;
  absentCount: number;
  notConsideredCount: number;
  percentage: number | null;
  totalSessions: number;
}

/**
 * 3-Month Demo Dataset Configuration
 * Period: 1 August 2026 to 31 October 2026 (Weekdays only, Saturdays and Sundays strictly excluded)
 */
export const DEMO_ATTENDANCE_CONFIG = {
  startDate: "2026-08-01",
  endDate: "2026-10-31",
  totalDays: 92,
  totalWeekdays: 65,
  saturdaysCount: 14,
  sundaysCount: 13,
  byMonthWeekdays: {
    "2026-08": 21,
    "2026-09": 22,
    "2026-10": 22,
  },
  label: "DEMO DATA",
  targetDistribution: {
    presentApprox: "80–90%",
    absentApprox: "5–15%",
    notConsideredApprox: "remainder",
  },
} as const;

/**
 * Check whether a given date string (YYYY-MM-DD) falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Returns an array of all 65 weekday dates (YYYY-MM-DD) between 2026-08-01 and 2026-10-31.
 * Saturdays and Sundays are excluded.
 */
export function getDemoPeriodWeekdays(): string[] {
  const dates: string[] = [];
  const start = new Date(2026, 7, 1); // August 1, 2026 (month index 7)
  const end = new Date(2026, 9, 31); // October 31, 2026 (month index 9)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

/**
 * Deterministic integer hash for a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Deterministic PRNG based on Mulberry32
 */
function pseudoRandom(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Deterministic status generator for a student on a specific weekday date.
 * Yields ~85.4% Present, ~11.0% Absent, ~3.6% Not Considered overall,
 * with a realistic tail:
 * - ~6 students < 60% (High Academic Risk)
 * - ~12 students 60–75% (Medium Academic Risk)
 * - Remainder 75–98%
 */
export function deterministicDemoStatus(
  rollNo: string,
  dateStr: string,
  studentIndex = 0
): AttendanceStatus {
  // Deterministic bias based on roll number & student index
  const numPart = parseInt(rollNo.replace(/\D/g, ""), 10) || studentIndex || 1;
  let bias = 0.88; // Default normal attendance probability

  if (numPart % 25 === 0) {
    bias = 0.52; // Chronic absentee (~50% attendance, <60% threshold)
  } else if (numPart % 11 === 0) {
    bias = 0.72; // Moderate absentee (~70% attendance, 60–75% threshold)
  }

  const seed = hashString(`${rollNo}_${dateStr}_kryptedu_demo`) ^ 42;
  const rand = pseudoRandom(seed);

  if (rand < bias) {
    return "present";
  } else if (rand < bias + (1 - bias) * 0.75) {
    return "absent";
  } else {
    return "not_considered";
  }
}

/**
 * Calculates session summary statistics.
 * Formula:
 * Attendance Percentage = Present / (Present + Absent) * 100
 * Not Considered is excluded from the denominator.
 * Returns null if (Present + Absent) === 0 (displays as "N/A").
 */
export function calculateAttendanceSummary(
  totalInDept: number,
  records: { status?: AttendanceStatus | null }[],
  options?: {
    isPublished?: boolean;
    isSample?: boolean;
    isDemo?: boolean;
    sessionDate?: string;
    department?: string;
  }
): AttendanceSummary {
  let presentCount = 0;
  let absentCount = 0;
  let notConsideredCount = 0;

  for (const r of records) {
    if (r.status === "present") presentCount++;
    else if (r.status === "absent") absentCount++;
    else if (r.status === "not_considered") notConsideredCount++;
  }

  const denominator = presentCount + absentCount;
  const attendancePercentage =
    denominator > 0 ? Math.round((presentCount / denominator) * 1000) / 10 : null;

  return {
    totalStudents: totalInDept,
    presentCount,
    absentCount,
    notConsideredCount,
    attendancePercentage,
    isPublished: options?.isPublished ?? false,
    isSample: options?.isSample ?? false,
    isDemo: options?.isDemo ?? options?.isSample ?? false,
    sessionDate: options?.sessionDate ?? new Date().toISOString().split("T")[0],
    department: options?.department ?? "Computer Engineering",
  };
}

/**
 * Calculates individual student's cumulative attendance across published sessions.
 * Formula:
 * Individual % = Published Present / (Published Present + Published Absent) * 100
 * Not Considered is excluded.
 */
export function calculateStudentOverallAttendance(
  records: { status: AttendanceStatus; is_sample?: boolean; is_demo?: boolean }[]
): {
  totalPublishedSessions: number;
  presentCount: number;
  absentCount: number;
  notConsideredCount: number;
  overallAttendancePercentage: number | null;
  hasSampleData: boolean;
  hasDemoData: boolean;
} {
  let presentCount = 0;
  let absentCount = 0;
  let notConsideredCount = 0;
  let hasSampleData = false;
  let hasDemoData = false;

  for (const r of records) {
    if (r.is_sample) hasSampleData = true;
    if (r.is_demo) hasDemoData = true;
    if (r.status === "present") presentCount++;
    else if (r.status === "absent") absentCount++;
    else if (r.status === "not_considered") notConsideredCount++;
  }

  const totalPublishedSessions = records.length;
  const denominator = presentCount + absentCount;
  const overallAttendancePercentage =
    denominator > 0 ? Math.round((presentCount / denominator) * 1000) / 10 : null;

  return {
    totalPublishedSessions,
    presentCount,
    absentCount,
    notConsideredCount,
    overallAttendancePercentage,
    hasSampleData,
    hasDemoData,
  };
}

/**
 * Calculates a student's monthly attendance stats for timeline visualization.
 * Groups by YYYY-MM (e.g. Aug 2026, Sep 2026, Oct 2026).
 */
export function calculateStudentMonthlyAttendance(
  records: { attendance_date: string; status: AttendanceStatus }[]
): MonthlyAttendanceStat[] {
  const monthMap = new Map<string, { present: number; absent: number; notConsidered: number }>();

  for (const r of records) {
    if (!r.attendance_date) continue;
    const monthKey = r.attendance_date.slice(0, 7); // e.g. "2026-08"
    const current = monthMap.get(monthKey) || { present: 0, absent: 0, notConsidered: 0 };

    if (r.status === "present") current.present++;
    else if (r.status === "absent") current.absent++;
    else if (r.status === "not_considered") current.notConsidered++;

    monthMap.set(monthKey, current);
  }

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  };

  const sortedKeys = Array.from(monthMap.keys()).sort();

  return sortedKeys.map((mk) => {
    const stat = monthMap.get(mk)!;
    const [y, m] = mk.split("-");
    const label = `${monthNames[m] || m} ${y}`;
    const denom = stat.present + stat.absent;
    const pct = denom > 0 ? Math.round((stat.present / denom) * 1000) / 10 : null;
    return {
      month: label,
      monthKey: mk,
      presentCount: stat.present,
      absentCount: stat.absent,
      notConsideredCount: stat.notConsidered,
      percentage: pct,
      totalSessions: stat.present + stat.absent + stat.notConsidered,
    };
  });
}

let cachedDemoAttendanceMap: Record<string, number> | null = null;
let BASE_DEMO_ATTENDANCE_MAP: Record<string, number> | null = null;
const AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP = new Map<string, number>();

/**
 * Pre-computes the static baseline published demo attendance percentages for all 275 students
 * across all 65 weekdays of the Aug-Oct 2026 period once. Memoized permanently in memory.
 */
function getOrCreateBaseDemoAttendanceMap(): Record<string, number> {
  if (BASE_DEMO_ATTENDANCE_MAP) return BASE_DEMO_ATTENDANCE_MAP;

  const weekdays = getDemoPeriodWeekdays();
  const map: Record<string, number> = {};

  for (let idx = 0; idx < OFFICIAL_STUDENTS.length; idx++) {
    const stu = OFFICIAL_STUDENTS[idx];
    let present = 0;
    let absent = 0;

    for (const dateStr of weekdays) {
      const st = deterministicDemoStatus(stu.roll_no, dateStr, idx);
      if (st === "present") present++;
      else if (st === "absent") absent++;
    }

    const denom = present + absent;
    if (denom > 0) {
      const pct = Math.round((present / denom) * 1000) / 10;
      map[stu.roll_no] = pct;
      map[`ust-${stu.roll_no.toLowerCase()}`] = pct;
      map[stu.id] = pct;
    }
  }

  BASE_DEMO_ATTENDANCE_MAP = map;
  return map;
}

/**
 * Standard Attendance Percentage Calculation across the application:
 * Attendance Percentage = Present / (Present + Absent) * 100
 * Not Considered, Unmarked, draft sessions, and non-attendance days are excluded from the denominator.
 * Returns null (N/A) when denominator is 0.
 */
export function calculateAttendancePercentage(present: number, absent: number): number | null {
  const p = Math.max(0, Number(present) || 0);
  const a = Math.max(0, Number(absent) || 0);
  const denom = p + a;
  if (denom === 0) return null;
  return Math.round((p / denom) * 1000) / 10;
}

export const ATTENDANCE_OVERRIDE_STORAGE_KEY = "kryptedu_authoritative_attendance_map";

/**
 * Update a student's authoritative published attendance percentage live.
 * Clears cached maps so all downstream consumers immediately receive the new percentage.
 */
export function updateStudentAuthoritativeAttendance(rollNo: string, percentage: number | null): void {
  const cleanRoll = rollNo.toUpperCase();
  if (percentage === null) {
    AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.delete(cleanRoll);
    AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.delete(`ust-${cleanRoll.toLowerCase()}`);
    AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.delete(rollNo);
  } else {
    AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(cleanRoll, percentage);
    AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(`ust-${cleanRoll.toLowerCase()}`, percentage);
    AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(rollNo, percentage);
  }
  cachedDemoAttendanceMap = null;

  if (typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(ATTENDANCE_OVERRIDE_STORAGE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};
      if (percentage === null) {
        delete parsed[cleanRoll];
        delete parsed[`ust-${cleanRoll.toLowerCase()}`];
      } else {
        parsed[cleanRoll] = percentage;
        parsed[`ust-${cleanRoll.toLowerCase()}`] = percentage;
      }
      localStorage.setItem(ATTENDANCE_OVERRIDE_STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  }
}

/**
 * Synchronises a batch of authoritative attendance percentages live into memory and persistent client storage.
 */
export function syncAuthoritativeAttendanceMap(attendanceMap: Record<string, number>): void {
  for (const [k, v] of Object.entries(attendanceMap)) {
    if (typeof v === "number" && !Number.isNaN(v)) {
      const cleanRoll = k.toUpperCase();
      AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(cleanRoll, v);
      AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(`ust-${cleanRoll.toLowerCase()}`, v);
      AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(k, v);
    }
  }
  cachedDemoAttendanceMap = null;

  if (typeof window !== "undefined") {
    try {
      const existing = localStorage.getItem(ATTENDANCE_OVERRIDE_STORAGE_KEY);
      const parsed = existing ? JSON.parse(existing) : {};
      const merged = { ...parsed, ...attendanceMap };
      localStorage.setItem(ATTENDANCE_OVERRIDE_STORAGE_KEY, JSON.stringify(merged));
    } catch {}
  }
}

/**
 * Clears persistent overrides from local storage (used primarily for test cleanup).
 */
export function clearAuthoritativeAttendanceStorageForTesting(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(ATTENDANCE_OVERRIDE_STORAGE_KEY);
    } catch {}
  }
  AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.clear();
  cachedDemoAttendanceMap = null;
}

/**
 * Retrieve a specific student's authoritative published attendance percentage.
 */
export function getAuthoritativeStudentAttendance(rollNo: string): number | null {
  const cleanRoll = rollNo.toUpperCase();
  if (AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.has(cleanRoll)) {
    return AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.get(cleanRoll)!;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ATTENDANCE_OVERRIDE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[cleanRoll] !== undefined) return parsed[cleanRoll];
        if (parsed[rollNo] !== undefined) return parsed[rollNo];
      }
    } catch {}
  }
  const map = getAuthoritativeDemoAttendanceMap();
  return map[cleanRoll] ?? map[rollNo] ?? null;
}

/**
 * Invalidate the published attendance cache explicitly (e.g. after database sync or session submit).
 */
export function invalidateAttendanceCache(): void {
  cachedDemoAttendanceMap = null;
}

/**
 * Returns an authoritative map of published demo attendance percentages for all 275 students
 * across all 65 weekdays of the 1 Aug - 31 Oct 2026 period, merged with any live published updates.
 * Excludes weekends and Not Considered.
 * Highly optimized via permanent base map memoization (O(1) memory clone).
 */
export function getAuthoritativeDemoAttendanceMap(): Record<string, number> {
  const baseMap = getOrCreateBaseDemoAttendanceMap();
  const map: Record<string, number> = { ...baseMap };

  // Apply any client persistent storage overrides
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ATTENDANCE_OVERRIDE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "number" && !Number.isNaN(v)) {
            const clean = k.toUpperCase();
            AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(clean, v);
            AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(`ust-${clean.toLowerCase()}`, v);
            AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.set(k, v);
          }
        }
      }
    } catch {}
  }

  // Apply any live overrides in O(k)
  for (const [k, v] of AUTHORITATIVE_ATTENDANCE_OVERRIDE_MAP.entries()) {
    map[k] = v;
  }

  cachedDemoAttendanceMap = map;
  return map;
}

/**
 * Authoritatively computes a student's cumulative attendance percentage across the 3-month
 * instructional semester (Aug 1 - Oct 31, 2026), incorporating any date overrides or local drafts.
 * Adheres strictly to the institutional formula:
 * Attendance % = (Present Sessions / (Present + Absent Sessions)) * 100
 * Excludes Not Considered from the denominator.
 */
export function computeStudentCumulativeAttendance(
  rollNo: string,
  overrides?: Record<string, AttendanceStatus | null>
): number | null {
  const cleanRoll = rollNo.toUpperCase();
  const stuIdx = OFFICIAL_STUDENTS.findIndex(
    (s) => s.roll_no.toUpperCase() === cleanRoll || `ust-${s.roll_no.toLowerCase()}` === rollNo.toLowerCase()
  );
  if (stuIdx === -1) return null;

  const stu = OFFICIAL_STUDENTS[stuIdx];
  const weekdays = getDemoPeriodWeekdays();
  let present = 0;
  let absent = 0;

  for (const dateStr of weekdays) {
    let status: AttendanceStatus | null = null;
    if (overrides && overrides[dateStr] !== undefined) {
      status = overrides[dateStr];
    } else if (typeof window !== "undefined") {
      try {
        const savedDraft = localStorage.getItem(`kryptedu_att_draft_${stu.department}_${dateStr}`);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          const sId = `ust-${stu.roll_no.toLowerCase()}`;
          if (parsed[sId] || parsed[stu.roll_no]) {
            status = parsed[sId] || parsed[stu.roll_no];
          }
        }
      } catch {}
    }

    if (!status) {
      status = deterministicDemoStatus(stu.roll_no, dateStr, stuIdx);
    }

    if (status === "present") {
      present++;
    } else if (status === "absent") {
      absent++;
    }
  }

  const denom = present + absent;
  if (denom === 0) return null;
  return Math.round((present / denom) * 1000) / 10;
}

/**
 * Returns monthly breakdown for a specific student across the 3-month demo period
 */
export function getStudentDemoMonthlyStats(rollNo: string): MonthlyAttendanceStat[] {
  const stuIdx = OFFICIAL_STUDENTS.findIndex(
    (s) => s.roll_no.toLowerCase() === rollNo.toLowerCase()
  );
  if (stuIdx === -1) return [];

  const weekdays = getDemoPeriodWeekdays();
  const records = weekdays.map((dateStr) => ({
    attendance_date: dateStr,
    status: deterministicDemoStatus(rollNo, dateStr, stuIdx),
  }));

  return calculateStudentMonthlyAttendance(records);
}

/**
 * Generates published demo records for a single student across all 65 weekdays in Aug-Oct 2026.
 * Highly optimized (O(65) single student iteration) for instant student dashboard rendering.
 */
export function getStudentDemoRecords(
  rollNo: string,
  dept?: CanonicalDepartment
): AttendanceRecordItem[] {
  const stuIdx = OFFICIAL_STUDENTS.findIndex(
    (s) => s.roll_no.toLowerCase() === rollNo.toLowerCase()
  );
  if (stuIdx === -1) return [];

  const stu = OFFICIAL_STUDENTS[stuIdx];
  const targetDept = dept || stu.department;
  const weekdays = getDemoPeriodWeekdays();
  const records: AttendanceRecordItem[] = [];

  for (const dateStr of weekdays) {
    const status = deterministicDemoStatus(stu.roll_no, dateStr, stuIdx);
    const sessId = `sess-${targetDept}_${dateStr}`;
    records.push({
      id: `rec-${sessId}-${stu.roll_no}`,
      session_id: sessId,
      student_id: `ust-${stu.roll_no.toLowerCase()}`,
      student_name: stu.name,
      student_roll_no: stu.roll_no,
      student_dept: targetDept,
      status,
      attendance_date: dateStr,
      is_sample: true,
      is_demo: true,
    });
  }

  return records.sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
}

/**
 * Returns canonical departments available for attendance
 */
export { CANONICAL_DEPARTMENTS };
