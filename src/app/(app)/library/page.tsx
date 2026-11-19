import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderClosed,
  Image as ImageIcon,
  Library,
  Table2,
  UploadCloud,
} from "lucide-react";
import { requirePageUser } from "@/lib/api";
import { listCollectionsWithCounts, listDocuments, listTags } from "@/lib/documents";
import { Badge, buttonClass, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { DocumentActions } from "@/components/document-actions";
import { excerpt, fileTypeLabel, formatBytes, formatDate } from "@/lib/utils";

export const metadata = { title: "My memories" };

const TYPE_ICON = { pdf: FileText, docx: FileText, txt: FileText, md: FileText, csv: Table2, image: ImageIcon };

type Search = {
  query?: string;
  type?: string;
  status?: string;
  collection?: string;
  tag?: string;
  page?: string;
  order?: string;
};

function buildQuery(base: Search, overrides: Partial<Search>): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  Object.entries(merged).forEach(([key, value]) => {
    if (value && value !== "all") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePageUser("/library");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const [result, collections, tags] = await Promise.all([
    listDocuments(user.id, {
      query: params.query,
      fileType: params.type,
      status: params.status,
      collectionId: params.collection,
      tag: params.tag,
      order: (params.order as "newest" | "oldest" | "title" | undefined) ?? "newest",
      page,
      pageSize: 10,
    }),
    listCollectionsWithCounts(user.id),
    listTags(user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasFilters = Boolean(params.query || params.type || params.status || params.collection || params.tag);

  return (
    <div>
      <PageHeader
        title="My memories"
        description="Everything you have uploaded, with its processing state and where it lives."
        actions={
          <Link href="/upload" className={buttonClass("primary", "md")}>
            <UploadCloud size={15} /> Upload documents
          </Link>
        }
      />

      <Card className="mb-4 p-3">
        <form action="/library" method="get" className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <Input
            name="query"
            defaultValue={params.query ?? ""}
            placeholder="Filter by title or filename…"
            aria-label="Filter by title"
          />
          <Select name="type" defaultValue={params.type ?? "all"} aria-label="File type" className="sm:w-32">
            <option value="all">All types</option>
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
            <option value="md">Markdown</option>
            <option value="txt">Text</option>
            <option value="csv">CSV</option>
            <option value="image">Image</option>
          </Select>
          <Select name="collection" defaultValue={params.collection ?? ""} aria-label="Collection" className="sm:w-40">
            <option value="">All collections</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </Select>
          <Select name="tag" defaultValue={params.tag ?? ""} aria-label="Tag" className="sm:w-32">
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("secondary", "md", "flex-1")}>
              Filter
            </button>
            {hasFilters ? (
              <Link href="/library" className={buttonClass("ghost", "md")}>
                Clear
              </Link>
            ) : null}
          </div>
          <input type="hidden" name="status" value={params.status ?? "all"} />
        </form>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted">
          {result.total} {result.total === 1 ? "document" : "documents"}
          {hasFilters ? " matching your filters" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={buildQuery(params, { order: params.order === "oldest" ? "newest" : "oldest" })}
            className="text-[11.5px] text-muted hover:text-ink"
          >
            {params.order === "oldest" ? "Newest first" : "Oldest first"}
          </Link>
        </div>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Library size={18} />}
          title={hasFilters ? "No documents match those filters" : "Your library is empty"}
          description={
            hasFilters
              ? "Try a different file type, collection or search term."
              : "Upload a PDF, a markdown note or a screenshot to get started."
          }
          action={
            hasFilters ? (
              <Link href="/library" className={buttonClass("secondary", "md")}>
                Clear filters
              </Link>
            ) : (
              <Link href="/upload" className={buttonClass("primary", "md")}>
                <UploadCloud size={15} /> Upload your first document
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-2">
          {result.items.map((document) => {
            const Icon = TYPE_ICON[document.file_type as keyof typeof TYPE_ICON] ?? FileText;
            return (
              <li key={document.id}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-2">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/documents/${document.id}`}
                          className="truncate text-[13.5px] font-medium text-ink hover:text-accent"
                        >
                          {document.title}
                        </Link>
                        <Badge tone="outline">{fileTypeLabel(document.file_type)}</Badge>
                        <StatusBadge status={document.status} />
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {formatDate(document.created_at)} · {formatBytes(Number(document.size_bytes))} ·{" "}
                        {document.chunk_count} {document.chunk_count === 1 ? "passage" : "passages"}
                        {document.page_count ? ` · ${document.page_count} pages` : ""}
                      </p>
                      {document.preview_text ? (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted">
                          {excerpt(document.preview_text, 240)}
                        </p>
                      ) : document.error_message ? (
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-danger">
                          {document.error_message}
                        </p>
                      ) : null}

                      {(document.collections.length > 0 || document.tags.length > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {document.collections.map((collection) => (
                            <span
                              key={collection.id}
                              className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] text-ink-2"
                            >
                              <FolderClosed size={10} /> {collection.name}
                            </span>
                          ))}
                          {document.tags.map((tag) => (
                            <Link
                              key={tag}
                              href={`/library?tag=${encodeURIComponent(tag)}`}
                              className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted hover:text-ink"
                            >
                              #{tag}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link href={`/documents/${document.id}`} className={buttonClass("secondary", "sm")}>
                        Open
                      </Link>
                      <DocumentActions documentId={document.id} status={document.status} />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between">
          <Link
            href={buildQuery(params, { page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
            className={buttonClass("secondary", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}
          >
            <ChevronLeft size={14} /> Previous
          </Link>
          <span className="text-[11.5px] text-muted">
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildQuery(params, { page: String(Math.min(totalPages, page + 1)) })}
            aria-disabled={page >= totalPages}
            className={buttonClass("secondary", "sm", page >= totalPages ? "pointer-events-none opacity-40" : "")}
          >
            Next <ChevronRight size={14} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
