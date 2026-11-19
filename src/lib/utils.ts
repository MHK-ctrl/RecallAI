import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  txt: "Text",
  md: "Markdown",
  csv: "CSV",
  image: "Image",
};

export function fileTypeLabel(type: string): string {
  return FILE_TYPE_LABEL[type] ?? type.toUpperCase();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Splits text into alternating plain/highlighted segments for safe rendering. */
export function splitHighlight(text: string, terms: string[]): Array<{ text: string; hit: boolean }> {
  const clean = terms.map((term) => term.trim()).filter((term) => term.length >= 2);
  if (clean.length === 0) return [{ text, hit: false }];
  const escaped = clean.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      hit: clean.some((term) => part.toLowerCase() === term.toLowerCase()),
    }));
}

const HIGHLIGHT_STOPWORDS = new Set([
  "the", "and", "for", "with", "what", "where", "when", "which", "about", "from", "that",
  "this", "have", "has", "did", "does", "was", "were", "are", "you", "your", "our", "find",
  "show", "notes", "note", "documents", "document", "mention", "mentions", "tell", "explain",
  "save", "saved", "search", "please", "into", "over", "under", "their", "them", "they",
]);

/** Meaningful query terms, used for highlighting and the substring fallback. */
export function highlightTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !HIGHLIGHT_STOPWORDS.has(word)),
    ),
  ).slice(0, 8);
}

export function excerpt(text: string, max = 240): string {
  const normalised = text.replace(/\s+/g, " ").trim();
  if (normalised.length <= max) return normalised;
  return `${normalised.slice(0, max).trimEnd()}…`;
}

export function plural(count: number, single: string, multiple = `${single}s`): string {
  return count === 1 ? single : multiple;
}
