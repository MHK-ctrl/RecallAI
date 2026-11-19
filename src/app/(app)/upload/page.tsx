import { requirePageUser } from "@/lib/api";
import { env } from "@/lib/env";
import { storageUsage } from "@/lib/documents";
import { PageHeader, Card, Badge } from "@/components/ui";
import { Uploader } from "@/components/uploader";
import { formatBytes } from "@/lib/utils";

export const metadata = { title: "Upload" };

export default async function UploadPage() {
  const user = await requirePageUser("/upload");
  const usage = await storageUsage(user.id);

  return (
    <div>
      <PageHeader
        title="Add memories"
        description="Each file is stored privately, extracted, chunked and indexed against your account only."
        actions={<Badge tone="outline">{formatBytes(usage.bytes)} used</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Uploader maxUploadMb={env.maxUploadMb} />

        <div className="space-y-3">
          <Card className="p-4">
            <h2 className="text-[13px] font-semibold text-ink">What happens to a file</h2>
            <ol className="mt-3 space-y-3">
              {[
                "The extension and file signature are checked before anything is stored.",
                "Text is extracted per page — PDFs keep page numbers, Markdown keeps headings.",
                "Content is cleaned and split into overlapping passages of about 750 tokens.",
                "Vectors are generated (provider embeddings or the local lexical fallback).",
                "Passages, page ranges and sections are written to your account only.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-semibold text-ink-2">
                    {index + 1}
                  </span>
                  <span className="text-[12px] leading-5 text-muted">{step}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4">
            <h2 className="text-[13px] font-semibold text-ink">Limits on this deployment</h2>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-5 text-muted">
              <li>Maximum file size: {env.maxUploadMb} MB</li>
              <li>Storage allowance: {env.storageQuotaMb} MB per account</li>
              <li>Up to {env.maxChunksPerDocument} passages indexed per document</li>
              <li>OCR: {env.ocrEnabled ? "enabled for images" : "disabled"}</li>
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-5 text-muted">
              Files that are byte-identical to something already in your library are rejected, so
              re-uploading cannot create duplicate passages.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
