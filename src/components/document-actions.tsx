"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";

export function DocumentActions({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "delete" | "reprocess") => {
    if (action === "delete" && !window.confirm("Delete this document, its passages and its embeddings?")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        action === "delete" ? `/api/documents/${documentId}` : `/api/documents/${documentId}/process`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "That action failed.");
      }
      setOpen(false);
      if (action === "delete") router.push("/library");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That action failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Document actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <MoreHorizontal size={15} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-52 animate-fade rounded-lg border border-line bg-surface p-1 shadow-lg">
            <button
              type="button"
              disabled={pending}
              onClick={() => run("reprocess")}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-ink-2 hover:bg-surface-3 disabled:opacity-50"
            >
              <RefreshCw size={13} /> {status === "failed" ? "Retry processing" : "Re-index document"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("delete")}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              <Trash2 size={13} /> Delete document
            </button>
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="absolute right-0 top-9 z-20 w-52 rounded-md bg-danger-soft px-2 py-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
