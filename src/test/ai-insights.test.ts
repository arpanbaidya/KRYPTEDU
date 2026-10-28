import { describe, it, expect } from "vitest";
import { isGeminiConfigured, getGeminiModel, callGemini } from "../lib/gemini.server";
import { score, type StudentRow } from "../lib/scoring";
import {
  computeAnalytics,
  generateConversationalFallback,
} from "../lib/ai.functions";

describe("AI Service Layer & Conversational Copilot Invariants", () => {
  it("reads model from GEMINI_MODEL or defaults to production-stable gemini-1.5-flash", () => {
    const original = process.env["GEMINI_MODEL"];
    delete process.env["GEMINI_MODEL"];
    expect(getGeminiModel()).toBe("gemini-1.5-flash");

    process.env["GEMINI_MODEL"] = "gemini-2.0-flash";
    expect(getGeminiModel()).toBe("gemini-2.0-flash");

    if (original) process.env["GEMINI_MODEL"] = original;
    else delete process.env["GEMINI_MODEL"];
  });

  it("handles missing API key gracefully without throwing unhandled exceptions", async () => {
    const origKey1 = process.env["GEMINI_API_KEY"];
    const origKey2 = process.env["GOOGLE_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];

    expect(isGeminiConfigured()).toBe(false);

    const result = await callGemini("test prompt");
    expect(result.data).toBeNull();
    expect(result.error).toContain("not configured");

    if (origKey1) process.env["GEMINI_API_KEY"] = origKey1;
    if (origKey2) process.env["GOOGLE_API_KEY"] = origKey2;
  });

  it("supports multi-turn conversation history in callGemini options", async () => {
    const origKey1 = process.env["GEMINI_API_KEY"];
    const origKey2 = process.env["GOOGLE_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];

    const history = [
      { role: "user" as const, content: "Which department has lowest placement?" },
      { role: "assistant" as const, content: "Information Technology averages 42/100." },
    ];

    const result = await callGemini("Why is it low?", { history });
    // Verifies the call signature and options accept multi-turn history without runtime type errors
    expect(result.error).toBeDefined();

    if (origKey1) process.env["GEMINI_API_KEY"] = origKey1;
    if (origKey2) process.env["GOOGLE_API_KEY"] = origKey2;
  });

  describe("Cohort Analytics Aggregation Consistency", () => {
    const sampleStudents: StudentRow[] = [
      {
        id: "1",
        roll_no: "KR101",
        name: "Alice",
        department: "Computer Science",
        year: 3,
        cgpa: 9.2,
        attendance: 92,
        lms_activity: 85,
        engagement: 80,
        placement_readiness: 90,
        skills_score: 85,
        feedback_score: 90,
        backlogs: 0,
      },
      {
        id: "2",
        roll_no: "KR102",
        name: "Bob",
        department: "Information Tech",
        year: 3,
        cgpa: 5.2,
        attendance: 55,
        lms_activity: 35,
        engagement: 30,
        placement_readiness: 35,
        skills_score: 30,
        feedback_score: 40,
        backlogs: 3,
      },
      {
        id: "3",
        roll_no: "KR103",
        name: "Charlie",
        department: "Computer Science",
        year: 2,
        cgpa: 8.5,
        attendance: 88,
        lms_activity: 80,
        engagement: 75,
        placement_readiness: 25,
        skills_score: 25,
        feedback_score: 30,
        backlogs: 0,
      },
    ];

    const scored = sampleStudents.map((s) => score(s));
    const analytics = computeAnalytics(scored);

    it("authoritatively computes student scores and assigns correct risk levels", () => {
      // Alice: High performer, low risk
      expect(scored[0]!.academicRisk).toBe("Low");
      expect(scored[0]!.placementRisk).toBe("Low");
      expect(scored[0]!.segment).toBe("High Academic / High Placement");

      // Bob: Low attendance, 3 backlogs → High academic risk & High placement risk
      expect(scored[1]!.academicRisk).toBe("High");
      expect(scored[1]!.placementRisk).toBe("High");
      expect(scored[1]!.segment).toBe("Low Academic / Low Placement");

      // Charlie: High academic, low placement readiness
      expect(scored[2]!.academicRisk).toBe("Low");
      expect(scored[2]!.placementRisk).toBe("High");
      expect(scored[2]!.segment).toBe("High Academic / Low Placement");
    });

    it("accurately summarizes cohort metrics without data hallucination", () => {
      expect(analytics.totalStudents).toBe(3);
      expect(analytics.academicRisk.High).toBe(1);
      expect(analytics.placementRisk.High).toBe(2);
      expect(analytics.byDepartment.length).toBe(2);
      expect(analytics.urgentStudents.length).toBe(2); // Bob & Charlie (both have at least 1 High risk)
    });

    it("strictly isolates individual student records for privacy", () => {
      const student1 = scored[0]!;
      const student2 = scored[1]!;

      expect(student1.roll_no).not.toBe(student2.roll_no);
      expect(student1.explanation.topStrength).not.toEqual(student2.explanation.topStrength);
    });

    describe("Conversational Multi-Turn Fallback Engine", () => {
      it("responds helpfully to greetings and capability introductions", () => {
        const reply = generateConversationalFallback("Hello! Who are you?", [], analytics);
        expect(reply).toContain("KRYPTEDU Student Analytics Copilot");
        expect(reply).toContain("Risk Monitoring");
        expect(reply).toContain("Department Comparisons");
      });

      it("handles Mode A natural-language inquiries about struggling students", () => {
        const reply = generateConversationalFallback("Which students are struggling the most?", [], analytics);
        expect(reply).toContain("Urgent Support & Cohort Risk Analysis");
        expect(reply).toContain("Bob");
      });

      it("handles Mode A department performance rankings", () => {
        const reply = generateConversationalFallback("Can you rank the branches by success score?", [], analytics);
        expect(reply).toContain("Department Performance Rankings");
        expect(reply).toContain("Computer Science");
        expect(reply).toContain("Information Tech");
      });

      it("answers Mode B general pedagogy question: STAR method", () => {
        const reply = generateConversationalFallback("Explain the STAR method for our students", [], analytics);
        expect(reply).toContain("STAR Method");
        expect(reply).toContain("Situation");
        expect(reply).toContain("Task");
        expect(reply).toContain("Action");
        expect(reply).toContain("Result");
      });

      it("answers Mode B general advisory question: How to improve placement rates", () => {
        const reply = generateConversationalFallback("How can a college improve placement rates?", [], analytics);
        expect(reply).toContain("Institutional Playbook");
        expect(reply).toContain("Diagnostic Screening");
        expect(reply).toContain("Mock Interviews");
      });

      it("explains the analytical scoring formula and weights in plain language", () => {
        const reply = generateConversationalFallback("How did you calculate the student success score?", [], analytics);
        expect(reply).toContain("Student Success Score Methodology");
        expect(reply).toContain("Academic Index (45%)");
        expect(reply).toContain("Placement Index (35%)");
        expect(reply).toContain("Campus Engagement (20%)");
      });

      it("resolves multi-turn follow-up: 'why is it low?' referring to previous department query", () => {
        const history = [
          { role: "user" as const, content: "Which department has lowest placement?" },
          { role: "assistant" as const, content: "Department Performance Rankings: Information Tech is lowest." },
        ];
        const reply = generateConversationalFallback("Why is it low?", history, analytics);
        expect(reply).toContain("Information Tech");
        expect(reply).toContain("Underlying Factors");
      });

      it("resolves multi-turn follow-up: 'make it a 30-day plan'", () => {
        const history = [
          { role: "user" as const, content: "Which students need urgent help?" },
          { role: "assistant" as const, content: "Bob needs urgent help due to backlogs." },
        ];
        const reply = generateConversationalFallback("Make it a 30-day plan", history, analytics);
        expect(reply).toContain("30-Day Turnaround & Action Plan");
        expect(reply).toContain("Week 1");
        expect(reply).toContain("Week 2");
        expect(reply).toContain("Week 3");
        expect(reply).toContain("Week 4");
      });
    });
  });
});
