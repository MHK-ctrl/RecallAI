import { requirePageUser } from "@/lib/api";
import { listCollectionsWithCounts } from "@/lib/documents";
import { PageHeader } from "@/components/ui";
import { CollectionsView } from "@/components/collections-view";

export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const user = await requirePageUser("/collections");
  const collections = await listCollectionsWithCounts(user.id);

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Organise your memories by course, project or client. Documents can belong to more than one."
      />
      <CollectionsView collections={collections} />
    </div>
  );
}
