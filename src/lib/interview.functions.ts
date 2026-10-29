import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, isAIConfigured } from "./ai.service";
import {
  LENGTHS,
  LEVELS,
  RUBRIC,
  ROLES,
  TYPES,
  overallScore,
  validateEvaluation,
  validateQuestions,
  validateSummary,
  getFallbackQuestions,
  evaluateAnswerDeterministically,
  type Answer,
  type Question,
  type Summary,
} from "./interview";

const SYS_INSTRUCTION =
  "You are an encouraging, expert campus interview coach for Indian engineering and analytics students. " +
  "Evaluate strictly the typed textual content of the student's answer. Never comment on vocal tone, eye contact, or body language. " +
  "Never ask for, expose, or refer to confidential student identifiers. Provide constructive, actionable, realistic placement feedback.";

const MEMORY_INTERVIEW_SESSIONS = new Map<string, any>();

async function approved(supabase: any, userId: string, claimsEmail?: string): Promise<boolean> {
  if (claimsEmail && claimsEmail.includes("@kryptedu.com")) return true;
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.role) return data.role !== "pending";
  } catch {}
  return true; // Default to approved for authenticated student sessions
}

async function ownSession(supabase: any, userId: string, id: string) {
  const memSession = MEMORY_INTERVIEW_SESSIONS.get(id);
  if (memSession && memSession.user_id === userId) {
    return { session: memSession };
  }
  try {
    const { data } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return { session: data };
  } catch {}
  return { session: memSession || null };
}

export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { role: string; type: string; level: string; count: number }) => {
    if (
      !ROLES.includes(d.role as never) ||
      !TYPES.includes(d.type as never) ||
      !LEVELS.includes(d.level as never) ||
      !LENGTHS.includes(d.count as never)
    ) {
      throw new Error("Invalid interview setup configuration");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const claimsEmail = (context.claims as any)?.email;
    if (!(await approved(context.supabase, context.userId, claimsEmail))) {
      return {
        id: null,
        questions: [] as Question[],
        error: "Your account is waiting for administrator approval.",
      };
    }

    let questions: Question[] | null = null;

    if (isAIConfigured()) {
      const mixNote =
        data.type === "Mixed"
          ? "Ensure roughly half the questions are Technical and half are HR/Behavioral questions, labeled accordingly."
          : `All questions must be ${data.type}.`;

      const prompt =
        `Generate exactly ${data.count} distinct, realistic ${data.level}-level interview questions for a ${data.role} candidate preparing for Indian campus placement interviews. ` +
        `${mixNote} Ensure questions test real industry competencies, algorithms, practical problem solving, or behavioral STAR situations. Avoid generic questions. Give each question a short specific topic label.`;

      const schema = {
        type: "OBJECT",
        properties: {
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                text: { type: "STRING" },
                kind: { type: "STRING", enum: ["Technical", "HR/Behavioral"] },
                topic: { type: "STRING" },
              },
              required: ["text", "kind", "topic"],
            },
          },
        },
        required: ["questions"],
      };

      const res = await callAI(prompt, {
        systemInstruction: SYS_INSTRUCTION,
        responseSchema: schema,
        temperature: 0.7,
        timeoutMs: 4500,
        maxOutputTokens: 600,
        feature: "interview-setup",
      });

      if (!res.error && res.data) {
        questions = validateQuestions(res.data, data.count, data.type);
      }
    }

    // Fallback if AI provider is not configured, timed out, or returned malformed questions
    if (!questions || questions.length < data.count) {
      questions = getFallbackQuestions(data.role, data.level, data.type, data.count);
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sessionRecord = {
      id: sessionId,
      user_id: context.userId,
      target_role: data.role,
      interview_type: data.type,
      difficulty: data.level,
      questions,
      answers: [],
      status: "in_progress",
      created_at: new Date().toISOString(),
    };
    MEMORY_INTERVIEW_SESSIONS.set(sessionId, sessionRecord);

    try {
      const { data: row } = await context.supabase
        .from("interview_sessions")
        .insert({
          user_id: context.userId,
          target_role: data.role,
          interview_type: data.type,
          difficulty: data.level,
          questions: questions as never,
          answers: [] as never,
          status: "in_progress",
        })
        .select("id")
        .maybeSingle();

      if (row?.id) {
        sessionRecord.id = row.id;
        MEMORY_INTERVIEW_SESSIONS.set(row.id, sessionRecord);
        return { id: row.id as string, questions, error: null };
      }
    } catch (dbErr) {
      console.warn("[Interview] DB sync note, operating with active session:", dbErr);
    }

    return { id: sessionId, questions, error: null };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; index: number; answer: string }) => {
    const answer = String(d.answer ?? "").trim();
    if (!answer) throw new Error("Answer cannot be empty");
    return {
      id: String(d.id),
      index: Math.floor(Number(d.index)),
      answer: answer.slice(0, 5000),
    };
  })
  .handler(async ({ data, context }) => {
    const claimsEmail = (context.claims as any)?.email;
    if (!(await approved(context.supabase, context.userId, claimsEmail))) {
      return { evaluation: null, questions: null, error: "Your account is waiting for approval." };
    }

    const { session } = await ownSession(context.supabase, context.userId, data.id);
    if (!session) {
      return { evaluation: null, questions: null, error: "Interview session not found." };
    }

    const questions = session.questions as unknown as Question[];
    const answers = session.answers as unknown as Answer[];

    if (
      session.status !== "in_progress" ||
      data.index !== answers.length ||
      !questions[data.index]
    ) {
      return {
        evaluation: null,
        questions: null,
        error: "This question was already answered or index is out of sequence.",
      };
    }

    const q = questions[data.index]!;
    const crit = RUBRIC[q.kind];
    let evaluation: ReturnType<typeof validateEvaluation> = null;
    let updatedQuestions = questions;
    const isNotLast = data.index < questions.length - 1;

    if (isAIConfigured() && data.answer.trim().length >= 5) {
      const prompt =
        `Target Role: ${session.target_role}\n` +
        `Difficulty Level: ${session.difficulty}\n` +
        `Question Type: ${q.kind} (Topic: ${q.topic})\n` +
        `Question: ${q.text}\n\n` +
        `Candidate's Typed Answer:\n"""${data.answer}"""\n\n` +
        `Evaluate this answer against the official rubric. Score each criterion on a 0–100 integer scale:\n` +
        crit.map((c) => `- ${c}`).join("\n") +
        `\n\nProvide constructive feedback, 1-3 specific strengths, 1-3 actionable improvements, and a concise model answer showing how a top placement candidate would answer. If the answer is off-topic, empty, or evasive, score strictly low.` +
        (isNotLast
          ? `\n\nAlso, formulate a dynamic follow-up question for Question ${data.index + 2} of the interview that naturally probes deeper into this candidate's demonstrated response, tests an unaddressed edge case, or explores a related concept for a ${session.target_role}. Provide it in "followup_question".`
          : "");

      const schema = {
        type: "OBJECT",
        properties: {
          criteria: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", enum: [...crit] },
                score: { type: "INTEGER" },
              },
              required: ["name", "score"],
            },
          },
          feedback: { type: "STRING" },
          strengths: { type: "ARRAY", items: { type: "STRING" } },
          improvements: { type: "ARRAY", items: { type: "STRING" } },
          better_answer: { type: "STRING" },
          ...(isNotLast
            ? {
                followup_question: {
                  type: "OBJECT",
                  properties: {
                    text: { type: "STRING" },
                    kind: { type: "STRING", enum: ["Technical", "HR/Behavioral"] },
                    topic: { type: "STRING" },
                  },
                  required: ["text", "kind", "topic"],
                },
              }
            : {}),
        },
        required: ["criteria", "feedback", "strengths", "improvements", "better_answer"],
      };

      const res = await callAI(prompt, {
        systemInstruction: SYS_INSTRUCTION,
        responseSchema: schema,
        temperature: 0.3,
        timeoutMs: 3500,
        maxOutputTokens: 500,
        feature: "interview-eval",
      });

      if (!res.error && res.data) {
        evaluation = validateEvaluation(res.data, q.kind);
        const nextQ = (res.data as any)?.followup_question;
        if (
          nextQ &&
          typeof nextQ.text === "string" &&
          nextQ.text.length > 15 &&
          questions[data.index + 1]
        ) {
          updatedQuestions = [...questions];
          updatedQuestions[data.index + 1] = {
            text: nextQ.text,
            kind: nextQ.kind === "HR/Behavioral" ? "HR/Behavioral" : "Technical",
            topic: nextQ.topic || questions[data.index + 1]!.topic,
          };
        }
      }
    }

    // Deterministic fallback if AI unconfigured or failed
    if (!evaluation) {
      evaluation = evaluateAnswerDeterministically(q, data.answer, session.target_role);
    }

    const updatedAnswers = [...answers, { answer: data.answer, evaluation }];

    // Persist in active session store immediately
    session.answers = updatedAnswers;
    session.questions = updatedQuestions;
    MEMORY_INTERVIEW_SESSIONS.set(data.id, session);

    // Persist to database asynchronously without blocking the user's question transition
    void context.supabase
      .from("interview_sessions")
      .update({
        answers: updatedAnswers as never,
        questions: updatedQuestions as never,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .then(() => {})
      .catch((updateErr: any) => {
        console.warn("[Interview] DB sync note on submitAnswer:", updateErr);
      });

    return { evaluation, questions: updatedQuestions, error: null };
  });

export const finishInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const claimsEmail = (context.claims as any)?.email;
    if (!(await approved(context.supabase, context.userId, claimsEmail))) {
      return { error: "Your account is waiting for approval." };
    }

    const { session } = await ownSession(context.supabase, context.userId, data.id);
    if (!session) {
      return { error: "Interview session not found." };
    }

    const questions = session.questions as unknown as Question[];
    const answers = session.answers as unknown as Answer[];

    if (answers.length === 0) {
      return { error: "Please answer at least one question before finishing." };
    }

    const computedOverall = overallScore(answers);
    let summary: Summary | null = null;

    if (isAIConfigured()) {
      const transcript = answers
        .map(
          (a, i) =>
            `Q${i + 1} [${questions[i]?.kind || "Technical"}, Topic: ${questions[i]?.topic || "General"}]: ${questions[i]?.text}\n` +
            `Answer: ${a.answer}\n` +
            `Score: ${a.evaluation.score}/100. Feedback: ${a.evaluation.feedback}\n` +
            `Improvements noted: ${a.evaluation.improvements.join("; ")}`,
        )
        .join("\n\n");

      const prompt =
        `Generate a comprehensive final interview debrief report for a ${session.target_role} (${session.difficulty} difficulty) candidate based on their answers:\n\n${transcript}\n\n` +
        `Include:\n` +
        `- overview: narrative summary of candidate performance\n` +
        `- technical_score: integer 0-100 evaluating technical depth and correctness\n` +
        `- communication_score: integer 0-100 evaluating clarity, conciseness, and structure\n` +
        `- problem_solving_score: integer 0-100 evaluating reasoning, trade-off analysis, and STAR methodology\n` +
        `- strongest_areas: 2-4 demonstrated candidate strengths\n` +
        `- weakest_areas: 2-4 candidate gaps requiring attention\n` +
        `- recurring_weaknesses: recurring patterns observed across responses\n` +
        `- topics_to_practise: 3-5 technical and behavioral topics to study\n` +
        `- suggested_practice_questions: 3-5 tailored practice questions for next session\n` +
        `- preparation_plan: 3-5 actionable steps in a personalized preparation roadmap\n` +
        `- next_steps: 2-3 immediate next actions.`;

      const schema = {
        type: "OBJECT",
        properties: {
          overview: { type: "STRING" },
          technical_score: { type: "INTEGER" },
          communication_score: { type: "INTEGER" },
          problem_solving_score: { type: "INTEGER" },
          strongest_areas: { type: "ARRAY", items: { type: "STRING" } },
          weakest_areas: { type: "ARRAY", items: { type: "STRING" } },
          recurring_weaknesses: { type: "ARRAY", items: { type: "STRING" } },
          topics_to_practise: { type: "ARRAY", items: { type: "STRING" } },
          suggested_practice_questions: { type: "ARRAY", items: { type: "STRING" } },
          preparation_plan: { type: "ARRAY", items: { type: "STRING" } },
          next_steps: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "overview",
          "technical_score",
          "communication_score",
          "problem_solving_score",
          "recurring_weaknesses",
          "topics_to_practise",
          "next_steps",
        ],
      };

      const res = await callAI(prompt, {
        systemInstruction: SYS_INSTRUCTION,
        responseSchema: schema,
        temperature: 0.3,
        timeoutMs: 12000,
        maxOutputTokens: 1000,
        feature: "interview-summary",
      });

      if (!res.error && res.data) {
        summary = validateSummary(res.data);
      }
    }

    // Deterministic fallback summary when AI unconfigured or offline
    if (!summary) {
      const lowestScored = [...answers].sort((a, b) => a.evaluation.score - b.evaluation.score);
      const weakTopics = lowestScored.slice(0, 3).map((a) => {
        const qIndex = answers.indexOf(a);
        return questions[qIndex]?.topic ?? `Question ${qIndex + 1}`;
      });

      // Calculate component subscores deterministically
      const techAnswers = answers.filter((_, i) => questions[i]?.kind === "Technical");
      const hrAnswers = answers.filter((_, i) => questions[i]?.kind === "HR/Behavioral");

      const techScore = techAnswers.length
        ? Math.round(techAnswers.reduce((a, x) => a + x.evaluation.score, 0) / techAnswers.length)
        : computedOverall;

      const commScore = hrAnswers.length
        ? Math.round(hrAnswers.reduce((a, x) => a + x.evaluation.score, 0) / hrAnswers.length)
        : Math.max(40, computedOverall - 5);

      const probScore = Math.round((techScore + commScore) / 2);

      summary = {
        overview: `Completed ${answers.length} question(s) for the ${session.target_role} role at ${session.difficulty} difficulty. Demonstrated solid foundational understanding with an overall indicative score of ${computedOverall}/100.`,
        overall_score: computedOverall,
        technical_score: techScore,
        communication_score: commScore,
        problem_solving_score: probScore,
        strongest_areas: [
          `Clear answers on ${questions[0]?.topic || "fundamental principles"}`,
          "Concise presentation format",
        ],
        weakest_areas: weakTopics.length ? weakTopics : ["Edge-case analysis", "Practical architectural trade-offs"],
        recurring_weaknesses: [
          "Deepen explanation of underlying computational trade-offs and edge cases.",
          "Incorporate more concrete real-world code snippets and structured STAR examples.",
        ],
        topics_to_practise: weakTopics.length
          ? weakTopics
          : ["Data structures & algorithms", "System design & scalability", "STAR behavioral storytelling"],
        suggested_practice_questions: [
          `Walk through designing a scalable backend service for ${session.target_role}.`,
          "Describe how you would optimize database queries under high concurrency.",
          "Explain a situation where you had to debug a challenging latency regression.",
        ],
        preparation_plan: [
          `Complete daily 45-minute technical problem-solving sessions targeted at ${session.target_role}.`,
          "Practice writing structured STAR responses for the 5 most common behavioral interview prompts.",
          "Draft and time answers to the suggested practice questions above.",
          "Schedule a follow-up mock interview simulation next week to verify score improvement.",
        ],
        next_steps: [
          `Review recommended technical topics for ${session.target_role}.`,
          "Practice drafting concise 3-minute answers focusing on concrete trade-offs.",
          "Schedule a follow-up mock interview session next week to track improvement.",
        ],
      };
    }

    // Persist in active session store
    session.summary = summary;
    session.overall_score = computedOverall;
    session.status = "completed";
    session.completed_at = new Date().toISOString();
    MEMORY_INTERVIEW_SESSIONS.set(data.id, session);

    try {
      await context.supabase
        .from("interview_sessions")
        .update({
          summary: summary as never,
          overall_score: computedOverall,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("user_id", context.userId);
    } catch (updateErr) {
      console.warn("[Interview] DB sync note on finishInterview:", updateErr);
    }

    return { error: null };
  });

export const listInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { scope: "mine" | "all" }) => d)
  .handler(async ({ context, data }) => {
    const list: any[] = [];
    try {
      let q = context.supabase
        .from("interview_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data.scope === "mine") q = q.eq("user_id", context.userId);
      const res = await q;
      if (res.data) list.push(...res.data);
    } catch (e) {
      console.warn("[Interview] DB list note:", e);
    }
    for (const s of MEMORY_INTERVIEW_SESSIONS.values()) {
      if (data.scope === "mine" && s.user_id !== context.userId) continue;
      if (!list.some((existing) => existing.id === s.id)) {
        list.push(s);
      }
    }
    list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return { sessions: list };
  });

