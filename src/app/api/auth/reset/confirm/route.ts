import { z } from "zod";
import { sql, tx } from "@/lib/db";
import { ApiError, apiJson, assertSameOrigin, handleApiError, parseBody } from "@/lib/api";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/sign-url";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(20, "That reset link is not valid."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "reset-confirm"), 10, 60_000);
    const body = await parseBody(request, schema);

    const problems = passwordProblems(body.password);
    if (problems.length > 0) throw new ApiError(400, problems[0], "weak_password");

    const rows = await sql<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        LIMIT 1`,
      [hashToken(body.token)],
    );
    const reset = rows[0];
    if (!reset) {
      throw new ApiError(400, "This reset link is invalid or has expired.", "invalid_token");
    }

    await tx(async (client) => {
      const hash = await hashPassword(body.password);
      await client.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
        reset.user_id,
        hash,
      ]);
      await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [
        reset.id,
      ]);
      // Sign out every existing session after a reset.
      await client.query(`DELETE FROM sessions WHERE user_id = $1`, [reset.user_id]);
    });

    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
