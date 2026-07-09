"use client";

import type { AssetDetailResponse } from "@media-manager/contracts";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DeleteAssetsDialog } from "@/components/delete-assets-dialog";
import { LibraryAssetBrowser } from "@/components/library-asset-browser";
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

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div>
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
            <div className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{folder.title}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {folder.description ? <span>{folder.description}</span> : null}
                    <span>ID: {folder.id}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => setEditMode(true)} type="button" variant="outline">
                    Edit Folder
                  </Button>
                  <DeleteAssetsDialog
                    assetIds={[folder.id]}
                    label="Delete Folder"
                    onJobCreated={() => {
                      const destination = folder.containerId
                        ? `/library?containerId=${encodeURIComponent(folder.containerId)}`
                        : "/library";
                      router.push(destination);
                      router.refresh();
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </header>

      <LibraryAssetBrowser assets={children} containerId={folder.id} />
    </section>
  );
}
