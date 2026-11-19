export type FileKind = "pdf" | "docx" | "txt" | "md" | "csv" | "image";

export type ExtractionUnit = {
  text: string;
  /** 1-based page number when the source has pages. */
  page?: number;
  section?: string;
};

export type ExtractionResult = {
  units: ExtractionUnit[];
  pageCount: number | null;
  metadata: Record<string, unknown>;
  ocrUsed: boolean;
  warnings: string[];
};

export type DocumentChunkDraft = {
  content: string;
  pageFrom: number | null;
  pageTo: number | null;
  section: string | null;
  tokenCount: number;
};

export class ExtractionError extends Error {
  code: string;
  constructor(message: string, code = "extraction_failed") {
    super(message);
    this.code = code;
  }
}
