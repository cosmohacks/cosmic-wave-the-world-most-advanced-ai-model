"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage, ProviderName } from "@/lib/types";

const suggestions = [
  "Explain the latest space discovery",
  "Teach me a language in 5 minutes",
  "Summarize world news today",
  "Help me solve a difficult problem",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ProviderName>("gemini");
  const [configuredProviders, setConfiguredProviders] = useState<ProviderName[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    fetch("/api/chat")
      .then((response) => response.json())
      .then((data) => setConfiguredProviders(data.configuredProviders || []))
      .catch(() => setConfiguredProviders([]));
  }, []);

  async function send(text = input) {
    const message = text.trim();
    if (!message || loading) return;

    const history = [...messages];
    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, provider, language: navigator.language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cosmo could not respond");
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <main className="shell">
      <header>
        <div className="brand"><span className="orb" /> <strong>COSMO</strong></div>
        <div className="provider-control">
          <span className={configuredProviders.includes(provider) ? "provider-status ready" : "provider-status"}>
            {configuredProviders.includes(provider) ? "API ready" : "Key not detected"}
          </span>
          <select value={provider} onChange={(event) => setProvider(event.target.value as ProviderName)} aria-label="AI provider">
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="anthropic">Claude</option>
          </select>
        </div>
      </header>

      <section className={messages.length ? "conversation active" : "conversation"} aria-live="polite">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="hero-orb"><span /></div>
            <h1>What will you discover?</h1>
            <p>Ask Cosmo in your language. Explore science, culture, news, ideas, and the world around you.</p>
            <div className="suggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void send(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message, index) => (
              <article key={index} className={message.role}>
                <span className="avatar" aria-hidden="true">{message.role === "assistant" ? "C" : "Y"}</span>
                <div>{message.content}</div>
              </article>
            ))}
            {loading && <article className="assistant"><span className="avatar">C</span><div className="typing" aria-label="Cosmo is thinking"><i /><i /><i /></div></article>}
            <div ref={endRef} />
          </div>
        )}
      </section>

      <form onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask anything in any language..." aria-label="Message Cosmo" maxLength={4000} />
        <button type="submit" disabled={!input.trim() || loading} aria-label="Send">↗</button>
      </form>
      <footer>Cosmo can make mistakes. Verify important information.</footer>
    </main>
  );
}
