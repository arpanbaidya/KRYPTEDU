import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  score,
  SCORING_CONFIG,
  type StudentRow,
  type Scored,
  SUPPORT_GROUPS,
  supportGroups,
  SEGMENTS,
} from "./scoring";
import { generateSuggestions } from "./interventions";
import { callGemini, isGeminiConfigured } from "./gemini.server";

type Msg = { role: "user" | "assistant"; content: string };

type AggregatedAnalytics = {
  totalStudents: number;
  avgSuccessScore: number;
  avgAcademicIndex: number;
  avgPlacementIndex: number;
  academicRisk: { High: number; Medium: number; Low: number };
  placementRisk: { High: number; Medium: number; Low: number };
  segments: Record<string, number>;
  supportGroups: Record<string, number>;
  byDepartment: {
    dept: string;
    count: number;
    avgScore: number;
    avgAtt: number;
    avgCgpa: number;
    highRiskCount: number;
  }[];
  byYear: { year: number; count: number; avgScore: number }[];
  urgentStudents: {
    roll_no: string;
    name: string;
    department: string;
    year: number;
    score: number;
    acadRisk: string;
    plcRisk: string;
    topRisk: string;
  }[];
  highAcademicLowPlacement: {
    roll_no: string;
    name: string;
    department: string;
    score: number;
    cgpa: number;
    plcScore: number;
  }[];
  commonRiskFactors: { factor: string; count: number }[];
  insufficientDataCount: number;
};

export function computeAnalytics(students: Scored[]): AggregatedAnalytics {
  const total = students.length;
  if (total === 0) {
    return {
      totalStudents: 0,
      avgSuccessScore: 0,
      avgAcademicIndex: 0,
      avgPlacementIndex: 0,
      academicRisk: { High: 0, Medium: 0, Low: 0 },
      placementRisk: { High: 0, Medium: 0, Low: 0 },
      segments: {},
      supportGroups: {},
      byDepartment: [],
      byYear: [],
      urgentStudents: [],
      highAcademicLowPlacement: [],
      commonRiskFactors: [],
      insufficientDataCount: 0,
    };
  }

  const avgSuccess = Math.round(
    students.reduce((a, s) => a + s.successScore, 0) / total,
  );
  const avgAcademic = Math.round(
    students.reduce((a, s) => a + s.academicIndex, 0) / total,
  );
  const avgPlacement = Math.round(
    students.reduce((a, s) => a + s.placementIndex, 0) / total,
  );

  const academicRisk = {
    High: students.filter((s) => s.academicRisk === "High").length,
    Medium: students.filter((s) => s.academicRisk === "Medium").length,
    Low: students.filter((s) => s.academicRisk === "Low").length,
  };

  const placementRisk = {
    High: students.filter((s) => s.placementRisk === "High").length,
    Medium: students.filter((s) => s.placementRisk === "Medium").length,
    Low: students.filter((s) => s.placementRisk === "Low").length,
  };

  const segments: Record<string, number> = {};
  for (const seg of SEGMENTS) {
    segments[seg] = students.filter((s) => s.segment === seg).length;
  }

  const sGroups: Record<string, number> = {};
  for (const g of SUPPORT_GROUPS) {
    sGroups[g.id] = students.filter((s) => supportGroups(s).includes(g.id)).length;
  }

  const depts = [...new Set(students.map((s) => s.department))];
  const byDepartment = depts
    .map((d) => {
      const list = students.filter((s) => s.department === d);
      return {
        dept: d,
        count: list.length,
        avgScore: Math.round(
          list.reduce((a, s) => a + s.successScore, 0) / list.length,
        ),
        avgAtt: Math.round(
          list.reduce((a, s) => a + s.attendance, 0) / list.length,
        ),
        avgCgpa: +(
          list.reduce((a, s) => a + s.cgpa, 0) / list.length
        ).toFixed(2),
        highRiskCount: list.filter(
          (s) => s.academicRisk === "High" || s.placementRisk === "High",
        ).length,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  const years = [...new Set(students.map((s) => s.year))].sort();
  const byYear = years.map((y) => {
    const list = students.filter((s) => s.year === y);
    return {
      year: y,
      count: list.length,
      avgScore: Math.round(
        list.reduce((a, s) => a + s.successScore, 0) / list.length,
      ),
    };
  });

  const urgentStudents = students
    .filter((s) => s.academicRisk === "High" || s.placementRisk === "High")
    .sort((a, b) => a.successScore - b.successScore)
    .slice(0, 10)
    .map((s) => ({
      roll_no: s.roll_no,
      name: s.name,
      department: s.department,
      year: s.year,
      score: s.successScore,
      acadRisk: s.academicRisk,
      plcRisk: s.placementRisk,
      topRisk: s.riskFactors[0] ?? "Multiple low indicators",
    }));

  const highAcademicLowPlacement = students
    .filter((s) => s.segment === "High Academic / Low Placement")
    .slice(0, 8)
    .map((s) => ({
      roll_no: s.roll_no,
      name: s.name,
      department: s.department,
      score: s.successScore,
      cgpa: s.cgpa,
      plcScore: s.placementIndex,
    }));

  const factorCounts: Record<string, number> = {};
  for (const s of students) {
    for (const rf of s.riskFactors) {
      factorCounts[rf] = (factorCounts[rf] ?? 0) + 1;
    }
  }
  const commonRiskFactors = Object.entries(factorCounts)
    .map(([factor, count]) => ({ factor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const insufficientDataCount = sGroups["Insufficient data"] ?? 0;

  return {
    totalStudents: total,
    avgSuccessScore: avgSuccess,
    avgAcademicIndex: avgAcademic,
    avgPlacementIndex: avgPlacement,
    academicRisk,
    placementRisk,
    segments,
    supportGroups: sGroups,
    byDepartment,
    byYear,
    urgentStudents,
    highAcademicLowPlacement,
    commonRiskFactors,
    insufficientDataCount,
  };
}

/**
 * Multi-turn conversational fallback generator for offline or unconfigured environments.
 * Retains conversation context and supports both Mode A (analytics) and Mode B (general advisory).
 */
export function generateConversationalFallback(
  query: string,
  history: Msg[],
  analytics: AggregatedAnalytics,
): string {
  const q = query.toLowerCase().trim();
  const priorUserMsg = history
    .filter((m) => m.role === "user" && m.content !== query)
    .slice(-1)[0]?.content.toLowerCase() || "";
  const priorAssistantMsg = history
    .filter((m) => m.role === "assistant")
    .slice(-1)[0]?.content || "";

  const prefix = `**Institutional Analytics Copilot** *(Verified Local Engine)*\n\n`;

  // 1. Conversational greetings and introductions
  if (
    q === "hello" ||
    q === "hi" ||
    q === "hey" ||
    q.startsWith("hello ") ||
    q.startsWith("hi ") ||
    q.includes("who are you") ||
    q.includes("what can you do") ||
    q === "help"
  ) {
    return (
      `${prefix}Hello! I am your **KRYPTEDU Student Analytics Copilot**. I assist college leadership, faculty, and placement teams with evidence-backed student insights.\n\n` +
      `**How I can assist you today:**\n` +
      `• **Risk Monitoring:** Identify students who require urgent academic support or placement coaching.\n` +
      `• **Department Comparisons:** Review performance rankings, attendance trends, and CGPA averages across branches.\n` +
      `• **Placement Readiness:** Discover students with strong academics who lag in mock assessments or coding scores.\n` +
      `• **Action Planning & Pedagogy:** Formulate 30-day intervention plans, remedial strategies, or interview preparation roadmaps.\n\n` +
      `*Try asking:* "Which students need urgent academic support?", "Compare departments by success score", or "How can we improve placement readiness?"`
    );
  }

  // 2. Follow-up: 30-day plan / timeline
  if (
    q.includes("30-day") ||
    q.includes("30 day") ||
    q.includes("roadmap") ||
    q.includes("schedule") ||
    (q.includes("plan") && (q.includes("make") || q.includes("give") || q.includes("create")))
  ) {
    return (
      `${prefix}**Targeted 30-Day Turnaround & Action Plan:**\n\n` +
      `**Week 1: Diagnostic & Advisor Outreach**\n` +
      `• Schedule 1-on-1 advisor sessions with the **${analytics.academicRisk.High} high-academic-risk students** to identify personal barriers (e.g. attendance deficits, backlogs).\n` +
      `• Audit student LMS logins and resolve access roadblocks.\n\n` +
      `**Week 2: Remedial Core & Attendance Checkpoint**\n` +
      `• Launch peer tutoring groups for subjects with active backlogs.\n` +
      `• Set up bi-weekly attendance tracking alerts for students currently below the 75% institutional threshold.\n\n` +
      `**Week 3: Practical Assessments & Interview Coaching**\n` +
      `• Enroll the **${analytics.segments["High Academic / Low Placement"] ?? 0} students** in the *High Academic / Low Placement* quadrant into Mock Interview Studio sessions.\n` +
      `• Conduct hands-on coding and aptitude practice tests.\n\n` +
      `**Week 4: Re-Assessment & Progress Review**\n` +
      `• Review updated mock test scores and mid-semester attendance numbers.\n` +
      `• Update intervention status in the platform to measure improvement.`
    );
  }

  // 3. Follow-up: "Why?", "What about them?", "Explain why"
  if (
    q === "why?" ||
    q === "why is it low?" ||
    q === "why" ||
    q.includes("why is their") ||
    q.includes("what about them") ||
    q.includes("tell me more")
  ) {
    if (
      priorUserMsg.includes("department") ||
      priorUserMsg.includes("branch") ||
      priorAssistantMsg.includes("Department")
    ) {
      const worst = analytics.byDepartment[analytics.byDepartment.length - 1];
      return (
        `${prefix}**Underlying Factors in ${worst?.dept || "the Lowest-Scoring Department"}:**\n\n` +
        `• **Average Success Score:** ${worst?.avgScore || 0}/100\n` +
        `• **Average Attendance:** ${worst?.avgAtt || 0}%\n` +
        `• **High-Risk Students:** ${worst?.highRiskCount || 0} out of ${worst?.count || 0} students\n\n` +
        `The primary drag on this department's score stems from a combination of attendance deficits below institutional thresholds and multiple active backlogs in early semesters.\n\n` +
        `*Would you like a recommended intervention plan for this department?*`
      );
    }
    if (priorUserMsg.includes("placement") || priorAssistantMsg.includes("Placement Readiness")) {
      return (
        `${prefix}**Root Factors Driving Low Placement Readiness:**\n\n` +
        `Based on student evaluation records, the placement index is affected primarily by:\n` +
        `1. **Assessment Practice Gaps:** Students frequently have solid classroom CGPAs but lack structured practice in timed technical coding and aptitude assessments.\n` +
        `2. **Mock Interview Feedback Scores:** Several students have low feedback scores in communication, articulation, or STAR-method behavioral responses.\n` +
        `3. **Skill Gaps:** Specific technical competencies (e.g. data structures, system design, or modern toolchains) are identified as gaps.\n\n` +
        `*Would you like a suggested 30-day placement coaching curriculum, or a list of affected students?*`
      );
    }
    // General "why" fallback
    return (
      `${prefix}**Key Contributing Risk Factors Across Cohort:**\n\n` +
      analytics.commonRiskFactors.slice(0, 5).map((f) => `• **${f.factor}**: impacting ${f.count} students`).join("\n") +
      `\n\nThese indicators carry heavy weight in the **Student Success Score** calculation. For example, attendance below 60% or having $\\ge 2$ active backlogs immediately triggers High Academic Risk.\n\n` +
      `*Would you like to explore remedial options for attendance, backlogs, or placement preparation?*`
    );
  }

  // 4. Mode B: STAR method explanation
  if (q.includes("star method") || q.includes("star technique")) {
    return (
      `${prefix}**The STAR Method for Behavioral & Placement Interviews:**\n\n` +
      `The **STAR framework** is the industry standard for answering behavioral placement questions:\n\n` +
      `• **S — Situation:** Set the context (e.g., *"During our 3rd-year database group project, our server crashed 2 days before submission."*)\n` +
      `• **T — Task:** Define your specific responsibility (e.g., *"I was responsible for database recovery and preserving student test data."*)\n` +
      `• **A — Action:** Detail the concrete steps you took (e.g., *"I audited the error logs, identified an unindexed query bottleneck, applied a database migration, and re-ran tests."*)\n` +
      `• **R — Result:** Share quantifiable outcomes (e.g., *"We submitted on time, and our service handled concurrent test load with zero data loss."*)\n\n` +
      `*Tip:* Students can practice behavioral STAR questions directly in our built-in **Mock Interview Studio**!`
    );
  }

  // 5. Mode B: How to improve placement rates
  if (
    (q.includes("improve") || q.includes("increase") || q.includes("boost")) &&
    (q.includes("placement") || q.includes("hiring") || q.includes("recruitment"))
  ) {
    return (
      `${prefix}**Institutional Playbook: How Colleges Can Improve Placement Success:**\n\n` +
      `1. **Early Diagnostic Screening:** Use the platform's **High Academic / Low Placement** segment to identify technically strong students early (currently **${analytics.segments["High Academic / Low Placement"] ?? 0} students** on campus).\n` +
      `2. **Weekly Coding & Assessment Sprints:** Institutionalize timed mock assessments mirroring industry tests (data structures, problem solving).\n` +
      `3. **Structured Mock Interviews:** Leverage the **Mock Interview Studio** so students gain feedback on technical explanation clarity and STAR behavioral questions.\n` +
      `4. **Alumni & Peer Mentorship:** Pair struggling candidates with placed final-year seniors for resume reviews and interview debriefs.\n` +
      `5. **Close Skill Gaps:** Target curriculum micro-certifications for the most common skill deficiencies.\n\n` +
      `*Would you like to view the list of students who have strong academics but low placement readiness?*`
    );
  }

  // 6. Mode B: CGPA vs Placement Readiness
  if (
    (q.includes("difference") || q.includes("compare")) &&
    q.includes("cgpa") &&
    q.includes("placement")
  ) {
    return (
      `${prefix}**CGPA vs. Placement Readiness — Understanding the Distinction:**\n\n` +
      `• **CGPA (Academic Performance):** Reflects cumulative classroom exam scores, theoretical coursework comprehension, and curriculum mastery.\n` +
      `• **Placement Readiness Index:** Measures practical employability, including aptitude testing speed, coding problem-solving under time limits, mock interview communication, and verified technical skills.\n\n` +
      `**Campus Insight:** On this campus, **${analytics.segments["High Academic / Low Placement"] ?? 0} students** have a high academic index but low placement index. Bridging this gap through hands-on technical practice is the highest-leverage intervention.`
    );
  }

  // 7. Mode A: How did you calculate that? / Scoring methodology
  if (
    q.includes("how did you calculate") ||
    q.includes("how is it calculated") ||
    q.includes("formula") ||
    q.includes("weight")
  ) {
    return (
      `${prefix}**Student Success Score Methodology (0–100 Scale):**\n\n` +
      `The score synthesizes three primary dimensions:\n` +
      `• **Academic Index (45%):** CGPA (50%), Attendance (30%), LMS Activity (20%), minus 5 points per active backlog.\n` +
      `• **Placement Index (35%):** Placement Readiness Assessments (50%), Technical Skills (30%), Faculty Feedback (20%).\n` +
      `• **Campus Engagement (20%):** Clubs, hackathons, and extracurricular initiatives.\n\n` +
      `**Risk Classifications:**\n` +
      `• **Academic Risk High:** Academic Index < 55, attendance < 60%, or $\\ge 2$ active backlogs.\n` +
      `• **Placement Risk High:** Placement Index < 45.\n` +
      `*Missing indicators are excluded and remaining weights rescaled proportionally.*`
    );
  }

  // 8. Mode A: Urgent support / at-risk students
  if (
    q.includes("urgent") ||
    q.includes("struggling") ||
    q.includes("help") ||
    q.includes("risk") ||
    q.includes("attention") ||
    q.includes("failing")
  ) {
    let out = `${prefix}**Urgent Support & Cohort Risk Analysis:**\n\n`;
    out += `• **High Academic Risk:** ${analytics.academicRisk.High} students (${Math.round((analytics.academicRisk.High / analytics.totalStudents) * 100)}% of cohort)\n`;
    out += `• **High Placement Risk:** ${analytics.placementRisk.High} students (${Math.round((analytics.placementRisk.High / analytics.totalStudents) * 100)}% of cohort)\n`;
    out += `• **Urgent Support Group (Both Risks High):** **${analytics.supportGroups["Urgent support"] ?? 0} students**\n\n`;

    if (analytics.urgentStudents.length > 0) {
      out += `**Priority Students Flagged for Faculty Outreach:**\n`;
      analytics.urgentStudents.slice(0, 6).forEach((s) => {
        out += `• **${s.name}** (${s.roll_no}, ${s.department} Y${s.year}) — Success Score: **${s.score}/100** | Acad: ${s.acadRisk}, Plc: ${s.plcRisk} (${s.topRisk})\n`;
      });
    }

    out += `\n**Recommended Actions:**\n`;
    out += `• Assign dedicated faculty mentors for students with multiple backlogs.\n`;
    out += `• Schedule immediate counseling for students with attendance below 60%.\n\n`;
    out += `*Would you like a department-by-department breakdown of high-risk students, or a draft 30-day intervention plan?*`;
    return out;
  }

  // 9. Mode A: Department comparison / rankings
  if (
    q.includes("department") ||
    q.includes("branch") ||
    q.includes("compare") ||
    q.includes("best") ||
    q.includes("worst") ||
    q.includes("ranking")
  ) {
    let out = `${prefix}**Department Performance Rankings (Avg. Success Score):**\n\n`;
    analytics.byDepartment.forEach((d, idx) => {
      out += `• **#${idx + 1} ${d.dept}**: Avg Score: **${d.avgScore}/100** (Avg CGPA: ${d.avgCgpa}, Attendance: ${d.avgAtt}%, Enrolled: ${d.count}, High-Risk: ${d.highRiskCount})\n`;
    });
    const best = analytics.byDepartment[0];
    const worst = analytics.byDepartment[analytics.byDepartment.length - 1];
    if (best && worst && analytics.byDepartment.length > 1) {
      out += `\n**Key Observation:**\n`;
      out += `• **Leading:** **${best.dept}** has the highest average score (${best.avgScore}/100).\n`;
      out += `• **Needs Priority Attention:** **${worst.dept}** currently averages ${worst.avgScore}/100 with ${worst.highRiskCount} high-risk students.\n\n`;
    }
    out += `*Would you like to examine the specific risk factors for ${worst?.dept || "the lowest department"}?*`;
    return out;
  }

  // 10. Mode A: Placement readiness / Strong academics but low placement
  if (
    q.includes("placement") ||
    q.includes("interview") ||
    q.includes("readiness") ||
    q.includes("job")
  ) {
    let out = `${prefix}**Placement Readiness & Skill Distribution:**\n\n`;
    const count = analytics.segments["High Academic / Low Placement"] ?? 0;
    out += `• **Average Placement Index Across Campus:** ${analytics.avgPlacementIndex}/100\n`;
    out += `• **High Placement Risk (<45):** ${analytics.placementRisk.High} students\n`;
    out += `• **High Academic / Low Placement Readiness:** **${count} students** (${Math.round((count / analytics.totalStudents) * 100)}% of cohort)\n`;
    out += `• **Placement-Ready (Low Risk):** ${analytics.supportGroups["Placement-ready, low risk"] ?? 0} students\n\n`;

    if (analytics.highAcademicLowPlacement.length > 0) {
      out += `**Sample Students with Academic–Placement Divergence:**\n`;
      analytics.highAcademicLowPlacement.slice(0, 5).forEach((s) => {
        out += `• **${s.name}** (${s.roll_no}, ${s.department}) — CGPA: **${s.cgpa}**, Placement Index: **${s.plcScore}/100**\n`;
      });
    }

    out += `\n**Recommended Intervention:**\n`;
    out += `• Enroll these students in timed mock technical assessments and mock interview practice.\n\n`;
    out += `*Would you like suggestions for technical interview preparation or coding practice modules?*`;
    return out;
  }

  // 11. Mode A: Attendance & absenteeism
  if (
    q.includes("attendance") ||
    q.includes("absent") ||
    q.includes("bunk") ||
    q.includes("lms") ||
    q.includes("engagement")
  ) {
    let out = `${prefix}**Attendance & Coursework Engagement Analysis:**\n\n`;
    const poorAtt = analytics.supportGroups["Good academics, poor attendance"] ?? 0;
    out += `• **Students with CGPA $\\ge$ 7.0 but Attendance < 75%:** **${poorAtt} students**\n`;
    out += `• **Critical Attendance Deficit (<60%):** Automatically classified as High Academic Risk\n\n`;
    out += `**Recommended Measures:**\n`;
    out += `• Send automated attendance alerts to both students and their academic advisors.\n`;
    out += `• Check medical records and campus engagement logs before issuing exam hall tickets.\n\n`;
    out += `*Would you like a list of students whose attendance is currently below 60%?*`;
    return out;
  }

  // 12. General overview / unclassified natural query
  return (
    `${prefix}**Campus Cohort Overview & Health Metrics:**\n\n` +
    `• **Total Students Enrolled:** ${analytics.totalStudents} across ${analytics.byDepartment.length} departments\n` +
    `• **Average Student Success Score:** **${analytics.avgSuccessScore}/100**\n` +
    `• **Academic Index Average:** ${analytics.avgAcademicIndex}/100 | **Placement Index Average:** ${analytics.avgPlacementIndex}/100\n` +
    `• **Academic Risk Distribution:** High: ${analytics.academicRisk.High}, Medium: ${analytics.academicRisk.Medium}, Low: ${analytics.academicRisk.Low}\n` +
    `• **Placement Risk Distribution:** High: ${analytics.placementRisk.High}, Medium: ${analytics.placementRisk.Medium}, Low: ${analytics.placementRisk.Low}\n\n` +
    `**Top Risk Drivers Across Campus:**\n` +
    analytics.commonRiskFactors.slice(0, 4).map((f) => `• ${f.factor} (${f.count} students)`).join("\n") +
    `\n\n*Feel free to ask follow-up questions, like "Which students are struggling most?", "Compare departments by success score", or "How can we improve placement rates?"*`
  );
}

export const askInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { messages: Msg[] }) => {
    if (!Array.isArray(d?.messages) || d.messages.length === 0) {
      throw new Error("No messages provided");
    }
    return {
      messages: d.messages.slice(-12).map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 4000),
      })),
    };
  })
  .handler(async ({ data, context }) => {
    // 1. Authenticate user and resolve RBAC role securely on the server
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (roleErr) {
      return { reply: "", error: "Couldn't verify your access. Please sign in again." };
    }

    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    const userRole =
      ["admin", "faculty", "placement", "student"].find((r) => roles.includes(r)) ?? "pending";

    if (userRole === "pending") {
      return { reply: "", error: "Your account is pending administrator approval." };
    }

    const latestQuery = data.messages[data.messages.length - 1]?.content || "";
    const conversationHistory = data.messages.slice(0, -1);

    // 2. STUDENT WORKFLOW: strictly personal data only
    if (userRole === "student") {
      const { data: student, error: stErr } = await context.supabase
        .from("students")
        .select(
          "id, roll_no, name, department, year, cgpa, attendance, lms_activity, engagement, placement_readiness, skills_score, backlogs, user_id",
        )
        .eq("user_id", context.userId)
        .maybeSingle();

      if (stErr || !student) {
        return { reply: "", error: "Could not locate your linked student record." };
      }

      const { data: fb } = await context.supabase.rpc("student_feedback");
      const ownFeedback = fb?.[0]?.feedback_score ?? null;
      const scoredStudent = score({
        ...(student as unknown as StudentRow),
        feedback_score: ownFeedback,
      });
      const suggestions = generateSuggestions(scoredStudent);

      // Deterministic fallback structure for student
      const fallbackStudentJson = {
        summary: `Your overall Student Success Score is ${scoredStudent.successScore}/100. Academic risk is ${scoredStudent.academicRisk} and Placement risk is ${scoredStudent.placementRisk}.`,
        observed_indicators: [
          `CGPA: ${scoredStudent.cgpa} / 10`,
          `Attendance: ${scoredStudent.attendance}%`,
          `LMS Engagement: ${scoredStudent.lms_activity}/100`,
          `Placement Readiness: ${scoredStudent.placement_readiness}/100`,
          `Backlogs: ${scoredStudent.backlogs}`,
        ],
        strengths: scoredStudent.explanation.topStrength
          ? [scoredStudent.explanation.topStrength]
          : ["Consistent coursework engagement"],
        improvement_areas:
          scoredStudent.riskFactors.length > 0
            ? scoredStudent.riskFactors
            : ["Maintain current standards"],
        recommended_actions: suggestions.map((s) => `${s.action} (${s.why})`).slice(0, 3),
        suggested_timeline: "Review weekly with your assigned mentor or faculty advisor.",
        suggested_follow_up_metrics: [
          "Next cycle CGPA",
          "Monthly attendance average",
          "Mock interview assessment",
        ],
        caveats: "AI guidance is advisory only and intended to support your educational journey.",
      };

      if (!isGeminiConfigured()) {
        return { reply: JSON.stringify(fallbackStudentJson), error: null };
      }

      const prompt =
        `Student Profile:\n` +
        `Name: ${scoredStudent.name} (${scoredStudent.roll_no})\n` +
        `Department: ${scoredStudent.department}, Year: ${scoredStudent.year}\n` +
        `CGPA: ${scoredStudent.cgpa} / 10\n` +
        `Attendance: ${scoredStudent.attendance}%\n` +
        `LMS Activity: ${scoredStudent.lms_activity}/100\n` +
        `Placement Readiness: ${scoredStudent.placement_readiness}/100\n` +
        `Skills Score: ${scoredStudent.skills_score}/100\n` +
        `Backlogs: ${scoredStudent.backlogs}\n` +
        `Success Score: ${scoredStudent.successScore}/100\n` +
        `Academic Risk: ${scoredStudent.academicRisk}\n` +
        `Placement Risk: ${scoredStudent.placementRisk}\n` +
        `Segment: ${scoredStudent.segment}\n` +
        `Identified Risk Factors: ${scoredStudent.riskFactors.join(", ") || "None"}\n` +
        `Recommended Interventions: ${suggestions.map((s) => s.action).join("; ") || "Maintain consistent progress"}\n\n` +
        `Student Query: "${latestQuery}"\n\n` +
        `Respond with supportive, actionable advice based on their indicators. Return structured JSON with: summary, observed_indicators, strengths, improvement_areas, recommended_actions, suggested_timeline, suggested_follow_up_metrics, caveats.`;

      const responseSchema = {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          observed_indicators: { type: "ARRAY", items: { type: "STRING" } },
          strengths: { type: "ARRAY", items: { type: "STRING" } },
          improvement_areas: { type: "ARRAY", items: { type: "STRING" } },
          recommended_actions: { type: "ARRAY", items: { type: "STRING" } },
          suggested_timeline: { type: "STRING" },
          suggested_follow_up_metrics: { type: "ARRAY", items: { type: "STRING" } },
          caveats: { type: "STRING" },
        },
        required: [
          "summary",
          "observed_indicators",
          "strengths",
          "improvement_areas",
          "recommended_actions",
          "suggested_timeline",
          "suggested_follow_up_metrics",
          "caveats",
        ],
      };

      const result = await callGemini<Record<string, unknown>>(prompt, {
        systemInstruction:
          "You are an encouraging, expert academic advisor at KRYPTEDU. " +
          "Provide personalized, empathetic student guidance grounded in their metrics in JSON format.",
        responseSchema,
        history: conversationHistory,
        timeoutMs: 30000,
      });

      if (result.error || !result.data) {
        return { reply: JSON.stringify(fallbackStudentJson), error: null };
      }

      return { reply: JSON.stringify(result.data), error: null };
    }

    // 3. STAFF WORKFLOW: Faculty, Placement, Admin
    // Query actual authorized student cohort records
    const { data: rows, error: qErr } = await context.supabase
      .from("students")
      .select(
        "id, roll_no, name, department, year, cgpa, attendance, lms_activity, engagement, placement_readiness, skills_score, backlogs",
      );

    if (qErr || !rows) {
      return { reply: "", error: "Could not load institutional cohort data." };
    }

    const { data: fbRows } = await context.supabase.rpc("student_feedback");
    const fbMap = new Map((fbRows ?? []).map((r: any) => [r.id, r.feedback_score]));

    // Authoritative scoring calculation
    const scoredList = (rows as unknown as StudentRow[]).map((r) =>
      score({ ...r, feedback_score: fbMap.get(r.id) ?? null }),
    );

    const analytics = computeAnalytics(scoredList);

    // If Gemini is unconfigured or unavailable, use the conversational deterministic engine
    if (!isGeminiConfigured()) {
      return {
        reply: generateConversationalFallback(latestQuery, conversationHistory, analytics),
        error: null,
      };
    }

    // Role-specific scope guidelines
    let roleScope = "You are assisting senior campus leadership with institutional strategy.";
    if (userRole === "faculty") {
      roleScope =
        "You are assisting faculty. Emphasize academic performance, attendance interventions, course completion, and remedial mentoring.";
    } else if (userRole === "placement") {
      roleScope =
        "You are assisting placement officers. Emphasize placement readiness scores, assessment metrics, mock interviews, and skill coaching.";
    }

    const compactContext = `
AUTHORIZED INSTITUTIONAL COHORT DATA:
- Total students enrolled: ${analytics.totalStudents}
- Average Success Score: ${analytics.avgSuccessScore}/100
- Average Academic Index: ${analytics.avgAcademicIndex}/100
- Average Placement Index: ${analytics.avgPlacementIndex}/100

RISK METRICS:
- Academic Risk: High=${analytics.academicRisk.High}, Medium=${analytics.academicRisk.Medium}, Low=${analytics.academicRisk.Low}
- Placement Risk: High=${analytics.placementRisk.High}, Medium=${analytics.placementRisk.Medium}, Low=${analytics.placementRisk.Low}

QUADRANTS & SEGMENTATION:
- High Academic / High Placement: ${analytics.segments["High Academic / High Placement"] ?? 0}
- High Academic / Low Placement: ${analytics.segments["High Academic / Low Placement"] ?? 0}
- Low Academic / High Placement: ${analytics.segments["Low Academic / High Placement"] ?? 0}
- Low Academic / Low Placement: ${analytics.segments["Low Academic / Low Placement"] ?? 0}

SUPPORT GROUPS:
- Urgent Support (Both Risks High): ${analytics.supportGroups["Urgent support"] ?? 0}
- Good Academics, Poor Attendance (CGPA >= 7, Att < 75%): ${analytics.supportGroups["Good academics, poor attendance"] ?? 0}
- Placement-Ready (Low Risk): ${analytics.supportGroups["Placement-ready, low risk"] ?? 0}
- Insufficient Data (Low Confidence): ${analytics.insufficientDataCount}

DEPARTMENT PERFORMANCE RANKINGS:
${analytics.byDepartment.map((d, i) => `#${i + 1} ${d.dept}: count=${d.count}, avgScore=${d.avgScore}, avgAtt=${d.avgAtt}%, avgCGPA=${d.avgCgpa}, highRisk=${d.highRiskCount}`).join("\n")}

SAMPLE PRIORITY STUDENTS FLAGGED FOR ATTENTION:
${analytics.urgentStudents.map((s) => `${s.roll_no} | ${s.name} | ${s.department} Y${s.year} | Score: ${s.score} | Acad: ${s.acadRisk}, Plc: ${s.plcRisk} | Main Issue: ${s.topRisk}`).join("\n")}

TOP ROOT RISK FACTORS ACROSS CAMPUS:
${analytics.commonRiskFactors.map((f) => `${f.factor} (${f.count} students)`).join(", ")}

STUDENT SUCCESS SCORE FORMULA:
Success Score = 0.45 * Academic Index + 0.35 * Placement Index + 0.20 * Campus Engagement
Academic Index = 0.50 * (CGPA * 10) + 0.30 * Attendance + 0.20 * LMS Activity - 5 * Backlogs
Placement Index = 0.50 * Placement Readiness + 0.30 * Skills Score + 0.20 * Feedback Score
`;

    const systemInstruction = `You are KRYPTEDU AI Insights — an expert, articulate, and conversational Student Success & Campus Analytics Copilot for college leadership, faculty, and placement officers. ${roleScope}

CORE OPERATING MODES:
1. Mode A (Institutional Data Questions):
   - When asked about this campus, cohort, students, departments, success scores, attendance, backlogs, or interventions, ground answers STRICTLY in the verified data provided above.
   - Quote exact figures, percentages, department rankings, and student names/roll numbers where authorized.
   - Never invent student names, roll numbers, or cohort statistics not present in the verified data.
   - Clearly distinguish verified observational facts from potential underlying reasons or advisory suggestions.

2. Mode B (General Educational, Career & Pedagogy Guidance):
   - When asked general questions (e.g., "How can we improve placement rates?", "Explain the STAR method", "What study strategies work for students with backlogs?", "How should faculty conduct attendance interventions?", "Explain the difference between CGPA and placement readiness", "Create a 30-day revision timetable"):
   - Draw on pedagogical best practices, career advisory standards, and industry placement expectations to provide rich, comprehensive, structured, and actionable guidance.
   - Do NOT refuse to answer general educational questions just because they are not in the raw student database!

3. Mode C (Hybrid Questions):
   - When asked questions connecting institutional data to general strategy (e.g. "Our IT department has low placement readiness, what should we do?"):
   - First reference the verified data (e.g., citing the specific average score and risk count for that department).
   - Then provide structured, practical pedagogical and coaching interventions tailored to those metrics (e.g., weekly mock coding sessions, peer mentoring, resume workshops).

CONVERSATIONAL CONTEXT & FOLLOW-UPS:
- You maintain multi-turn context. If the user refers to previous messages (e.g., "why is it low?", "tell me more about them", "what should they do?", "make it a 30-day plan", "summarize that in simple words"), resolve pronouns and context seamlessly.
- If a user's question is genuinely ambiguous with multiple interpretations and no prior context, provide a brief helpful overview and politely ask clarifying questions.
- Write naturally, professionally, and empathetically. Use clean Markdown (bold headings, bullet points, numbered action items).
- At the end of analytical answers, suggest 1–2 helpful next questions to guide the conversation further.`;

    const result = await callGemini(
      `${compactContext}\n\nUser Question: "${latestQuery}"\n\nProvide an intelligent, conversational, evidence-backed answer:`,
      {
        systemInstruction,
        temperature: 0.3,
        history: conversationHistory,
        timeoutMs: 30000,
      },
    );

    if (result.error || !result.text) {
      // Graceful fallback on API error or timeout
      return {
        reply: generateConversationalFallback(latestQuery, conversationHistory, analytics),
        error: null,
      };
    }

    return { reply: result.text, error: null };
  });
