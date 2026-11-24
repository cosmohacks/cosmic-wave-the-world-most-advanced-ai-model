import type { ChatMessage, ChatResponse, ProviderName } from "./types";

const SYSTEM_PROMPT = `You are Cosmo, a helpful multilingual AI assistant. Reply in the user's language unless asked otherwise. Be accurate and balanced, acknowledge uncertainty, and never invent sources or claim live access to information you do not have.`;
const REQUEST_TIMEOUT_MS = 30_000;

export class ProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ProviderError";
  }
}

export function getConfiguredProviders(): ProviderName[] {
  const configured: ProviderName[] = [];
  if (process.env.OPENAI_API_KEY?.trim()) configured.push("openai");
  if (process.env.GEMINI_API_KEY?.trim()) configured.push("gemini");
  if (process.env.ANTHROPIC_API_KEY?.trim()) configured.push("anthropic");
  return configured;
}

export async function generateChatAnswer(
  message: string,
  history: ChatMessage[],
  provider: ProviderName,
  language?: string
): Promise<ChatResponse> {
  if (provider === "openai") return generateOpenAI(message, history, language);
  if (provider === "gemini") return generateGemini(message, history, language);
  return generateAnthropic(message, history, language);
}

function languageHint(language?: string) {
  return language ? ` Preferred response language: ${language}.` : "";
}

function requestOptions(): RequestInit {
  // Create a fresh timeout for every request; a module-level signal expires permanently.
  return { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" };
}

async function providerError(response: Response, provider: string): Promise<ProviderError> {
  let providerMessage = "";
  try {
    const body = await response.json();
    providerMessage = body?.error?.message || body?.error?.status || "";
  } catch {
    // Provider response wasn't JSON; use status-based guidance below.
  }
  console.error(`${provider} request failed`, { status: response.status, message: providerMessage.slice(0, 500) });

  if (provider === "Gemini") {
    if (response.status === 400) return new ProviderError("Gemini rejected the request. Check that GEMINI_MODEL is a model available to your API key (default: gemini-2.5-flash).", 502);
    if (response.status === 401 || response.status === 403) return new ProviderError("Gemini rejected the API key. Verify GEMINI_API_KEY in Vercel, check API-key restrictions, and confirm the Gemini API is enabled for its Google Cloud project.", 502);
    if (response.status === 404) return new ProviderError("The configured Gemini model was not found or is unavailable. Set GEMINI_MODEL to a model enabled for your API key (for example, gemini-2.5-flash).", 502);
    if (response.status === 429) return new ProviderError("Gemini quota or rate limit exceeded. Check your Google AI Studio usage, billing, and rate limits.", 503);
  }
  if (response.status >= 500) return new ProviderError(`${provider} is temporarily unavailable. Please try again shortly.`, 503);
  return new ProviderError(`${provider} rejected the request (HTTP ${response.status}). Check its API key, model setting, and account access.`, 502);
}

async function generateOpenAI(message: string, history: ChatMessage[], language?: string): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ProviderError("OPENAI_API_KEY is not configured in the hosting environment.", 503);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    ...requestOptions(),
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + languageHint(language) },
        ...history,
        { role: "user", content: message },
      ],
    }),
  });
  if (!response.ok) throw await providerError(response, "OpenAI");
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer) throw new ProviderError("OpenAI returned an empty response. Please retry.", 502);
  return { answer, provider: "openai" };
}

async function generateGemini(message: string, history: ChatMessage[], language?: string): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ProviderError("GEMINI_API_KEY is not configured in the hosting environment. Add it to the Vercel Production environment and redeploy.", 503);

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const contents = history.map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }],
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      ...requestOptions(),
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + languageHint(language) }] },
        contents,
      }),
    }
  );
  if (!response.ok) throw await providerError(response, "Gemini");
  const data = await response.json();
  const answer = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (typeof answer !== "string" || !answer) {
    const reason = data.promptFeedback?.blockReason;
    throw new ProviderError(reason ? `Gemini blocked this prompt (${reason}). Try rephrasing it.` : "Gemini returned no text. Please retry with a different prompt.", 502);
  }
  return { answer, provider: "gemini" };
}

async function generateAnthropic(message: string, history: ChatMessage[], language?: string): Promise<ChatResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new ProviderError("ANTHROPIC_API_KEY is not configured in the hosting environment.", 503);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    ...requestOptions(),
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 1200,
      system: SYSTEM_PROMPT + languageHint(language),
      messages: [...history, { role: "user", content: message }],
    }),
  });
  if (!response.ok) throw await providerError(response, "Anthropic");
  const data = await response.json();
  const answer = data.content?.map((block: { text?: string }) => block.text || "").join("");
  if (typeof answer !== "string" || !answer) throw new ProviderError("Anthropic returned an empty response. Please retry.", 502);
  return { answer, provider: "anthropic" };
}
