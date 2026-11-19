import { Badge } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "warn" | "danger" | "success" | "outline" }> = {
  uploaded: { label: "Uploaded", tone: "neutral" },
  extracting: { label: "Extracting", tone: "warn" },
  chunking: { label: "Chunking", tone: "warn" },
  embedding: { label: "Embedding", tone: "warn" },
  indexed: { label: "Indexed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS[status] ?? { label: status, tone: "outline" as const };
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}

export const STATUS_LABEL = STATUS;
