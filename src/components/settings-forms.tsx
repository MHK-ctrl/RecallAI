"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Download, LogOut } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";

function feedback(response: Response, payload: { error?: string }) {
  if (!response.ok) throw new Error(payload.error ?? "That change could not be saved.");
}

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      feedback(response, payload);
      setMessage("Name updated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your name.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="text-[13px] font-semibold text-ink">Profile</h2>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div>
          <Label htmlFor="profile-name">Display name</Label>
          <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </div>
        <div>
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} readOnly disabled />
          <p className="mt-1 text-[11px] text-muted">Email changes are not enabled in this deployment.</p>
        </div>
        {message ? <p className="text-[11.5px] text-accent-ink">{message}</p> : null}
        {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
        <Button type="submit" size="sm" disabled={pending || name.trim().length < 2}>
          <Check size={13} /> Save profile
        </Button>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setError("The two new passwords do not match.");
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(form.get("currentPassword") ?? ""),
          newPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      feedback(response, payload);
      setMessage("Password changed. Other sessions keep running until they expire.");
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change your password.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="text-[13px] font-semibold text-ink">Password</h2>
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          </div>
        </div>
        {message ? <p className="text-[11.5px] text-accent-ink">{message}</p> : null}
        {error ? <p className="text-[11.5px] text-danger">{error}</p> : null}
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

export function DataControls() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }
    if (
      !window.confirm(
        "Delete your account and every document, passage, collection and conversation? This cannot be undone.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      feedback(response, payload);
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete your account.");
      setPending(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="text-[13px] font-semibold text-ink">Your data</h2>
      <div className="mt-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5">
          <div>
            <p className="text-[12px] font-medium text-ink">Export everything</p>
            <p className="text-[11px] text-muted">Metadata, extracted passages, tags, collections and conversations.</p>
          </div>
          <a
            href="/api/account/export"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[12px] font-medium text-ink hover:bg-surface-3"
          >
            <Download size={13} /> Download JSON
          </a>
        </div>

        <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-[12px] font-medium text-ink">Session</p>
          <p className="text-[11px] text-muted">Sessions expire after 30 days. Signing out removes this one.</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[12px] font-medium text-ink hover:bg-surface-3"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>

        <div className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-danger">
            <AlertTriangle size={13} /> Delete account
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-danger">
            This permanently removes your profile, documents, passages, vectors, collections and
            conversations.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="Type DELETE"
              aria-label="Type DELETE to confirm account deletion"
              className="h-8 max-w-[160px] text-[12px]"
            />
            <button
              type="button"
              disabled={pending}
              onClick={deleteAccount}
              className="h-8 rounded-md bg-danger px-3 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
          {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}
        </div>
      </div>
    </Card>
  );
}
