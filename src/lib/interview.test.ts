import { describe, it, expect } from "vitest";
import {
  validateEvaluation,
  validateQuestions,
  validateSummary,
  overallScore,
  getFallbackQuestions,
  evaluateAnswerDeterministically,
  ROLES,
  LEVELS,
  TYPES,
  RUBRIC,
} from "./interview";

describe("Mock Interview Studio Validation & Evaluation", () => {
  it("score is the mean of the three rubric scores", () => {
    const e = validateEvaluation(
      {
        criteria: [
          { name: "Technical correctness", score: 90 },
          { name: "Relevance and completeness", score: 60 },
          { name: "Problem-solving explanation", score: 30 },
        ],
        feedback: "ok",
      },
      "Technical",
    );
    expect(e?.score).toBe(60);
  });

  it("rejects evaluation missing a required rubric criterion", () => {
    expect(
      validateEvaluation(
        {
          criteria: [{ name: "Clarity and structure", score: 80 }],
          feedback: "x",
        },
        "HR/Behavioral",
      ),
    ).toBeNull();
  });

  it("clamps scores to 0-100", () => {
    const e = validateEvaluation(
      {
        criteria: [
          { name: "Clarity and structure", score: 150 },
          { name: "Relevance to the question", score: -5 },
          { name: "Specificity and concrete examples", score: 50 },
        ],
        feedback: "x",
      },
      "HR/Behavioral",
    );
    expect(e?.criteria.map((c) => c.score)).toEqual([100, 0, 50]);
  });

  it("rejects fewer questions than requested", () => {
    expect(
      validateQuestions(
        { questions: [{ text: "Explain closures in JavaScript with code." }] },
        5,
        "Technical",
      ),
    ).toBeNull();
  });

  it("deduplicates identical or trivial questions", () => {
    const duplicateList = {
      questions: [
        { text: "What is an index in SQL?", topic: "DB" },
        { text: "What is an index in SQL?", topic: "DB" }, // duplicate
        { text: "short", topic: "x" }, // too short
        { text: "Explain how B-tree indexes improve database queries.", topic: "DB" },
      ],
    };
    const result = validateQuestions(duplicateList, 2, "Technical");
    expect(result).toHaveLength(2);
    expect(result?.[0]?.text).toContain("What is an index");
    expect(result?.[1]?.text).toContain("B-tree");
  });

  it("overall score averages all answered questions accurately", () => {
    expect(
      overallScore([
        { answer: "a", evaluation: { score: 40 } as never },
        { answer: "b", evaluation: { score: 80 } as never },
      ]),
    ).toBe(60);
  });

  it("validates summary structure correctly", () => {
    const validSummary = validateSummary({
      overview: "Good technical interview with strong problem solving.",
      recurring_weaknesses: ["Needs more concrete code examples"],
      topics_to_practise: ["System design", "Dynamic programming"],
      next_steps: ["Review LeetCode medium questions"],
    });
    expect(validSummary).not.toBeNull();
    expect(validSummary?.overview).toContain("Good technical");
    expect(validSummary?.topics_to_practise).toHaveLength(2);
  });

  it("rejects summary missing an overview", () => {
    expect(
      validateSummary({
        recurring_weaknesses: ["Weakness"],
        topics_to_practise: [],
        next_steps: [],
      }),
    ).toBeNull();
  });

  describe("Deterministic Fallback Question Bank", () => {
    it("returns correct count of fallback questions for Software Developer", () => {
      const qs = getFallbackQuestions("Software Developer", "Intermediate", "Technical", 5);
      expect(qs).toHaveLength(5);
      qs.forEach((q) => {
        expect(q.text.length).toBeGreaterThan(15);
        expect(q.kind).toBe("Technical");
        expect(q.topic).toBeTruthy();
      });
    });

    it("returns correct questions for Data Analyst and HR/Behavioral type", () => {
      const qs = getFallbackQuestions("Data Analyst", "Beginner", "HR/Behavioral", 2);
      expect(qs.length).toBeGreaterThanOrEqual(1);
      expect(qs[0]?.kind).toBe("HR/Behavioral");
    });
  });

  describe("Deterministic Answer Evaluation", () => {
    it("penalizes empty or trivial answers (< 5 words)", () => {
      const question = {
        text: "Explain how indexing works in databases.",
        kind: "Technical" as const,
        topic: "Databases",
      };
      const evalResult = evaluateAnswerDeterministically(
        question,
        "i don't know",
        "Software Developer",
      );
      expect(evalResult.score).toBeLessThanOrEqual(25);
      expect(evalResult.improvements.length).toBeGreaterThan(0);
    });

    it("evaluates a detailed answer with examples and technical reasoning", () => {
      const question = {
        text: "Explain caching in high-traffic systems.",
        kind: "Technical" as const,
        topic: "Caching",
      };
      const detailedAnswer =
        "In high-traffic systems, caching is essential because it reduces database read load. " +
        "For example, we can use an in-memory Redis cache with an LRU (Least Recently Used) eviction policy. " +
        "The trade-off is cache invalidation and potential stale reads, which can be mitigated with write-through or TTL expiration.";
      const evalResult = evaluateAnswerDeterministically(
        question,
        detailedAnswer,
        "Software Developer",
      );
      expect(evalResult.score).toBeGreaterThanOrEqual(75);
      expect(evalResult.criteria.length).toBe(3);
    });
  });
});
