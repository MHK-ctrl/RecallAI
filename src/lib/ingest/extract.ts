import { env } from "@/lib/env";
import { looksBinary } from "./detect";
import {
  ExtractionError,
  type ExtractionResult,
  type ExtractionUnit,
  type FileKind,
} from "./types";

const MAX_PDF_PAGES = 300;
const MAX_CSV_ROWS = 20_000;

/** Normalises whitespace without destroying paragraph and line structure. */
export function cleanText(input: string): string {
  return input
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeText(bytes: Buffer, filename: string): string {
  const text = bytes.toString("utf8");
  if (looksBinary(text)) {
    throw new ExtractionError(
      `${filename} does not look like UTF-8 text. Save it as UTF-8 and try again.`,
      "binary_text",
    );
  }
  return cleanText(text);
}

function extractMarkdown(bytes: Buffer, filename: string): ExtractionResult {
  const text = decodeText(bytes, filename);
  const units: ExtractionUnit[] = [];
  let section: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const body = cleanText(buffer.join("\n"));
    if (body) units.push({ text: body, section });
    buffer = [];
  };

  for (const line of text.split("\n")) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      section = heading[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  if (units.length === 0) units.push({ text, section: undefined });

  return { units, pageCount: null, metadata: { format: "markdown" }, ocrUsed: false, warnings: [] };
}

function extractPlainText(bytes: Buffer, filename: string): ExtractionResult {
  const text = decodeText(bytes, filename);
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim().length > 0);
  const units: ExtractionUnit[] = paragraphs.map((paragraph) => ({ text: paragraph }));
  if (units.length === 0 && text) units.push({ text });
  return { units, pageCount: null, metadata: { format: "text" }, ocrUsed: false, warnings: [] };
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
    if (rows.length >= MAX_CSV_ROWS) break;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

function extractCsv(bytes: Buffer, filename: string): ExtractionResult {
  const text = decodeText(bytes, filename);
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length === 0) {
    throw new ExtractionError("This CSV file is empty.", "empty_document");
  }
  if (rows.length >= MAX_CSV_ROWS) {
    warnings.push(`Only the first ${MAX_CSV_ROWS.toLocaleString()} rows were indexed.`);
  }

  const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  const body = rows.slice(1);
  const perUnit = 25;
  const units: ExtractionUnit[] = [];

  for (let start = 0; start < body.length; start += perUnit) {
    const slice = body.slice(start, start + perUnit);
    const lines = slice.map((cells) => {
      const pairs = cells
        .map((cell, index) => {
          const value = cell.trim();
          if (!value) return null;
          return `${headers[index] ?? `Column ${index + 1}`}: ${value}`;
        })
        .filter(Boolean);
      return `Row ${start + slice.indexOf(cells) + 2} — ${pairs.join(" | ")}`;
    });
    units.push({
      text: `Columns: ${headers.join(", ")}\n${lines.join("\n")}`,
      section: `Rows ${start + 2}–${start + slice.length + 1}`,
    });
  }

  return {
    units,
    pageCount: null,
    metadata: { format: "csv", columns: headers.length, rows: body.length },
    ocrUsed: false,
    warnings,
  };
}

async function extractPdf(bytes: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];
  let pages: string[] = [];
  let totalPages = 0;

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = (await extractText(pdf, { mergePages: false })) as {
      totalPages: number;
      text: string[] | string;
    };
    totalPages = result.totalPages;
    pages = Array.isArray(result.text) ? result.text : [result.text];
  } catch (error) {
    throw new ExtractionError(
      `Could not read this PDF${error instanceof Error ? `: ${error.message}` : "."}`,
      "pdf_unreadable",
    );
  }

  if (totalPages > MAX_PDF_PAGES) {
    warnings.push(`Only the first ${MAX_PDF_PAGES} pages were indexed.`);
    pages = pages.slice(0, MAX_PDF_PAGES);
  }

  const units: ExtractionUnit[] = [];
  pages.forEach((pageText, index) => {
    const cleaned = cleanText(pageText);
    if (cleaned.length > 0) units.push({ text: cleaned, page: index + 1 });
  });

  if (units.length === 0) {
    warnings.push(
      "No selectable text was found. This PDF may be a scan — export it as images and upload those for OCR.",
    );
  }

  return {
    units,
    pageCount: totalPages,
    metadata: { format: "pdf", pages: totalPages },
    ocrUsed: false,
    warnings,
  };
}

async function extractDocx(bytes: Buffer): Promise<ExtractionResult> {
  try {
    const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = cleanText(result.value);
    if (!text) {
      throw new ExtractionError("This Word document has no readable text.", "empty_document");
    }
    const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim().length > 0);
    const units: ExtractionUnit[] = paragraphs.map((paragraph) => ({ text: paragraph }));
    return {
      units,
      pageCount: null,
      metadata: { format: "docx", paragraphs: paragraphs.length },
      ocrUsed: false,
      warnings: result.messages?.slice(0, 3).map((message) => message.message) ?? [],
    };
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      `Could not read this Word document${error instanceof Error ? `: ${error.message}` : "."}`,
      "docx_unreadable",
    );
  }
}

async function extractImage(bytes: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];
  if (!env.ocrEnabled) {
    return {
      units: [],
      pageCount: null,
      metadata: { format: "image" },
      ocrUsed: false,
      warnings: ["OCR is disabled on this deployment, so this image was stored without text."],
    };
  }

  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng", 1, {
      cachePath: "/tmp",
      logger: () => undefined,
    });
    const { data } = await worker.recognize(bytes);
    const text = cleanText(data.text ?? "");
    if (!text) {
      warnings.push("No text was recognised in this image. Try a sharper screenshot.");
      return { units: [], pageCount: null, metadata: { format: "image" }, ocrUsed: true, warnings };
    }
    return {
      units: [{ text }],
      pageCount: 1,
      metadata: { format: "image", ocrConfidence: Math.round(data.confidence ?? 0) },
      ocrUsed: true,
      warnings,
    };
  } catch (error) {
    warnings.push(
      `OCR was unavailable (${error instanceof Error ? error.message.slice(0, 120) : "unknown error"}). The image is saved but not searchable by its contents.`,
    );
    return { units: [], pageCount: null, metadata: { format: "image" }, ocrUsed: false, warnings };
  } finally {
    await worker?.terminate().catch(() => undefined);
  }
}

export async function extractDocument(
  kind: FileKind,
  bytes: Buffer,
  filename: string,
): Promise<ExtractionResult> {
  switch (kind) {
    case "pdf":
      return extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
    case "md":
      return extractMarkdown(bytes, filename);
    case "csv":
      return extractCsv(bytes, filename);
    case "txt":
      return extractPlainText(bytes, filename);
    case "image":
      return extractImage(bytes);
    default:
      throw new ExtractionError("Unsupported file type.", "unsupported_type");
  }
}
