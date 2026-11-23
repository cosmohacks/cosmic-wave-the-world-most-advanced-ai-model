import { NextResponse } from "next/server";
import { generateChatAnswer } from "@/lib/ai";
import type { ChatRequest, ProviderName } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();

    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const providers: ProviderName[] = ["openai", "gemini", "anthropic"];
    const preferred = body.provider;
    const candidates = preferred
      ? [preferred, ...providers.filter((provider) => provider !== preferred)]
      : providers;

    let lastError: unknown;
    for (const provider of candidates) {
      try {
        const result = await generateChatAnswer(message, body.history || [], provider, body.language);
        return NextResponse.json(result);
      } catch (error) {
        lastError = error;
      }
    }

    console.error(lastError);
    return NextResponse.json(
      { error: "No configured AI provider is available. Add at least one API key to .env.local." },
      { status: 503 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
