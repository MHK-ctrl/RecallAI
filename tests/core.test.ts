import { describe, expect, it } from "vitest";
import { chunkExtraction, estimateTokens } from "@/lib/ingest/chunk";
import { parseCsv } from "@/lib/ingest/extract";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { highlightTerms, splitHighlight } from "@/lib/utils";
import { buildCitations, extractiveAnswer, NO_EVIDENCE_MESSAGE } from "@/lib/ai/answer";
import { DEMO_DOCUMENTS, DEMO_QUESTIONS, demoAnswer, demoSearch } from "@/lib/demo";
import { localEmbedding } from "@/lib/ai/embed";
import type { ChunkHit } from "@/lib/search";

function chunkHit(overrides: Partial<ChunkHit> = {}): ChunkHit {
  return {
    chunkId: "chunk-1",
    chunkIndex: 0,
    documentId: "doc-1",
    title: "DBMS Notes",
    filename: "dbms.pdf",
    fileType: "pdf",
    content:
      "Normalization organises tables to reduce redundancy. Third normal form removes transitive dependencies.",
    pageFrom: 24,
    pageTo: 24,
    section: "Normal forms",
    createdAt: "2026-10-01T10:00:00.000Z",
    score: 0.03,
    matchedTitle: false,
    ...overrides,
  };
}

describe("chunking", () => {
  it("splits long content into overlapping chunks that keep page metadata", () => {
    const paragraph = "A functional dependency determines one value for each key. ".repeat(40);
    const { chunks, truncated } = chunkExtraction(
      [
        { text: paragraph, page: 3, section: "Dependencies" },
        { text: paragraph, page: 4, section: "Normal forms" },
      ],
      { targetChars: 1200, overlapChars: 240, maxChunks: 50 },
    );

    expect(truncated).toBe(false);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageFrom).toBe(3);
    expect(chunks.every((chunk) => chunk.content.length <= 1200)).toBe(true);
    expect(chunks.every((chunk) => chunk.tokenCount === estimateTokens(chunk.content))).toBe(true);
    expect(chunks.some((chunk) => chunk.pageTo === 4)).toBe(true);
  });

  it("does not duplicate identical chunk text", () => {
    const duplicate = "The same sentence appears twice in this document. ";
    const { chunks } = chunkExtraction(
      [
        { text: duplicate, page: 1 },
        { text: duplicate, page: 2 },
      ],
      { targetChars: 4000, overlapChars: 100 },
    );
    expect(new Set(chunks.map((chunk) => chunk.content)).size).toBe(chunks.length);
  });

  it("truncates at the configured maximum", () => {
    const units = Array.from({ length: 20 }, (_, index) => ({
      text: `Paragraph ${index} ${"content ".repeat(120)}`,
      page: index + 1,
    }));
    const { chunks, truncated } = chunkExtraction(units, { targetChars: 600, overlapChars: 60, maxChunks: 3 });
    expect(chunks).toHaveLength(3);
    expect(truncated).toBe(true);
  });
});

describe("csv extraction", () => {
  it("parses quoted fields and escaped quotes", () => {
    const rows = parseCsv('title,note\n"A, B","He said ""hi"""\nplain,value\n');
    expect(rows[0]).toEqual(["title", "note"]);
    expect(rows[1]).toEqual(["A, B", 'He said "hi"']);
    expect(rows[2]).toEqual(["plain", "value"]);
  });
});

describe("password hashing", () => {
  it("verifies the correct password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse 42");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse 42", hash)).toBe(true);
    expect(await verifyPassword("wrong horse 42", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(passwordProblems("short").length).toBeGreaterThan(0);
    expect(passwordProblems("alllettersonly").length).toBeGreaterThan(0);
    expect(passwordProblems("longenough1")).toHaveLength(0);
  });
});

describe("highlighting", () => {
  it("extracts meaningful terms and marks matches", () => {
    expect(highlightTerms("where did I write about database normalization?")).toContain("normalization");
    const parts = splitHighlight("Database normalization matters", ["normalization"]);
    expect(parts.some((part) => part.hit && part.text.toLowerCase() === "normalization")).toBe(true);
  });
});

describe("citations", () => {
  it("numbers citations from one and deduplicates chunks", () => {
    const citations = buildCitations([chunkHit(), chunkHit()]);
    expect(citations).toHaveLength(1);
    expect(citations[0].index).toBe(1);
    expect(citations[0].documentId).toBe("doc-1");
    expect(citations[0].page).toBe(24);
  });

  it("never cites a source that does not exist", () => {
    const citations = buildCitations([chunkHit(), chunkHit({ chunkId: "chunk-2", documentId: "doc-2" })]);
    const answer = extractiveAnswer("normalization", citations);
    const markers = Array.from(answer.matchAll(/\[(\d+)\]/g)).map((match) => Number(match[1]));
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.every((marker) => marker >= 1 && marker <= citations.length)).toBe(true);
    expect(citations[0].documentTitle).toBe("DBMS Notes");
    expect(citations[0].page).toBe(24);
  });

  it("returns an explicit no-evidence message instead of inventing an answer", () => {
    const answer = extractiveAnswer("nothing here", []);
    expect(answer).toBe(NO_EVIDENCE_MESSAGE);
    expect(answer.toLowerCase()).toContain("could not find");
  });
});

describe("local embeddings", () => {
  it("produces normalised vectors where related text scores higher", () => {
    const dim = 1536;
    const a = localEmbedding("database normalization removes redundant tables", dim);
    const b = localEmbedding("normalization of database tables removes redundancy", dim);
    const c = localEmbedding("banana smoothie recipe with mango", dim);
    expect(a).toHaveLength(dim);
    const norm = Math.sqrt(a.reduce((total, value) => total + value * value, 0));
    expect(norm).toBeCloseTo(1, 3);

    const cosine = (x: number[], y: number[]) =>
      x.reduce((total, value, index) => total + value * y[index], 0);
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
});

describe("demo workspace", () => {
  it("answers every suggested question with citations to real sample documents", () => {
    const titles = new Set(DEMO_DOCUMENTS.map((document) => document.title));
    for (const question of DEMO_QUESTIONS) {
      const result = demoAnswer(question);
      expect(result.citations.length).toBeGreaterThan(0);
      for (const citation of result.citations) expect(titles.has(citation.title)).toBe(true);
      for (const marker of result.answer.matchAll(/\[(\d+)\]/g)) {
        expect(Number(marker[1])).toBeLessThanOrEqual(result.citations.length);
      }
    }
  });

  it("does not fabricate citations for an unrelated question", () => {
    const result = demoAnswer("quantum chromodynamics lattice spacing");
    expect(result.citations).toHaveLength(0);
    expect(demoSearch("quantum chromodynamics lattice spacing")).toHaveLength(0);
  });
});
