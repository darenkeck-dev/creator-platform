"use client";

import type { AssetListResponse } from "@media-manager/contracts";
import { FileAudio, FileImage, Film, Folder } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddAssetMenu } from "@/components/add-asset-menu";

type Asset = AssetListResponse["assets"][number];
type ViewMode = "grid" | "list";

type Props = {
  assets: Asset[];
  containerId?: string;
};

function assetDetailHref(asset: Asset): string {
  return `/asset/${encodeURIComponent(asset.id)}`;
}

function folderHref(asset: Asset): string {
  return `/library?containerId=${encodeURIComponent(asset.id)}`;
}

function statusText(value: string | undefined): string {
  return (value ?? "not_started").replaceAll("_", " ");
}

function AssetTypeIcon({ asset }: { asset: Asset }) {
  const className = "h-4 w-4";
  const label = `${asset.type} asset`;
  const icon =
    asset.type === "audio" ? (
      <FileAudio aria-hidden="true" className={className} />
    ) : asset.type === "video" ? (
      <Film aria-hidden="true" className={className} />
    ) : asset.type === "image" ? (
      <FileImage aria-hidden="true" className={className} />
    ) : (
      <Folder aria-hidden="true" className={className} />
    );

  return (
    <span
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground"
      title={asset.type}
    >
      {icon}
    </span>
  );
}

export function LibraryAssetBrowser({ assets, containerId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "list" ? "list" : "grid";
  const [view, setView] = useState<ViewMode>(initialView);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.has(asset.id)),
    [assets, selectedIds]
  );
  const allSelected = assets.length > 0 && selectedIds.size === assets.length;

  function setViewMode(nextView: ViewMode) {
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "list") {
      params.set("view", "list");
    } else {
      params.delete("view");
    }
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function toggleSelected(id: string) {
    setBulkMessage(null);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setBulkMessage(null);
    setSelectedIds((previous) => {
      if (assets.length > 0 && previous.size === assets.length) {
        return new Set();
      }
      return new Set(assets.map((asset) => asset.id));
    });
  }

  async function bulkDeleteSelected() {
    if (selectedAssets.length === 0 || bulkDeleting) {
      return;
    }

    const names = selectedAssets.slice(0, 3).map((asset) => asset.title);
    const extra = selectedAssets.length > names.length ? ` and ${selectedAssets.length - names.length} more` : "";
    const confirmed = window.confirm(`Delete ${selectedAssets.length} selected item(s): ${names.join(", ")}${extra}?`);
    if (!confirmed) {
      return;
    }

    setBulkMessage(null);
    setBulkDeleting(true);
    try {
      const failed: string[] = [];
      for (const asset of selectedAssets) {
        try {
          const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            failed.push(asset.title);
          }
        } catch {
          failed.push(asset.title);
        }
      }

      if (failed.length > 0) {
        setBulkMessage(`Deleted ${selectedAssets.length - failed.length}; failed: ${failed.join(", ")}.`);
      } else {
        setBulkMessage(`Deleted ${selectedAssets.length} item(s).`);
      }
      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={assets.length === 0} onClick={toggleSelectAll} type="button" variant="outline">
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
          {selectedIds.size > 0 ? (
            <Button
              disabled={bulkDeleting}
              onClick={() => void bulkDeleteSelected()}
              type="button"
              variant="destructive"
            >
              {bulkDeleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
          {selectedIds.size > 0 ? (
            <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <AddAssetMenu containerId={containerId} />
          <Button
            onClick={() => setViewMode("grid")}
            type="button"
            variant={view === "grid" ? "default" : "outline"}
          >
            Grid
          </Button>
          <Button
            onClick={() => setViewMode("list")}
            type="button"
            variant={view === "list" ? "default" : "outline"}
          >
            List
          </Button>
        </div>
      </div>

      {bulkMessage ? <p className="text-sm text-muted-foreground">{bulkMessage}</p> : null}

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assets match the selected filters.</p>
      ) : null}

      {view === "list" ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_8rem_8rem_8rem_8rem] gap-3 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground max-lg:grid-cols-[2.5rem_minmax(0,1fr)_7rem_7rem]">
            <span>Select</span>
            <span>Asset</span>
            <span>Type</span>
            <span>Status</span>
            <span className="max-lg:hidden">Conversion</span>
            <span className="max-lg:hidden">Tone</span>
          </div>
          {assets.map((asset) => (
            <div
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_8rem_8rem_8rem_8rem] items-center gap-3 border-b px-4 py-3 last:border-b-0 max-lg:grid-cols-[2.5rem_minmax(0,1fr)_7rem_7rem]"
              key={asset.id}
            >
              <input
                aria-label={`Select ${asset.title}`}
                checked={selectedIds.has(asset.id)}
                className="h-4 w-4"
                onChange={() => toggleSelected(asset.id)}
                type="checkbox"
              />
              <div className="min-w-0">
                <Link className="font-medium hover:underline" href={assetDetailHref(asset)}>
                  {asset.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{asset.id}</p>
              </div>
              <AssetTypeIcon asset={asset} />
              <span className="text-sm capitalize">{asset.status}</span>
              <span className="text-sm capitalize text-muted-foreground max-lg:hidden">
                {statusText(asset.conversion?.status)}
              </span>
              <span className="text-sm capitalize text-muted-foreground max-lg:hidden">
                {statusText(asset.toneAnalysis?.status)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <article
              className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              key={asset.id}
            >
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Select ${asset.title}`}
                  checked={selectedIds.has(asset.id)}
                  className="mt-1 h-4 w-4"
                  onChange={() => toggleSelected(asset.id)}
                  type="checkbox"
                />
                <Link className="min-w-0 flex-1" href={assetDetailHref(asset)}>
                  <div className="flex items-center gap-2">
                    <AssetTypeIcon asset={asset} />
                    <p className="text-xs text-muted-foreground">Origin: {asset.origin ?? "uploaded"}</p>
                  </div>
                  <h2 className="mt-3 text-base font-medium">{asset.title}</h2>
                  <p className="mt-3 truncate text-xs text-muted-foreground">ID: {asset.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Status: {asset.status}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conversion: {statusText(asset.conversion?.status)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tone: {statusText(asset.toneAnalysis?.status)}
                  </p>
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Container: {asset.containerId ?? "root"}</span>
                <span>Sources: {asset.sourceAssetIds?.length ?? 0}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
