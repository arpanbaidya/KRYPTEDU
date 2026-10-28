import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery } from "@tanstack/react-query";
import { askInsights } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { score, type StudentRow } from "@/lib/scoring";
import {
  Send,
  Loader2,
  CreditCard,
  CalendarCheck,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  FileText,
  Sparkles,
  BarChart2,
  ExternalLink,
  Clock,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAuthoritativeDemoAttendanceMap } from "@/lib/attendance";
import { getAuthoritativeAcademicsCgpaMap } from "@/lib/academics";
import { OFFICIAL_STUDENTS } from "@/lib/official-dataset";

export const Route = createFileRoute("/_authenticated/student-dashboard")({
  component: StudentDashboard,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

function StudentDashboard() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"advisor" | "academics" | "resources">("advisor");

  const { data: student, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      let studentData: any = null;

      // 1. Try finding by user_id
      try {
        const { data } = await supabase
          .from('students')
          .select('id, roll_no, name, department, year, cgpa, attendance, lms_activity, engagement, placement_readiness, skills_score, backlogs, user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (data) {
          // If linked record is a legacy dummy student (e.g. KR2024001 Aarav Patel), disassociate it
          if (data.roll_no?.startsWith('KR') || data.name?.toLowerCase().includes('aarav')) {
            try {
              await supabase.from('students').update({ user_id: null }).eq('id', data.id);
            } catch {
              // ignore
            }
          } else {
            studentData = data;
          }
        }
      } catch {
        // ignore
      }

      // 2. If not found by user_id, check if user is Arpan Baidya or designated student login
      if (!studentData) {
        const email = userData.user.email?.toLowerCase() || "";
        let isStudentRole = false;
        try {
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .maybeSingle();
          if (roleRow?.role === "student") isStudentRole = true;
        } catch {
          // ignore
        }

        const isArpanOrStudent =
          isStudentRole ||
          email === "student@kryptedu.com" ||
          email === "arpan.baidya@ustu.edu.in" ||
          email === "arpan@kryptedu.com" ||
          email === "student" ||
          email.includes("arpan") ||
          email.includes("baidya") ||
          email.includes("ust24r0102020");

        if (isArpanOrStudent) {
          try {
            const { data: arpanDb } = await supabase
              .from('students')
              .select('id, roll_no, name, department, year, cgpa, attendance, lms_activity, engagement, placement_readiness, skills_score, backlogs, user_id')
              .eq('roll_no', 'UST24R0102020')
              .maybeSingle();

            if (arpanDb) {
              studentData = arpanDb;
              // Link user_id in database for persistence
              try {
                await supabase
                  .from('students')
                  .update({ user_id: userData.user.id })
                  .eq('roll_no', 'UST24R0102020');
              } catch {
                // ignore
              }
            }
          } catch {
            // ignore
          }

          if (!studentData) {
            const arpanOff = OFFICIAL_STUDENTS.find((s) => s.roll_no === 'UST24R0102020');
            if (arpanOff) {
              studentData = {
                id: `ust-${arpanOff.roll_no.toLowerCase()}`,
                roll_no: arpanOff.roll_no,
                name: arpanOff.name,
                department: arpanOff.department,
                year: arpanOff.year,
                user_id: userData.user.id,
                cgpa: arpanOff.cgpa,
                attendance: arpanOff.attendance,
                lms_activity: arpanOff.lms_activity,
                engagement: arpanOff.engagement,
                placement_readiness: arpanOff.placement_readiness,
                skills_score: arpanOff.skills_score,
                backlogs: arpanOff.backlogs,
              };
            }
          }
        }
      }

      if (!studentData) {
        throw new Error("Student profile is not linked to your user account.");
      }

      const officialRecord = OFFICIAL_STUDENTS.find((s) => s.roll_no === studentData.roll_no);

      let fbScore = null;
      try {
        const { data: fb } = await supabase.rpc('student_feedback');
        fbScore = fb?.[0]?.feedback_score ?? null;
      } catch {
        // ignore
      }

      const attMap = getAuthoritativeDemoAttendanceMap();
      const academicsCgpaMap = getAuthoritativeAcademicsCgpaMap();
      const authoritativeAtt =
        attMap[studentData.roll_no] ??
        attMap[studentData.roll_no?.toUpperCase()] ??
        attMap[studentData.roll_no?.toLowerCase()] ??
        attMap[studentData.id] ??
        (studentData.attendance !== null && studentData.attendance !== undefined ? Number(studentData.attendance) : null);
      const authoritativeCgpa =
        academicsCgpaMap[studentData.roll_no] ??
        academicsCgpaMap[studentData.roll_no?.toUpperCase()] ??
        (studentData.cgpa !== null && studentData.cgpa !== undefined ? Number(studentData.cgpa) : null);

      const scoredStudent = score({
        ...(studentData as unknown as StudentRow),
        cgpa: authoritativeCgpa,
        attendance: authoritativeAtt,
        feedback_score: fbScore,
      });

      return {
        ...scoredStudent,
        attendance: authoritativeAtt,
        rawAttendance: authoritativeAtt,
        cgpa: authoritativeCgpa,
        rawCgpa: authoritativeCgpa,
        email: officialRecord?.email || `${studentData.roll_no.toLowerCase()}@ustu.edu.in`,
        programme: officialRecord?.programme || `B.Tech ${studentData.department}`,
        section: officialRecord?.section || "Div A Batch I",
        batch_year: officialRecord?.batch_year || 2024,
      };
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (msgs: ChatMsg[]) => {
      return askInsights({ data: { messages: msgs } });
    },
    onSuccess: (data) => {
      if (data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      } else if (data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    }
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const newMsgs: ChatMsg[] = [...messages, { role: "user", content: input }];
    setMessages(newMsgs);
    setInput("");
    chatMutation.mutate(newMsgs);
  };

  const renderMessageContent = (content: string) => {
    try {
      const json = JSON.parse(content);
      return (
        <div className="space-y-4">
          <div>
            <strong className="text-primary block">Summary</strong>
            <p className="text-sm">{json.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <strong className="text-green-600 block">Strengths</strong>
                <ul className="list-disc pl-4 text-sm">
                   {json.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
             </div>
             <div>
                <strong className="text-orange-600 block">Areas for Improvement</strong>
                <ul className="list-disc pl-4 text-sm">
                   {json.improvement_areas?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
             </div>
          </div>
          <div>
            <strong className="text-blue-600 block">Recommended Actions</strong>
            <ul className="list-disc pl-4 text-sm">
               {json.recommended_actions?.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
             <p>Timeline: {json.suggested_timeline}</p>
             <p>Caveats: {json.caveats}</p>
          </div>
        </div>
      );
    } catch (e) {
      return <p className="text-sm whitespace-pre-wrap">{content}</p>;
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!student) return <div className="p-8 text-center text-red-500">Failed to load student profile</div>;

  return (
    <div className="container mx-auto p-4 md:p-8 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Student Portal</span>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {student.name}</h1>
        </div>

        {/* Linked Institutional Student Profile Card */}
        <Card className="border-border overflow-hidden bg-card shadow-soft">
          <CardHeader className="bg-muted/40 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Institutional Profile</span>
                <CardTitle className="text-base font-bold text-foreground">{student.name}</CardTitle>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] font-semibold">
                Linked · Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-3 space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Roll Number</span>
              <span className="font-mono font-semibold text-foreground">{student.roll_no}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Department</span>
              <span className="font-semibold text-foreground">{student.department}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Programme</span>
              <span className="font-medium text-foreground">{student.programme || `B.Tech ${student.department}`}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground font-medium">Year & Section</span>
              <span className="font-medium text-foreground">Year {student.year} ({student.section || "Div A Batch I"})</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground font-medium">Student Email</span>
              <span className="font-mono text-[11px] text-foreground">{student.email || `${student.roll_no.toLowerCase()}@ustu.edu.in`}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <CardTitle>Your Success Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div>
               <div className="flex justify-between mb-1">
                 <span className="text-sm font-medium">Success Score</span>
                 <span className="text-sm font-bold text-primary">{student.successScore}/100</span>
               </div>
               <div className="w-full bg-secondary rounded-full h-2">
                 <div className="bg-primary rounded-full h-2" style={{ width: `${student.successScore}%` }} />
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4 pt-4 border-t">
               <div>
                 <p className="text-xs text-muted-foreground uppercase">Academic Risk</p>
                 <p className={`font-bold ${student.academicRisk === 'High' ? 'text-red-500' : student.academicRisk === 'Medium' ? 'text-orange-500' : 'text-green-500'}`}>
                   {student.academicRisk}
                 </p>
               </div>
               <div>
                 <p className="text-xs text-muted-foreground uppercase">Placement Risk</p>
                 <p className={`font-bold ${student.placementRisk === 'High' ? 'text-red-500' : student.placementRisk === 'Medium' ? 'text-orange-500' : 'text-green-500'}`}>
                   {student.placementRisk}
                 </p>
                 {student.placementRiskScore !== null && (
                   <p className="text-[10px] text-muted-foreground mt-0.5">
                     Risk score: {student.placementRiskScore} (Readiness: {student.placementReadinessScore})
                   </p>
                 )}
               </div>
             </div>
             
             {student.riskFactors.length > 0 && (
               <div className="pt-4 border-t">
                 <p className="text-xs text-muted-foreground uppercase mb-2">Risk Factors Identified</p>
                 <ul className="text-sm space-y-1">
                   {student.riskFactors.map((r, i) => <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {r}</li>)}
                 </ul>
               </div>
             )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>My Attendance</span>
              <CalendarCheck className="size-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-emerald-700">
                {student.rawAttendance !== null && student.rawAttendance !== undefined
                  ? `${student.rawAttendance}%`
                  : "N/A"}
              </span>
              {student.rawAttendance !== null && student.rawAttendance !== undefined ? (
                <Badge
                  variant="outline"
                  className={
                    student.rawAttendance >= 75
                      ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/20 font-semibold text-[11px]"
                      : "text-amber-700 bg-amber-500/10 border-amber-500/20 font-semibold text-[11px]"
                  }
                >
                  {student.rawAttendance >= 75 ? "Compliant (≥75%)" : "Low Attendance (<75%)"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[11px]">
                  Pending Publication
                </Badge>
              )}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 rounded-full h-2 transition-all duration-300"
                style={{ width: `${Math.min(100, student.attendance || 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
              <span>Tracked Sessions</span>
              <span className="font-semibold text-foreground font-mono">65 Sessions</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Official lecture attendance across published semester dates.
            </p>
            <Link
              to="/attendance"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
            >
              <CalendarCheck className="size-3.5" />
              View Attendance Calendar & Records
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Course Fee & Payments</span>
              <CreditCard className="size-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Review your enrolled course fees, pay outstanding balance via Razorpay, and download receipts.
            </p>
            <Link
              to="/payments"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
            >
              <CreditCard className="size-3.5" />
              View Fee & Pay Online
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 flex flex-col space-y-6">
        <div className="w-full">
          <div className="grid w-full grid-cols-3 rounded-xl h-11 p-1 bg-muted/60 border border-border/40">
            <button
              type="button"
              onClick={() => setActiveTab("advisor")}
              className={`text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "advisor"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5" /> AI Advisor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("academics")}
              className={`text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "academics"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="size-3.5" /> Academics & Results
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("resources")}
              className={`text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "resources"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="size-3.5" /> Resources
            </button>
          </div>

          {/* TAB 1: AI Academic Advisor */}
          {activeTab === "advisor" && (
            <div className="mt-4">
            <Card className="flex flex-col flex-1 shadow-md border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">AI Academic Advisor</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Personalised guidance tailored to your success score, attendance, and placement goals.
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20">
                  {student.name} · {student.roll_no}
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                <ScrollArea className="flex-1 p-4" style={{ height: "420px" }}>
                  {messages.length === 0 ? (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground space-y-3 p-6 text-center">
                      <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                        <Sparkles className="size-6" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        Hello {student.name}, how can I help you today?
                      </p>
                      <p className="text-xs max-w-sm text-muted-foreground">
                        Ask about your semester coursework, attendance percentage ({student.rawAttendance !== null ? `${student.rawAttendance}%` : "official records"}),
                        placement readiness ({student.rawPlacementReadiness !== null ? `${student.rawPlacementReadiness}/100` : "in evaluation"}), or revision strategies.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInput("How can I improve my placement readiness for software roles?");
                          }}
                          className="text-xs rounded-full border border-border px-3 py-1.5 bg-background hover:bg-secondary transition-colors"
                        >
                          Placement readiness tips →
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInput("What is my current attendance status and compliance?");
                          }}
                          className="text-xs rounded-full border border-border px-3 py-1.5 bg-background hover:bg-secondary transition-colors"
                        >
                          Attendance compliance check →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-lg p-4 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"}`}
                          >
                            {m.role === "user" ? <p className="text-sm">{m.content}</p> : renderMessageContent(m.content)}
                          </div>
                        </div>
                      ))}
                      {chatMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] rounded-lg p-4 bg-muted border flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />{" "}
                            <span className="text-sm">Analysing academic indicators...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-4 border-t bg-background">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask your academic advisor..."
                      disabled={chatMutation.isPending}
                      className="flex-1 rounded-xl"
                    />
                    <Button type="submit" disabled={!input.trim() || chatMutation.isPending} className="rounded-xl">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* TAB 2: Academics & Results */}
          {activeTab === "academics" && (
            <div className="mt-4 space-y-4">
            <Card className="shadow-sm border-border">
              <CardHeader className="bg-muted/30 border-b pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold">Academics & Semester Grade Register</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      B.Tech {student.department} · Year {student.year} · Universal College of Engineering
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs w-fit">
                    Official Enrolment Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[11px] uppercase text-muted-foreground font-semibold">Pointer / CGPA</span>
                    <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                      {student.rawCgpa !== null && student.rawCgpa !== undefined ? Number(student.rawCgpa).toFixed(2) : "N/A"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {student.rawCgpa !== null ? "Out of 10.0 scale" : "Awaiting Publication"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[11px] uppercase text-muted-foreground font-semibold">Backlogs</span>
                    <p className="text-2xl font-bold tracking-tight text-emerald-600 mt-0.5">
                      {student.rawBacklogs !== null && student.rawBacklogs !== undefined ? student.rawBacklogs : 0}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Clear standing</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[11px] uppercase text-muted-foreground font-semibold">Section / Group</span>
                    <p className="text-sm font-bold tracking-tight text-foreground mt-1 truncate">
                      {student.section || "Div A Batch I"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Batch {student.batch_year || 2024}</span>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[11px] uppercase text-muted-foreground font-semibold">Attendance</span>
                    <p className="text-2xl font-bold tracking-tight text-emerald-600 mt-0.5">
                      {student.attendance !== null && student.attendance !== undefined ? `${student.attendance}%` : "Pending"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Official Sessions</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2.5 text-xs font-semibold text-foreground flex items-center justify-between border-b">
                    <span>Enrolled Course Subjects & Semester Registration</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Semester 1 · Active</span>
                  </div>
                  <div className="divide-y divide-border/50 text-xs">
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Applied Mathematics I</div>
                      <div className="col-span-2 text-muted-foreground">4 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. Rajesh Giri</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Applied Chemistry I</div>
                      <div className="col-span-2 text-muted-foreground">3 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. Komal Jain</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Applied Chemistry Lab</div>
                      <div className="col-span-2 text-muted-foreground">1 Credit</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. Komal Jain</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Problem Solving And Programming</div>
                      <div className="col-span-2 text-muted-foreground">3 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. John Kenny</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Problem Solving And Programming Lab</div>
                      <div className="col-span-2 text-muted-foreground">1.5 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. John Kenny</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Engineering Graphics And Design</div>
                      <div className="col-span-2 text-muted-foreground">3 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Dr. Shivam Shukla</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Entrepreneurship Fundamentals</div>
                      <div className="col-span-2 text-muted-foreground">2 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. Swapnil</div>
                    </div>
                    <div className="grid grid-cols-12 p-3 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-6 font-medium">Personality Development And Effective Communication I</div>
                      <div className="col-span-2 text-muted-foreground">2 Credits</div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className="text-[11px] bg-sky-500/10 text-sky-600 border-sky-500/20 font-medium">Enrolled</Badge>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground italic text-[11px]">Prof. Umama</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-muted-foreground italic">
                    Note: Authoritative curriculum for B.Tech {student.department} (Semester 1). Total 20 Credits.
                  </p>
                  <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 h-8">
                    <Link to="/academics">
                      <GraduationCap className="size-3.5 text-primary" />
                      Open Academics & Grade Register →
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* TAB 3: Assignments & Resources */}
          {activeTab === "resources" && (
            <div className="mt-4 space-y-4">
              <Card className="shadow-sm border-border">
                <CardHeader className="bg-muted/30 border-b pb-3">
                  <CardTitle className="text-base font-bold">Course Modules & Learning Resources</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Curated resources for B.Tech Computer Engineering (Year 1 · Div A Batch I).
                  </p>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <div className="divide-y divide-border/60 text-xs">
                    <div className="py-3 flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Data Structures Lab Sheet & Practice Problems</p>
                          <p className="text-[11px] text-muted-foreground">Trees, Binary Search, and Graph Traversal in C++ · Prof. CS Dept</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl text-[11px] h-8">
                        View PDF
                      </Button>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0 mt-0.5">
                          <BookOpen className="size-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Computer Organization Lecture Slides (Week 1–12)</p>
                          <p className="text-[11px] text-muted-foreground">Instruction sets, ALU design, memory hierarchy · Department Repository</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl text-[11px] h-8">
                        Open Slides
                      </Button>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 place-items-center rounded-lg bg-purple-500/10 text-purple-600 shrink-0 mt-0.5">
                          <GraduationCap className="size-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Campus Placement Preparation Track</p>
                          <p className="text-[11px] text-muted-foreground">Technical interview questions, DSA drills, and mock evaluation studio</p>
                        </div>
                      </div>
                      <Button asChild size="sm" className="rounded-xl text-[11px] h-8">
                        <Link to="/interview">Start Interview Practice</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
