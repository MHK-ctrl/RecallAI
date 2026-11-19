import { apiJson, assertSameOrigin, handleApiError } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySession();
    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
