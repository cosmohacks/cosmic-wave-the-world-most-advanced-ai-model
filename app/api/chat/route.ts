import { NextResponse } from "next/server";
import { generateChatAnswer, getConfiguredProviders, ProviderError } from "@/lib/ai";
import type { ChatMessage, ProviderName } from "@/lib/types";

const providers: ProviderName[] = ["openai", "gemini", "anthropic"];
const maxMessageLength = 4000;
const maxHistoryLength = 12;

export async function GET() {
  const configuredProviders = getConfiguredProviders();
  return NextResponse.json({ configuredProviders });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request must contain valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const input = body as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > maxMessageLength) return NextResponse.json({ error: `Message must be ${maxMessageLength} characters or fewer.` }, { status: 400 });

  const requestedProvider = input.provider;
  if (requestedProvider !== undefined && (typeof requestedProvider !== "string" || !providers.includes(requestedProvider as ProviderName))) {
    return NextResponse.json({ error: "Choose a supported AI provider." }, { status: 400 });
  }
  const rawHistory = input.history === undefined ? [] : input.history;
  if (!Array.isArray(rawHistory) || rawHistory.length > maxHistoryLength) {
    return NextResponse.json({ error: `Conversation history must have at most ${maxHistoryLength} messages.` }, { status: 400 });
  }
  const history: ChatMessage[] = [];
  for (const item of rawHistory) {
    if (!item || typeof item !== "object") return NextResponse.json({ error: "Invalid conversation history." }, { status: 400 });
    const entry = item as Record<string, unknown>;
    if ((entry.role !== "user" && entry.role !== "assistant") || typeof entry.content !== "string" || entry.content.length > maxMessageLength) {
      return NextResponse.json({ error: "Invalid conversation history." }, { status: 400 });
    }
    history.push({ role: entry.role, content: entry.content });
  }
  const language = typeof input.language === "string" && input.language.length <= 40 ? input.language : undefined;
  const configured = getConfiguredProviders();
  const selected = requestedProvider as ProviderName | undefined;

  // Respect an explicitly chosen provider so its actual auth/model/quota error is visible.
  const candidates = selected ? [selected] : configured;
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No provider API key is configured for this deployment. Add GEMINI_API_KEY in Vercel and redeploy." }, { status: 503 });
  }
  if (selected && !configured.includes(selected)) {
    const envName = `${selected.toUpperCase()}_API_KEY`;
    return NextResponse.json({ error: `${envName} is not available in this Vercel deployment. Add it for the Production environment and redeploy.` }, { status: 503 });
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return NextResponse.json(await generateChatAnswer(message, history, candidate, language));
    } catch (error) {
      lastError = error;
      if (selected) break;
    }
  }
  if (lastError instanceof ProviderError) {
    return NextResponse.json({ error: lastError.message }, { status: lastError.status });
  }
  console.error("Cosmo AI request failed:", lastError instanceof Error ? lastError.message : "unknown error");
  return NextResponse.json({ error: "The AI provider request failed unexpectedly. Please retry." }, { status: 502 });
}
