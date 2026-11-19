import { z } from "zod";
import { sql } from "@/lib/db";
import { apiJson, ApiError, assertSameOrigin, handleApiError, parseBody } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, deleteExpiredSessions } from "@/lib/auth/session";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "login"), 10, 60_000);
    const body = await parseBody(request, schema);

    const rows = await sql<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
      created_at: string;
    }>(
      `SELECT id, email, name, password_hash, created_at::text AS created_at
         FROM users WHERE email = $1 LIMIT 1`,
      [body.email],
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new ApiError(401, "Email or password is incorrect.", "invalid_credentials");
    }

    await deleteExpiredSessions().catch(() => undefined);
    await createSession(user.id, request.headers.get("user-agent"));

    return apiJson({
      user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
