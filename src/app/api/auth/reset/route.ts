import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { apiJson, assertSameOrigin, handleApiError, parseBody } from "@/lib/api";
import { hashToken } from "@/lib/auth/sign-url";
import { env } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

/**
 * No email provider is configured, so the response is deliberately identical
 * for known and unknown addresses. In development the link is returned (and
 * logged) so the flow is testable; in production an operator must connect an
 * email provider — see docs/DEPLOYMENT.md.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "reset"), 5, 60_000);
    const body = await parseBody(request, schema);

    const rows = await sql<{ id: string }>(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [
      body.email,
    ]);
    let resetUrl: string | undefined;

    if (rows[0]) {
      const token = randomBytes(32).toString("base64url");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await sql(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [rows[0].id, hashToken(token), expires],
      );
      resetUrl = `${env.appUrl}/reset?token=${token}`;
      console.info(`[auth] password reset link for ${body.email}: ${resetUrl}`);
    }

    return apiJson({
      ok: true,
      message: "If an account exists for that address, a reset link has been created.",
      resetUrl: env.devShowResetLink ? resetUrl : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
