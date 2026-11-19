import { z } from "zod";
import { PG_UNIQUE_VIOLATION, pgErrorCode, sql } from "@/lib/db";
import {
  apiJson,
  assertSameOrigin,
  handleApiError,
  ApiError,
  parseBody,
} from "@/lib/api";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "signup"), 8, 60_000);
    const body = await parseBody(request, schema);

    const problems = passwordProblems(body.password);
    if (problems.length > 0) {
      throw new ApiError(400, problems[0], "weak_password");
    }

    const passwordHash = await hashPassword(body.password);
    let user: { id: string; email: string; name: string; created_at: string };
    try {
      const rows = await sql<{ id: string; email: string; name: string; created_at: string }>(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, created_at::text AS created_at`,
        [body.email, body.name, passwordHash],
      );
      user = rows[0];
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw new ApiError(409, "An account with that email already exists.", "email_taken");
      }
      throw error;
    }

    await sql(`INSERT INTO collections (user_id, name, color) VALUES ($1, 'Inbox', 'sage')`, [user.id]);
    await createSession(user.id, request.headers.get("user-agent"));

    return apiJson({ user }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
