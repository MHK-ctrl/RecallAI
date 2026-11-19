import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function apiJson<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiError(status: number, message: string, code = "error") {
  return NextResponse.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Returns the session user or throws a 401 ApiError. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "You need to sign in to do that.", "unauthorized");
  return user;
}

/** Page-level guard: redirects to login with a return path. */
export async function requirePageUser(nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/**
 * CSRF defence for cookie-authenticated mutations. Browsers always send Origin
 * on POST/PATCH/DELETE; if it does not match the request host we reject.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) {
      throw new ApiError(403, "Cross-origin request blocked.", "forbidden");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "Invalid origin.", "forbidden");
  }
}

export async function parseBody<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ApiError(400, "Expected a JSON body.", "invalid_json");
  }
  return parseWith(schema, payload);
}

export function parseWith<T>(schema: { parse: (value: unknown) => T }, payload: unknown): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      throw new ApiError(400, first?.message ?? "That input is not valid.", "invalid_input");
    }
    throw error;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiError(error.status, error.message, error.code);
  }
  console.error("[api] unhandled error", error);
  return apiError(500, "Something went wrong on our side. Please try again.", "internal");
}

export function notFound(message = "Not found.") {
  return new ApiError(404, message, "not_found");
}
