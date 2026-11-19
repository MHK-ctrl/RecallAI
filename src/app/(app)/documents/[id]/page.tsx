import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { requirePageUser } from "@/lib/api";
import { sql } from "@/lib/db";
import { getDocument, getDocumentChunks, listCollectionsWithCounts } from "@/lib/documents";
import { signFileParams } from "@/lib/auth/sign-url";
import { highlightTerms, splitHighlight } from "@/lib/utils";
import { Badge, buttonClass, Card } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { DocumentActions } from "@/components/document-actions";
import { DocumentDetailsEditor } from "@/components/document-details-editor";
import { excerpt, fileTypeLabel, formatBytes, formatDateTime, relativeTime } from "@/lib/utils";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePageUser("/library");
  const { id } = await params;
  const { page, q } = await searchParams;

  const document = await getDocument(user.id, id);
  if (!document) notFound();

  const [chunks, collections, membership] = await Promise.all([
    getDocumentChunks(user.id, id),
    listCollectionsWithCounts(user.id),
    sql<{ collection_id: string }>(
      `SELECT collection_id FROM document_collections WHERE document_id = $1 AND user_id = $2`,
      [id, user.id],
    ),
  ]);

  const signed = signFileParams(id, user.id);
  const fileHref = `/api/documents/${id}/file?${signed}${page ? `#page=${page}` : ""}`;
  const terms = q ? highlightTerms(q) : [];
  const focusedPage = page ? Number(page) : null;
  const warnings = Array.isArray(document.metadata.warnings)
    ? (document.metadata.warnings as string[])
    : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/library" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
          <ArrowLeft size={13} /> Back to library
        </Link>
        <span className="text-[11px] text-muted">/</span>
        <span className="truncate text-[12px] text-muted">{document.filename}</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{fileTypeLabel(document.file_type)}</Badge>
            <StatusBadge status={document.status} />
            {document.page_count ? <Badge tone="outline">{document.page_count} pages</Badge> : null}
            {document.collections.map((collection) => (
              <Badge key={collection.id} tone="accent">
                {collection.name}
              </Badge>
            ))}
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
            {document.title}
          </h1>
          <p className="mt-1 text-[12px] text-muted">
            {document.filename} · {formatBytes(Number(document.size_bytes))} · added{" "}
            {formatDateTime(document.created_at)}
            {document.indexed_at ? ` · indexed ${relativeTime(document.indexed_at)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a href={fileHref} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
            <ExternalLink size={14} /> Open original
          </a>
          <a href={`/api/documents/${id}/file?${signed}`} className={buttonClass("ghost", "md")} download>
            <Download size={14} /> Download
          </a>
          <DocumentActions documentId={id} status={document.status} />
        </div>
      </div>

      {document.status === "failed" && document.error_message ? (
        <Card className="mb-4 border-danger/30 bg-danger-soft p-4">
          <p className="text-[12.5px] font-medium text-danger">Processing failed</p>
          <p className="mt-1 text-[12px] leading-5 text-danger">{document.error_message}</p>
          <p className="mt-2 text-[11.5px] text-danger/80">
            Use the actions menu to retry, or re-upload the file.
          </p>
        </Card>
      ) : null}

      {warnings.length > 0 ? (
        <Card className="mb-4 border-warn/30 bg-warn-soft p-4">
          <p className="text-[12.5px] font-medium text-warn">Indexing notes</p>
          <ul className="mt-1 space-y-1 text-[11.5px] leading-5 text-warn">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Passages", value: document.chunk_count, icon: Layers },
                { label: "Words", value: document.word_count.toLocaleString(), icon: Hash },
                { label: "Pages", value: document.page_count ?? "—", icon: FileText },
                { label: "Privacy", value: "Private", icon: ShieldCheck },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.1em] text-muted">
                    <stat.icon size={10} /> {stat.label}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold text-ink">Extracted text</h2>
              <div className="flex items-center gap-2">
                {q ? (
                  <Badge tone="outline">
                    Highlighting “{q}” · {chunks.filter((chunk) => {
                      const haystack = chunk.content.toLowerCase();
                      return terms.some((term) => haystack.includes(term));
                    }).length} matching passages
                  </Badge>
                ) : null}
                <span className="text-[11px] text-muted">Read-only copy stored with your account</span>
              </div>
            </div>

            {chunks.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12.5px] text-muted">
                No text was extracted from this document. It can still be found by title and tags.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {chunks.map((chunk) => {
                  const isFocus = focusedPage && chunk.page_from === focusedPage;
                  const matches =
                    terms.length > 0 &&
                    terms.some((term) => chunk.content.toLowerCase().includes(term));
                  return (
                    <details
                      key={chunk.id}
                      open={Boolean(isFocus) || Boolean(matches) || chunk.chunk_index < 2}
                      className={`group px-4 py-3 ${isFocus ? "bg-accent-soft/40" : ""}`}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11.5px] text-muted">
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
                          #{chunk.chunk_index + 1}
                        </span>
                        {chunk.page_from ? (
                          <span>
                            Page {chunk.page_from}
                            {chunk.page_to && chunk.page_to !== chunk.page_from ? `–${chunk.page_to}` : ""}
                          </span>
                        ) : null}
                        {chunk.section ? <span className="truncate">· {chunk.section}</span> : null}
                        <span className="ml-auto tabular-nums">{chunk.token_count} tokens</span>
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-6 text-ink-2">
                        {splitHighlight(excerpt(chunk.content, 1400), terms).map((part, index) =>
                          part.hit ? (
                            <mark key={index} className="rounded-[2px] bg-accent-soft px-0.5 text-accent-ink">
                              {part.text}
                            </mark>
                          ) : (
                            <span key={index}>{part.text}</span>
                          ),
                        )}
                      </p>
                      {chunk.page_from && document.file_type === "pdf" ? (
                        <a
                          href={`/api/documents/${id}/file?${signed}#page=${chunk.page_from}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                        >
                          Open page {chunk.page_from} in the PDF <ExternalLink size={10} />
                        </a>
                      ) : null}
                    </details>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div>
          <DocumentDetailsEditor
            documentId={id}
            initialTitle={document.title}
            initialDescription={document.description ?? ""}
            initialTags={document.tags}
            collections={collections}
            memberIds={membership.map((row) => row.collection_id)}
          />
          <Card className="mt-3 p-4">
            <h2 className="text-[13px] font-semibold text-ink">About this document</h2>
            <dl className="mt-2.5 space-y-1.5 text-[11.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">File type</dt>
                <dd className="text-ink-2">{fileTypeLabel(document.file_type)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Size</dt>
                <dd className="text-ink-2">{formatBytes(Number(document.size_bytes))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Uploaded</dt>
                <dd className="text-ink-2">{formatDateTime(document.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className="text-ink-2">{document.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Owner</dt>
                <dd className="text-ink-2">You only</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
