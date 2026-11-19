import { z } from "zod";
import { sql } from "@/lib/db";
import { ApiError, apiJson, assertSameOrigin, handleApiError, parseBody, requireApiUser } from "@/lib/api";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";
import { storageUsage } from "@/lib/documents";

const schema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((value) => !value.newPassword || Boolean(value.currentPassword), {
    message: "Enter your current password to set a new one.",
    path: ["currentPassword"],
  });

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const body = await parseBody(request, schema);

    if (body.name) {
      await sql(`UPDATE users SET name = $2, updated_at = now() WHERE id = $1`, [user.id, body.name]);
    }

    if (body.newPassword && body.currentPassword) {
      const problems = passwordProblems(body.newPassword);
      if (problems.length > 0) throw new ApiError(400, problems[0], "weak_password");
      const rows = await sql<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE id = $1`,
        [user.id],
      );
      if (!rows[0] || !(await verifyPassword(body.currentPassword, rows[0].password_hash))) {
        throw new ApiError(403, "Your current password is not correct.", "invalid_password");
      }
      const hash = await hashPassword(body.newPassword);
      await sql(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
        user.id,
        hash,
      ]);
    }

    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const usage = await storageUsage(user.id);
    await destroySession();
    await sql(`DELETE FROM users WHERE id = $1`, [user.id]);
    return apiJson({ ok: true, removedDocuments: usage.documents });
  } catch (error) {
    return handleApiError(error);
  }
}
