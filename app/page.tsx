"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ProviderName } from "@/lib/types";

type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const STORAGE_KEY = "cosmo-conversations-v1";
const suggestions = [
  { icon: "✦", title: "Explore an idea", prompt: "Explain a fascinating idea in a simple way." },
  { icon: "⌘", title: "Write something", prompt: "Help me write something clear and engaging." },
  { icon: "◎", title: "Learn a skill", prompt: "Teach me a useful new skill step by step." },
  { icon: "↗", title: "Solve a problem", prompt: "Help me think through a challenging problem." },
];
const providerNames: Record<ProviderName, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromMessage(message: string) {
  const clean = message.trim().replace(/\s+/g, " ");
  return clean.length > 38 ? `${clean.slice(0, 38)}…` : clean || "New chat";
}

export default function Home() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ProviderName>("gemini");
  const [configuredProviders, setConfiguredProviders] = useState<ProviderName[]>([]);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Conversation[];
        if (Array.isArray(parsed)) {
          setChats(parsed);
          if (parsed.length) setActiveId(parsed[0].id);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    fetch("/api/chat")
      .then((response) => response.json())
      .then((data) => setConfiguredProviders(data.configuredProviders || []))
      .catch(() => setConfiguredProviders([]));
  }, []);

  useEffect(() => {
    if (chats.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    else localStorage.removeItem(STORAGE_KEY);
  }, [chats]);

  const activeChat = chats.find((chat) => chat.id === activeId);
  const messages = activeChat?.messages || [];
  const filteredChats = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...chats]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((chat) => !term || chat.title.toLowerCase().includes(term) || chat.messages.some((m) => m.content.toLowerCase().includes(term)));
  }, [chats, query]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function newChat() {
    setActiveId("");
    setInput("");
    inputRef.current?.focus();
  }

  function patchChat(id: string, update: (chat: Conversation) => Conversation) {
    setChats((current) => current.map((chat) => chat.id === id ? update(chat) : chat));
  }

  async function ask(messageText: string, history: ChatMessage[], chatId: string, isNew: boolean) {
    const text = messageText.trim();
    if (!text || loading) return;
    setLoading(true);
    setInput("");

    let targetId = chatId;
    if (isNew || !targetId) {
      targetId = makeId();
      setActiveId(targetId);
      setChats((current) => [{
        id: targetId,
        title: titleFromMessage(text),
        updatedAt: Date.now(),
        messages: [...history, { role: "user", content: text }],
      }, ...current]);
    } else {
      patchChat(targetId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, { role: "user", content: text }],
      }));
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-12), provider, language: navigator.language }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cosmo could not respond. Please try again.");
      patchChat(targetId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, { role: "assistant", content: data.answer }],
      }));
    } catch (error) {
      patchChat(targetId, (chat) => ({
        ...chat,
        messages: [...chat.messages, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong." }],
      }));
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input, messages, activeId, !activeId);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(input, messages, activeId, !activeId);
    }
  }

  async function copyMessage(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      setCopiedIndex(null);
    }
  }

  function regenerate(index: number) {
    if (loading || !activeChat) return;
    const previousUserIndex = messages.slice(0, index).map((message) => message.role).lastIndexOf("user");
    if (previousUserIndex < 0) return;
    const prompt = messages[previousUserIndex].content;
    const history = messages.slice(0, previousUserIndex);
    patchChat(activeChat.id, (chat) => ({ ...chat, messages: chat.messages.slice(0, previousUserIndex) }));
    void ask(prompt, history, activeChat.id, false);
  }

  function deleteChat(id: string) {
    const remaining = chats.filter((chat) => chat.id !== id);
    setChats(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id || "");
  }

  return (
    <main className={`app-frame ${sidebarOpen ? "sidebar-visible" : "sidebar-hidden"}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="sidebar-brand" type="button" onClick={newChat} aria-label="Cosmo home">
            <span className="brand-orb"><i /></span><span>COSMO</span>
          </button>
          <button className="icon-button sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">‹</button>
        </div>
        <button className="new-chat-button" type="button" onClick={newChat}><span>＋</span> New chat</button>
        <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
        <div className="sidebar-section-label">RECENTS</div>
        <nav className="chat-list" aria-label="Recent conversations">
          {filteredChats.length ? filteredChats.map((chat) => (
            <div className={`chat-row ${chat.id === activeId ? "selected" : ""}`} key={chat.id}>
              <button type="button" className="chat-select" onClick={() => { setActiveId(chat.id); setInput(""); }}>{chat.title}</button>
              <button type="button" className="chat-delete" aria-label={`Delete ${chat.title}`} onClick={() => deleteChat(chat.id)}>···</button>
            </div>
          )) : <p className="empty-history">{query ? "No matching chats" : "Your conversations will appear here."}</p>}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">C</div>
          <div className="profile-copy"><strong>Cosmo</strong><span>Personal AI</span></div>
          <span className="profile-menu">···</span>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && <button className="icon-button open-sidebar" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">☰</button>}
            <span className="mobile-brand"><span className="brand-orb"><i /></span> COSMO</span>
            <div className="model-picker-wrap">
              <select className="model-picker" value={provider} onChange={(event) => setProvider(event.target.value as ProviderName)} aria-label="Choose AI model">
                <option value="gemini">Cosmo · Gemini</option><option value="openai">Cosmo · OpenAI</option><option value="anthropic">Cosmo · Claude</option>
              </select><span className={`connection-dot ${configuredProviders.includes(provider) ? "connected" : ""}`} title={configuredProviders.includes(provider) ? "Provider key detected" : "Provider key not detected"} />
            </div>
          </div>
          <button className="share-button" type="button" onClick={() => activeChat && navigator.clipboard.writeText(window.location.href)} disabled={!activeChat}>↗ <span>Share</span></button>
        </header>

        <div className="conversation-scroll" key={activeId || "welcome"}>
          {!messages.length ? (
            <div className="welcome-screen">
              <div className="welcome-mark"><span className="brand-orb"><i /></span></div>
              <p className="eyebrow">YOUR CURIOSITY, UNLIMITED</p>
              <h1>Where should we<br /><span>begin?</span></h1>
              <p className="welcome-subtitle">Ideas, answers, and a little cosmic perspective.<br />Ask Cosmo anything, in any language.</p>
              <div className="prompt-grid">
                {suggestions.map((item) => <button key={item.title} type="button" onClick={() => void ask(item.prompt, [], "", true)}><span className="prompt-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.prompt}</small></span><b>↗</b></button>)}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <article key={`${index}-${message.role}`} className={`message ${message.role}`}>
                  {message.role === "assistant" && <div className="assistant-mark"><span className="brand-orb"><i /></span><span>Cosmo</span></div>}
                  <div className="message-content">{message.content}</div>
                  {message.role === "assistant" && <div className="message-actions"><button type="button" onClick={() => void copyMessage(message.content, index)} title="Copy response">{copiedIndex === index ? "✓ Copied" : "▢ Copy"}</button><button type="button" onClick={() => regenerate(index)} disabled={loading} title="Regenerate response">↻ Retry</button></div>}
                </article>
              ))}
              {loading && <article className="message assistant"><div className="assistant-mark"><span className="brand-orb"><i /></span><span>Cosmo</span></div><div className="thinking"><i /><i /><i /><span>Thinking</span></div></article>}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="composer-area">
          <form className="composer" onSubmit={submit}>
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Message Cosmo…" aria-label="Message Cosmo" maxLength={4000} rows={1} />
            <div className="composer-bottom"><span className="composer-hint">↵ send <span>·</span> ⇧↵ new line</span><span className="composer-model">{providerNames[provider]}</span><button type="submit" disabled={!input.trim() || loading} aria-label="Send message">↑</button></div>
          </form>
          <p className="disclaimer">Cosmo can make mistakes. Check important information.</p>
        </div>
      </section>
    </main>
  );
}
