import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  FolderClosed,
  HardDrive,
  Layers,
  MessagesSquare,
  Search,
  UploadCloud,
} from "lucide-react";
import { one, sql } from "@/lib/db";
import { requirePageUser } from "@/lib/api";
import { listCollectionsWithCounts, storageUsage } from "@/lib/documents";
import { Badge, buttonClass, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { fileTypeLabel, formatBytes, relativeTime } from "@/lib/utils";

export const metadata = { title: "Overview" };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");

  const [counts, chunkCount, usage, recentDocs, recentSearches, recentChats, collections, daily] =
    await Promise.all([
      one<{ total: number; indexed: number; failed: number; processing: number }>(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'indexed')::int AS indexed,
                count(*) FILTER (WHERE status = 'failed')::int AS failed,
                count(*) FILTER (WHERE status IN ('uploaded','extracting','chunking','embedding'))::int AS processing
           FROM documents WHERE user_id = $1`,
        [user.id],
      ),
      one<{ chunks: number }>(
        `SELECT count(*)::int AS chunks FROM document_chunks WHERE user_id = $1`,
        [user.id],
      ),
      storageUsage(user.id),
      sql<{ id: string; title: string; file_type: string; status: string; created_at: string; chunk_count: number }>(
        `SELECT d.id, d.title, d.file_type, d.status, d.created_at::text AS created_at,
                count(c.id)::int AS chunk_count
           FROM documents d LEFT JOIN document_chunks c ON c.document_id = d.id
          WHERE d.user_id = $1
          GROUP BY d.id ORDER BY d.created_at DESC LIMIT 5`,
        [user.id],
      ),
      sql<{ id: string; query: string; result_count: number; created_at: string }>(
        `SELECT id, query, result_count, created_at::text AS created_at
           FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [user.id],
      ),
      sql<{ id: string; title: string; updated_at: string; message_count: number }>(
        `SELECT s.id, s.title, s.updated_at::text AS updated_at, count(m.id)::int AS message_count
           FROM chat_sessions s LEFT JOIN chat_messages m ON m.session_id = s.id
          WHERE s.user_id = $1 GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 4`,
        [user.id],
      ),
      listCollectionsWithCounts(user.id),
      sql<{ label: string; count: number }>(
        `SELECT to_char(day, 'Dy') AS label, count(d.id)::int AS count
           FROM generate_series(now()::date - interval '6 days', now()::date, interval '1 day') AS day
           LEFT JOIN documents d ON d.user_id = $1 AND d.created_at::date = day::date
          GROUP BY day ORDER BY day`,
        [user.id],
      ),
    ]);

  const stats = counts ?? { total: 0, indexed: 0, failed: 0, processing: 0 };
  const firstName = user.name.split(" ")[0];
  const maxDaily = Math.max(1, ...daily.map((day) => day.count));
  const hasDocuments = stats.total > 0;

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="A snapshot of what is in your library, what you searched for, and what you asked it."
        actions={
          <>
            <Link href="/search" className={buttonClass("secondary", "md")}>
              <Search size={15} /> Search
            </Link>
            <Link href="/upload" className={buttonClass("primary", "md")}>
              <UploadCloud size={15} /> Upload
            </Link>
          </>
        }
      />

      {!hasDocuments ? (
        <EmptyState
          className="mb-6"
          icon={<Layers size={18} />}
          title="Your library is empty"
          description="Upload lecture notes, PDFs, a markdown file or a screenshot. RecallAI will extract the text, split it into passages and make it searchable."
          action={
            <Link href="/upload" className={buttonClass("primary", "md")}>
              <UploadCloud size={15} /> Upload your first document
            </Link>
          }
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Documents" value={stats.total} hint={`${stats.indexed} indexed`} />
        <Stat label="Indexed passages" value={chunkCount?.chunks ?? 0} hint="Searchable chunks" />
        <Stat
          label="Storage used"
          value={formatBytes(usage.bytes)}
          hint={`of ${formatBytes(250 * 1024 * 1024)} allowance`}
        />
        <Stat
          label="Needs attention"
          value={stats.failed}
          hint={stats.processing > 0 ? `${stats.processing} processing` : "All caught up"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-muted" />
              <h2 className="text-[13.5px] font-semibold text-ink">Recent memories</h2>
            </div>
            <Link href="/library" className="text-[11.5px] text-muted transition-colors hover:text-ink">
              View library
            </Link>
          </div>
          {recentDocs.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-muted">
              Nothing uploaded yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentDocs.map((document) => (
                <li key={document.id}>
                  <Link
                    href={`/documents/${document.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-3 text-[10px] font-semibold uppercase text-ink-2">
                      {fileTypeLabel(document.file_type).slice(0, 3)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{document.title}</span>
                      <span className="block text-[11.5px] text-muted">
                        {document.chunk_count} {document.chunk_count === 1 ? "passage" : "passages"} ·{" "}
                        {relativeTime(document.created_at)}
                      </span>
                    </span>
                    <StatusBadge status={document.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13.5px] font-semibold text-ink">Added this week</h2>
              <Badge tone="outline">{daily.reduce((total, day) => total + day.count, 0)} total</Badge>
            </div>
            <div className="mt-4 flex h-24 items-end gap-2">
              {daily.map((day) => (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-[3px] bg-accent/80"
                    style={{ height: `${Math.max(4, (day.count / maxDaily) * 72)}px` }}
                    title={`${day.count} on ${day.label}`}
                  />
                  <span className="text-[10px] text-muted">{day.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13.5px] font-semibold text-ink">Collections</h2>
              <Link href="/collections" className="text-[11.5px] text-muted hover:text-ink">
                Manage
              </Link>
            </div>
            {collections.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-muted">
                Collections group documents by project, course or client.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-1.5">
                {collections.slice(0, 3).map((collection) => (
                  <li key={collection.id}>
                    <Link
                      href={`/library?collection=${collection.id}`}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] text-ink-2 hover:bg-surface-3 hover:text-ink"
                    >
                      <FolderClosed size={13} className="text-muted" />
                      <span className="truncate">{collection.name}</span>
                      <span className="ml-auto tabular-nums text-[11px] text-muted">
                        {collection.document_count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-muted" />
              <h2 className="text-[13.5px] font-semibold text-ink">Recent searches</h2>
            </div>
          </div>
          {recentSearches.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-muted">
              Searches you run will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentSearches.map((search) => (
                <li key={search.id}>
                  <Link
                    href={`/search?q=${encodeURIComponent(search.query)}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{search.query}</span>
                    <span className="text-[11px] text-muted">{search.result_count} hits</span>
                    <span className="text-[11px] text-muted">{relativeTime(search.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <MessagesSquare size={15} className="text-muted" />
              <h2 className="text-[13.5px] font-semibold text-ink">Recent conversations</h2>
            </div>
            <Link href="/ask" className="text-[11.5px] text-muted hover:text-ink">
              Ask
            </Link>
          </div>
          {recentChats.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-muted">
              Ask a question about your documents to start a conversation.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentChats.map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={`/ask?session=${chat.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{chat.title}</span>
                    <span className="text-[11px] text-muted">{chat.message_count} msgs</span>
                    <ArrowUpRight size={12} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <HardDrive size={12} /> {formatBytes(usage.bytes)} across {usage.documents} files
        </span>
        <Link href="/settings" className="inline-flex items-center gap-1 hover:text-ink">
          Privacy & data controls <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
