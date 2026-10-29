import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCheck, Clock } from "lucide-react";
import { Pill } from "@/components/kr";
import { cn } from "@/lib/utils";
import { studentsQuery } from "@/lib/data";
import { Empty, PageHeader, StudentLink } from "@/components/kr";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — KRYPTEDU" }, { name: "description", content: "Risk alerts and student updates." }, { property: "og:title", content: "Notifications — KRYPTEDU" }, { property: "og:description", content: "Risk alerts and student updates." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(studentsQuery),
  component: Notifications,
});

function Notifications() {
  const { data: students } = useSuspenseQuery(studentsQuery);
  const lowAtt = students.filter((s) => typeof s.attendance === "number" && s.attendance < 75);
  const high = students.filter((s) => s.academicRisk === "High" && s.placementRisk === "High");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.from("notification_reads").select("notification_key").then(({ data, error }) => {
      if (!live) return;
      if (error) toast.error("Couldn't load read status.");
      else setRead(new Set(data.map((r) => r.notification_key)));
      setLoading(false);
    });
    return () => { live = false; };
  }, []);
  const mark = async (ids: string[]) => {
    const fresh = ids.filter((k) => !read.has(k));
    if (!fresh.length) return;
    const prev = read;
    setRead(new Set([...read, ...fresh]));
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = u.user ? await supabase.from("notification_reads").upsert(fresh.map((k) => ({ user_id: u.user!.id, notification_key: k }))) : { error: new Error("Not signed in") };
    setSaving(false);
    if (error) { setRead(prev); toast.error("Couldn't save read status. Please try again."); }
  };
  const allIds = [...lowAtt.map((s) => "att" + s.id), ...high.map((s) => "s" + s.id)];
  const unread = allIds.filter((x) => !read.has(x)).length;
  const showLowAtt = cat === "All" || cat === "Low attendance";
  const showHigh = cat === "All" || cat === "Risk alerts";
  const dot = (k: string) => <span aria-label={read.has(k) ? undefined : "Unread"} className={cn("ml-auto mt-1.5 size-2 shrink-0 rounded-full", read.has(k) ? "bg-transparent" : "bg-primary-deep")} />;
  return (
    <>
      <PageHeader eyebrow={loading ? "Loading…" : `${unread} unread`} title="Notifications" action={!loading && unread > 0 ? <button type="button" disabled={saving} onClick={() => void mark(allIds)} className="press disabled:opacity-50 flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-xs font-medium"><CheckCheck className="size-4" /> {saving ? "Saving…" : "Mark all read"}</button> : undefined} />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">{["All", "Low attendance", "Risk alerts"].map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}</div>
      {lowAtt.length + high.length === 0 ? <Empty title="You're all caught up" /> : (
        <div className="card-surface divide-y">
          {showLowAtt && lowAtt.map((s) => (
            <StudentLink key={"att" + s.id} id={s.id} onClick={() => void mark(["att" + s.id])} className="flex gap-3 p-4 hover:bg-surface">
              <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
              <div><div className="text-sm font-medium">{s.name} attendance is below 75% ({s.attendance}%)</div><div className="text-xs text-subtle">{s.roll_no} · {s.department} · Year {s.year}</div></div>{dot("att" + s.id)}
            </StudentLink>
          ))}
          {showHigh && high.map((s) => (
            <StudentLink key={s.id} id={s.id} onClick={() => void mark(["s" + s.id])} className="flex gap-3 p-4 hover:bg-surface">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
              <div><div className="text-sm font-medium">{s.name} is high risk on both academics and placement</div><div className="text-xs text-subtle">Success Score {s.successScore} · {s.riskFactors.slice(0, 2).join(", ")}</div></div>{dot("s" + s.id)}
            </StudentLink>
          ))}
        </div>
      )}
    </>
  );
}
