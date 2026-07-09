"use client";

import type { AssetDetailResponse } from "@media-manager/contracts";
import { ChevronRight, Folder, Home } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Asset = AssetDetailResponse["asset"];
type FolderAsset = Asset & { type: "folder" };

type FolderNode = {
  folder: FolderAsset;
  children: FolderNode[];
  childrenLoaded: boolean;
  expanded: boolean;
  loading: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  assetCount: number;
  currentContainerId?: string;
  excludedFolderIds?: string[];
  onConfirm: (containerId: string | null) => Promise<void>;
};

function folderLabel(folder: FolderAsset) {
  return folder.title || folder.id;
}

function toNodes(assets: Asset[], excluded: Set<string>): FolderNode[] {
  return assets
    .filter((asset): asset is FolderAsset => asset.type === "folder" && !excluded.has(asset.id))
    .sort((a, b) => folderLabel(a).localeCompare(folderLabel(b)))
    .map((folder) => ({
      folder,
      children: [],
      childrenLoaded: false,
      expanded: false,
      loading: false,
    }));
}

function updateNode(
  nodes: FolderNode[],
  folderId: string,
  update: (node: FolderNode) => FolderNode
): FolderNode[] {
  return nodes.map((node) => {
    if (node.folder.id === folderId) {
      return update(node);
    }
    return { ...node, children: updateNode(node.children, folderId, update) };
  });
}

function findNode(nodes: FolderNode[], folderId: string): FolderNode | null {
  for (const node of nodes) {
    if (node.folder.id === folderId) {
      return node;
    }
    const child = findNode(node.children, folderId);
    if (child) {
      return child;
    }
  }
  return null;
}

export function MoveAssetsDialog({
  open,
  onOpenChange,
  title = "Move assets",
  description,
  assetCount,
  currentContainerId,
  excludedFolderIds = [],
  onConfirm,
}: Props) {
  const excluded = new Set(excludedFolderIds);
  const [nodes, setNodes] = useState<FolderNode[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    currentContainerId ?? null
  );
  const [loadingRoot, setLoadingRoot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setSelectedContainerId(currentContainerId ?? null);
    setMessage(null);
    setLoadingRoot(true);

    const loadRoot = async () => {
      try {
        const response = await fetch("/api/assets?type=folder&sort=newest", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to load folders");
        }
        const json = (await response.json()) as { assets?: Asset[] };
        if (!cancelled) {
          setNodes(toNodes(json.assets ?? [], excluded));
        }
      } catch {
        if (!cancelled) {
          setMessage("Could not load folders. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoadingRoot(false);
        }
      }
    };

    void loadRoot();

    return () => {
      cancelled = true;
    };
  }, [currentContainerId, open, excludedFolderIds.join("|")]);

  async function toggleFolder(folderId: string) {
    const node = findNode(nodes, folderId);
    if (!node) {
      return;
    }

    if (node.childrenLoaded) {
      setNodes((previous) =>
        updateNode(previous, folderId, (entry) => ({ ...entry, expanded: !entry.expanded }))
      );
      return;
    }

    setNodes((previous) =>
      updateNode(previous, folderId, (entry) => ({ ...entry, expanded: true, loading: true }))
    );
    setMessage(null);

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(folderId)}/children`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load child folders");
      }
      const json = (await response.json()) as { assets?: Asset[] };
      setNodes((previous) =>
        updateNode(previous, folderId, (entry) => ({
          ...entry,
          children: toNodes(json.assets ?? [], excluded),
          childrenLoaded: true,
          expanded: true,
          loading: false,
        }))
      );
    } catch {
      setNodes((previous) =>
        updateNode(previous, folderId, (entry) => ({ ...entry, loading: false }))
      );
      setMessage("Could not load child folders. Please try again.");
    }
  }

  async function confirmMove() {
    setSubmitting(true);
    setMessage(null);

    try {
      await onConfirm(selectedContainerId);
      onOpenChange(false);
    } catch {
      setMessage("Could not move selection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              `Choose a destination folder for ${assetCount === 1 ? "this asset" : `${assetCount} assets`}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-lg border bg-card">
          <button
            className={cn(
              "flex h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted",
              selectedContainerId === null ? "bg-muted font-medium" : ""
            )}
            onClick={() => setSelectedContainerId(null)}
            type="button"
          >
            <Home className="h-4 w-4 text-muted-foreground" />
            Root
          </button>
          <div className="max-h-80 overflow-y-auto border-t p-2">
            {loadingRoot ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading folders...</p>
            ) : nodes.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">No folders available.</p>
            ) : (
              nodes.map((node) => (
                <FolderTreeRow
                  key={node.folder.id}
                  node={node}
                  onSelect={setSelectedContainerId}
                  onToggle={toggleFolder}
                  selectedContainerId={selectedContainerId}
                />
              ))
            )}
          </div>
          </div>
        </div>

        {message ? <p className="px-6 pb-3 text-sm text-muted-foreground">{message}</p> : null}

        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <Button disabled={submitting} onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => void confirmMove()} type="button">
            {submitting ? "Moving..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderTreeRow({
  node,
  selectedContainerId,
  onSelect,
  onToggle,
  level = 0,
}: {
  node: FolderNode;
  selectedContainerId: string | null;
  onSelect: (folderId: string) => void;
  onToggle: (folderId: string) => void;
  level?: number;
}) {
  const selected = selectedContainerId === node.folder.id;
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "grid grid-cols-[2rem_1fr] items-center rounded-md text-sm hover:bg-muted",
          selected ? "bg-muted font-medium" : ""
        )}
      >
        <button
          aria-label={node.expanded ? "Collapse folder" : "Expand folder"}
          className="flex h-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          onClick={() => void onToggle(node.folder.id)}
          type="button"
        >
          <ChevronRight
            className={cn("h-4 w-4 transition", node.expanded ? "rotate-90" : "")}
          />
        </button>
        <button
          className="flex h-10 min-w-0 items-center gap-2 pr-3 text-left"
          onClick={() => onSelect(node.folder.id)}
          type="button"
        >
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate">{folderLabel(node.folder)}</span>
          {node.loading ? <span className="text-xs text-muted-foreground">Loading...</span> : null}
        </button>
      </div>
      {node.expanded ? (
        <div className="ml-6 space-y-1 border-l pl-3">
          {node.children.length === 0 && node.childrenLoaded ? (
            <p className="py-2 text-sm text-muted-foreground">No folders inside.</p>
          ) : null}
          {node.children.map((child) => (
            <FolderTreeRow
              key={child.folder.id}
              level={level + 1}
              node={child}
              onSelect={onSelect}
              onToggle={onToggle}
              selectedContainerId={selectedContainerId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
