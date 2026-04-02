"use client";

import {
  AssetDetailResponseSchema,
  AssetListResponseSchema,
  AssetTypeSchema,
  AssetUploadUrlResponseSchema,
  type VideoUploadMetadata,
} from "@media-manager/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { uploadFileViaMultipart } from "@/lib/multipart-upload";

const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
const POST_UPLOAD_VISIBLE_MS = 800;

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

async function putFileWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
  videoMetadata?: VideoUploadMetadata
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl, true);
    request.setRequestHeader("content-type", contentType);
    if (videoMetadata) {
      request.setRequestHeader("x-amz-meta-video-width", String(videoMetadata.width));
      request.setRequestHeader("x-amz-meta-video-height", String(videoMetadata.height));
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.min(1, event.loaded / Math.max(event.total, 1)));
    };

    request.onerror = () => {
      reject(new Error("File upload failed."));
    };

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
  if (!file.type.startsWith("video/")) {
    return undefined;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const metadata = await new Promise<VideoUploadMetadata>((resolve, reject) => {
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

      video.onerror = () => {
        reject(new Error("Video metadata could not be read."));
      };

      video.src = objectUrl;
    });

    return metadata;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function UploadPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [targetMode, setTargetMode] = useState<"root" | "existing" | "new">("root");
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [toast, setToast] = useState<ToastState>({
    open: false,
    variant: "success",
    title: "",
  });

  function showToast(nextToast: Omit<ToastState, "open">) {
    setToast({ ...nextToast, open: true });
  }

  useEffect(() => {
    if (!toast.open) {
      return;
    }

    const timer = setTimeout(() => {
      setToast((current) => ({ ...current, open: false }));
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [toast.open]);

  useEffect(() => {
    let cancelled = false;

    const loadFolders = async () => {
      try {
        const response = await fetch("/api/assets?type=folder&sort=newest", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as unknown;
        const parsed = AssetListResponseSchema.safeParse(json);
        if (!parsed.success || cancelled) {
          return;
        }

        setFolders(parsed.data.assets.map((asset) => ({ id: asset.id, title: asset.title })));
      } catch {
        // best effort
      }
    };

    void loadFolders();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData(event.currentTarget);
      const rawType = String(formData.get("asset-type") ?? "");
      const rawTitle = String(formData.get("asset-title") ?? "");
      const rawDescription = String(formData.get("asset-description") ?? "");
      const file = formData.get("asset-file");

      const parsedType = AssetTypeSchema.safeParse(rawType);
      if (!parsedType.success) {
        throw new Error("Please select a valid asset type.");
      }
      if (parsedType.data === "folder") {
        throw new Error("Use Create Folder in Library to add folders.");
      }

      const title = rawTitle.trim();
      if (!title) {
        throw new Error("Title is required.");
      }

      if (!(file instanceof File) || file.size === 0) {
        throw new Error("Please choose a media file to upload.");
      }

      let containerId: string | undefined;
      if (targetMode === "existing") {
        const chosen = selectedFolderId.trim();
        if (!chosen) {
          throw new Error("Select a target folder.");
        }
        containerId = chosen;
      }

      if (targetMode === "new") {
        const newTitle = newFolderTitle.trim();
        if (!newTitle) {
          throw new Error("New folder name is required.");
        }

        const folderCreateResponse = await fetch("/api/assets", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            type: "folder",
            title: newTitle,
            description: "",
          }),
        });

        if (!folderCreateResponse.ok) {
          throw new Error("Failed to create destination folder.");
        }

        const folderJson = (await folderCreateResponse.json()) as unknown;
        const folderParsed = AssetDetailResponseSchema.safeParse(folderJson);
        if (!folderParsed.success) {
          throw new Error("Folder response failed validation.");
        }

        containerId = folderParsed.data.asset.id;
      }

      const createResponse = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: parsedType.data,
          title,
          description: rawDescription.trim(),
          ...(containerId ? { containerId } : {}),
        }),
      });

      if (!createResponse.ok) {
        throw new Error("Failed to create asset.");
      }

      const createJson = (await createResponse.json()) as unknown;
      const createParsed = AssetDetailResponseSchema.safeParse(createJson);
      if (!createParsed.success) {
        throw new Error("Create asset response failed validation.");
      }

      const asset = createParsed.data.asset;

      const uploadFile = file as File;
      const contentType = uploadFile.type || "application/octet-stream";
      const videoMetadata =
        parsedType.data === "video" ? await getVideoUploadMetadata(uploadFile) : undefined;
      const shouldUseMultipart =
        parsedType.data === "video" && uploadFile.size >= MULTIPART_THRESHOLD_BYTES;

      if (shouldUseMultipart) {
        await uploadFileViaMultipart(asset.id, uploadFile, {
          onProgress: setUploadProgress,
          videoMetadata,
        });
      } else {
        const uploadUrlResponse = await fetch(
          `/api/assets/${encodeURIComponent(asset.id)}/upload-url`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              contentType,
              ...(videoMetadata ? { videoMetadata } : {}),
            }),
          }
        );

        if (!uploadUrlResponse.ok) {
          throw new Error("Failed to create upload URL.");
        }

        const uploadJson = (await uploadUrlResponse.json()) as unknown;
        const uploadParsed = AssetUploadUrlResponseSchema.safeParse(uploadJson);
        if (!uploadParsed.success) {
          throw new Error("Upload URL response failed validation.");
        }

        await putFileWithProgress(
          uploadParsed.data.uploadUrl,
          uploadFile,
          contentType,
          setUploadProgress,
          videoMetadata
        );

        const confirmResponse = await fetch(
          `/api/assets/${encodeURIComponent(asset.id)}/upload-complete`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (!confirmResponse.ok) {
          throw new Error("Upload completed but confirmation failed.");
        }
      }

      showToast({
        variant: "success",
        title: "Upload complete",
        description: "Your asset was uploaded to S3 successfully.",
      });

      setUploadProgress(1);

      await new Promise((resolve) => {
        setTimeout(resolve, POST_UPLOAD_VISIBLE_MS);
      });

      router.push(`/asset/${asset.id}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setErrorMessage(message);
      showToast({
        variant: "error",
        title: "Upload failed",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload media to root, an existing folder, or a new folder.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <label className="block text-sm font-medium" htmlFor="asset-type">
          Asset type
        </label>
        <select
          id="asset-type"
          name="asset-type"
          defaultValue="video"
          className="w-full rounded-md border bg-card px-3 py-2 text-sm"
        >
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="image">Image</option>
        </select>

        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Destination</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={targetMode === "root"}
              name="target-mode"
              onChange={() => setTargetMode("root")}
              type="radio"
            />
            Root
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={targetMode === "existing"}
              name="target-mode"
              onChange={() => setTargetMode("existing")}
              type="radio"
            />
            Existing folder
          </label>
          {targetMode === "existing" ? (
            <select
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              onChange={(event) => setSelectedFolderId(event.target.value)}
              value={selectedFolderId}
            >
              <option value="">Select folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.title} - {folder.id}
                </option>
              ))}
            </select>
          ) : null}
          {targetMode === "existing" && selectedFolder ? (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedFolder.title}{" "}
              <span className="text-muted-foreground/70">{selectedFolder.id}</span>
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={targetMode === "new"}
              name="target-mode"
              onChange={() => setTargetMode("new")}
              type="radio"
            />
            New folder
          </label>
          {targetMode === "new" ? (
            <input
              className="w-full rounded-md border bg-card px-3 py-2 text-sm"
              onChange={(event) => setNewFolderTitle(event.target.value)}
              placeholder="New folder name"
              value={newFolderTitle}
            />
          ) : null}
        </fieldset>
        <label className="block text-sm font-medium" htmlFor="asset-title">
          Asset title
        </label>
        <input
          id="asset-title"
          name="asset-title"
          type="text"
          placeholder="Summer campaign b-roll"
          className="w-full rounded-md border bg-card px-3 py-2 text-sm"
          required
        />
        <label className="block text-sm font-medium" htmlFor="asset-description">
          Description
        </label>
        <textarea
          id="asset-description"
          name="asset-description"
          rows={3}
          placeholder="Optional context about this asset"
          className="w-full rounded-md border bg-card px-3 py-2 text-sm"
        />
        <label className="block text-sm font-medium" htmlFor="asset-file">
          Media file
        </label>
        <input
          id="asset-file"
          name="asset-file"
          type="file"
          className="w-full rounded-md border bg-card px-3 py-2 text-sm"
          required
        />
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Create asset and upload"}
        </Button>
      </form>
      <Toast
        open={toast.open}
        variant={toast.variant}
        title={toast.title}
        description={toast.description}
      />
      {isSubmitting ? (
        <>
          <div className="pointer-events-none fixed bottom-0 left-0 z-50 h-1 w-full bg-border/60">
            <div
              className="h-full bg-primary transition-[width] duration-150 ease-out"
              style={{ width: `${Math.max(2, Math.round(uploadProgress * 100))}%` }}
            />
          </div>
          <div className="pointer-events-none fixed bottom-2 right-3 z-50 rounded bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
            {Math.round(uploadProgress * 100)}%
          </div>
        </>
      ) : null}
    </section>
  );
}
