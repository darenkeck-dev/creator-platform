"use client";

import { AssetDetailResponseSchema } from "@media-manager/contracts";
import { FolderPlus, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  containerId?: string;
  className?: string;
};

function uploadHref(containerId?: string): string {
  return containerId ? `/upload?containerId=${encodeURIComponent(containerId)}` : "/upload";
}

export function AddAssetMenu({ containerId, className }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderTitle, setFolderTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = folderTitle.trim();
    if (!title) {
      setMessage("Folder name is required.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "folder",
          title,
          description: "",
          ...(containerId ? { containerId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create folder.");
      }

      const json = (await response.json()) as unknown;
      const parsed = AssetDetailResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("Folder response failed validation.");
      }

      setFolderTitle("");
      setMessage(null);
      setFolderDialogOpen(false);
      router.refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to create folder.";
      setMessage(nextMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        <Plus className="h-5 w-5" />
        <span className="sr-only">Add asset or folder</span>
      </Button>

      {menuOpen ? (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border bg-background p-1 shadow-lg">
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setMenuOpen(false);
              setFolderDialogOpen(true);
            }}
            type="button"
          >
            <FolderPlus className="h-4 w-4" />
            Folder
          </button>
          <Link
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
            href={uploadHref(containerId)}
            onClick={() => setMenuOpen(false)}
          >
            <Upload className="h-4 w-4" />
            Media upload
          </Link>
        </div>
      ) : null}

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createFolder}>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="new-folder-title">
                Folder name
              </label>
              <Input
                autoFocus
                id="new-folder-title"
                onChange={(event) => setFolderTitle(event.target.value)}
                placeholder="New folder name"
                value={folderTitle}
              />
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <DialogFooter>
              <Button
                onClick={() => setFolderDialogOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
