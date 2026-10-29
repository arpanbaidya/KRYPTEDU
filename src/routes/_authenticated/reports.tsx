import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { studentsQuery } from "@/lib/data";
import type { Scored } from "@/lib/scoring";
import { Card, PageHeader } from "@/components/kr";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — KRYPTEDU" }, { name: "description", content: "Export student success reports." }, { property: "og:title", content: "Reports — KRYPTEDU" }, { property: "og:description", content: "Export student success reports." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(studentsQuery),
  component: Reports,
});

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  if (rows.length <= 1) toast.info("No matching records — the file has column headers only.");
}
const studentRows = (l: Scored[]) => [
  ["Roll", "Name", "Department", "Year", "CGPA", "Attendance", "Success", "Academic risk", "Placement risk", "Segment"],
  ...l.map((s) => [
    s.roll_no,
    s.name,
    s.department,
    s.year,
    s.rawCgpa !== null ? s.cgpa : "N/A",
    s.rawAttendance !== null ? s.attendance : "N/A",
    s.hasMetrics ? s.successScore : "Pending",
    s.hasMetrics ? s.academicRisk : "Pending",
    s.hasMetrics ? s.placementRisk : "Pending",
    s.segment,
  ]),
];

function Reports() {
  const { data: students } = useSuspenseQuery(studentsQuery);
  const reports = [
    { t: "Full cohort success report", d: `${students.length} students with scores, risks and segments`, go: () => download("kryptedu-cohort.csv", studentRows(students)) },
    { t: "Published attendance report", d: `Official attendance records across 65 weekdays for ${students.length} students (Aug–Oct 2026)`, go: () => download("kryptedu-attendance-cohort.csv", [
      ["Roll No", "Name", "Department", "Attendance %", "Academic Risk", "Status"],
      ...students.map((s) => [
        s.roll_no,
        s.name,
        s.department,
        s.rawAttendance !== null ? `${s.attendance}%` : "N/A",
        s.academicRisk,
        s.attendance >= 75 ? "Satisfactory" : s.attendance >= 60 ? "Warning" : "Critical Deficit",
      ]),
    ]) },
    { t: "At-risk students", d: "High academic or placement risk", go: () => download("kryptedu-at-risk.csv", studentRows(students.filter((s) => s.academicRisk === "High" || s.placementRisk === "High"))) },
    { t: "Academics & CGPA report", d: `Official calculated semester CGPA and backlogs for ${students.length} students`, go: () => download("kryptedu-academics.csv", [
      ["Roll No", "Name", "Department", "CGPA", "Backlogs", "Academic Risk"],
      ...students.map((s) => [s.roll_no, s.name, s.department, s.rawCgpa !== null ? s.cgpa : "N/A", s.backlogs ?? 0, s.academicRisk]),
    ]) },
  ];
  return (
    <>
      <PageHeader eyebrow="Exports" title="Reports" />
      <div className="space-y-3">
        {reports.map((r) => (
          <Card key={r.t} className="flex items-center gap-4">
            <div className="flex-1"><div className="font-medium">{r.t}</div><div className="text-xs text-subtle">{r.d}</div></div>
            <Button variant="secondary" className="rounded-xl border" onClick={r.go}><Download className="size-4" /> CSV</Button>
          </Card>
        ))}
      </div>
    </>
  );
}
