"use client";

import type { AssetListResponse } from "@media-manager/contracts";
import {
  ChevronDown,
  Eye,
  EyeOff,
  FileAudio,
  FileImage,
  Film,
  Folder,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AddAssetMenu } from "@/components/add-asset-menu";
import { DeleteAssetsDialog } from "@/components/delete-assets-dialog";
import { ReprocessAssetsDialog } from "@/components/reprocess-assets-dialog";
import { updateBulkAssetVisibility } from "@/lib/bulk-asset-visibility";

type Asset = AssetListResponse["assets"][number];

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

function assetHref(asset: Asset): string {
  return asset.type === "folder" ? folderHref(asset) : assetDetailHref(asset);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [isApplyingVisibility, setIsApplyingVisibility] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.has(asset.id)),
    [assets, selectedIds]
  );
  const allSelected = assets.length > 0 && selectedAssets.length === assets.length;
  const assetIdsKey = assets.map((asset) => asset.id).join("\0");

  useEffect(() => {
    const currentIds = new Set(assets.map((asset) => asset.id));
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => currentIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [assetIdsKey, assets]);

  useEffect(() => {
    if (!actionMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) setActionMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActionMenuOpen(false);
      actionButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionMenuOpen]);

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
    setSelectedIds(
      assets.length > 0 && selectedAssets.length === assets.length
        ? new Set()
        : new Set(assets.map((asset) => asset.id))
    );
  }

  async function applyVisibility(visibility: "private" | "public") {
    if (isApplyingVisibility) return;
    setActionMenuOpen(false);
    setIsApplyingVisibility(true);
    setBulkMessage(`Updating ${selectedAssets.length} selected items...`);
    try {
      const result = await updateBulkAssetVisibility(selectedAssets, visibility);
      setSelectedIds((previous) => {
        const next = new Set(previous);
        result.updatedIds.forEach((id) => next.delete(id));
        return next;
      });

      const parts = [`${result.updatedIds.length} set to ${visibility}`];
      if (result.failedIds.length > 0) parts.push(`${result.failedIds.length} failed`);
      if (result.skippedFolderIds.length > 0) {
        parts.push(`${result.skippedFolderIds.length} folders skipped`);
      }
      setBulkMessage(`${parts.join(" · ")}.`);
      router.refresh();
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Visibility update failed.");
    } finally {
      setIsApplyingVisibility(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={assets.length === 0}
            onClick={toggleSelectAll}
            type="button"
            variant="outline"
          >
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
          {selectedAssets.length > 0 ? (
            <>
              <div className="relative" ref={actionMenuRef}>
                <Button
                  aria-controls="selected-asset-actions"
                  aria-expanded={actionMenuOpen}
                  disabled={isApplyingVisibility}
                  onClick={() => setActionMenuOpen((open) => !open)}
                  ref={actionButtonRef}
                  type="button"
                  variant="outline"
                >
                  {isApplyingVisibility ? "Updating..." : "Action"}
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </Button>
                <div
                  aria-label="Selected asset actions"
                  className={`${actionMenuOpen ? "" : "hidden"} absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border bg-background p-1 shadow-lg`}
                  id="selected-asset-actions"
                  role="group"
                >
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => void applyVisibility("public")}
                    type="button"
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" />
                    Make public
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => void applyVisibility("private")}
                    type="button"
                  >
                    <EyeOff aria-hidden="true" className="h-4 w-4" />
                    Make private
                  </button>
                  <div className="my-1 border-t" />
                  <ReprocessAssetsDialog
                    assetIds={selectedAssets.map((asset) => asset.id)}
                    onJobCreated={() => {
                      setBulkMessage("Tone reprocessing job started.");
                      setSelectedIds(new Set());
                      router.refresh();
                    }}
                    onTriggered={() => setActionMenuOpen(false)}
                    triggerVariant="menu-item"
                    type="reprocess_tone"
                  />
                  <ReprocessAssetsDialog
                    assetIds={selectedAssets.map((asset) => asset.id)}
                    onJobCreated={() => {
                      setBulkMessage("Conversion reprocessing job started.");
                      setSelectedIds(new Set());
                      router.refresh();
                    }}
                    onTriggered={() => setActionMenuOpen(false)}
                    triggerVariant="menu-item"
                    type="reprocess_conversion"
                  />
                </div>
              </div>
              <DeleteAssetsDialog
                assetIds={selectedAssets.map((asset) => asset.id)}
                onJobCreated={() => {
                  setBulkMessage("Delete job started.");
                  setSelectedIds(new Set());
                  router.refresh();
                }}
              />
            </>
          ) : null}
          {selectedAssets.length > 0 ? (
            <span className="text-xs text-muted-foreground">{selectedAssets.length} selected</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <AddAssetMenu containerId={containerId} />
          <Button
            onClick={() => router.refresh()}
            type="button"
            variant="outline"
            title="Refresh status"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">Refresh status</span>
          </Button>
        </div>
      </div>

      {bulkMessage ? (
        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
          {bulkMessage}
        </p>
      ) : null}

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items here yet.</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-[2.5rem_3rem_minmax(0,1fr)_6rem_8rem_7rem_8rem_8rem] gap-3 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground max-lg:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_7rem]">
          <span>Select</span>
          <span>Type</span>
          <span>Asset</span>
          <span>Review</span>
          <span>Status</span>
          <span className="max-lg:hidden">Visibility</span>
          <span className="max-lg:hidden">Conversion</span>
          <span className="max-lg:hidden">Tone</span>
        </div>
        {assets.map((asset) => (
          <div
            className="grid grid-cols-[2.5rem_3rem_minmax(0,1fr)_6rem_8rem_7rem_8rem_8rem] items-center gap-3 border-b px-4 py-3 last:border-b-0 max-lg:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_7rem]"
            key={asset.id}
          >
            <input
              aria-label={`Select ${asset.title}`}
              checked={selectedIds.has(asset.id)}
              className="h-4 w-4"
              onChange={() => toggleSelected(asset.id)}
              type="checkbox"
            />
            <AssetTypeIcon asset={asset} />
            <div className="min-w-0">
              <Link className="block truncate font-medium hover:underline" href={assetHref(asset)}>
                {asset.title}
              </Link>
              {asset.type === "folder" && asset.description ? (
                <p className="truncate text-xs text-muted-foreground">{asset.description}</p>
              ) : null}
            </div>
            {asset.type === "audio" || asset.type === "video" ? (
              <Link
                aria-label={`Review ${asset.title}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                href={`/review?targetType=${asset.type}&assetId=${encodeURIComponent(asset.id)}`}
              >
                <MessageSquareText aria-hidden="true" className="h-4 w-4" />
                <span className="max-lg:sr-only">Review</span>
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            {asset.type === "folder" ? (
              <>
                <span aria-hidden="true" />
                <span aria-hidden="true" className="max-lg:hidden" />
                <span aria-hidden="true" className="max-lg:hidden" />
                <span aria-hidden="true" className="max-lg:hidden" />
              </>
            ) : (
              <>
                <span className="text-sm capitalize">
                  {asset.status}
                  <span className="block text-xs text-muted-foreground lg:hidden">
                    {asset.visibility}
                  </span>
                </span>
                <span className="text-sm capitalize text-muted-foreground max-lg:hidden">
                  {asset.visibility}
                </span>
                <span className="text-sm capitalize text-muted-foreground max-lg:hidden">
                  {statusText(asset.conversion?.status)}
                </span>
                <span className="text-sm capitalize text-muted-foreground max-lg:hidden">
                  {statusText(asset.toneAnalysis?.status)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
