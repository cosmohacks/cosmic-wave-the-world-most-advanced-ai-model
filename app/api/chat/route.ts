import { NextResponse } from "next/server";
import { generateChatAnswer } from "@/lib/ai";
import type { ChatMessage, ProviderName } from "@/lib/types";

const providers: ProviderName[] = ["openai", "gemini", "anthropic"];
const maxMessageLength = 4000;
const maxHistoryLength = 12;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64_000) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request must contain valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > maxMessageLength) {
    return NextResponse.json({ error: `Message must be ${maxMessageLength} characters or fewer.` }, { status: 400 });
  }

  const provider = input.provider === undefined ? undefined : input.provider;
  if (provider !== undefined && (typeof provider !== "string" || !providers.includes(provider as ProviderName))) {
    return NextResponse.json({ error: "Choose a supported AI provider." }, { status: 400 });
  }
  const rawHistory = input.history === undefined ? [] : input.history;
  if (!Array.isArray(rawHistory) || rawHistory.length > maxHistoryLength) {
    return NextResponse.json({ error: `Conversation history must have at most ${maxHistoryLength} messages.` }, { status: 400 });
  }
  const history: ChatMessage[] = [];
  for (const item of rawHistory) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Invalid conversation history." }, { status: 400 });
    }
    const entry = item as Record<string, unknown>;
    if ((entry.role !== "user" && entry.role !== "assistant") || typeof entry.content !== "string" || entry.content.length > maxMessageLength) {
      return NextResponse.json({ error: "Invalid conversation history." }, { status: 400 });
    }
    history.push({ role: entry.role, content: entry.content });
  }
  const language = typeof input.language === "string" && input.language.length <= 40 ? input.language : undefined;

  const preferred = provider as ProviderName | undefined;
  const candidates = preferred
    ? [preferred, ...providers.filter((item) => item !== preferred)]
    : providers;

  for (const candidate of candidates) {
    try {
      const result = await generateChatAnswer(message, history, candidate, language);
      return NextResponse.json(result);
    } catch (error) {
      // Do not expose provider diagnostics or secret-adjacent data to clients.
      console.error(`Cosmo provider ${candidate} failed:`, error instanceof Error ? error.message : "unknown error");
    }
  }

  return NextResponse.json(
    { error: "No AI provider is available. Configure a valid provider API key and try again." },
    { status: 503 }
  );
}
