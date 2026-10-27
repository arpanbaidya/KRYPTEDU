import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGemini, isGeminiConfigured } from "./gemini.server";
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
  "Never ask for, expose, or refer to confidential student identifiers.";

async function approved(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && data.role !== "pending";
}

async function ownSession(supabase: any, userId: string, id: string) {
  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return { session: data };
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
    if (!(await approved(context.supabase, context.userId))) {
      return {
        id: null,
        questions: [] as Question[],
        error: "Your account is waiting for administrator approval.",
      };
    }

    let questions: Question[] | null = null;

    if (isGeminiConfigured()) {
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

      const res = await callGemini(prompt, {
        systemInstruction: SYS_INSTRUCTION,
        responseSchema: schema,
        temperature: 0.7,
        timeoutMs: 30000,
      });

      if (!res.error && res.data) {
        questions = validateQuestions(res.data, data.count, data.type);
      }
    }

    // Fallback if Gemini is not configured, timed out, or returned malformed questions
    if (!questions || questions.length < data.count) {
      questions = getFallbackQuestions(data.role, data.level, data.type, data.count);
    }

    const { data: row, error: insertErr } = await context.supabase
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
      .single();

    if (insertErr || !row) {
      return {
        id: null,
        questions: [],
        error: "Could not create interview session. Please retry.",
      };
    }

    return { id: row.id as string, questions, error: null };
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
    if (!(await approved(context.supabase, context.userId))) {
      return { evaluation: null, error: "Your account is waiting for approval." };
    }

    const { session } = await ownSession(context.supabase, context.userId, data.id);
    if (!session) {
      return { evaluation: null, error: "Interview session not found." };
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
        error: "This question was already answered or index is out of sequence.",
      };
    }

    const q = questions[data.index]!;
    const crit = RUBRIC[q.kind];
    let evaluation: ReturnType<typeof validateEvaluation> = null;

    if (isGeminiConfigured() && data.answer.trim().length >= 5) {
      const prompt =
        `Target Role: ${session.target_role}\n` +
        `Difficulty Level: ${session.difficulty}\n` +
        `Question Type: ${q.kind} (Topic: ${q.topic})\n` +
        `Question: ${q.text}\n\n` +
        `Candidate's Typed Answer:\n"""${data.answer}"""\n\n` +
        `Evaluate this answer against the official rubric. Score each criterion on a 0–100 integer scale:\n` +
        crit.map((c) => `- ${c}`).join("\n") +
        `\n\nProvide constructive feedback, 1-3 specific strengths, 1-3 actionable improvements, and a concise model answer showing how a top placement candidate would answer. If the answer is off-topic, empty, or evasive, score strictly low.`;

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
        },
        required: ["criteria", "feedback", "strengths", "improvements", "better_answer"],
      };

      const res = await callGemini(prompt, {
        systemInstruction: SYS_INSTRUCTION,
        responseSchema: schema,
        temperature: 0.3,
        timeoutMs: 30000,
      });

      if (!res.error && res.data) {
        evaluation = validateEvaluation(res.data, q.kind);
      }
    }

    // Deterministic fallback if Gemini unconfigured or failed
    if (!evaluation) {
      evaluation = evaluateAnswerDeterministically(q, data.answer, session.target_role);
    }

    const updatedAnswers = [...answers, { answer: data.answer, evaluation }];

    const { error: updateErr } = await context.supabase
      .from("interview_sessions")
      .update({ answers: updatedAnswers as never })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (updateErr) {
      return { evaluation: null, error: "Could not save your answer. Please retry." };
    }

    return { evaluation, error: null };
  });

export const finishInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => ({ id: String(d.id) }))
  .handler(async ({ data, context }) => {
    if (!(await approved(context.supabase, context.userId))) {
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

    if (isGeminiConfigured()) {
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
        `Summarize this completed mock interview for a ${session.target_role} (${session.difficulty} difficulty) candidate. ` +
        `Answers submitted:\n\n${transcript}\n\n` +
        `Generate an overall assessment, recurring weaknesses observed across answers, key topics to practice before campus placement, and concrete next preparation steps.`;

      const schema = {
        type: "OBJECT",
        properties: {
          overview: { type: "STRING" },
          recurring_weaknesses: { type: "ARRAY", items: { type: "STRING" } },
          topics_to_practise: { type: "ARRAY", items: { type: "STRING" } },
          next_steps: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["overview", "recurring_weaknesses", "topics_to_practise", "next_steps"],
      };

      const res = await callGemini(prompt, {
        systemInstruction: SYS_INSTRUCTION,
        responseSchema: schema,
        temperature: 0.3,
        timeoutMs: 30000,
      });

      if (!res.error && res.data) {
        summary = validateSummary(res.data);
      }
    }

    // Deterministic fallback summary
    if (!summary) {
      const lowestScored = [...answers].sort((a, b) => a.evaluation.score - b.evaluation.score);
      const weakTopics = lowestScored.slice(0, 3).map((a, i) => {
        const qIndex = answers.indexOf(a);
        return questions[qIndex]?.topic ?? `Question ${qIndex + 1}`;
      });

      summary = {
        overview: `Completed ${answers.length} question(s) for the ${session.target_role} role at ${session.difficulty} level with an overall score of ${computedOverall}/100.`,
        recurring_weaknesses: [
          "Deepen explanation of underlying computational trade-offs and edge cases.",
          "Incorporate more concrete real-world code snippets and structured STAR examples.",
        ],
        topics_to_practise: weakTopics.length
          ? weakTopics
          : ["Data structures", "System design", "STAR behavioral storytelling"],
        next_steps: [
          `Review recommended technical topics for ${session.target_role}.`,
          "Practice drafting concise 3-minute answers focusing on concrete trade-offs.",
          "Schedule a follow-up mock interview session next week to track improvement.",
        ],
      };
    }

    const { error: updateErr } = await context.supabase
      .from("interview_sessions")
      .update({
        summary: summary as never,
        overall_score: computedOverall,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (updateErr) {
      return { error: "Could not save final interview summary. Please retry." };
    }

    return { error: null };
  });
