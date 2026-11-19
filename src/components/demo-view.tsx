"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  FileText,
  Image as ImageIcon,
  Info,
  MessagesSquare,
  Quote,
  Search,
  Sparkles,
  Table2,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, buttonClass, Card, Input } from "@/components/ui";
import {
  DEMO_DOCUMENTS,
  DEMO_QUESTIONS,
  demoAnswer,
  demoSearch,
  demoTerms,
  type DemoAnswer,
} from "@/lib/demo";
import { cn, fileTypeLabel, splitHighlight } from "@/lib/utils";

const ICONS = {
  pdf: FileText,
  md: FileText,
  docx: FileText,
  txt: FileText,
  csv: Table2,
  image: ImageIcon,
} as const;

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {splitHighlight(text, terms).map((part, index) =>
        part.hit ? (
          <mark key={index} className="rounded-[2px] bg-accent-soft px-0.5 text-accent-ink">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function DemoView() {
  const [mode, setMode] = useState<"search" | "ask">("search");
  const [query, setQuery] = useState("normalization");
  const [submitted, setSubmitted] = useState("normalization");

  const terms = useMemo(() => demoTerms(submitted), [submitted]);
  const hits = useMemo(() => demoSearch(submitted), [submitted]);
  const answer = useMemo<DemoAnswer | null>(
    () => (mode === "ask" ? demoAnswer(submitted) : null),
    [mode, submitted],
  );

  const run = (value: string) => {
    setQuery(value);
    setSubmitted(value.trim() || "normalization");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    run(query);
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Brand />
          <Badge tone="warn" className="ml-1 hidden sm:inline-flex">Demo workspace</Badge>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden text-[13px] text-ink-2 hover:text-ink sm:block">
              Sign in
            </Link>
            <Link href="/signup" className={buttonClass("primary", "sm")}>
              Start remembering
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] leading-5 text-warn">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">This is a demo workspace.</span> The six documents below
            are synthetic samples written for this demo. They are not your data, and answers here are
            assembled from those samples — not generated about your library.
          </p>
        </div>

        <div className="mt-8 max-w-2xl">
          <p className="eyebrow">Explore RecallAI</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[40px]">
            Ask a question the way you would ask yourself.
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-muted">
            Search the sample library, or switch to Ask mode to see how a cited answer is assembled
            from retrieved passages.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. where did I write about two-phase locking?"
                aria-label="Demo search query"
                className="h-12 pl-9 pr-3 text-[14px]"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-md border border-line-strong bg-surface p-0.5" role="group" aria-label="Mode">
                {(["search", "ask"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded px-3 text-[12.5px] font-medium capitalize transition-colors",
                      mode === value ? "bg-accent-soft text-accent-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    {value === "search" ? <Search size={13} /> : <Sparkles size={13} />}
                    {value}
                  </button>
                ))}
              </div>
              <Button type="submit" className="h-12 px-5">
                Run <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {DEMO_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => run(question)}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] text-ink-2 transition-colors hover:border-accent/40 hover:text-ink"
            >
              {question}
            </button>
          ))}
        </div>

        {mode === "ask" && answer ? (
          <Card className="mt-8 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent-ink">
                <MessagesSquare size={14} />
              </span>
              <p className="text-[13px] font-medium text-ink">Demo answer</p>
              <Badge tone="outline" className="ml-auto">Synthetic sources</Badge>
            </div>
            <div className="mt-4 space-y-3 text-[13.5px] leading-7 text-ink-2">
              {answer.answer.split("\n").map((line, index) =>
                line.trim() === "" ? (
                  <div key={index} className="h-1" />
                ) : line.startsWith("- ") ? (
                  <div key={index} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <Quote size={12} className="mb-1 text-muted" />
                    <Highlighted text={line.slice(2)} terms={terms} />
                  </div>
                ) : (
                  <p key={index} className={line.startsWith("_") ? "text-[12px] text-muted" : ""}>
                    {line.replace(/^_|_$/g, "")}
                  </p>
                ),
              )}
            </div>

            {answer.citations.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="eyebrow">Sources</p>
                <div className="mt-2 space-y-2">
                  {answer.citations.map((citation) => (
                    <div key={citation.index} className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 px-3 py-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-ink-2">
                        {citation.index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-ink">{citation.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {fileTypeLabel(citation.fileType)}
                          {citation.page ? ` · Page ${citation.page}` : ""}
                          {citation.section ? ` · ${citation.section}` : ""}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11.5px] leading-5 text-muted">{citation.excerpt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        ) : (
          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">
                {hits.length} {hits.length === 1 ? "passage" : "passages"} in the sample library
              </p>
              <p className="text-[11.5px] text-muted">Synthetic workspace · 6 documents</p>
            </div>

            <div className="mt-3 space-y-3">
              {hits.length === 0 ? (
                <Card className="px-5 py-10 text-center">
                  <p className="text-[13.5px] font-medium text-ink">Nothing matches that in the demo library.</p>
                  <p className="mt-1 text-[12.5px] text-muted">Try one of the suggested questions above.</p>
                </Card>
              ) : (
                hits.map((hit) => {
                  const Icon = ICONS[hit.fileType as keyof typeof ICONS] ?? FileText;
                  return (
                    <Card key={`${hit.documentId}-${hit.section}-${hit.page}`} className="p-4 animate-rise">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-2">
                          <Icon size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13.5px] font-medium text-ink">{hit.title}</p>
                            <Badge tone="outline">{fileTypeLabel(hit.fileType)}</Badge>
                            {hit.page ? <Badge tone="outline">Page {hit.page}</Badge> : null}
                            {hit.section ? <Badge tone="outline">{hit.section}</Badge> : null}
                            <span className="ml-auto text-[11px] tabular-nums text-muted">
                              {Math.round((hit.score / Math.max(hits[0].score, 1)) * 100)}% match
                            </span>
                          </div>
                          <p className="mt-1.5 text-[12.5px] leading-6 text-ink-2">
                            <Highlighted text={hit.excerpt} terms={terms} />
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="mt-12">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-accent" />
            <h2 className="text-[15px] font-semibold text-ink">Sample documents</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_DOCUMENTS.map((document) => {
              const Icon = ICONS[document.fileType] ?? FileText;
              return (
                <div key={document.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-3 text-ink-2">
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-ink">{document.title}</p>
                    <p className="truncate text-[11px] text-muted">
                      {fileTypeLabel(document.fileType)} · {document.units.length} indexed passages
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[15px] font-semibold text-ink">Ready to search your own library?</p>
            <p className="mt-1 text-[12.5px] text-muted">
              Upload your notes and screenshots. Your library stays private to your account.
            </p>
          </div>
          <Link href="/signup" className={buttonClass("primary", "md")}>
            Start remembering <ArrowRight size={15} />
          </Link>
        </div>
      </main>
    </div>
  );
}
