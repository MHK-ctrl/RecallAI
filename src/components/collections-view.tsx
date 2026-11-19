"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderClosed, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Input, Label, Select } from "@/components/ui";

type Collection = { id: string; name: string; color: string; document_count: number };

const COLORS = ["sage", "ink", "amber", "clay", "slate"];

export function CollectionsView({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("sage");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create the collection.");
      setName("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the collection.");
    } finally {
      setPending(false);
    }
  };

  const rename = async (id: string) => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not rename the collection.");
      setEditing(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rename the collection.");
    } finally {
      setPending(false);
    }
  };

  const remove = async (collection: Collection) => {
    if (
      !window.confirm(
        `Delete “${collection.name}”? Documents stay in your library; only the grouping is removed.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not delete the collection.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the collection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        {error ? (
          <div role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
            {error}
          </div>
        ) : null}

        {collections.length === 0 ? (
          <EmptyState
            icon={<FolderClosed size={18} />}
            title="No collections yet"
            description="Group documents by course, project or client. A document can live in more than one collection."
          />
        ) : (
          <ul className="space-y-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Card className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                      collection.color === "amber"
                        ? "bg-warn-soft text-warn"
                        : collection.color === "clay"
                          ? "bg-danger-soft text-danger"
                          : "bg-accent-soft text-accent-ink"
                    }`}
                  >
                    <FolderClosed size={14} />
                  </span>

                  {editing === collection.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="h-8 max-w-xs text-[12.5px]"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => void rename(collection.id)} disabled={pending || !draft.trim()}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <Link href={`/library?collection=${collection.id}`} className="text-[13.5px] font-medium text-ink hover:text-accent">
                          {collection.name}
                        </Link>
                        <p className="text-[11.5px] text-muted">
                          {collection.document_count} {collection.document_count === 1 ? "document" : "documents"}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Rename ${collection.name}`}
                        onClick={() => {
                          setEditing(collection.id);
                          setDraft(collection.name);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${collection.name}`}
                        onClick={() => void remove(collection)}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card className="h-fit p-4">
        <h2 className="text-[13px] font-semibold text-ink">New collection</h2>
        <form onSubmit={create} className="mt-3 space-y-3">
          <div>
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Semester 4 — DBMS"
              maxLength={60}
              required
            />
          </div>
          <div>
            <Label htmlFor="collection-color">Accent</Label>
            <Select id="collection-color" value={color} onChange={(event) => setColor(event.target.value)}>
              {COLORS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry[0].toUpperCase() + entry.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
            <Plus size={14} /> Create collection
          </Button>
        </form>
        <p className="mt-3 text-[11.5px] leading-5 text-muted">
          Add documents to a collection from the document viewer, or filter your library by
          collection.
        </p>
      </Card>
    </div>
  );
}
