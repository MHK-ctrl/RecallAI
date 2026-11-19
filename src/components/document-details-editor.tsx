"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderClosed, Plus, Tag, X } from "lucide-react";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

type Collection = { id: string; name: string; color: string; document_count: number };

export function DocumentDetailsEditor({
  documentId,
  initialTitle,
  initialDescription,
  initialTags,
  collections,
  memberIds,
}: {
  documentId: string;
  initialTitle: string;
  initialDescription: string;
  initialTags: string[];
  collections: Collection[];
  memberIds: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState(initialTags);
  const [tagDraft, setTagDraft] = useState("");
  const [members, setMembers] = useState<string[]>(memberIds);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not save those changes.");
  };

  const saveDetails = async () => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await request({ title, description });
      setMessage("Saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setPending(false);
    }
  };

  const saveTags = async (next: string[]) => {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await request({ tags: next });
      setTags(next);
      setMessage("Tags updated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update tags.");
    } finally {
      setPending(false);
    }
  };

  const addTag = () => {
    const value = tagDraft.trim().toLowerCase().replace(/^#/, "");
    if (!value || tags.includes(value) || tags.length >= 12) {
      setTagDraft("");
      return;
    }
    const next = [...tags, value];
    setTagDraft("");
    void saveTags(next);
  };

  const toggleCollection = async (collectionId: string, add: boolean) => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, action: add ? "add" : "remove" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not update collections.");
      setMembers((current) =>
        add ? Array.from(new Set([...current, collectionId])) : current.filter((id) => id !== collectionId),
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update collections.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="text-[13px] font-semibold text-ink">Document details</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
          </div>
          <div>
            <Label htmlFor="doc-description">Owner&apos;s note (indexed with the document)</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What is this file, and why does it matter?"
            />
          </div>
          <Button size="sm" onClick={() => void saveDetails()} disabled={pending || !title.trim()}>
            <Check size={13} /> Save details
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-1.5">
          <Tag size={13} className="text-muted" />
          <h2 className="text-[13px] font-semibold text-ink">Tags</h2>
          <span className="ml-auto text-[10.5px] text-muted">{tags.length}/12</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.length === 0 ? <p className="text-[11.5px] text-muted">No tags yet.</p> : null}
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={pending}
              onClick={() => void saveTags(tags.filter((entry) => entry !== tag))}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 hover:border-danger/40 hover:text-danger"
            >
              #{tag} <X size={10} />
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Input
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag…"
            maxLength={32}
            className="h-8 text-[12px]"
          />
          <Button size="sm" variant="secondary" onClick={addTag} disabled={pending || !tagDraft.trim()}>
            <Plus size={12} /> Add
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-1.5">
          <FolderClosed size={13} className="text-muted" />
          <h2 className="text-[13px] font-semibold text-ink">Collections</h2>
        </div>
        {collections.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-muted">
            Create a collection first, then add this document to it.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-1">
            {collections.map((collection) => {
              const checked = members.includes(collection.id);
              return (
                <li key={collection.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] transition-colors",
                      checked ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-3",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending}
                      onChange={(event) => void toggleCollection(collection.id, event.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    <span className="truncate">{collection.name}</span>
                    {checked ? <Badge tone="accent" className="ml-auto">Added</Badge> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {message ? <p className="text-[11.5px] text-accent-ink">{message}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-2.5 py-1.5 text-[11.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
