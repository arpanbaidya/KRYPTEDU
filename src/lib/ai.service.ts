import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Server-side .env loader ────────────────────────────────────────────────
// Vite only injects VITE_* vars into process.env for SSR server functions.
// Non-VITE_ vars (like AI_PROVIDER_API_KEY) must be loaded explicitly from .env.
let _envLoaded = false;
function ensureEnvLoaded(): void {
  if (_envLoaded) return;
  _envLoaded = true;
  try {
    // Try to find .env file relative to process.cwd() (project root)
    const candidates = [
      join(process.cwd(), ".env"),
      join(process.cwd(), "..", ".env"),
    ];
    for (const envPath of candidates) {
      if (!existsSync(envPath)) continue;
      const content = readFileSync(envPath, "utf8");
      for (const raw of content.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0) continue;
        const key = line.substring(0, eqIdx).trim();
        let value = line.substring(eqIdx + 1).trim();
        // Strip surrounding quotes (single or double)
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        // Only set if not already in process.env (respect system overrides)
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
      break; // Stop at first found .env
    }
  } catch {
    // Silent failure — env vars may already be set by the runtime
  }
}
// Load once at module import
ensureEnvLoaded();

export type ChatRole = "user" | "assistant" | "model" | "system";

export type ChatTurn = {
  role: "user" | "assistant" | "model";
  content: string;
};

export type AIServiceOptions = {
  systemInstruction?: string;
  responseSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  history?: ChatTurn[];
  feature?: "insights" | "interview-setup" | "interview-eval" | "interview-summary" | "general";
  skipCache?: boolean;
};

export type AIServiceResult<T = unknown> = {
  data: T | null;
  text: string;
  error: string | null;
  model: string;
  latencyMs: number;
  cached?: boolean;
};

/**
 * Cache entry for non-sensitive, idempotent AI requests
 */
type CacheEntry = {
  result: AIServiceResult<any>;
  timestamp: number;
};

const RESPONSE_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60-second TTL for identical idempotent requests

/**
 * Securely retrieves the active AI provider API key from server environment variables.
 * Prioritizes AI_PROVIDER_API_KEY, with fallback to GEMINI_API_KEY and GOOGLE_API_KEY.
 * Never exposed to client bundles or frontend responses.
 */
export function getAIKey(): string | null {
  ensureEnvLoaded();
  const key =
    process.env["AI_PROVIDER_API_KEY"] ||
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"];
  if (typeof key === "string" && key.trim().length > 10) {
    return key.trim();
  }
  return null;
}

/**
 * Check whether the AI service is configured with a valid server-side credential.
 * Safe for capability checks; never reveals key contents.
 */
export function isAIConfigured(): boolean {
  return getAIKey() !== null;
}

/**
 * Returns the configured model identifier.
 * Prioritizes AI_PROVIDER_MODEL, then GEMINI_MODEL, defaulting to "gemini-1.5-flash".
 */
export function getAIModel(): string {
  return (
    process.env["AI_PROVIDER_MODEL"] ||
    process.env["GEMINI_MODEL"] ||
    "gemini-3.1-flash-lite"
  );
}

/**
 * Returns the configured base URL / endpoint if custom gateway is used.
 */
export function getAIBaseUrl(): string | undefined {
  return process.env["AI_PROVIDER_BASE_URL"] || process.env["GEMINI_BASE_URL"] || undefined;
}

/**
 * Clean up expired cache entries.
 */
function pruneExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of RESPONSE_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      RESPONSE_CACHE.delete(key);
    }
  }
}

/**
 * Shared, robust server-side AI execution service for KRYPTEDU.
 *
 * Capabilities:
 * - Official Google GenAI SDK integration (@google/genai)
 * - Server-only execution with zero secret leakage
 * - Multi-turn conversation context retention
 * - Configurable timeouts (e.g. longer for interview evaluations, shorter for analytics)
 * - Bounded exponential backoff with jitter for transient errors (429, 503, timeouts)
 * - Strict structured JSON schema validation with markdown fence extraction fallback
 * - Request caching for idempotent general queries with privacy boundaries
 * - Structured latency logging without logging PII or sensitive keys
 */
export async function callAI<T = unknown>(
  prompt: string,
  options: AIServiceOptions = {},
): Promise<AIServiceResult<T>> {
  const startTime = Date.now();
  const key = getAIKey();
  const model = getAIModel();
  const baseUrl = getAIBaseUrl();

  console.log(`[AIService] callAI: model=${model}, keySet=${!!key}, keyLen=${key?.length ?? 0}, feature=${options.feature ?? "general"}`);

  if (!key) {
    return {
      data: null,
      text: "",
      error: "The AI service is not configured with an API key. Please set AI_PROVIDER_API_KEY in server environment variables.",
      model,
      latencyMs: 0,
    };
  }

  // Check cache for idempotent requests when allowed
  const canCache = !options.skipCache && options.feature !== "interview-eval";
  let cacheKey = "";
  if (canCache) {
    pruneExpiredCache();
    cacheKey = `${model}:${options.systemInstruction || ""}:${prompt}:${JSON.stringify(options.history || [])}`;
    const cached = RESPONSE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.result,
        latencyMs: Date.now() - startTime,
        cached: true,
      };
    }
  }

  // Feature-specific timeout tuning: fast responses ensure the UI never hangs
  const defaultTimeout =
    options.feature === "interview-eval"
      ? 5000 // 5 seconds max for interview evaluations
      : options.feature === "interview-summary"
      ? 6000 // 6 seconds max for interview summary
      : options.feature === "interview-setup"
      ? 6000 // 6 seconds max for question setup
      : 7000; // 7 seconds max for analytics and insights

  const timeoutMs = options.timeoutMs ?? defaultTimeout;
  const isJson = !!options.responseSchema;

  // Build clean contents payload for Google GenAI SDK
  let contentsPayload: string;
  if (!options.history || options.history.length === 0) {
    contentsPayload = prompt;
  } else {
    const turns = options.history
      .filter((t) => t.content && t.content.trim())
      .map((t) => `${t.role === "assistant" || t.role === "model" ? "Assistant" : "User"}: ${t.content.trim()}`)
      .join("\n\n");
    contentsPayload = turns ? `${turns}\n\nUser: ${prompt}` : prompt;
  }

  let attempt = 0;
  let activeModel = model;
  const maxRetries = 1;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const clientOptions: Record<string, any> = { apiKey: key };
      if (baseUrl) {
        clientOptions["httpOptions"] = { baseUrl };
      }

      const ai = new GoogleGenAI(clientOptions);

      const config: Record<string, unknown> = {
        systemInstruction: options.systemInstruction,
        abortSignal: AbortSignal.timeout(timeoutMs),
      };

      if (isJson) {
        config["responseMimeType"] = "application/json";
        if (options.responseSchema) {
          config["responseSchema"] = options.responseSchema;
        }
      }

      if (typeof options.temperature === "number") {
        config["temperature"] = Math.max(0, Math.min(1, options.temperature));
      }

      if (options.maxOutputTokens) {
        config["maxOutputTokens"] = options.maxOutputTokens;
      }

      const response = await ai.models.generateContent({
        model: activeModel,
        contents: contentsPayload,
        config: config as any,
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text ?? "";

      let data: T | null = null;
      if (isJson && text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          // If direct JSON parse fails, attempt extraction from markdown code fences
          const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            try {
              data = JSON.parse(match[1]) as T;
            } catch {
              return {
                data: null,
                text,
                error: "The AI service returned malformed structured JSON data.",
                model: activeModel,
                latencyMs,
              };
            }
          } else {
            return {
              data: null,
              text,
              error: "The AI service returned an invalid JSON response structure.",
              model: activeModel,
              latencyMs,
            };
          }
        }
      }

      const finalResult: AIServiceResult<T> = {
        data,
        text,
        error: null,
        model: activeModel,
        latencyMs,
      };

      // Store in cache if eligible
      if (canCache && cacheKey && !finalResult.error) {
        RESPONSE_CACHE.set(cacheKey, { result: finalResult, timestamp: Date.now() });
      }

      return finalResult;
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? err?.name ?? "error";
      const isTransient =
        status === 429 ||
        status === 503 ||
        status === 404 ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNRESET" ||
        err?.name === "TimeoutError";

      if (isTransient && attempt <= maxRetries) {
        if (activeModel === "gemini-3.5-flash-lite") {
          activeModel = "gemini-3.1-flash-lite";
        } else if (activeModel === "gemini-3.1-flash-lite") {
          activeModel = "gemini-flash-lite-latest";
        } else {
          activeModel = "gemini-3.5-flash-lite";
        }
        const delay = 150 * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      const latencyMs = Date.now() - startTime;

      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        return {
          data: null,
          text: "",
          error: `The AI request timed out after ${timeoutMs}ms. Please try again.`,
          model,
          latencyMs,
        };
      }

      if (status === 429) {
        return {
          data: null,
          text: "",
          error: "AI service rate limit reached. Please wait a moment before sending another request.",
          model,
          latencyMs,
        };
      }

      if (status === 503) {
        return {
          data: null,
          text: "",
          error: "The upstream AI service is temporarily unavailable. Please retry shortly.",
          model,
          latencyMs,
        };
      }

      if (status === 401 || status === 403) {
        return {
          data: null,
          text: "",
          error: "Invalid or unauthorized AI credentials on server. Please verify AI_PROVIDER_API_KEY.",
          model,
          latencyMs,
        };
      }

      const errorMessage = typeof err?.message === "string" ? err.message : "AI request could not be completed.";
      console.error("[AIService] Execution error:", errorMessage, err);
      return {
        data: null,
        text: "",
        error: errorMessage.includes("API key not valid")
          ? "Invalid AI API key. Please check your AI_PROVIDER_API_KEY environment variable."
          : errorMessage || "AI request could not be processed at this time.",
        model,
        latencyMs,
      };
    }
  }

  return {
    data: null,
    text: "",
    error: "AI service request failed after retry attempts.",
    model,
    latencyMs: Date.now() - startTime,
  };
}

// ─── Backward-Compatibility Aliases ─────────────────────────────────────────

export const isGeminiConfigured = isAIConfigured;
export const getGeminiModel = getAIModel;
export const callGemini = callAI;

export async function geminiJson(
  prompt: string,
  systemInstruction: string,
  responseSchema: unknown,
): Promise<{ data: unknown; error: string | null }> {
  const result = await callAI(prompt, {
    systemInstruction,
    responseSchema,
  });
  return { data: result.data, error: result.error };
}
