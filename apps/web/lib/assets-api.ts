import {
  AssetDeleteResponseSchema,
  AssetDetailResponseSchema,
  AssetChildrenResponseSchema,
  AssetLineageResponseSchema,
  AssetListResponseSchema,
  CreateAssetInputSchema,
  CreateComboInputSchema,
  MoveAssetInputSchema,
  MoveAssetResponseSchema,
  ComboDeleteResponseSchema,
  ComboDetailResponseSchema,
  ComboListResponseSchema,
  ComboVoteInputSchema,
  ComboVoteByAssetsInputSchema,
  CreateJobInputSchema,
  CreateJobResponseSchema,
  JobDetailResponseSchema,
  JobPreviewInputSchema,
  JobPreviewResponseSchema,
  ToneReviewInputSchema,
  ToneReviewResponseSchema,
  AssetPlaybackUrlResponseSchema,
  MultipartAbortInputSchema,
  MultipartAbortResponseSchema,
  MultipartCompleteInputSchema,
  MultipartInitInputSchema,
  MultipartInitResponseSchema,
  MultipartSignInputSchema,
  MultipartSignResponseSchema,
  PublicRandomComboResponseSchema,
  AssetUploadUrlInputSchema,
  AssetUploadUrlResponseSchema,
  ToneReviewListQuerySchema,
  ToneReviewListResponseSchema,
  UpdateAssetInputSchema,
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
  type AssetChildrenResponse,
  type AssetLineageResponse,
  type AssetListResponse,
  type CreateAssetInput,
  type CreateComboInput,
  type MoveAssetInput,
  type MoveAssetResponse,
  type ComboDeleteResponse,
  type ComboDetailResponse,
  type ComboListResponse,
  type ComboVoteInput,
  type ComboVoteByAssetsInput,
  type CreateJobInput,
  type CreateJobResponse,
  type JobDetailResponse,
  type JobPreviewInput,
  type JobPreviewResponse,
  type PublicRandomComboResponse,
  type ToneReviewListQuery,
  type ToneReviewListResponse,
  type ToneReviewInput,
  type ToneReviewResponse,
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

type AssetListFilters = {
  type?: "video" | "audio" | "image" | "folder";
  origin?: "uploaded" | "generated" | "derived" | "manual";
  facet?: string;
  containerId?: string;
  scope?: "container" | "all";
  sort?: "newest" | "oldest";
};

export async function fetchAssetsFromApi(
  filters: AssetListFilters = {}
): Promise<AssetListResponse["assets"]> {
  const query = new URLSearchParams();
  if (filters.type) {
    query.set("type", filters.type);
  }
  if (filters.facet) {
    query.set("facet", filters.facet);
  }
  if (filters.origin) {
    query.set("origin", filters.origin);
  }
  if (filters.containerId) {
    query.set("containerId", filters.containerId);
  }
  if (filters.scope) {
    query.set("scope", filters.scope);
  }
  if (filters.sort) {
    query.set("sort", filters.sort);
  }

  const queryString = query.toString();
  const url = `${getApiBaseUrl()}/assets${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
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

export async function createAssetInApi(
  input: CreateAssetInput
): Promise<AssetDetailResponse["asset"]> {
  const parsedInput = CreateAssetInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid create asset payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/assets`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
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

  if (response.status === 403) {
    throw new Error(`Forbidden deleting asset ${id}`);
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

export async function previewJobInApi(input: JobPreviewInput): Promise<JobPreviewResponse> {
  const parsedInput = JobPreviewInputSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/jobs/preview`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to preview job: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = JobPreviewResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Job preview response failed validation");
  }
  return parsed.data;
}

export async function createJobInApi(input: CreateJobInput): Promise<CreateJobResponse> {
  const parsedInput = CreateJobInputSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/jobs`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to create job: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = CreateJobResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Create job response failed validation");
  }
  return parsed.data;
}

export async function fetchJobFromApi(id: string): Promise<JobDetailResponse> {
  const response = await fetch(`${getApiBaseUrl()}/jobs/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch job ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = JobDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Job detail response failed validation");
  }
  return parsed.data;
}

export async function submitToneReviewInApi(
  input: ToneReviewInput
): Promise<ToneReviewResponse> {
  const parsedInput = ToneReviewInputSchema.parse(input);
  const response = await fetch(`${getApiBaseUrl()}/tone-reviews`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to submit tone review: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ToneReviewResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Tone review response failed validation");
  }
  return parsed.data;
}

export async function listToneReviewsFromApi(
  input: Partial<ToneReviewListQuery> = {}
): Promise<ToneReviewListResponse> {
  const parsedInput = ToneReviewListQuerySchema.parse(input);
  const query = new URLSearchParams();
  if (parsedInput.targetType) {
    query.set("targetType", parsedInput.targetType);
  }
  if (parsedInput.targetId) {
    query.set("targetId", parsedInput.targetId);
  }
  if (parsedInput.cursor) {
    query.set("cursor", parsedInput.cursor);
  }
  query.set("limit", String(parsedInput.limit));

  const response = await fetch(`${getApiBaseUrl()}/tone-reviews?${query.toString()}`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to list tone reviews: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ToneReviewListResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Tone review list response failed validation");
  }
  return parsed.data;
}

export async function fetchAssetChildrenFromApi(id: string): Promise<AssetChildrenResponse> {
  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/children`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch children for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetChildrenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Asset children response failed validation");
  }

  return parsed.data;
}

export async function fetchAssetLineageFromApi(id: string): Promise<AssetLineageResponse> {
  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/lineage`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lineage for asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetLineageResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Asset lineage response failed validation");
  }

  return parsed.data;
}

export async function moveAssetInApi(
  id: string,
  input: MoveAssetInput
): Promise<MoveAssetResponse> {
  const parsedInput = MoveAssetInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid move asset payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/assets/${encodeURIComponent(id)}/move`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to move asset ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = MoveAssetResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Move asset response failed validation");
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

export async function listCombosFromApi(): Promise<ComboListResponse["combos"]> {
  const response = await fetch(`${getApiBaseUrl()}/combos`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load combos: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ComboListResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Combo list response failed validation");
  }

  return parsed.data.combos;
}

export async function createComboInApi(
  input: CreateComboInput
): Promise<ComboDetailResponse["combo"]> {
  const parsedInput = CreateComboInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid combo payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/combos`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to create combo: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ComboDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Create combo response failed validation");
  }

  return parsed.data.combo;
}

export async function fetchComboByIdFromApi(id: string): Promise<ComboDetailResponse["combo"]> {
  const response = await fetch(`${getApiBaseUrl()}/combos/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error(`Combo ${id} not found`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch combo ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ComboDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Combo response failed validation");
  }

  return parsed.data.combo;
}

export async function voteOnComboInApi(
  id: string,
  input: ComboVoteInput
): Promise<ComboDetailResponse["combo"]> {
  const parsedInput = ComboVoteInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid combo vote payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/combos/${encodeURIComponent(id)}/vote`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to vote on combo ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ComboDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Combo vote response failed validation");
  }

  return parsed.data.combo;
}

export async function voteOnComboByAssetsInApi(
  input: ComboVoteByAssetsInput
): Promise<ComboDetailResponse["combo"]> {
  const parsedInput = ComboVoteByAssetsInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Invalid combo vote-by-assets payload");
  }

  const response = await fetch(`${getApiBaseUrl()}/combos/vote`, {
    method: "POST",
    headers: {
      authorization: await getAuthHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput.data),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to vote on combo pair: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ComboDetailResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Combo pair vote response failed validation");
  }

  return parsed.data.combo;
}

export async function deleteComboInApi(id: string): Promise<ComboDeleteResponse> {
  const response = await fetch(`${getApiBaseUrl()}/combos/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      authorization: await getAuthHeader(),
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error(`Combo ${id} not found`);
  }

  if (!response.ok) {
    throw new Error(`Failed to delete combo ${id}: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = ComboDeleteResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Delete combo response failed validation");
  }

  return parsed.data;
}

export async function fetchRandomPublicComboFromApi(
  previousAudioAssetId?: string
): Promise<PublicRandomComboResponse | null> {
  const query = previousAudioAssetId
    ? `?previousAudioAssetId=${encodeURIComponent(previousAudioAssetId)}`
    : "";
  const response = await fetch(`${getApiBaseUrl()}/public/combos/random${query}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch random combo: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = PublicRandomComboResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Random combo response failed validation");
  }
  return parsed.data;
}

export async function fetchRandomReviewAssetFromApi(
  type: "audio" | "video",
  excludeAssetId?: string
): Promise<AssetDetailResponse["asset"] | null> {
  const assets = (await fetchAssetsFromApi({ type, scope: "all" })).filter((asset) => {
    if (asset.status === "draft" || asset.status === "error") {
      return false;
    }

    if (type === "video") {
      return asset.status === "ready" && Boolean(asset.stream?.hlsMasterUrl);
    }

    return (
      asset.status === "ready" ||
      asset.status === "uploaded" ||
      asset.conversion?.status === "ready" ||
      asset.conversion?.status === "passthrough_ready"
    );
  });
  if (assets.length === 0) {
    return null;
  }

  const candidates = excludeAssetId && assets.length > 1
    ? assets.filter((asset) => asset.id !== excludeAssetId)
    : assets;

  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}
