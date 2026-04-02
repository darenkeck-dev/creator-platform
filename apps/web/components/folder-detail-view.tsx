"use client";

import type { AssetDetailResponse } from "@media-manager/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CreateFolderForm } from "@/components/create-folder-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Asset = AssetDetailResponse["asset"];

type Props = {
  folder: Asset;
  children: Asset[];
};

export function FolderDetailView({ folder, children }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(folder.title);
  const [description, setDescription] = useState(folder.description);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(
    () => title.trim() !== folder.title || description.trim() !== folder.description,
    [description, folder.description, folder.title, title]
  );

  async function saveFolder() {
    if (!dirty || saving) {
      setEditMode(false);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(folder.id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update folder.");
      }

      setMessage("Folder updated.");
      setEditMode(false);
      router.refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to update folder.";
      setMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFolder() {
    if (children.length > 0) {
      setMessage("Move or delete child items before deleting this folder.");
      return;
    }

    const confirmed = window.confirm("Delete this folder?");
    if (!confirmed || deleting) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(folder.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete folder.");
      }

      const destination = folder.containerId
        ? `/library?containerId=${encodeURIComponent(folder.containerId)}`
        : "/library";
      router.push(destination);
      router.refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to delete folder.";
      setMessage(nextMessage);
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">folder</Badge>
          <Badge variant="secondary">children: {children.length}</Badge>
          {folder.containerId ? (
            <Link className="text-sm underline" href={`/library?containerId=${folder.containerId}`}>
              Back to parent folder
            </Link>
          ) : (
            <Link className="text-sm underline" href="/library">
              Back to library root
            </Link>
          )}
        </div>

        {editMode ? (
          <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="folder-title">
                Folder name
              </label>
              <Input
                id="folder-title"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="folder-description">
                Description
              </label>
              <Textarea
                id="folder-description"
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                value={description}
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={saving} onClick={() => void saveFolder()} type="button">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={() => {
                  setTitle(folder.title);
                  setDescription(folder.description);
                  setEditMode(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{folder.title}</h1>
            {folder.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{folder.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">ID: {folder.id}</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setEditMode(true)} type="button" variant="outline">
                Edit Folder
              </Button>
              <Button
                disabled={deleting}
                onClick={() => void deleteFolder()}
                type="button"
                variant="destructive"
              >
                {deleting ? "Deleting..." : "Delete Folder"}
              </Button>
            </div>
          </div>
        )}

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </header>

      <CreateFolderForm containerId={folder.id} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">This folder is empty.</p>
        ) : null}
        {children.map((asset) => (
          <article
            className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
            key={asset.id}
          >
            <Link href={`/asset/${asset.id}`}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{asset.type}</p>
              <h2 className="mt-2 text-base font-medium">{asset.title}</h2>
              <p className="mt-3 text-xs text-muted-foreground">ID: {asset.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status: {asset.status}</p>
            </Link>
            {asset.type === "folder" ? (
              <div className="mt-3 text-xs text-muted-foreground">
                <Link className="underline" href={`/asset/${asset.id}`}>
                  Open folder
                </Link>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
