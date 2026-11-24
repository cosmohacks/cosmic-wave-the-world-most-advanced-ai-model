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
  return { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" };
}

async function providerError(response: Response, provider: string): Promise<ProviderError> {
  let providerMessage = "";
  try {
    const body = await response.json();
    providerMessage = body?.error?.message || body?.error?.status || "";
  } catch {
    // Use status-based guidance if the provider didn't return JSON.
  }
  console.error(`${provider} request failed`, { status: response.status, message: providerMessage.slice(0, 500) });

  if (provider === "Gemini") {
    if (response.status === 401 || response.status === 403) return new ProviderError("Google rejected the Gemini API request. Google AI Pro for the Gemini app does not necessarily include Gemini API quota; check that this API key is from Google AI Studio, the Gemini API is enabled, and API billing/access is active for its project.", 502);
    if (response.status === 404) return new ProviderError("Google could not find or allow this Gemini model through the API. Confirm the exact model ID is available to this API key in Google AI Studio. Gemini 4 models use the Interactions API, not generateContent.", 502);
    if (response.status === 400) return new ProviderError("Gemini rejected the Interactions API request. Check the model ID and Google AI Studio API access for this project.", 502);
    if (response.status === 429) return new ProviderError("Gemini API quota or rate limit exceeded. Check API usage, billing, and limits in Google AI Studio or its linked Cloud project. The Gemini app subscription is separate from API quota.", 503);
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

  // Gemini 4 Neon/Hydrogen are called through Interactions, not generateContent.
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-4-neon";
  const transcript = history.map((turn) => `${turn.role === "assistant" ? "Cosmo" : "User"}: ${turn.content}`).join("\n\n");
  const input = [transcript, `User: ${message}`].filter(Boolean).join("\n\n");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    ...requestOptions(),
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      model,
      input,
      system_instruction: SYSTEM_PROMPT + languageHint(language),
    }),
  });
  if (!response.ok) throw await providerError(response, "Gemini");
  const data = await response.json();
  const answer = typeof data.output_text === "string"
    ? data.output_text
    : data.output?.map((item: { content?: Array<{ text?: string }> }) => item.content?.map((part) => part.text || "").join("") || "").join("");
  if (typeof answer !== "string" || !answer) throw new ProviderError("Gemini returned no text. Check the model's API availability and try again.", 502);
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
