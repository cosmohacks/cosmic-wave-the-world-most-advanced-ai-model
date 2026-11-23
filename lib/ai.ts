import type { ChatMessage, ChatResponse, ProviderName } from "./types";

const SYSTEM_PROMPT = `You are Cosmo, a knowledgeable, multilingual AI assistant.
Respond in the user's language unless they request another language.
Give accurate, useful, balanced answers across every subject.
State uncertainty clearly, avoid invented facts, and cite sources when current information is requested.
Be friendly, concise, and natural. Do not claim to be human or to possess capabilities you do not have.`;

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

function preferredLanguage(language?: string) {
  return language ? ` Preferred response language: ${language}.` : "";
}

async function generateOpenAI(message: string, history: ChatMessage[], language?: string): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + preferredLanguage(language) },
    ...history.slice(-12).map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: message },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${await response.text()}`);
  const data = await response.json();
  return { answer: data.choices[0].message.content, provider: "openai" };
}

async function generateGemini(message: string, history: ChatMessage[], language?: string): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const contents = history.slice(-12).map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }],
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + preferredLanguage(language) }] },
        contents,
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini request failed: ${await response.text()}`);
  const data = await response.json();
  return { answer: data.candidates[0].content.parts.map((part: { text?: string }) => part.text || "").join(""), provider: "gemini" };
}

async function generateAnthropic(message: string, history: ChatMessage[], language?: string): Promise<ChatResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 1200,
      system: SYSTEM_PROMPT + preferredLanguage(language),
      messages: [...history.slice(-12), { role: "user", content: message }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic request failed: ${await response.text()}`);
  const data = await response.json();
  const answer = data.content.map((block: { text?: string }) => block.text || "").join("");
  return { answer, provider: "anthropic" };
}
