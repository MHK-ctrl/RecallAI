import { z } from "zod";
import { apiJson, assertSameOrigin, handleApiError, parseBody, requireApiUser } from "@/lib/api";
import { searchMemories, recordSearch, highlightTerms } from "@/lib/search";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  query: z.string().trim().min(1, "Type something to search for.").max(400),
  fileTypes: z.array(z.enum(["pdf", "docx", "txt", "md", "csv", "image"])).optional(),
  collectionId: z.string().uuid().optional(),
  tag: z.string().trim().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    rateLimit(clientKey(request, `search:${user.id}`), 60, 60_000);
    const body = await parseBody(request, schema);

    const outcome = await searchMemories(
      user.id,
      body.query,
      {
        fileTypes: body.fileTypes,
        collectionId: body.collectionId,
        tag: body.tag,
        from: body.from,
        to: body.to,
      },
      20,
    );
    await recordSearch(user.id, body.query, outcome.hits.length).catch(() => undefined);

    return apiJson({
      hits: outcome.hits,
      mode: outcome.mode,
      terms: highlightTerms(body.query),
      count: outcome.hits.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
