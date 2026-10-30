import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { studentsQuery } from "@/lib/data";
import { Bar, Card, Empty, PageHeader, RiskBadge, ScoreRing, SectionTitle } from "@/components/kr";
import { Badge } from "@/components/ui/badge";
import { getStudentDemoMonthlyStats, getAuthoritativeStudentAttendance } from "@/lib/attendance";
import { score } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student profile — KRYPTEDU" }, { name: "description", content: "Student intelligence profile." }, { property: "og:title", content: "Student profile — KRYPTEDU" }, { property: "og:description", content: "Student intelligence profile." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: async ({ context, params }) => {
    const list = await context.queryClient.ensureQueryData(studentsQuery);
    if (!list.find((s) => s.id === params.id || s.roll_no?.toUpperCase() === params.id?.toUpperCase() || `ust-${s.roll_no?.toLowerCase()}` === params.id?.toLowerCase())) throw notFound();
  },
  component: Profile,
  notFoundComponent: () => <Empty title="Student not found" />,
  errorComponent: ({ error }) => <div role="alert" className="text-sm">{String((error as Error)?.message ?? error)}</div>,
});

// Deterministic trend derived from current values (semester history placeholder for demo data)
function trend(seed: number, end: number, spread: number, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const wobble = Math.sin(seed * 13 + i * 1.7) * spread;
    return +(end - (n - 1 - i) * (spread / 4) + wobble).toFixed(2);
  }).map((v, i, a) => (i === a.length - 1 ? end : v));
}

function Profile() {
  const { id } = Route.useParams();
  const { data: students } = useSuspenseQuery(studentsQuery);
  const sRaw = students.find(
    (x) =>
      x.id === id ||
      x.roll_no?.toUpperCase() === id?.toUpperCase() ||
      `ust-${x.roll_no?.toLowerCase()}` === id?.toLowerCase()
  );
  if (!sRaw) throw notFound();

  // Authoritative real-time attendance fallback & dynamic synchronization
  const liveAtt = getAuthoritativeStudentAttendance(sRaw.roll_no);
  const s =
    liveAtt !== null && (liveAtt !== sRaw.attendance || liveAtt !== sRaw.rawAttendance)
      ? score({ ...sRaw, attendance: liveAtt })
      : sRaw;

  const seed = s.roll_no.charCodeAt(s.roll_no.length - 1);
  const gpa = trend(seed, s.cgpa, 0.6).map((v, i) => ({ sem: `S${i + 1}`, v: Math.min(10, Math.max(4, v)) }));
  
  // Real monthly attendance derived from authoritative published demo dataset (Aug 1 - Oct 31, 2026)
  const monthlyStats = getStudentDemoMonthlyStats(s.roll_no);
  const att = monthlyStats.length > 0
    ? monthlyStats.map((ms) => ({ m: ms.month.split(" ")[0], v: ms.percentage ?? s.attendance, fullMonth: ms.month }))
    : trend(seed + 3, s.attendance, 8).map((v, i) => ({ m: ["Aug", "Sep", "Oct"][i] || "M", v: Math.min(100, Math.max(30, Math.round(v))), fullMonth: "2026" }));

  const tt = { borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 };

  return (
    <>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Students</Link>
      <PageHeader
        eyebrow={`${s.roll_no} · ${s.department} · Year ${s.year}`}
        title={s.name}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-4">
          <ScoreRing value={s.successScore} />
          <div className="flex flex-wrap justify-center gap-2">
            <RiskBadge risk={s.academicRisk} label="Academic" />
            <RiskBadge risk={s.placementRisk} label="Placement" />
          </div>
          <div className="text-center text-xs text-subtle">{s.segment}</div>
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle title="Score components" />
          {!s.hasMetrics ? (
            <div className="py-4 text-xs text-muted-foreground bg-secondary/20 p-4 rounded-xl border">
              Institutional academic, attendance, and placement evaluation records are pending data sync for Batch 2024.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Bar label="Academic index (45%)" value={s.academicIndex} />
              <Bar label="Placement index (35%)" value={s.placementIndex} />
              <Bar label="Engagement (20%)" value={s.engagement} />
              <Bar label="Attendance" value={s.attendance} right={s.rawAttendance !== null ? `${s.attendance}%` : "N/A"} />
              <Bar label="LMS activity" value={s.lms_activity} />
              <Bar label="CGPA" value={s.rawCgpa !== null ? s.cgpa * 10 : 0} right={s.rawCgpa !== null ? s.cgpa.toFixed(2) : "N/A"} />
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle title="Academic trend (CGPA)" />
          {s.rawCgpa !== null ? (
            <div className="h-40">
              <ResponsiveContainer>
                <LineChart data={gpa}>
                  <XAxis dataKey="sem" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[4, 10]} fontSize={11} width={24} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tt} />
                  <Line dataKey="v" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-chart-1)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-xs text-muted-foreground text-center p-4">
              <span>Official semester examination records pending publication</span>
              <span className="text-[10px] text-subtle mt-1">Awaiting curriculum mapping for {s.department}</span>
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle title="Attendance history" />
          <div className="h-40"><ResponsiveContainer><LineChart data={att}><XAxis dataKey="m" fontSize={11} tickLine={false} axisLine={false} /><YAxis domain={[30, 100]} fontSize={11} width={24} tickLine={false} axisLine={false} /><Tooltip contentStyle={tt} formatter={(val) => [`${val}%`, "Attendance"]} /><Line dataKey="v" stroke="var(--color-chart-3)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: "var(--color-chart-3)" }} /></LineChart></ResponsiveContainer></div>
        </Card>
        <Card>
          <SectionTitle title="Placement readiness & risk" />
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium pb-2 border-b">
              <span className="flex items-center gap-1.5">
                Risk:
                <span className={`font-semibold ${s.placementRisk === 'High' ? 'text-red-500' : s.placementRisk === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {s.placementRisk}
                </span>
              </span>
              <span>
                Readiness: <strong>{s.placementReadinessScore !== null ? `${s.placementReadinessScore}/100` : "N/A"}</strong>
              </span>
            </div>
            <Bar label="Academic foundation (25%)" value={s.rawCgpa !== null ? s.cgpa * 10 : 0} right={s.rawCgpa !== null ? `${s.cgpa.toFixed(2)}` : "N/A"} />
            <Bar label="Technical skills (25%)" value={s.skills_score} right={s.rawSkillsScore !== null ? `${s.skills_score}` : "N/A"} />
            <Bar label="Mock interview (20%)" value={s.feedback_score} right={s.rawFeedbackScore !== null ? `${s.feedback_score}` : "N/A"} />
            <Bar label="Placement prep (20%)" value={s.placement_readiness} right={s.rawPlacementReadiness !== null ? `${s.placement_readiness}` : "N/A"} />
            <Bar label="Attendance (10%)" value={s.attendance} right={s.rawAttendance !== null ? `${s.attendance}%` : "N/A"} />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <SectionTitle title="Contributing risk factors" />
          {s.riskFactors.length === 0 ? <div className="text-sm text-muted-foreground">No significant risk factors.</div> : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {s.riskFactors.map((r) => <li key={r} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm"><span className="size-1.5 rounded-full bg-primary" />{r}</li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
