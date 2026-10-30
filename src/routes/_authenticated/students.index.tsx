import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useDeferredValue } from "react";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { studentsQuery } from "@/lib/data";
import { Card, Empty, PageHeader, Pill, RiskBadge, StudentLink } from "@/components/kr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthoritativeStudentAttendance } from "@/lib/attendance";
import { score } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/students/")({
  head: () => ({
    meta: [
      { title: "Students — KRYPTEDU" },
      { name: "description", content: "Student directory with success scores and risk." },
      { property: "og:title", content: "Students — KRYPTEDU" },
      { property: "og:description", content: "Student directory with success scores and risk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(studentsQuery),
  component: Students,
  errorComponent: ({ error }) => (
    <div role="alert" className="text-sm">
      {String((error as Error)?.message ?? error)}
    </div>
  ),
});

const RISK = ["All", "High academic", "High placement"] as const;
const PAGE_SIZE = 25;

function Students() {
  const { data } = useSuspenseQuery(studentsQuery);
  const [searchInput, setSearchInput] = useState("");
  const deferredQ = useDeferredValue(searchInput);

  const [dept, setDept] = useState("All");
  const [risk, setRisk] = useState<(typeof RISK)[number]>("All");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  const filtered = searchInput !== "" || dept !== "All" || risk !== "All";
  const depts = useMemo(() => ["All", ...new Set(data.map((s) => s.department))], [data]);

  const list = useMemo(() => {
    const qLower = deferredQ.toLowerCase();
    const liveSynced = data.map((student) => {
      const liveAtt = getAuthoritativeStudentAttendance(student.roll_no);
      if (liveAtt !== null && (liveAtt !== student.attendance || liveAtt !== student.rawAttendance)) {
        return score({ ...student, attendance: liveAtt });
      }
      return student;
    });

    const result = liveSynced.filter((s) => {
      const matchDept = dept === "All" || s.department === dept;
      const matchRisk =
        risk === "All" ||
        (risk === "High academic" ? s.academicRisk === "High" : s.placementRisk === "High");
      const matchSearch =
        !qLower ||
        s.name.toLowerCase().includes(qLower) ||
        s.roll_no.toLowerCase().includes(qLower);

      return matchDept && matchRisk && matchSearch;
    });

    return result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "score-asc") return a.successScore - b.successScore;
      if (sort === "score-desc") return b.successScore - a.successScore;
      return b.attendance - a.attendance;
    });
  }, [data, deferredQ, dept, risk, sort]);

  const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  const handleDeptSelect = (d: string) => {
    setDept(d);
    setPage(1);
  };

  const handleRiskSelect = (r: (typeof RISK)[number]) => {
    setRisk(r);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setDept("All");
    setRisk("All");
    setPage(1);
  };

  return (
    <>
      <PageHeader eyebrow={`${data.length} students enrolled`} title="Student directory" />

      {/* Debounced Search */}
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          placeholder="Search by student name or unique registration roll number..."
          className="h-12 rounded-xl pl-11 pr-11"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setPage(1);
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Canonical Department Filters */}
      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2">
        {depts.map((d) => (
          <Pill key={d} active={dept === d} onClick={() => handleDeptSelect(d)}>
            {d}
          </Pill>
        ))}
      </div>

      {/* Risk Filters */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {RISK.map((r) => (
          <Pill key={r} active={risk === r} onClick={() => handleRiskSelect(r)}>
            {r}
          </Pill>
        ))}
      </div>

      {/* Summary & Sorting Bar */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.length)} of {list.length} students{" "}
          {filtered && `(filtered from ${data.length})`}
        </span>
        <div className="flex items-center gap-2">
          {filtered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="press rounded-full px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              Clear filters
            </button>
          )}
          <select
            aria-label="Sort students"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-full border bg-card px-3 text-xs"
          >
            <option value="name">Name A–Z</option>
            <option value="score-asc">Lowest score first</option>
            <option value="score-desc">Highest score first</option>
            <option value="att">Attendance</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty title="No students match" text="Try a different search or department filter." />
      ) : (
        <>
          {/* Mobile Card List */}
          <div className="space-y-2 md:hidden">
            {paginatedList.map((s) => (
              <StudentLink key={s.id} id={s.id} className="card-surface block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-xs text-subtle">
                      {s.roll_no} · {s.department}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">
                      {s.hasMetrics ? s.successScore : "—"}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-subtle">
                      {s.hasMetrics ? "Success" : "Pending"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>CGPA {s.rawCgpa !== null ? s.cgpa.toFixed(2) : "N/A"}</span>
                  <span>·</span>
                  <span>Att {s.rawAttendance !== null ? `${s.attendance}%` : "—"}</span>
                  <span className="ml-auto flex gap-1">
                    {s.hasMetrics ? (
                      <>
                        <RiskBadge risk={s.academicRisk} label="A" />
                        <RiskBadge risk={s.placementRisk} label="P" />
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                        New Enrolment
                      </Badge>
                    )}
                  </span>
                </div>
              </StudentLink>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-subtle bg-secondary/30">
                  <tr>
                    {["Student", "Department", "CGPA", "Attendance", "Success", "Academic risk", "Placement risk"].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 font-semibold">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedList.map((s) => (
                    <tr key={s.id} className="hover:bg-surface transition-colors">
                      <td className="px-4 py-3">
                        <StudentLink id={s.id} className="font-semibold text-foreground hover:underline">
                          {s.name}
                        </StudentLink>
                        <div className="text-xs text-subtle font-mono">{s.roll_no}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-medium">{s.department}</td>
                      <td className="px-4 py-3 tabular-nums font-mono">
                        {s.rawCgpa !== null ? s.cgpa.toFixed(2) : <span className="text-muted-foreground font-sans">N/A</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {s.rawAttendance !== null ? (
                          `${s.attendance}%`
                        ) : (
                          <span className="text-muted-foreground font-sans">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums">
                        {s.hasMetrics ? (
                          s.successScore
                        ) : (
                          <span className="text-muted-foreground text-xs italic font-normal">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.hasMetrics ? (
                          <RiskBadge risk={s.academicRisk} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.hasMetrics ? (
                          <RiskBadge risk={s.placementRisk} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-secondary/20 px-5 py-3 text-xs">
                <span className="text-muted-foreground">
                  Page {page} of {totalPages} ({list.length} total students)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 gap-1 rounded-xl text-xs"
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 gap-1 rounded-xl text-xs"
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
