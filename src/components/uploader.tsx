"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react";
import { Badge, buttonClass, Button, Card, Spinner } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";

type Stage =
  | "queued"
  | "uploading"
  | "uploaded"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

type Item = {
  key: string;
  file: File;
  stage: Stage;
  progress: number;
  docId?: string;
  message?: string;
};

const STAGE_LABEL: Record<Stage, string> = {
  queued: "Queued",
  uploading: "Uploading",
  uploaded: "Uploaded",
  extracting: "Extracting text",
  chunking: "Chunking",
  embedding: "Generating vectors",
  indexed: "Indexed",
  failed: "Failed",
};

const PROGRESS: Record<Stage, number> = {
  queued: 4,
  uploading: 15,
  uploaded: 25,
  extracting: 45,
  chunking: 62,
  embedding: 82,
  indexed: 100,
  failed: 100,
};

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.csv,.png,.jpg,.jpeg,.webp";

export function Uploader({ maxUploadMb }: { maxUploadMb: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Item>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const processItem = useCallback(async (item: Item) => {
    update(item.key, { stage: "uploading", progress: PROGRESS.uploading, message: undefined });

    try {
      if (!item.docId) {
        const form = new FormData();
        form.append("file", item.file);
        const response = await fetch("/api/documents", { method: "POST", body: form });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          document?: { id: string };
        };
        if (!response.ok || !payload.document) {
          throw new Error(payload.error ?? "Upload failed.");
        }
        item = { ...item, docId: payload.document.id };
        update(item.key, { docId: payload.document.id, stage: "uploaded", progress: PROGRESS.uploaded });
      }

      const documentId = item.docId;
      if (!documentId) throw new Error("Upload did not return a document id.");

      // Poll the real processing status while the index request runs.
      const poll = window.setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/documents/${documentId}`, { cache: "no-store" });
          if (!statusResponse.ok) return;
          const data = (await statusResponse.json()) as { document?: { status?: Stage } };
          const stage = data.document?.status;
          if (stage && stage in PROGRESS && stage !== "failed") {
            update(item.key, { stage, progress: PROGRESS[stage] });
          }
        } catch {
          // polling is best-effort
        }
      }, 900);

      const response = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      window.clearInterval(poll);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Processing failed.");
      }
      update(item.key, { stage: "indexed", progress: 100, message: undefined });
    } catch (error) {
      update(item.key, {
        stage: "failed",
        progress: 100,
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }, []);

  const start = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files).filter((file) => file.size > 0);
      if (incoming.length === 0) return;

      const newItems: Item[] = incoming.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        stage: file.size > maxUploadMb * 1024 * 1024 ? "failed" : "queued",
        progress: file.size > maxUploadMb * 1024 * 1024 ? 100 : 4,
        message: file.size > maxUploadMb * 1024 * 1024 ? `Files must be ${maxUploadMb} MB or smaller.` : undefined,
      }));

      setItems((current) => [...newItems, ...current]);
      setRunning(true);
      for (const item of newItems) {
        if (item.stage === "failed") continue;
        await processItem(item);
      }
      setRunning(false);
    },
    [maxUploadMb, processItem],
  );

  const retry = async (item: Item) => {
    setRunning(true);
    await processItem({ ...item, stage: "queued", message: undefined });
    setRunning(false);
  };

  const remove = async (item: Item) => {
    if (item.docId) {
      await fetch(`/api/documents/${item.docId}`, { method: "DELETE" }).catch(() => undefined);
    }
    setItems((current) => current.filter((entry) => entry.key !== item.key));
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void start(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft/60" : "border-line-strong bg-surface-2",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void start(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-accent">
          <UploadCloud size={20} />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold text-ink">Drop your files here</h2>
        <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-6 text-muted">
          PDF, DOCX, TXT, Markdown, CSV, PNG, JPG or WEBP. Up to {maxUploadMb} MB per file on this
          deployment. Text is extracted page by page and indexed privately to your account.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={running}>
            {running ? <Spinner className="h-3.5 w-3.5" /> : null}
            {running ? "Processing…" : "Choose files"}
          </Button>
          <Link href="/library" className={buttonClass("ghost", "md")}>
            Go to library
          </Link>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-ink">
              This session · {items.length} {items.length === 1 ? "file" : "files"}
            </p>
            <button
              type="button"
              onClick={() => setItems((current) => current.filter((item) => item.stage === "indexed"))}
              className="text-[11.5px] text-muted hover:text-ink"
            >
              Clear finished
            </button>
          </div>

          {items.map((item) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="p-3.5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                      item.stage === "indexed"
                        ? "bg-accent-soft text-accent-ink"
                        : item.stage === "failed"
                          ? "bg-danger-soft text-danger"
                          : "bg-surface-3 text-ink-2",
                    )}
                  >
                    {item.stage === "indexed" ? (
                      <CheckCircle2 size={15} />
                    ) : item.stage === "failed" ? (
                      <AlertTriangle size={15} />
                    ) : (
                      <FileText size={15} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-ink">{item.file.name}</p>
                      <span className="shrink-0 text-[11px] text-muted">{formatBytes(item.file.size)}</span>
                      <span className="ml-auto shrink-0">
                        <Badge tone={item.stage === "indexed" ? "success" : item.stage === "failed" ? "danger" : "outline"}>
                          {STAGE_LABEL[item.stage]}
                        </Badge>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-500",
                          item.stage === "failed" ? "bg-danger" : "bg-accent",
                        )}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    {item.message ? (
                      <p className="mt-1.5 text-[11.5px] leading-5 text-danger">{item.message}</p>
                    ) : null}
                    {item.stage === "indexed" && item.docId ? (
                      <Link
                        href={`/documents/${item.docId}`}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline"
                      >
                        Open document <ArrowRight size={11} />
                      </Link>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {item.stage === "failed" ? (
                      <button
                        type="button"
                        onClick={() => retry(item)}
                        title="Retry processing"
                        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"
                      >
                        <RefreshCw size={13} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      title="Remove"
                      aria-label={`Remove ${item.file.name}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
