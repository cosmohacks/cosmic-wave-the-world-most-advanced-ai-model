export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ProviderName = "openai" | "gemini" | "anthropic";

export interface ChatRequest {
  message: string;
  provider?: ProviderName;
  history?: ChatMessage[];
  language?: string;
}

export interface ChatResponse {
  answer: string;
  provider: ProviderName;
}
