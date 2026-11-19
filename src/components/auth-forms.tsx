"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-[12.5px] leading-5 text-danger">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-accent/25 bg-accent-soft px-3 py-2.5 text-[12.5px] leading-5 text-accent-ink">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    resetUrl?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong. Please try again.");
  return payload;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/auth/login", {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@university.edu" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/reset" className="mb-1.5 text-[11.5px] text-muted hover:text-ink">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/auth/signup", {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your account.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" autoComplete="name" required placeholder="Hamza Khan" minLength={2} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@university.edu" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
        <p className="mt-1.5 text-[11.5px] text-muted">Use at least 8 characters with a letter and a number.</p>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating your library…" : "Create account"}
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await postJson("/api/auth/reset", {
        email: String(form.get("email") ?? ""),
      });
      setMessage("If an account exists for that address, a reset link has been created.");
      if (result.resetUrl) setResetUrl(result.resetUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start a reset.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <SuccessNote message={message} />
      {resetUrl ? (
        <div className="rounded-md border border-line bg-surface-2 p-3 text-[12px] leading-5 text-ink-2">
          <p className="font-medium text-ink">Development reset link</p>
          <p className="mt-1 text-muted">
            Email delivery is not configured on this deployment, so the link is shown here instead.
          </p>
          <Link href={resetUrl} className="mt-2 inline-block break-all font-mono text-[11.5px] text-accent underline">
            {resetUrl}
          </Link>
        </div>
      ) : null}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@university.edu" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating link…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords do not match.");
      setPending(false);
      return;
    }
    try {
      await postJson("/api/auth/reset/confirm", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reset your password.");
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <SuccessNote message="Password updated. Redirecting you to sign in…" />
        <Link href="/login" className="inline-block text-[13px] text-accent hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorNote message={error} />
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
