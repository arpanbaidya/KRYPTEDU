import { describe, it } from "vitest";
import { publishSubjectResultsLogic } from "../lib/academics.functions";
import { OFFICIAL_STUDENTS } from "../lib/official-dataset";
import { clearAuthoritativeAcademicsStorageForTesting } from "../lib/academics";

describe("Performance Benchmarks — Academics Publishing", () => {
  it("Benchmark publishSubjectResultsLogic scaling", async () => {
    clearAuthoritativeAcademicsStorageForTesting();
    const facultyContext = {
      supabase: null,
      userId: "faculty-id",
      claims: { email: "faculty@kryptedu.com" },
    };

    // 1 student
    const t0 = performance.now();
    await publishSubjectResultsLogic(
      {
        subjectId: "cse-s1-01",
        semesterNumber: 1,
        records: [
          {
            studentRollNo: OFFICIAL_STUDENTS[0].roll_no,
            writtenMarks: 45,
            internalMarks: 45,
          },
        ],
      },
      facultyContext
    );
    const d1 = performance.now() - t0;

    // 10 students
    const records10 = OFFICIAL_STUDENTS.slice(0, 10).map((s) => ({
      studentRollNo: s.roll_no,
      writtenMarks: 40,
      internalMarks: 40,
    }));
    const t1 = performance.now();
    await publishSubjectResultsLogic(
      {
        subjectId: "cse-s1-01",
        semesterNumber: 1,
        records: records10,
      },
      facultyContext
    );
    const d10 = performance.now() - t1;

    // 60 students (full cohort)
    const records60 = OFFICIAL_STUDENTS.slice(0, 60).map((s) => ({
      studentRollNo: s.roll_no,
      writtenMarks: 38,
      internalMarks: 38,
    }));
    const t2 = performance.now();
    await publishSubjectResultsLogic(
      {
        subjectId: "cse-s1-01",
        semesterNumber: 1,
        records: records60,
      },
      facultyContext
    );
    const d60 = performance.now() - t2;

    console.log(`[BENCHMARK] 1 student publish: ${d1.toFixed(2)}ms`);
    console.log(`[BENCHMARK] 10 students publish: ${d10.toFixed(2)}ms`);
    console.log(`[BENCHMARK] 60 students publish: ${d60.toFixed(2)}ms`);
  });
});
