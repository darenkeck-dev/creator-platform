import {
  AssetDetailResponseSchema,
  AssetUploadUrlResponseSchema,
  type AssetRecord,
} from "@media-manager/contracts";

import { titleFromFileName, type UploadAssetType } from "@/lib/upload-files";

export type AssetUploadStage = "signing" | "uploading" | "confirming";

export class AssetUploadError extends Error {
  constructor(
    message: string,
    readonly asset: AssetRecord,
    readonly stage: AssetUploadStage
  ) {
    super(message);
  }
}

async function jsonResponse(response: Response): Promise<unknown> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Asset upload failed";
    throw new Error(message);
  }
  return payload;
}

export async function uploadAssetFile(
  file: File,
  type: Extract<UploadAssetType, "audio" | "image">,
  existingAsset?: AssetRecord,
  libraryVisibility: "listed" | "unlisted" = "listed"
): Promise<AssetRecord> {
  if (file.size === 0) throw new Error(`${file.name} is empty`);
  let created = existingAsset;
  if (created) {
    const currentResponse = await fetch(`/api/assets/${encodeURIComponent(created.id)}`, {
      cache: "no-store",
    });
    if (currentResponse.status === 404) {
      created = undefined;
    } else if (currentResponse.ok) {
      const current = AssetDetailResponseSchema.parse(await jsonResponse(currentResponse)).asset;
      if (current.status !== "draft") return current;
      created = current;
    }
  }
  if (!created) {
    const createResponse = await fetch("/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        title: titleFromFileName(file.name),
        description: "",
        visibility: "private",
        libraryVisibility,
      }),
    });
    created = AssetDetailResponseSchema.parse(await jsonResponse(createResponse)).asset;
  }
  const contentType = file.type || "application/octet-stream";
  try {
    const urlResponse = await fetch(`/api/assets/${encodeURIComponent(created.id)}/upload-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType }),
    });
    const upload = AssetUploadUrlResponseSchema.parse(await jsonResponse(urlResponse));
    try {
      const putResponse = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
      });
      if (!putResponse.ok) throw new Error(`Failed to upload ${file.name}`);
    } catch (error) {
      throw new AssetUploadError(
        error instanceof Error ? error.message : `Failed to upload ${file.name}`,
        created,
        "uploading"
      );
    }
  } catch (error) {
    if (error instanceof AssetUploadError) throw error;
    throw new AssetUploadError(
      error instanceof Error ? error.message : "Failed to create upload URL",
      created,
      "signing"
    );
  }
  try {
    const completeResponse = await fetch(
      `/api/assets/${encodeURIComponent(created.id)}/upload-complete`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
    );
    return AssetDetailResponseSchema.parse(await jsonResponse(completeResponse)).asset;
  } catch (error) {
    throw new AssetUploadError(
      error instanceof Error ? error.message : "Upload confirmation failed",
      created,
      "confirming"
    );
  }
}
