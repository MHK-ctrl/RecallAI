import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  FolderClosed,
  Layers,
  Lock,
  MessagesSquare,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, buttonClass } from "@/components/ui";

const STEPS = [
  {
    icon: UploadCloud,
    title: "Upload your knowledge",
    body: "Drop in lecture notes, PDFs, Word documents, markdown files, spreadsheets or screenshots. RecallAI extracts the text — including OCR for images — and splits it into source-linked passages.",
  },
  {
    icon: Search,
    title: "Search naturally",
    body: "Ask the way you think. Hybrid retrieval combines full-text search with vector similarity, so you find the right passage even when you do not remember the exact words.",
  },
  {
    icon: MessagesSquare,
    title: "Ask with citations",
    body: "Get a short answer written from the passages it actually retrieved, with numbered citations to the document, page and section behind every claim.",
  },
];

const PRIVACY = [
  { icon: Lock, title: "Private by default", body: "Every document belongs to one account. Nothing is published, shared, or searchable by anyone else." },
  { icon: Layers, title: "Isolated retrieval", body: "Queries are scoped to your own chunks at the database level, not filtered afterwards in the browser." },
  { icon: Sparkles, title: "Only relevant passages", body: "An answer request sends the few retrieved excerpts to the AI provider — never your whole library." },
  { icon: Trash2, title: "Deletion that means it", body: "Deleting a document removes its file, its chunks, its embeddings and its collection links in one cascade." },
];

const FORMATS = ["PDF", "DOCX", "TXT", "Markdown", "CSV", "PNG", "JPG", "WEBP"];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Brand />
          <nav className="hidden items-center gap-6 text-[13px] text-ink-2 md:flex" aria-label="Sections">
            <a className="transition-colors hover:text-ink" href="#how">How it works</a>
            <a className="transition-colors hover:text-ink" href="#answers">Cited answers</a>
            <a className="transition-colors hover:text-ink" href="#privacy">Privacy</a>
            <a className="transition-colors hover:text-ink" href="#formats">Formats</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden rounded-md px-3 py-2 text-[13px] font-medium text-ink-2 hover:text-ink sm:block">
              Sign in
            </Link>
            <Link href="/signup" className={buttonClass("primary", "sm")}>
              Start remembering
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--accent-soft),transparent)] opacity-70"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:pb-24">
            <div className="animate-rise">
              <Badge tone="outline" className="mb-5 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Personal knowledge, searchable
              </Badge>
              <h1 className="text-[42px] font-semibold leading-[1.03] tracking-[-0.038em] text-ink sm:text-[58px] lg:text-[64px]">
                Your memories.
                <br />
                <span className="text-accent">One intelligent search.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-7 text-ink-2">
                Stop searching through folders. Find anything you&apos;ve saved using simple,
                natural language — then open the exact page it came from.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup" className={buttonClass("primary", "lg")}>
                  Start remembering <ArrowRight size={16} />
                </Link>
                <Link href="/demo" className={buttonClass("secondary", "lg")}>
                  Explore demo
                </Link>
              </div>
              <p className="mt-5 flex items-center gap-1.5 text-[12.5px] text-muted">
                <ShieldCheck size={14} className="text-accent" />
                Private by default. Your documents are never public.
              </p>
            </div>

            {/* Product preview */}
            <div className="animate-rise [animation-delay:120ms]">
              <div className="rounded-2xl border border-line bg-surface p-2 shadow-[0_24px_60px_-30px_rgba(16,24,20,0.35)]">
                <div className="flex items-center gap-1.5 px-2 py-2">
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="ml-2 text-[10.5px] uppercase tracking-[0.12em] text-muted">
                    Interface preview
                  </span>
                </div>
                <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                  <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2.5">
                    <Search size={15} className="text-accent" />
                    <span className="text-[13px] text-ink-2">where did I write about database normalization?</span>
                    <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
                      ↵
                    </kbd>
                  </div>

                  <div className="mt-3 rounded-lg border border-accent/20 bg-accent-soft/70 p-3">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent-ink">
                      <Sparkles size={11} /> Answer from 2 sources
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-5 text-accent-ink">
                      Your DBMS notes describe normalization as organising tables to reduce
                      redundancy and avoid update anomalies, working through 1NF, 2NF and 3NF.
                      <span className="ml-1 font-medium">[1]</span>
                      <span className="ml-0.5 font-medium">[2]</span>
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    {[
                      { title: "DBMS — Normalization Notes", meta: "PDF · Page 24 · Section: Normal forms", score: "92%" },
                      { title: "Database revision sheet", meta: "Markdown · Section: 3NF and BCNF", score: "78%" },
                    ].map((result) => (
                      <div key={result.title} className="rounded-lg border border-line bg-surface p-3">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-surface-3 text-ink-2">
                            <FileText size={13} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[12.5px] font-medium text-ink">{result.title}</p>
                              <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted">
                                {result.score}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted">{result.meta}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted">
                Illustrative preview using the synthetic demo workspace.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-line bg-surface-2">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <p className="eyebrow">How RecallAI works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[38px]">
                Three steps between a question and the page it lives on.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="rounded-xl border border-line bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                      <step.icon size={17} strokeWidth={1.8} />
                    </span>
                    <span className="font-mono text-[11px] text-muted">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-6 text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cited answers */}
        <section id="answers" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="eyebrow">Grounded, not guessed</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[38px]">
                Answers that show their work.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-ink-2">
                RecallAI retrieves passages first, then answers from them. Every citation points to
                a real chunk in a real document — with the page and section attached. When the
                sources do not cover your question, it says so instead of inventing an answer.
              </p>
              <ul className="mt-6 space-y-3 text-[13.5px] text-ink-2">
                {[
                  "Numbered citations on every claim",
                  "Open the original file at the cited page",
                  "No-evidence response when your library is silent",
                  "Extractive fallback when no AI model is configured",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-line bg-surface p-4 shadow-[0_18px_50px_-36px_rgba(16,24,20,0.4)]">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent-ink">
                  <MessagesSquare size={14} />
                </span>
                <p className="text-[13px] font-medium text-ink">Ask your memories</p>
                <Badge tone="outline" className="ml-auto">Example</Badge>
              </div>
              <div className="space-y-3 pt-3">
                <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-ink px-3 py-2 text-[12.5px] leading-5 text-canvas">
                  What did I save about two-phase locking?
                </div>
                <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-line bg-surface-2 px-3 py-2.5">
                  <p className="text-[12.5px] leading-5 text-ink-2">
                    Two-phase locking has a growing phase where locks are acquired and a shrinking
                    phase where they are released. Strict 2PL holds every lock until commit, which
                    prevents cascading aborts.
                    <span className="ml-1 font-medium text-accent-ink">[1]</span>
                  </p>
                  <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
                    <div className="flex items-start gap-2 text-[11.5px] text-muted">
                      <Quote size={11} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium text-ink-2">[1] Distributed Systems — Lecture 7</span>
                        <span className="block">Markdown · Section: Two-phase locking</span>
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-[11.5px] text-muted">
                      <Quote size={11} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium text-ink-2">[2] Transactions — Revision</span>
                        <span className="block">PDF · Page 12</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Organisation */}
        <section className="border-y border-line bg-surface-2">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-3 lg:py-20">
            {[
              { icon: FolderClosed, title: "Collections", body: "Group a semester, a project or a client into one workspace and search inside it." },
              { icon: Layers, title: "Tags", body: "Cross-cut your library with tags, then combine them with file-type and date filters." },
              { icon: Search, title: "Memory timeline", body: "Walk back through everything you added, month by month, and reopen any source." },
            ].map((feature) => (
              <div key={feature.title} className="rounded-xl border border-line bg-surface p-5">
                <feature.icon size={18} className="text-accent" strokeWidth={1.8} />
                <h3 className="mt-3 text-[15px] font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="overflow-hidden rounded-2xl bg-ink text-canvas">
            <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-canvas/60">Privacy first</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-[36px]">
                  Your library is nobody else&apos;s business.
                </h2>
                <p className="mt-4 max-w-md text-[14px] leading-7 text-canvas/70">
                  RecallAI is built around a simple rule: a document is visible only to the account
                  that uploaded it. Ownership is checked on the server for every read, write and
                  download — not hidden in the interface.
                </p>
                <Link
                  href="/signup"
                  className="mt-7 inline-flex h-10 items-center gap-2 rounded-md bg-canvas px-4 text-[13px] font-medium text-ink transition-opacity hover:opacity-90"
                >
                  Start remembering <ArrowRight size={15} />
                </Link>
              </div>
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {PRIVACY.map((item) => (
                  <div key={item.title}>
                    <item.icon size={16} className="text-canvas/70" strokeWidth={1.8} />
                    <h3 className="mt-2 text-[13.5px] font-semibold">{item.title}</h3>
                    <p className="mt-1 text-[12px] leading-5 text-canvas/65">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Formats */}
        <section id="formats" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="eyebrow">Supported formats</p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-ink">
                If you saved it, bring it in.
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-6 text-muted">
                PDFs keep their page numbers. Markdown keeps its headings. Screenshots go through
                optical character recognition when OCR is available on the deployment.
              </p>
            </div>
            <div className="flex max-w-sm flex-wrap gap-1.5">
              {FORMATS.map((format) => (
                <span
                  key={format}
                  className="rounded-md border border-line-strong bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-ink-2"
                >
                  {format}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-12 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_100%_at_50%_100%,var(--accent-soft),transparent)]"
            />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[40px]">
                Your memories. One intelligent search.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-7 text-ink-2">
                Create an account, upload a few files, and ask your first question. You can explore
                the demo workspace first — no account needed.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className={buttonClass("primary", "lg")}>
                  Start remembering
                </Link>
                <Link href="/demo" className={buttonClass("secondary", "lg")}>
                  Explore demo
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-2">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="text-[11.5px] text-muted">Private knowledge search</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
            <Link href="/demo" className="hover:text-ink">Demo</Link>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            <Link href="/signup" className="hover:text-ink">Create account</Link>
            <span>Next.js · PostgreSQL · pgvector</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
