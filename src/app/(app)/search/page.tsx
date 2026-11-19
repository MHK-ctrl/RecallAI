import { Search } from "lucide-react";
import { requirePageUser } from "@/lib/api";
import { listCollectionsWithCounts, listTags, storageUsage } from "@/lib/documents";
import { PageHeader } from "@/components/ui";
import { SearchView } from "@/components/search-view";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePageUser("/search");
  const { q } = await searchParams;
  const [collections, tags, usage] = await Promise.all([
    listCollectionsWithCounts(user.id),
    listTags(user.id),
    storageUsage(user.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Search your memories"
        description="Natural language in, ranked passages out — with the page and section each one came from."
        actions={
          <span className="hidden items-center gap-1.5 text-[11.5px] text-muted sm:inline-flex">
            <Search size={12} /> {usage.documents} documents indexed
          </span>
        }
      />
      <SearchView
        initialQuery={q ?? ""}
        collections={collections}
        tags={tags}
        hasDocuments={usage.documents > 0}
      />
    </div>
  );
}
