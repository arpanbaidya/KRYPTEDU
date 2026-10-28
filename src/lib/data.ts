import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { score, type StudentRow, type Scored } from "./scoring";
import { OFFICIAL_STUDENTS } from "./official-dataset";
import { CANONICAL_DEPARTMENTS, normalizeDepartment } from "./departments";
import { getAuthoritativeDemoAttendanceMap } from "./attendance";
import { getAuthoritativeAcademicsCgpaMap } from "./academics";

// Authoritative fallback map generated directly from the official Google Sheet dataset
const fallbackStudents: StudentRow[] = OFFICIAL_STUDENTS.map((s) => ({
  id: `ust-${s.roll_no.toLowerCase()}`,
  roll_no: s.roll_no,
  name: s.name,
  department: s.department,
  year: s.year,
  cgpa: null,
  attendance: null,
  lms_activity: null,
  engagement: null,
  placement_readiness: null,
  skills_score: null,
  feedback_score: null,
  backlogs: null,
}));

/**
 * Central query for the scored student list.
 * - Prioritizes official dataset and database records.
 * - Synchronises authoritative CGPA from the Academics module.
 * - Strictly excludes old demo/dummy students ('KR2024...').
 * - Restricts departments to canonical institutional departments.
 * - Implements 60s staleTime for high performance and instant page navigation.
 */
export const studentsQuery = queryOptions({
  queryKey: ["students"],
  staleTime: 60_000, // 1 minute client caching for instant page transitions
  gcTime: 5 * 60_000,
  queryFn: async (): Promise<Scored[]> => {
    try {
      const [{ data, error }, fb] = await Promise.all([
        supabase
          .from("students")
          .select(
            "id, roll_no, name, department, year, cgpa, attendance, lms_activity, engagement, placement_readiness, skills_score, backlogs, user_id"
          )
          .order("name"),
        Promise.race([
          supabase.rpc("student_feedback").catch(() => ({ data: [] })),
          new Promise<{ data: any[] }>((resolve) => setTimeout(() => resolve({ data: [] }), 1200)),
        ]),
      ]);

      const attMap = getAuthoritativeDemoAttendanceMap();
      const academicsCgpaMap = getAuthoritativeAcademicsCgpaMap();

      if (error || !data || data.length === 0) {
        return fallbackStudents.map((s) => {
          const rNo = s.roll_no?.toUpperCase();
          return score({
            ...s,
            cgpa: academicsCgpaMap[rNo] ?? academicsCgpaMap[s.roll_no] ?? null,
            attendance: attMap[rNo] ?? attMap[s.roll_no] ?? attMap[s.id] ?? null,
          });
        });
      }

      // Filter out any legacy dummy records ('KR2024...')
      const genuine = data.filter((s) => !s.roll_no?.startsWith("KR2024"));
      if (genuine.length === 0) {
        return fallbackStudents.map((s) => {
          const rNo = s.roll_no?.toUpperCase();
          return score({
            ...s,
            cgpa: academicsCgpaMap[rNo] ?? academicsCgpaMap[s.roll_no] ?? null,
            attendance: attMap[rNo] ?? attMap[s.roll_no] ?? attMap[s.id] ?? null,
          });
        });
      }

      // Ensure department is normalized to canonical departments and use authoritative CGPA & attendance
      const normalizedList = genuine.map((s) => {
        const normDept = normalizeDepartment(s.department) || "Computer Engineering";
        const rNo = s.roll_no ? s.roll_no.toUpperCase() : "";
        const authoritativeAtt =
          attMap[rNo] ??
          attMap[s.roll_no] ??
          attMap[s.id] ??
          (s.attendance !== null && s.attendance !== undefined ? Number(s.attendance) : null);
        const authoritativeCgpa =
          academicsCgpaMap[rNo] ??
          academicsCgpaMap[s.roll_no] ??
          (s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa) : null);

        return {
          ...s,
          department: normDept,
          cgpa: authoritativeCgpa,
          attendance: authoritativeAtt,
        };
      });

      const feedback = new Map((fb?.data ?? []).map((r: any) => [r.id, r.feedback_score]));
      return (normalizedList as unknown as StudentRow[]).map((s) =>
        score({ ...s, feedback_score: feedback.get(s.id) ?? null })
      );
    } catch {
      const attMap = getAuthoritativeDemoAttendanceMap();
      const academicsCgpaMap = getAuthoritativeAcademicsCgpaMap();
      return fallbackStudents.map((s) =>
        score({
          ...s,
          cgpa: academicsCgpaMap[s.roll_no] ?? null,
          attendance: attMap[s.roll_no] ?? attMap[s.id] ?? null,
        })
      );
    }
  },
});

export type Intervention = {
  id: string;
  student_id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string;
  due_date: string | null;
  notes: string;
  created_at: string;
};

export const interventionsQuery = queryOptions({
  queryKey: ["interventions"],
  staleTime: 60_000,
  queryFn: async () => {
    try {
      const { data, error } = await supabase
        .from("interventions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data || []) as Intervention[];
    } catch {
      return [];
    }
  },
});

export const importsQuery = queryOptions({
  queryKey: ["imports"],
  staleTime: 60_000,
  queryFn: async () => {
    try {
      const { data, error } = await supabase
        .from("data_imports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
});

export function avg(nums: number[]) {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

/**
 * Calculates average for an array of nullable numbers (e.g. CGPAs).
 * Strictly excludes null, undefined, or NaN instead of treating them as zero.
 * Returns null if no valid numbers are provided.
 */
export function avgNullable(nums: (number | null | undefined)[]): number | null {
  const valid = nums.filter(
    (n): n is number => n !== null && n !== undefined && Number.isFinite(n)
  );
  return valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : null;
}
