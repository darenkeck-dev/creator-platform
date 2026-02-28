import {
  AssetDeleteResponseSchema,
  AssetDetailResponseSchema,
  AssetListResponseSchema,
  AssetPlaybackUrlResponseSchema,
  MultipartAbortInputSchema,
  MultipartAbortResponseSchema,
  MultipartCompleteInputSchema,
  MultipartInitInputSchema,
  MultipartInitResponseSchema,
  MultipartSignInputSchema,
  MultipartSignResponseSchema,
  AssetUploadUrlInputSchema,
  AssetUploadUrlResponseSchema,
  UpdateAssetInputSchema,
  AssetTypeSchema,
  type MultipartAbortInput,
  type MultipartAbortResponse,
  type MultipartCompleteInput,
  type MultipartInitInput,
  type MultipartInitResponse,
  type MultipartSignInput,
  type MultipartSignResponse,
  type AssetUploadUrlInput,
  type AssetUploadUrlResponse,
  type AssetPlaybackUrlResponse,
  type AssetDeleteResponse,
  type AssetDetailResponse,
  type AssetListResponse,
  type UpdateAssetInput,
} from "@media-manager/contracts";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/lib/auth";

function getApiBaseUrl(): string {
  const stage = (process.env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
  const stageKey = stage.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const stageApiBaseUrl = process.env[`API_BASE_URL_${stageKey}`];
  const apiBaseUrl =
    stageApiBaseUrl ?? process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error(`Missing API base URL. Set API_BASE_URL_${stageKey} or API_BASE_URL.`);
  }

  return apiBaseUrl.replace(/\/$/, "");
}

async function getAuthHeader(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    throw new Error("Missing auth token");
  }

  return `Bearer ${token}`;
}

export async function fetchAssetsFromApi(): Promise<AssetListResponse["assets"]> {
  const response = await fetch(`${getApiBaseUrl()}/assets`, {
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load assets: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetListResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Asset list response failed validation");
  }

  return parsed.data.assets;
}

export async function fetchAssetByIdFromApi(
  id: string
): Promise<AssetDetailResponse["asset"] | null> {
  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}`, {
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Asset response failed validation");
  }

  return parsed.data.asset;
}

export async function createAssetInApi(input: {
  type: "video" | "audio" | "image";
  title: string;
  description?: string;
}): Promise<AssetDetailResponse["asset"]> {
  const parsedType = AssetTypeSchema.safeParse(input.type);
  if (!parsedType.success) {
    throw new Error("Invalid asset type");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("Title is required");
  }

  const response = await fetch(`${getApiBaseUrl()}/assets`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: parsedType.data,
      title,
      description: input.description?.trim() ?? "",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to create asset: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Create asset response failed validation");
  }

  return parsed.data.asset;
}

export async function patchAssetInApi(
  id: string,
  input: UpdateAssetInput
): Promise<AssetDetailResponse["asset"]> {
  const parsedInput = UpdateAssetInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid update payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to update asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Patch asset response failed validation");
  }

  return parsed.data.asset;
}

export async function createUploadUrlInApi(
  id: string,
  input: AssetUploadUrlInput
): Promise<AssetUploadUrlResponse> {
  const parsedInput = AssetUploadUrlInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid upload URL payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/upload-url`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to create upload URL for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetUploadUrlResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Upload URL response failed validation");
  }

  return parsed.data;
}

export async function getPlaybackUrlInApi(id: string): Promise<AssetPlaybackUrlResponse> {
  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/playback-url`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playback URL for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetPlaybackUrlResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Playback URL response failed validation");
  }

  return parsed.data;
}

export async function confirmUploadInApi(id: string): Promise<AssetDetailResponse["asset"]> {
  const response = await fetch(
    `${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/upload-complete`,
    {
      method: "POST",
      headers: {
        authorization: await getAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to confirm upload for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Confirm upload response failed validation");
  }

  return parsed.data.asset;
}

export async function deleteAssetInApi(id: string): Promise<AssetDeleteResponse> {
  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error(`Asset ${id} not found`);
  }

  if (!response.ok) {
    throw new Error(`Failed to delete asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDeleteResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Delete asset response failed validation");
  }

  return parsed.data;
}

export async function initMultipartUploadInApi(
  id: string,
  input: MultipartInitInput
): Promise<MultipartInitResponse> {
  const parsedInput = MultipartInitInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid multipart init payload");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/multipart/init`,
    {
      method: "POST",
      headers: {
        authorization: await getAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput.data),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to init multipart upload for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = MultipartInitResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Multipart init response failed validation");
  }

  return parsed.data;
}

export async function signMultipartPartInApi(
  id: string,
  input: MultipartSignInput
): Promise<MultipartSignResponse> {
  const parsedInput = MultipartSignInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid multipart sign payload");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/multipart/sign`,
    {
      method: "POST",
      headers: {
        authorization: await getAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput.data),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to sign multipart part for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = MultipartSignResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Multipart sign response failed validation");
  }

  return parsed.data;
}

export async function completeMultipartUploadInApi(
  id: string,
  input: MultipartCompleteInput
): Promise<AssetDetailResponse["asset"]> {
  const parsedInput = MultipartCompleteInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid multipart complete payload");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/multipart/complete`,
    {
      method: "POST",
      headers: {
        authorization: await getAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput.data),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to complete multipart upload for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Multipart complete response failed validation");
  }

  return parsed.data.asset;
}

export async function abortMultipartUploadInApi(
  id: string,
  input: MultipartAbortInput
): Promise<MultipartAbortResponse> {
  const parsedInput = MultipartAbortInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid multipart abort payload");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/multipart/abort`,
    {
      method: "POST",
      headers: {
        authorization: await getAuthHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput.data),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to abort multipart upload for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = MultipartAbortResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Multipart abort response failed validation");
  }

  return parsed.data;
}
