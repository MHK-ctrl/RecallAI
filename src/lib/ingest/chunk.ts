import type { DocumentChunkDraft, ExtractionUnit } from "./types";

export type ChunkOptions = {
  /** ~4 characters per token; 3000 chars ≈ 750 tokens. */
  targetChars?: number;
  overlapChars?: number;
  maxChunks?: number;
};

const DEFAULTS = {
  targetChars: 3000,
  overlapChars: 480,
  maxChunks: 400,
};

type Block = { text: string; page?: number; section?: string };

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitIntoBlocks(units: ExtractionUnit[]): Block[] {
  const blocks: Block[] = [];
  for (const unit of units) {
    const paragraphs = unit.text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (paragraphs.length === 0) continue;
    for (const paragraph of paragraphs) {
      blocks.push({ text: paragraph, page: unit.page, section: unit.section });
    }
  }
  return blocks;
}

function splitLongBlock(block: Block, targetChars: number, overlapChars: number): Block[] {
  const windows: Block[] = [];
  const text = block.text;
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + targetChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const boundary = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n"),
      );
      if (boundary > targetChars * 0.5) end = start + boundary + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece) windows.push({ ...block, text: piece });
    if (end >= text.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return windows;
}

/**
 * Packs paragraphs into overlapping chunks, preserving page ranges and section
 * headings so every citation can point back to a real source location.
 */
export function chunkExtraction(
  units: ExtractionUnit[],
  options: ChunkOptions = {},
): { chunks: DocumentChunkDraft[]; truncated: boolean } {
  const targetChars = options.targetChars ?? DEFAULTS.targetChars;
  const overlapChars = options.overlapChars ?? DEFAULTS.overlapChars;
  const maxChunks = options.maxChunks ?? DEFAULTS.maxChunks;

  const blocks = splitIntoBlocks(units).flatMap((block) =>
    block.text.length > targetChars ? splitLongBlock(block, targetChars, overlapChars) : [block],
  );

  const chunks: DocumentChunkDraft[] = [];
  let current: Block[] = [];
  let currentLength = 0;
  // Held in an object so TypeScript does not narrow it to `never` after flush().
  const state: { tail: Block | null } = { tail: null };
  const seen = new Set<string>();
  let hitLimit = false;

  const push = (text: string, blockList: Block[]) => {
    const content = text.trim();
    const pages = blockList.map((block) => block.page).filter((page): page is number => typeof page === "number");
    // Identical boilerplate on different pages still deserves its own citation,
    // so dedupe by content *and* source page rather than dropping it entirely.
    const key = `${content}::${pages.join(",")}`;
    if (!content || seen.has(key)) return;
    seen.add(key);
    chunks.push({
      content,
      pageFrom: pages.length ? Math.min(...pages) : null,
      pageTo: pages.length ? Math.max(...pages) : null,
      section: blockList.find((block) => block.section)?.section ?? null,
      tokenCount: estimateTokens(content),
    });
  };

  const flush = () => {
    if (current.length === 0) return;
    const text = current.map((block) => block.text).join("\n\n");
    push(text, current);
    const last = current[current.length - 1];
    state.tail = { text: text.slice(-overlapChars), page: last.page, section: last.section };
    current = [];
    currentLength = 0;
  };

  for (const block of blocks) {
    if (chunks.length >= maxChunks) {
      hitLimit = true;
      break;
    }

    if (currentLength + block.text.length + 2 > targetChars && current.length > 0) {
      flush();
      if (state.tail && state.tail.text.length > 80) {
        // Keep the overlap inside the character budget instead of letting a
        // large paragraph push the chunk past the target size.
        const room = Math.max(0, targetChars - block.text.length - 2);
        if (room > 80) {
          const overlap = { ...state.tail, text: state.tail.text.slice(-room) };
          current = [overlap];
          currentLength = overlap.text.length;
        }
        state.tail = null;
      }
    }
    current.push(block);
    currentLength += block.text.length + 2;
  }
  flush();

  const truncated = hitLimit || chunks.length > maxChunks;
  return { chunks: chunks.slice(0, maxChunks), truncated };
}
