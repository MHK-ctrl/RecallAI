import type { FileKind } from "./types";

const EXTENSION_MAP: Record<string, FileKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  csv: "csv",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
};

export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSION_MAP);

const MIME_MAP: Record<FileKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  image: "image/*",
};

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() ?? "" : "";
}

export function kindForExtension(extension: string): FileKind | null {
  return EXTENSION_MAP[extension] ?? null;
}

export function mimeForKind(kind: FileKind, reported?: string | null): string {
  if (reported && reported !== "application/octet-stream") return reported;
  return MIME_MAP[kind];
}

export function sanitiseFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "document";
  return base.replace(/[^\w.\- ()]+/g, "_").slice(0, 180) || "document";
}

export function titleFromFilename(filename: string): string {
  const base = sanitiseFilename(filename).replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled document";
}

/**
 * Checks magic bytes so a renamed executable cannot masquerade as a document.
 * Returns null when the content does not match the claimed type.
 */
export function detectKindFromBytes(bytes: Buffer, extension: string): FileKind | null {
  const kind = kindForExtension(extension);
  if (!kind) return null;

  const startsWith = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  if (kind === "pdf") {
    return startsWith([0x25, 0x50, 0x44, 0x46]) ? kind : null; // %PDF
  }
  if (kind === "docx") {
    // DOCX is a ZIP container: PK\x03\x04
    return startsWith([0x50, 0x4b, 0x03, 0x04]) ? kind : null;
  }
  if (kind === "image") {
    const png = startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = startsWith([0xff, 0xd8, 0xff]);
    const webp = startsWith([0x52, 0x49, 0x46, 0x46]) && bytes.subarray(8, 12).toString() === "WEBP";
    return png || jpeg || webp ? kind : null;
  }
  // Text formats: reject obvious binary content.
  const sample = bytes.subarray(0, 512);
  const suspicious = sample.filter((byte) => byte === 0).length;
  return suspicious > 8 ? null : kind;
}

/** True when the decoded text is mostly replacement characters (binary data). */
export function looksBinary(text: string): boolean {
  if (!text) return false;
  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  return replacement / Math.max(text.length, 1) > 0.05;
}
