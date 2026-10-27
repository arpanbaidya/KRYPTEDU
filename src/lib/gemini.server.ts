import { GoogleGenAI } from "@google/genai";

export type ChatTurn = {
  role: "user" | "assistant" | "model";
  content: string;
};

export type GeminiOptions = {
  systemInstruction?: string;
  responseSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  history?: ChatTurn[];
};

export type GeminiResult<T = unknown> = {
  data: T | null;
  text: string;
  error: string | null;
  model: string;
  latencyMs: number;
};

/**
 * Check whether a Gemini API key is configured in the environment.
 * Does not expose the key value.
 */
export function isGeminiConfigured(): boolean {
  const key = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
  return typeof key === "string" && key.trim().length > 10;
}

/**
 * Get the configured Gemini model identifier.
 * Defaults to "gemini-1.5-flash" (production-stable low-latency model).
 */
export function getGeminiModel(): string {
  return process.env["GEMINI_MODEL"] || "gemini-1.5-flash";
}

/**
 * Robust, server-only invocation of Google GenAI SDK.
 * Features:
 * - Server-only execution; secrets never leak to client.
 * - Multi-turn conversation history support for conversational context retention.
 * - Bounded exponential backoff with jitter for transient errors (429, 503).
 * - Immediate abort on permanent failures (401, 403, 400).
 * - Configurable timeouts (default 35s).
 * - Structured JSON parsing with code-fence fallback.
 * - Sanitized error messages to avoid internal leaks.
 */
export async function callGemini<T = unknown>(
  prompt: string,
  options: GeminiOptions = {},
): Promise<GeminiResult<T>> {
  const startTime = Date.now();
  const key = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
  const model = getGeminiModel();

  if (!key) {
    return {
      data: null,
      text: "",
      error: "The AI service is not configured with an API key.",
      model,
      latencyMs: 0,
    };
  }

  const timeoutMs = options.timeoutMs ?? 35000;
  const isJson = !!options.responseSchema;

  // Build multi-turn contents array for Google GenAI SDK
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  if (options.history && options.history.length > 0) {
    for (const turn of options.history) {
      const text = (turn.content || "").trim();
      if (!text) continue;
      contents.push({
        role: turn.role === "assistant" || turn.role === "model" ? "model" : "user",
        parts: [{ text }],
      });
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  let attempt = 0;
  const maxRetries = 2;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const config: Record<string, unknown> = {
        systemInstruction: options.systemInstruction,
        abortSignal: AbortSignal.timeout(timeoutMs),
      };

      if (isJson) {
        config["responseMimeType"] = "application/json";
        config["responseSchema"] = options.responseSchema;
      }

      if (typeof options.temperature === "number") {
        config["temperature"] = Math.max(0, Math.min(1, options.temperature));
      }

      if (options.maxOutputTokens) {
        config["maxOutputTokens"] = options.maxOutputTokens;
      }

      const response = await ai.models.generateContent({
        model,
        contents: contents as any,
        config: config as any,
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text ?? "";

      let data: T | null = null;
      if (isJson && text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          // If JSON parse fails, try extracting JSON from markdown code fences
          const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            try {
              data = JSON.parse(match[1]) as T;
            } catch {
              return {
                data: null,
                text,
                error: "The AI returned malformed structured data.",
                model,
                latencyMs,
              };
            }
          } else {
            return {
              data: null,
              text,
              error: "The AI returned an invalid JSON structure.",
              model,
              latencyMs,
            };
          }
        }
      }

      return {
        data,
        text,
        error: null,
        model,
        latencyMs,
      };
    } catch (err: any) {
      const status = err?.status ?? err?.name ?? "error";
      const isTransient = status === 429 || status === 503 || err?.code === "ETIMEDOUT";

      if (isTransient && attempt <= maxRetries) {
        // Exponential backoff with jitter: 1000ms * attempt + random [0, 400]ms
        const delay = 1000 * attempt + Math.floor(Math.random() * 400);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      const latencyMs = Date.now() - startTime;
      console.error(`[Gemini Error] status=${status} attempt=${attempt} latency=${latencyMs}ms`);

      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        return {
          data: null,
          text: "",
          error: "The AI assistant request timed out. Please retry.",
          model,
          latencyMs,
        };
      }

      if (status === 429) {
        return {
          data: null,
          text: "",
          error: "AI usage limit reached. Please wait a moment before asking again.",
          model,
          latencyMs,
        };
      }

      if (status === 503) {
        return {
          data: null,
          text: "",
          error: "AI service temporarily unavailable. Please retry shortly.",
          model,
          latencyMs,
        };
      }

      if (status === 401 || status === 403) {
        return {
          data: null,
          text: "",
          error: "Invalid or unauthorized AI credentials on server.",
          model,
          latencyMs,
        };
      }

      return {
        data: null,
        text: "",
        error: "AI request could not be processed at this time.",
        model,
        latencyMs,
      };
    }
  }

  return {
    data: null,
    text: "",
    error: "AI service request failed after retries.",
    model,
    latencyMs: Date.now() - startTime,
  };
}

/** Backward-compatible wrapper for existing mock interview calls. */
export async function geminiJson(
  prompt: string,
  systemInstruction: string,
  responseSchema: unknown,
): Promise<{ data: unknown; error: string | null }> {
  const result = await callGemini(prompt, {
    systemInstruction,
    responseSchema,
  });
  return { data: result.data, error: result.error };
}
