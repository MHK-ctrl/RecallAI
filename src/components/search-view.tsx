"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  FileText,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, Button, buttonClass, Card, EmptyState, Input, Label, Select, Spinner } from "@/components/ui";
import { fileTypeLabel, formatDate, splitHighlight } from "@/lib/utils";

type Hit = {
  chunkId: string;
  documentId: string;
  title: string;
  filename: string;
  fileType: string;
  content: string;
  pageFrom: number | null;
  pageTo: number | null;
  section: string | null;
  createdAt: string;
  score: number;
  matchedTitle: boolean;
};

type Collection = { id: string; name: string; color: string; document_count: number };
type Tag = { id: string; name: string; usage_count: number };

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

function prettyMode(mode: string): string {
  if (mode === "hybrid") return "Hybrid retrieval";
  if (mode === "fallback") return "Keyword fallback";
  return "Keyword retrieval";
}

export function SearchView({
  initialQuery,
  collections,
  tags,
  hasDocuments,
}: {
  initialQuery: string;
  collections: Collection[];
  tags: Tag[];
  hasDocuments: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [hits, setHits] = useState<Hit[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [mode, setMode] = useState<string>("hybrid");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [fileType, setFileType] = useState("all");
  const [collectionId, setCollectionId] = useState("");
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searched, setSearched] = useState(false);
  const lastRun = useRef<string | null>(null);

  const run = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setSubmitted(trimmed);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          fileTypes: fileType !== "all" ? [fileType] : undefined,
          collectionId: collectionId || undefined,
          tag: tag || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        hits?: Hit[];
        terms?: string[];
        mode?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Search failed.");
      setHits(payload.hits ?? []);
      setTerms(payload.terms ?? []);
      setMode(payload.mode ?? "keyword");
    } catch (caught) {
      setHits([]);
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery && lastRun.current !== initialQuery) {
      lastRun.current = initialQuery;
      void run(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(query);
  };

  const maxScore = hits[0]?.score ?? 1;
  const activeFilters = [fileType !== "all", Boolean(collectionId), Boolean(tag), Boolean(from), Boolean(to)].filter(Boolean).length;

  return (
    <div>
      <form onSubmit={onSubmit} className="mb-4">
        <div className="relative">
          <SearchIcon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask for a topic, a phrase, or something you half-remember…"
            aria-label="Search your memories"
            className="h-12 pl-10 pr-28 text-[14px]"
            autoFocus
          />
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className="relative grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface-3 hover:text-ink"
              title="Filters"
            >
              <SlidersHorizontal size={15} />
              {activeFilters > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white dark:text-[#0b1512]">
                  {activeFilters}
                </span>
              ) : null}
            </button>
            <Button type="submit" size="sm" className="h-9" disabled={loading}>
              {loading ? <Spinner className="h-3.5 w-3.5" /> : null}
              Search
            </Button>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-2 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="type">File type</Label>
              <Select id="type" value={fileType} onChange={(event) => setFileType(event.target.value)}>
                <option value="all">All types</option>
                <option value="pdf">PDF</option>
                <option value="docx">Word</option>
                <option value="md">Markdown</option>
                <option value="txt">Text</option>
                <option value="csv">CSV</option>
                <option value="image">Image</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="collection">Collection</Label>
              <Select id="collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
                <option value="">All collections</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tag">Tag</Label>
              <Select id="tag" value={tag} onChange={(event) => setTag(event.target.value)}>
                <option value="">All tags</option>
                {tags.map((entry) => (
                  <option key={entry.id} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <button
                type="button"
                onClick={() => {
                  setFileType("all");
                  setCollectionId("");
                  setTag("");
                  setFrom("");
                  setTo("");
                }}
                className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink"
              >
                <X size={11} /> Reset filters
              </button>
            </div>
          </div>
        ) : null}
      </form>

      {!hasDocuments ? (
        <EmptyState
          icon={<SearchIcon size={18} />}
          title="Search needs something to search"
          description="Your library is empty. Upload a document first — then ask for it in your own words."
          action={
            <Link href="/upload" className={buttonClass("primary", "md")}>
              Upload documents
            </Link>
          }
        />
      ) : error ? (
        <Card className="border-danger/30 bg-danger-soft px-4 py-3 text-[12.5px] text-danger">{error}</Card>
      ) : loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Card key={index} className="animate-pulse p-4">
              <div className="h-3 w-1/3 rounded bg-surface-3" />
              <div className="mt-2.5 h-2.5 w-full rounded bg-surface-3" />
              <div className="mt-2 h-2.5 w-4/5 rounded bg-surface-3" />
            </Card>
          ))}
        </div>
      ) : !searched ? (
        <div className="rounded-xl border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" />
            <h2 className="text-[13.5px] font-semibold text-ink">Try asking for the idea, not the filename</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              "database normalization",
              "two-phase locking",
              "project architecture",
              "congestion control",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  void run(example);
                }}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] text-ink-2 hover:border-accent/40 hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : hits.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={18} />}
          title={`No passages for “${submitted}”`}
          description="Nothing in your library matches — RecallAI will not pad results with unrelated documents. Try fewer words, or upload a source that covers this."
          action={
            <Link href="/upload" className={buttonClass("secondary", "md")}>
              Upload a source
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-ink-2">
              <span className="font-medium text-ink">{hits.length}</span>{" "}
              {hits.length === 1 ? "passage" : "passages"} for “{submitted}”
            </p>
            <Badge tone="outline">{prettyMode(mode)}</Badge>
            {activeFilters > 0 ? <Badge tone="outline">{activeFilters} filters</Badge> : null}
          </div>

          <div className="space-y-2.5">
            {hits.map((hit, index) => {
              const percent = Math.round((hit.score / maxScore) * 100);
              return (
                <motion.div
                  key={hit.chunkId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.2) }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-2">
                        <FileText size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/documents/${hit.documentId}${hit.pageFrom ? `?page=${hit.pageFrom}` : ""}`}
                            className="text-[13.5px] font-medium text-ink hover:text-accent"
                          >
                            {hit.title}
                          </Link>
                          <Badge tone="outline">{fileTypeLabel(hit.fileType)}</Badge>
                          {hit.pageFrom ? <Badge tone="outline">Page {hit.pageFrom}</Badge> : null}
                          {hit.section ? (
                            <Badge tone="outline" className="max-w-[220px] truncate">
                              {hit.section}
                            </Badge>
                          ) : null}
                          {hit.matchedTitle ? <Badge tone="accent">Title match</Badge> : null}
                        </div>
                        <p className="mt-2 text-[12.5px] leading-6 text-ink-2">
                          <Highlighted text={hit.content.replace(/\s+/g, " ").slice(0, 520)} terms={terms} />
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-3">
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                            </span>
                            {percent}% relevance
                          </span>
                          <span>Added {formatDate(hit.createdAt)}</span>
                          <Link
                            href={`/documents/${hit.documentId}`}
                            className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            Open document <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <p className="mt-6 text-[11.5px] leading-5 text-muted">
            Results are ranked passages from your own documents. Use{" "}
            <Link href="/ask" className="text-accent hover:underline">
              Ask your memories
            </Link>{" "}
            for a written answer with numbered citations.
          </p>
        </>
      )}
    </div>
  );
}
