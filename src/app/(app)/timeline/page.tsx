import Link from "next/link";
import { History, UploadCloud } from "lucide-react";
import { requirePageUser } from "@/lib/api";
import { sql } from "@/lib/db";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { fileTypeLabel, formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Timeline" };

const TYPES = [
  { value: "all", label: "All types" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word" },
  { value: "md", label: "Markdown" },
  { value: "txt", label: "Text" },
  { value: "csv", label: "CSV" },
  { value: "image", label: "Image" },
];

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requirePageUser("/timeline");
  const { type } = await searchParams;
  const filter = type && type !== "all" ? type : null;

  const documents = await sql<{
    id: string;
    title: string;
    file_type: string;
    status: string;
    created_at: string;
    chunk_count: number;
    page_count: number | null;
  }>(
    `SELECT d.id, d.title, d.file_type, d.status, d.created_at::text AS created_at,
            d.page_count, count(c.id)::int AS chunk_count
       FROM documents d LEFT JOIN document_chunks c ON c.document_id = d.id
      WHERE d.user_id = $1 ${filter ? "AND d.file_type = $2" : ""}
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 200`,
    filter ? [user.id, filter] : [user.id],
  );

  const groups = new Map<string, typeof documents>();
  for (const document of documents) {
    const label = new Date(document.created_at).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const list = groups.get(label) ?? [];
    list.push(document);
    groups.set(label, list);
  }

  return (
    <div>
      <PageHeader
        title="Memory timeline"
        description="Walk back through everything you have added, newest first."
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {TYPES.map((entry) => (
          <Link
            key={entry.value}
            href={entry.value === "all" ? "/timeline" : `/timeline?type=${entry.value}`}
            className={
              (filter ?? "all") === entry.value
                ? "rounded-full bg-accent-soft px-3 py-1.5 text-[11.5px] font-medium text-accent-ink"
                : "rounded-full border border-line bg-surface px-3 py-1.5 text-[11.5px] text-ink-2 hover:border-accent/40 hover:text-ink"
            }
          >
            {entry.label}
          </Link>
        ))}
        <span className="ml-auto text-[11.5px] text-muted">{documents.length} entries</span>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={<History size={18} />}
          title={filter ? `No ${fileTypeLabel(filter)} documents yet` : "Nothing on the timeline yet"}
          description="Your uploads appear here as soon as they are added."
          action={
            <Link href="/upload" className={buttonClass("primary", "md")}>
              <UploadCloud size={15} /> Upload documents
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          {Array.from(groups.entries()).map(([label, items]) => (
            <section key={label}>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-2">{label}</h2>
                <span className="text-[11px] text-muted">{items.length} added</span>
              </div>
              <ol className="relative space-y-2 border-l border-line pl-4 md:ml-1">
                {items.map((document) => (
                  <li key={document.id} className="relative">
                    <span className="absolute -left-[21px] top-4 h-2 w-2 rounded-full border-2 border-canvas bg-line-strong" />
                    <Card className="p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/documents/${document.id}`}
                          className="text-[13px] font-medium text-ink hover:text-accent"
                        >
                          {document.title}
                        </Link>
                        <Badge tone="outline">{fileTypeLabel(document.file_type)}</Badge>
                        <StatusBadge status={document.status} />
                        <span className="ml-auto text-[11px] text-muted">
                          {formatDate(document.created_at)} · {relativeTime(document.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {document.chunk_count} {document.chunk_count === 1 ? "passage" : "passages"}
                        {document.page_count ? ` · ${document.page_count} pages` : ""}
                      </p>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
