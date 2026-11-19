"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  BookOpen,
  MessageSquarePlus,
  MessagesSquare,
  Quote,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, buttonClass, Card, EmptyState, Spinner } from "@/components/ui";
import type { Citation } from "@/lib/ai/answer";
import { cn, fileTypeLabel, relativeTime } from "@/lib/utils";

type Session = {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  answerMode?: "llm" | "extractive" | null;
  created_at?: string;
};

const SUGGESTIONS = [
  "Summarise what my library says about database normalization.",
  "Where did I write about two-phase locking?",
  "What does my project architecture note say about retrieval?",
  "Find anything I saved about congestion control.",
];

function citationLabel(citation: Citation): string {
  const parts = [fileTypeLabel(citation.fileType)];
  if (citation.page) parts.push(`page ${citation.page}`);
  if (citation.section) parts.push(citation.section);
  return parts.join(" · ");
}

export function AskView({
  sessions,
  activeSessionId,
  initialMessages,
  aiConfigured,
  hasDocuments,
}: {
  sessions: Session[];
  activeSessionId: string | null;
  initialMessages: ChatMessage[];
  aiConfigured: boolean;
  hasDocuments: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(activeSessionId);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const localCounter = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    setNotices([]);
    setQuestion("");

    localCounter.current += 1;
    const optimistic: ChatMessage = {
      id: `local-${localCounter.current}`,
      role: "user",
      content: trimmed,
      citations: [],
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, sessionId: sessionId ?? undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        sessionId?: string;
        message?: { id: string; content: string; created_at: string };
        citations?: Citation[];
        mode?: "llm" | "extractive";
        notices?: string[];
      };
      if (!response.ok || !payload.message || !payload.sessionId) {
        throw new Error(payload.error ?? "Could not answer that question.");
      }
      setSessionId(payload.sessionId);
      setNotices(payload.notices ?? []);
      setMessages((current) => [
        ...current,
        {
          id: payload.message!.id,
          role: "assistant",
          content: payload.message!.content,
          citations: payload.citations ?? [],
          answerMode: payload.mode,
          created_at: payload.message!.created_at,
        },
      ]);
      window.history.replaceState(null, "", `/ask?session=${payload.sessionId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not answer that question.");
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  const newConversation = () => {
    setMessages([]);
    setSessionId(null);
    setNotices([]);
    setError(null);
    window.history.replaceState(null, "", "/ask");
  };

  const removeSession = async (id: string) => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    await fetch(`/api/chat/${id}`, { method: "DELETE" }).catch(() => undefined);
    if (sessionId === id) newConversation();
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
        <div className="flex items-center justify-between lg:block">
          <button type="button" onClick={newConversation} className={buttonClass("secondary", "sm", "w-full justify-start")}>
            <MessageSquarePlus size={14} /> New conversation
          </button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scroll-thin lg:mt-3 lg:max-h-[calc(100dvh-7rem)] lg:flex-col lg:overflow-y-auto lg:pb-4">
          {sessions.length === 0 ? (
            <p className="hidden px-1.5 py-2 text-[11.5px] text-muted lg:block">No conversations yet.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group flex min-w-[180px] items-start gap-1.5 rounded-md px-2 py-1.5 lg:min-w-0",
                  sessionId === session.id ? "bg-accent-soft" : "hover:bg-surface-3",
                )}
              >
                <Link
                  href={`/ask?session=${session.id}`}
                  className="min-w-0 flex-1"
                  onClick={() => {
                    setSessionId(session.id);
                    setNotices([]);
                  }}
                >
                  <span className="block truncate text-[12px] font-medium text-ink">{session.title}</span>
                  <span className="block text-[10.5px] text-muted">
                    {session.message_count} messages · {relativeTime(session.updated_at)}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${session.title}`}
                  onClick={() => removeSession(session.id)}
                  className="mt-0.5 hidden h-5 w-5 place-items-center rounded text-muted hover:text-danger group-hover:grid"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={aiConfigured ? "accent" : "warn"}>
            {aiConfigured ? "Grounded AI answers" : "Extractive mode — no chat model configured"}
          </Badge>
          <span className="text-[11.5px] text-muted">
            {aiConfigured
              ? "Answers are written from retrieved passages and validated against real citations."
              : "Answers quote your retrieved passages directly; nothing is generated."}
          </span>
        </div>

        <Card className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  className="border-0 bg-transparent py-6"
                  icon={<MessagesSquare size={18} />}
                  title="Ask your own library a question"
                  description={
                    hasDocuments
                      ? "RecallAI retrieves the most relevant passages first, answers only from them, and cites the document, page and section."
                      : "Your library is empty, so there is nothing to retrieve yet."
                  }
                  action={
                    hasDocuments ? null : (
                      <Link href="/upload" className={buttonClass("primary", "md")}>
                        Upload documents
                      </Link>
                    )
                  }
                />
                {hasDocuments ? (
                  <div className="mx-auto mt-2 grid max-w-xl gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void ask(suggestion)}
                        className="rounded-md border border-line bg-surface-2 px-3 py-2 text-left text-[12px] text-ink-2 transition-colors hover:border-accent/40 hover:text-ink"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl rounded-br-sm bg-ink px-3.5 py-2.5 text-[13px] leading-6 text-canvas">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                      <Sparkles size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-ink-2">{message.content}</div>

                      {message.citations.length > 0 ? (
                        <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                          <p className="eyebrow">Sources</p>
                          {message.citations.map((citation) => (
                            <Link
                              key={`${message.id}-${citation.index}`}
                              href={`/documents/${citation.documentId}${citation.page ? `?page=${citation.page}` : ""}`}
                              className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 px-2.5 py-2 transition-colors hover:border-accent/40"
                            >
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-semibold text-ink-2">
                                {citation.index}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[12px] font-medium text-ink">
                                  {citation.documentTitle}
                                </span>
                                <span className="block text-[10.5px] text-muted">{citationLabel(citation)}</span>
                                <span className="mt-1 block line-clamp-2 text-[11px] leading-5 text-muted">
                                  {citation.excerpt}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : null}

                      {message.answerMode ? (
                        <p className="mt-2 text-[10.5px] text-muted">
                          {message.answerMode === "llm"
                            ? "Written from the sources above."
                            : "Quoted from the sources above — no language model configured."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ),
              )
            )}

            {pending ? (
              <div className="flex items-center gap-2.5 text-[12px] text-muted">
                <Spinner className="h-3.5 w-3.5" /> Retrieving passages and checking citations…
              </div>
            ) : null}

            {notices.length > 0 ? (
              <div className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[11.5px] leading-5 text-warn">
                {notices.join(" ")}
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
                {error}
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-line bg-surface p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask(question);
                  }
                }}
                rows={1}
                placeholder="Ask about anything you have uploaded…"
                aria-label="Your question"
                className="max-h-32 min-h-10 flex-1 resize-y rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[13px] text-ink placeholder:text-muted focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <button
                type="submit"
                disabled={pending || question.trim().length === 0}
                aria-label="Send question"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40 dark:text-[#0b1512]"
              >
                <ArrowUp size={17} />
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] text-muted">
              <BookOpen size={10} className="mr-1 inline" />
              Answers use only your retrieved documents. Document text is treated as data, never as instructions.
            </p>
          </form>
        </Card>

        <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted">
          <Quote size={10} /> Citations link to real passages. If the library has no evidence, RecallAI says so.
        </p>
      </div>
    </div>
  );
}
