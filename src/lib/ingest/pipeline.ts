import { sql, tx } from "@/lib/db";
import { activeEmbeddingModel, env } from "@/lib/env";
import { embedTexts, toVectorLiteral } from "@/lib/ai/embed";
import { cleanText, extractDocument } from "./extract";
import { chunkExtraction } from "./chunk";
import { ExtractionError, type FileKind } from "./types";

type ProcessingRow = {
  id: string;
  title: string;
  filename: string;
  file_type: FileKind;
  size_bytes: string;
  description: string | null;
  metadata: Record<string, unknown>;
  file_data: Buffer;
};

export type ProcessResult = {
  status: "indexed" | "failed";
  chunks: number;
  error?: string;
  warnings: string[];
};

async function setStatus(id: string, userId: string, status: string, error: string | null = null) {
  await sql(
    `UPDATE documents SET status = $3, error_message = $4 WHERE id = $1 AND user_id = $2`,
    [id, userId, status, error],
  );
}

function safeMessage(error: unknown): string {
  if (error instanceof ExtractionError) return error.message.slice(0, 500);
  if (error instanceof Error) {
    return error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
  }
  return "Processing failed for an unknown reason.";
}

/**
 * Extract → chunk → embed → store. Status is persisted at every stage so the
 * upload UI can show real progress instead of a spinner. Re-running this
 * replaces the previous chunks (idempotent reprocessing).
 */
export async function processDocument(
  documentId: string,
  userId: string,
): Promise<ProcessResult> {
  const rows = await sql<ProcessingRow>(
    `SELECT id, title, filename, file_type, size_bytes, description, metadata, file_data
       FROM documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  const document = rows[0];
  if (!document) throw new Error("Document not found.");

  try {
    await setStatus(document.id, userId, "extracting");
    const extraction = await extractDocument(
      document.file_type,
      Buffer.from(document.file_data),
      document.filename,
    );

    const warnings = [...extraction.warnings];
    let units = extraction.units.map((unit) => ({ ...unit, text: cleanText(unit.text) }));
    if (document.description?.trim()) {
      units = [
        { text: `Owner's note: ${document.description.trim()}`, section: "Owner's note" },
        ...units,
      ];
    }

    const { chunks, truncated } = chunkExtraction(units, {
      maxChunks: env.maxChunksPerDocument,
    });
    if (truncated) {
      warnings.push(
        `Only the first ${env.maxChunksPerDocument} chunks were indexed. Split very large files for full coverage.`,
      );
    }
    if (chunks.length === 0) {
      warnings.push(
        "No searchable text was extracted. The file is stored, but it will only match on its title and tags.",
      );
    }

    const joined = chunks.map((chunk) => chunk.content).join("\n\n");
    const wordCount = joined.split(/\s+/).filter(Boolean).length;
    const preview = joined.slice(0, 1600);

    await sql(
      `UPDATE documents
          SET status = 'chunking', page_count = $3, word_count = $4, char_count = $5,
              preview_text = $6, metadata = metadata || $7::jsonb, error_message = NULL
        WHERE id = $1 AND user_id = $2`,
      [
        document.id,
        userId,
        extraction.pageCount,
        wordCount,
        joined.length,
        preview || null,
        JSON.stringify({
          warnings,
          ocrUsed: extraction.ocrUsed,
          extraction: extraction.metadata,
          chunkCount: chunks.length,
        }),
      ],
    );

    await tx(async (client) => {
      await client.query(`DELETE FROM document_chunks WHERE document_id = $1 AND user_id = $2`, [
        document.id,
        userId,
      ]);
      for (const [index, chunk] of chunks.entries()) {
        await client.query(
          `INSERT INTO document_chunks
             (document_id, user_id, chunk_index, content, page_from, page_to, section, token_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            document.id,
            userId,
            index,
            chunk.content,
            chunk.pageFrom,
            chunk.pageTo,
            chunk.section,
            chunk.tokenCount,
          ],
        );
      }
    });

    if (chunks.length > 0) {
      await setStatus(document.id, userId, "embedding");
      const vectors = await embedTexts(chunks.map((chunk) => chunk.content.slice(0, 8000)));
      const stored = await sql<{ id: string; chunk_index: number }>(
        `SELECT id, chunk_index FROM document_chunks
          WHERE document_id = $1 AND user_id = $2 ORDER BY chunk_index`,
        [document.id, userId],
      );
      await tx(async (client) => {
        for (let index = 0; index < stored.length; index += 1) {
          const vector = vectors[index];
          if (!vector) continue;
          await client.query(
            `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2 AND user_id = $3`,
            [toVectorLiteral(vector), stored[index].id, userId],
          );
        }
      });
    }

    await sql(
      `UPDATE documents
          SET status = 'indexed', embedding_model = $3, indexed_at = now(), error_message = NULL
        WHERE id = $1 AND user_id = $2`,
      [document.id, userId, activeEmbeddingModel()],
    );

    return { status: "indexed", chunks: chunks.length, warnings };
  } catch (error) {
    const message = safeMessage(error);
    await setStatus(document.id, userId, "failed", message);
    return { status: "failed", chunks: 0, error: message, warnings: [] };
  }
}

/** Rough progress estimate for the UI, based on the persisted status. */
export function statusProgress(status: string): number {
  switch (status) {
    case "uploaded":
      return 12;
    case "extracting":
      return 35;
    case "chunking":
      return 58;
    case "embedding":
      return 78;
    case "indexed":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}
