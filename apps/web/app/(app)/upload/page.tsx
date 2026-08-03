"use client";

import {
  AssetDetailResponseSchema,
  AssetListResponseSchema,
  AssetUploadUrlResponseSchema,
  type VideoUploadMetadata,
} from "@media-manager/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import {
  aggregateUploadProgress,
  inferAssetTypeFromFile,
  runWithConcurrency,
  titleFromFileName,
  type UploadAssetType,
} from "@/lib/upload-files";
import { uploadFileViaMultipart } from "@/lib/multipart-upload";

const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
const FILE_UPLOAD_CONCURRENCY = 2;

type ToastState = {
  open: boolean;
  variant: "success" | "error";
  title: string;
  description?: string;
};

type FolderOption = {
  id: string;
  title: string;
};

type AssetVisibility = "private" | "public";
type UploadStatus = "pending" | "creating" | "uploading" | "confirming" | "complete" | "failed";

type UploadItem = {
  id: string;
  file: File;
  title: string;
  type: UploadAssetType | null;
  status: UploadStatus;
  progress: number;
  error?: string;
  assetId?: string;
};

function uploadItemId(file: File, index: number): string {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: UploadStatus): string {
  if (status === "creating") return "Creating asset";
  if (status === "uploading") return "Uploading";
  if (status === "confirming") return "Confirming";
  if (status === "complete") return "Complete";
  if (status === "failed") return "Failed";
  return "Ready";
}

async function putFileWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl, true);
    request.setRequestHeader("content-type", contentType);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(1, event.loaded / Math.max(event.total, 1)));
      }
    };
    request.onerror = () => reject(new Error("File upload failed."));
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("File upload failed."));
        return;
      }
      onProgress(1);
      resolve();
    };
    request.send(file);
  });
}

async function getVideoUploadMetadata(file: File): Promise<VideoUploadMetadata | undefined> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<VideoUploadMetadata>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        const width = Math.trunc(video.videoWidth);
        const height = Math.trunc(video.videoHeight);
        if (width <= 0 || height <= 0) {
          reject(new Error("Video dimensions could not be determined."));
          return;
        }
        resolve({ width, height });
      };
      video.onerror = () => reject(new Error("Video metadata could not be read."));
      video.src = objectUrl;
    });
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function UploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeContainerId = searchParams.get("containerId")?.trim() || "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [assetVisibility, setAssetVisibility] = useState<AssetVisibility>("private");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"root" | "existing" | "new">(
    activeContainerId ? "existing" : "root"
  );
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState(activeContainerId);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [completedContainerId, setCompletedContainerId] = useState<string | null | undefined>();
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [isDestinationValidating, setIsDestinationValidating] = useState(
    Boolean(activeContainerId)
  );
  const [destinationCreationUnknown, setDestinationCreationUnknown] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    variant: "success",
    title: "",
  });

  const overallProgress = aggregateUploadProgress(items);
  const completedCount = items.filter((item) => item.status === "complete").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const hasCreatedAssets = items.some((item) => item.assetId);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;

  function showToast(nextToast: Omit<ToastState, "open">) {
    setToast({ ...nextToast, open: true });
  }

  function updateItem(id: string, update: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }

  useEffect(() => {
    if (!toast.open) return;
    const timer = setTimeout(() => setToast((current) => ({ ...current, open: false })), 3000);
    return () => clearTimeout(timer);
  }, [toast.open]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/assets?type=folder&scope=all&sort=newest", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const parsed = AssetListResponseSchema.safeParse((await response.json()) as unknown);
        if (!parsed.success || cancelled) return;
        setFolders(parsed.data.assets.map((asset) => ({ id: asset.id, title: asset.title })));
      } catch {
        // Folder selection remains usable for the active URL destination.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeContainerId) {
      setTargetMode("existing");
      setSelectedFolderId(activeContainerId);
      setDestinationError(null);
      setIsDestinationValidating(true);
      let cancelled = false;
      void (async () => {
        try {
          const response = await fetch(`/api/assets/${encodeURIComponent(activeContainerId)}`, {
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Current folder could not be loaded.");
          const parsed = AssetDetailResponseSchema.safeParse((await response.json()) as unknown);
          if (!parsed.success || parsed.data.asset.type !== "folder") {
            throw new Error("The upload destination is not a folder.");
          }
          if (!cancelled) {
            const folder = { id: parsed.data.asset.id, title: parsed.data.asset.title };
            setFolders((current) => [
              folder,
              ...current.filter((option) => option.id !== folder.id),
            ]);
          }
        } catch (error) {
          if (!cancelled) {
            setDestinationError(
              error instanceof Error ? error.message : "Current folder could not be loaded."
            );
          }
        } finally {
          if (!cancelled) setIsDestinationValidating(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    } else {
      setTargetMode("root");
      setSelectedFolderId("");
      setDestinationError(null);
      setIsDestinationValidating(false);
    }
  }, [activeContainerId]);

  async function resolveContainerId(): Promise<string | undefined> {
    if (targetMode === "root") return undefined;
    if (targetMode === "existing") {
      const chosen = selectedFolderId.trim();
      if (!chosen) throw new Error("Select a target folder.");
      return chosen;
    }

    const title = newFolderTitle.trim();
    if (!title) throw new Error("New folder name is required.");
    let folder: FolderOption;
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "folder",
          title,
          description: "",
          ...(activeContainerId ? { containerId: activeContainerId } : {}),
        }),
      });
      if (!response.ok) throw new Error("Failed to create destination folder.");
      const parsed = AssetDetailResponseSchema.safeParse((await response.json()) as unknown);
      if (!parsed.success) throw new Error("Folder response failed validation.");
      folder = { id: parsed.data.asset.id, title: parsed.data.asset.title };
    } catch {
      setDestinationCreationUnknown(true);
      throw new Error(
        "Folder creation outcome is unknown. Check the library, then choose root or an existing folder."
      );
    }

    setDestinationCreationUnknown(false);
    setFolders((current) => [folder, ...current.filter((option) => option.id !== folder.id)]);
    setSelectedFolderId(folder.id);
    setTargetMode("existing");
    setNewFolderTitle("");
    return folder.id;
  }

  async function uploadOne(item: UploadItem, containerId: string | undefined): Promise<void> {
    if (!item.type) throw new Error("Select a supported asset type.");
    const title = item.title.trim();
    if (!title) throw new Error("Title is required.");
    if (item.file.size === 0) throw new Error("The selected file is empty.");

    let assetId = item.assetId;
    if (assetId) {
      const currentResponse = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
        cache: "no-store",
      });
      if (currentResponse.ok) {
        const current = AssetDetailResponseSchema.safeParse(
          (await currentResponse.json()) as unknown
        );
        if (current.success && current.data.asset.status !== "draft") {
          updateItem(item.id, { status: "complete", progress: 1, error: undefined });
          return;
        }
      }

      const confirmResponse = await fetch(
        `/api/assets/${encodeURIComponent(assetId)}/upload-complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (confirmResponse.ok) {
        updateItem(item.id, { status: "complete", progress: 1, error: undefined });
        return;
      }
      if (confirmResponse.status !== 409) {
        throw new Error("Could not verify the previous upload. Retry to check again.");
      }
    }

    if (!assetId) {
      updateItem(item.id, { status: "creating", error: undefined, progress: 0 });
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          title,
          description: description.trim(),
          visibility: assetVisibility,
          ...(containerId ? { containerId } : {}),
        }),
      });
      if (!response.ok) throw new Error("Failed to create asset.");
      const parsed = AssetDetailResponseSchema.safeParse((await response.json()) as unknown);
      if (!parsed.success) throw new Error("Create asset response failed validation.");
      assetId = parsed.data.asset.id;
      updateItem(item.id, { assetId });
    }

    updateItem(item.id, { status: "uploading", error: undefined });
    const contentType = item.file.type || "application/octet-stream";
    const videoMetadata =
      item.type === "video" ? await getVideoUploadMetadata(item.file) : undefined;
    const onProgress = (progress: number) => updateItem(item.id, { progress });

    if (item.type === "video" && item.file.size >= MULTIPART_THRESHOLD_BYTES) {
      await uploadFileViaMultipart(assetId, item.file, { onProgress, videoMetadata });
    } else {
      const uploadUrlResponse = await fetch(
        `/api/assets/${encodeURIComponent(assetId)}/upload-url`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType, ...(videoMetadata ? { videoMetadata } : {}) }),
        }
      );
      if (!uploadUrlResponse.ok) throw new Error("Failed to create upload URL.");
      const uploadParsed = AssetUploadUrlResponseSchema.safeParse(
        (await uploadUrlResponse.json()) as unknown
      );
      if (!uploadParsed.success) throw new Error("Upload URL response failed validation.");
      await putFileWithProgress(uploadParsed.data.uploadUrl, item.file, contentType, onProgress);

      updateItem(item.id, { status: "confirming", progress: 1 });
      const confirmResponse = await fetch(
        `/api/assets/${encodeURIComponent(assetId)}/upload-complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!confirmResponse.ok) throw new Error("Upload completed but confirmation failed.");
    }

    updateItem(item.id, { status: "complete", progress: 1, error: undefined });
  }

  async function uploadBatch(itemIds?: ReadonlySet<string>) {
    if (isSubmitting) return;
    setErrorMessage(null);

    const candidates = items.filter(
      (item) =>
        item.status !== "complete" &&
        (item.status !== "failed" || Boolean(item.assetId)) &&
        (!itemIds || itemIds.has(item.id))
    );
    if (candidates.length === 0) {
      setErrorMessage(
        items.some((item) => item.status === "failed" && !item.assetId)
          ? "Remove uploads with an unknown create result after checking the destination."
          : "Choose at least one media file."
      );
      return;
    }
    if (candidates.some((item) => !item.type)) {
      setErrorMessage("Choose a supported type for every file before uploading.");
      return;
    }
    if (candidates.some((item) => !item.title.trim())) {
      setErrorMessage("Every file needs a title.");
      return;
    }
    if (destinationError) {
      setErrorMessage(destinationError);
      return;
    }
    if (isDestinationValidating) {
      setErrorMessage("Wait for the current folder to finish loading.");
      return;
    }
    if (destinationCreationUnknown) {
      setErrorMessage(
        "Check the library for the new folder, then choose root or an existing folder."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const containerId = await resolveContainerId();
      setCompletedContainerId(containerId ?? null);
      const results = await runWithConcurrency(
        candidates,
        FILE_UPLOAD_CONCURRENCY,
        async (item) => {
          try {
            await uploadOne(item, containerId);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed.";
            updateItem(item.id, { status: "failed", error: message });
            throw error;
          }
        }
      );
      const failures = results.filter((result) => !result.ok).length;
      if (failures > 0) {
        const message = `${candidates.length - failures} completed, ${failures} failed.`;
        setErrorMessage(message);
        showToast({ variant: "error", title: "Batch upload incomplete", description: message });
      } else {
        showToast({
          variant: "success",
          title: candidates.length === 1 ? "Upload complete" : "Uploads complete",
          description: `${candidates.length} ${candidates.length === 1 ? "asset" : "assets"} uploaded successfully.`,
        });
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setErrorMessage(message);
      showToast({ variant: "error", title: "Upload failed", description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void uploadBatch();
  }

  const destinationHref = completedContainerId
    ? `/library?containerId=${encodeURIComponent(completedContainerId)}`
    : "/library";

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add multiple media files. Types are inferred and uploads default to private.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-6"
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="asset-files">
            Media files
          </label>
          <input
            id="asset-files"
            ref={fileInputRef}
            name="asset-files"
            type="file"
            accept="audio/*,video/*,image/*"
            multiple
            disabled={isSubmitting || hasCreatedAssets}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              setItems(
                files.map((file, index) => ({
                  id: uploadItemId(file, index),
                  file,
                  title: titleFromFileName(file.name),
                  type: inferAssetTypeFromFile(file),
                  status: "pending",
                  progress: 0,
                  ...(inferAssetTypeFromFile(file)
                    ? {}
                    : { error: "Type could not be inferred. Select one below." }),
                }))
              );
              setCompletedContainerId(undefined);
              setErrorMessage(null);
            }}
            className="w-full rounded-md border bg-card px-3 py-2 text-sm"
            required={items.length === 0}
          />
        </div>

        {items.length > 0 ? (
          <div className="space-y-3" aria-label="Selected files">
            {items.map((item) => (
              <article key={item.id} className="space-y-3 rounded-lg border bg-background/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)} · {statusLabel(item.status)}
                    </p>
                  </div>
                  {item.status === "pending" || (item.status === "failed" && !item.assetId) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const remaining = items.filter((row) => row.id !== item.id);
                        setItems(remaining);
                        if (remaining.length === 0 && fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      <span className="sr-only">{item.file.name}: </span>
                      Remove
                    </Button>
                  ) : null}
                  {item.status === "failed" && item.assetId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => void uploadBatch(new Set([item.id]))}
                    >
                      <span className="sr-only">{item.file.name}: </span>
                      Retry
                    </Button>
                  ) : null}
                  {item.status === "complete" && item.assetId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/asset/${item.assetId}`)}
                    >
                      <span className="sr-only">{item.file.name}: </span>
                      View
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <label className="space-y-1 text-xs font-medium">
                    <span>Title</span>
                    <input
                      className="w-full rounded-md border bg-card px-3 py-2 text-sm"
                      disabled={isSubmitting || item.status === "complete" || Boolean(item.assetId)}
                      value={item.title}
                      onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    <span>Type</span>
                    <select
                      className="w-full rounded-md border bg-card px-3 py-2 text-sm"
                      disabled={isSubmitting || item.status === "complete" || Boolean(item.assetId)}
                      value={item.type ?? ""}
                      onChange={(event) => {
                        const type = event.target.value as UploadAssetType;
                        updateItem(item.id, {
                          type,
                          status: "pending",
                          error: undefined,
                        });
                      }}
                    >
                      <option value="">Select type</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="image">Image</option>
                    </select>
                  </label>
                </div>

                {item.status !== "pending" ? (
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-border"
                    role="progressbar"
                    aria-label={`${item.file.name} upload progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                  >
                    <div
                      className="h-full bg-primary transition-[width] duration-150"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                ) : null}
                {item.error ? (
                  <p className="text-xs text-destructive" role="alert">
                    {item.error}
                    {!item.assetId && item.status === "failed"
                      ? " Check the destination before selecting this file again."
                      : ""}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium" htmlFor="asset-visibility">
            <span>Visibility</span>
            <select
              id="asset-visibility"
              value={assetVisibility}
              disabled={isSubmitting || hasCreatedAssets}
              onChange={(event) => setAssetVisibility(event.target.value as AssetVisibility)}
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium" htmlFor="asset-description">
            <span>Description for all files</span>
            <input
              id="asset-description"
              value={description}
              disabled={isSubmitting || hasCreatedAssets}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional shared context"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>

        <fieldset
          className="space-y-2 rounded-md border p-3"
          disabled={isSubmitting || hasCreatedAssets}
        >
          <legend className="px-1 text-sm font-medium">Destination</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={targetMode === "root"}
                name="target-mode"
                onChange={() => {
                  setTargetMode("root");
                  setDestinationError(null);
                  setDestinationCreationUnknown(false);
                }}
                type="radio"
              />
              Root
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={targetMode === "existing"}
                name="target-mode"
                onChange={() => {
                  setTargetMode("existing");
                  setDestinationCreationUnknown(false);
                }}
                type="radio"
              />
              Existing folder
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={targetMode === "new"}
                name="target-mode"
                onChange={() => {
                  setTargetMode("new");
                  setDestinationError(null);
                }}
                type="radio"
              />
              New folder
            </label>
          </div>
          {targetMode === "existing" ? (
            <label className="space-y-1 text-xs font-medium">
              <span>Existing folder</span>
              <select
                className="w-full rounded-md border bg-card px-3 py-2 text-sm"
                onChange={(event) => {
                  setSelectedFolderId(event.target.value);
                  setDestinationError(null);
                  setDestinationCreationUnknown(false);
                }}
                value={selectedFolderId}
              >
                <option value="">Select folder</option>
                {!selectedFolder && selectedFolderId ? (
                  <option value={selectedFolderId}>Current folder · {selectedFolderId}</option>
                ) : null}
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {targetMode === "existing" && selectedFolder ? (
            <p className="text-xs text-muted-foreground">Selected: {selectedFolder.title}</p>
          ) : null}
          {targetMode === "new" ? (
            <label className="space-y-1 text-xs font-medium">
              <span>New folder name</span>
              <input
                className="w-full rounded-md border bg-card px-3 py-2 text-sm"
                onChange={(event) => setNewFolderTitle(event.target.value)}
                placeholder="New folder name"
                value={newFolderTitle}
              />
            </label>
          ) : null}
          {destinationError ? (
            <p className="text-xs text-destructive" role="alert">
              {destinationError}
            </p>
          ) : null}
        </fieldset>

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              isDestinationValidating ||
              destinationCreationUnknown ||
              items.length === 0
            }
          >
            {isSubmitting
              ? `Uploading ${completedCount}/${items.length}`
              : failedCount > 0
                ? "Retry failed uploads"
                : `Upload ${items.length || ""} ${items.length === 1 ? "file" : "files"}`.trim()}
          </Button>
          {completedContainerId !== undefined && completedCount > 0 ? (
            <Button type="button" variant="outline" onClick={() => router.push(destinationHref)}>
              Return to folder
            </Button>
          ) : null}
          {items.length > 0 &&
          completedCount + failedCount === items.length &&
          failedCount === 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setItems([]);
                setCompletedContainerId(undefined);
                setErrorMessage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Upload another batch
            </Button>
          ) : null}
          {items.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {completedCount} complete{failedCount ? ` · ${failedCount} failed` : ""}
            </span>
          ) : null}
        </div>
      </form>

      <Toast
        open={toast.open}
        variant={toast.variant}
        title={toast.title}
        description={toast.description}
      />
      {isSubmitting ? (
        <>
          <div
            className="pointer-events-none fixed bottom-0 left-0 z-50 h-1 w-full bg-border/60"
            role="progressbar"
            aria-label="Overall upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(overallProgress * 100)}
          >
            <div
              className="h-full bg-primary transition-[width] duration-150 ease-out"
              style={{ width: `${Math.max(2, Math.round(overallProgress * 100))}%` }}
            />
          </div>
          <div className="pointer-events-none fixed bottom-2 right-3 z-50 rounded bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
            {Math.round(overallProgress * 100)}%
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-4xl">
          <p className="text-sm text-muted-foreground">Loading upload form...</p>
        </section>
      }
    >
      <UploadForm />
    </Suspense>
  );
}
