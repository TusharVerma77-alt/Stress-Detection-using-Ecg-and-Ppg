/**
 * Floating, collapsible chat assistant window (fixed bottom-right).
 *
 * Sends the user's message plus the current dashboard context (prediction +
 * top SHAP feature) to the backend's multi-agent system. Renders a badge on
 * each AI reply indicating which sub-agent answered.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { PredictResponse } from "@/lib/types";
import { ApiError, chat } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
  agentLabel?: string;
}

const SUGGESTIONS = [
  "Why is the patient stressed?",
  "What should I recommend?",
  "How does SHAP explainability work?",
  "What is the WESAD dataset?",
];

/* Pure message-id generator (the lint purity rule forbids Date.now()). */
let msgSeq = 0;
function nextMsgId(prefix: string): string {
  msgSeq += 1;
  return `${prefix}-${msgSeq}`;
}

/**
 * Technical questions the backend would route to the System Agent. In patient
 * view we intercept these so the patient only ever hears from the Clinical
 * Agent (the multi-agent router lives on the backend, which we must not
 * touch).
 */
const TECHNICAL_QUESTION_HINTS = [
  "wesad",
  "dataset",
  "model",
  "shap",
  "feature",
  "pipeline",
  "architecture",
  "algorithm",
  "accuracy",
  "api",
  "how does it work",
  "how does the system",
];

function looksTechnical(message: string): boolean {
  const m = message.toLowerCase();
  return TECHNICAL_QUESTION_HINTS.some((k) => m.includes(k));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Chatbox({
  result,
  viewMode = "clinician",
}: {
  result: PredictResponse | null;
  viewMode?: "clinician" | "patient";
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ---- auto-scroll to newest message ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  /* ---- focus the input when the panel opens ---- */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  /* ---- build context from the current dashboard result ---- */
  const buildContext = () => {
    if (!result) return {};
    const top = result.top_features[0];
    return {
      prediction: result.prediction,
      confidence: result.probabilities[result.prediction] ?? null,
      top_feature: top?.name ?? null,
      shap_value: top?.shap_value ?? null,
      importance: top?.importance ?? null,
    };
  };

  /* ---- send a message ---- */
  const send = async (text?: string) => {
    const body = (text ?? input).trim();
    if (!body || sending) return;

    const userMsg: Message = {
      id: nextMsgId("u"),
      role: "user",
      content: body,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    /* Patient view is Clinical-Agent only — keep technical questions from
       reaching the System Agent. */
    if (viewMode === "patient" && looksTechnical(body)) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId("a"),
          role: "assistant",
          content:
            "I’m focused on your wellbeing right now, so I’ll keep things " +
            "clinical. Tell me how you’re feeling — or try asking about " +
            "breathing exercises, stress, or what you can do to relax. 🙂",
          agent: "clinical",
          agentLabel: "Clinical Agent",
        },
      ]);
      return;
    }

    setSending(true);

    try {
      const res = await chat({ message: body, context: buildContext() });
      setMessages((prev) => [
        ...prev,
        {
          id: res.message_id,
          role: "assistant",
          content: res.response,
          agent: res.agent,
          agentLabel: res.agent_label,
        },
      ]);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId("e"),
          role: "assistant",
          content: `⚠️ ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      {/* ============================================================ */}
      {/*  COLLAPSED — floating launcher button                        */}
      {/* ============================================================ */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent/90 text-[#070a0e] shadow-xl shadow-accent/20 transition-all hover:scale-105 hover:bg-accent"
          aria-label="Open chat assistant"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* ============================================================ */}
      {/*  EXPANDED — chat window                                      */}
      {/* ============================================================ */}
      {open && (
        <div
          className="no-print fixed bottom-6 right-6 z-50 flex h-[540px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-edge bg-surface shadow-2xl shadow-black/60"
          role="dialog"
          aria-label="Clinical chat assistant"
        >
          {/* ---- Header ---- */}
          <header className="flex items-center justify-between border-b border-edge bg-raised/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              <span className="text-[12px] font-semibold text-ink">
                Clinical Assistant
              </span>
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                Multi-Agent
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
              aria-label="Minimize chat"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </header>

          {/* ---- Messages ---- */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <WelcomeBubble />
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-edge bg-raised px-2.5 py-1 text-[10px] text-dim transition-colors hover:border-accent/40 hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} content={m.content} />
              ) : (
                <AssistantBubble key={m.id} message={m} />
              ),
            )}

            {sending && <TypingBubble />}
          </div>

          {/* ---- Input ---- */}
          <div className="border-t border-edge p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask about the patient or the system…"
              className="w-full resize-none rounded-lg border border-edge bg-raised px-3 py-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent/50"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[9px] text-faint">
                Enter to send · Shift+Enter for newline
              </span>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="rounded-lg bg-accent/90 px-4 py-1.5 text-[11px] font-semibold text-[#070a0e] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-bubbles                                                        */
/* ------------------------------------------------------------------ */

function WelcomeBubble() {
  return (
    <div className="rounded-lg border border-edge bg-raised/50 px-3.5 py-3 text-[11px] leading-relaxed text-dim">
      Hello! I&apos;m your <strong className="text-ink">clinical decision
      assistant</strong>. I have live context of the current prediction
      (Stress / Baseline / Amusement / Meditation) and the top SHAP biomarker — ask me
      about the patient&apos;s state or the ML system behind this dashboard.
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-accent/20 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: Message }) {
  const isError = message.content.startsWith("⚠️");
  const isClinical = message.agent === "clinical";
  const badgeBg = isError
    ? "bg-stress/10 text-stress"
    : isClinical
      ? "bg-accent/10 text-accent"
      : "bg-amber-400/10 text-amber-400";

  return (
    <div className="flex flex-col">
      {message.agentLabel && !isError && (
        <span
          className={`mb-1 inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold ${badgeBg}`}
        >
          {isClinical ? "🤖" : "⚙️"} {message.agentLabel}
        </span>
      )}
      <div className="max-w-[92%] whitespace-pre-wrap rounded-xl rounded-bl-sm border border-edge bg-raised px-3.5 py-2.5 text-[12px] leading-relaxed text-dim">
        <BoldText text={message.content} />
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-1 rounded-xl rounded-bl-sm border border-edge bg-raised px-3.5 py-2.5 w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot h-1.5 w-1.5 rounded-full bg-faint"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Light **markdown** renderer (no dependency)                        */
/* ------------------------------------------------------------------ */

function BoldText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-ink">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
