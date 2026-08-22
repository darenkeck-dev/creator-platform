import {
  CreateMusicReleaseInputSchema,
  CreateMusicTrackInputSchema,
  MusicDeleteResponseSchema,
  MusicPublicationActionInputSchema,
  MusicReadinessResponseSchema,
  MusicReleaseListResponseSchema,
  MusicReleaseResponseSchema,
  MusicTrackListResponseSchema,
  MusicTrackResponseSchema,
  UpdateMusicReleaseInputSchema,
  UpdateMusicTrackInputSchema,
  type CreateMusicReleaseInput,
  type CreateMusicTrackInput,
  type MusicReadinessResponse,
  type MusicReleaseRecord,
  type MusicTrackRecord,
  type UpdateMusicReleaseInput,
  type UpdateMusicTrackInput,
} from "@media-manager/contracts";
import { getApiBaseUrl, getAuthHeader } from "@/lib/assets-api";

type Schema<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: unknown } };
};

export class MusicApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown
  ) {
    super(
      typeof payload === "object" && payload && "message" in payload &&
        typeof payload.message === "string"
        ? payload.message
        : `Music API request failed: ${status}`
    );
  }
}

async function request<T>(
  path: string,
  schema: Schema<T>,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: await getAuthHeader(),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) throw new MusicApiError(response.status, payload);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error(`Music API response failed validation for ${path}`);
  return parsed.data;
}

function parseInput<T>(schema: Schema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new MusicApiError(400, { message: "Invalid request body", issues: parsed.error.issues });
  }
  return parsed.data;
}

export async function listMusicTracksFromApi(): Promise<MusicTrackRecord[]> {
  return (await request("/music/tracks", MusicTrackListResponseSchema)).tracks;
}

export async function createMusicTrackInApi(
  input: CreateMusicTrackInput
): Promise<MusicTrackRecord> {
  const body = parseInput(CreateMusicTrackInputSchema, input);
  return (
    await request("/music/tracks", MusicTrackResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    })
  ).track;
}

export async function getMusicTrackFromApi(id: string): Promise<MusicTrackRecord> {
  return (await request(`/music/tracks/${encodeURIComponent(id)}`, MusicTrackResponseSchema)).track;
}

export async function updateMusicTrackInApi(
  id: string,
  input: UpdateMusicTrackInput
): Promise<MusicTrackRecord> {
  const body = parseInput(UpdateMusicTrackInputSchema, input);
  return (
    await request(`/music/tracks/${encodeURIComponent(id)}`, MusicTrackResponseSchema, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  ).track;
}

export async function listMusicReleasesFromApi(): Promise<MusicReleaseRecord[]> {
  return (await request("/music/releases", MusicReleaseListResponseSchema)).releases;
}

export async function createMusicReleaseInApi(
  input: CreateMusicReleaseInput
): Promise<MusicReleaseRecord> {
  const body = parseInput(CreateMusicReleaseInputSchema, input);
  return (
    await request("/music/releases", MusicReleaseResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    })
  ).release;
}

export async function getMusicReleaseFromApi(id: string): Promise<MusicReleaseRecord> {
  return (
    await request(`/music/releases/${encodeURIComponent(id)}`, MusicReleaseResponseSchema)
  ).release;
}

export async function updateMusicReleaseInApi(
  id: string,
  input: UpdateMusicReleaseInput
): Promise<MusicReleaseRecord> {
  const body = parseInput(UpdateMusicReleaseInputSchema, input);
  return (
    await request(`/music/releases/${encodeURIComponent(id)}`, MusicReleaseResponseSchema, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  ).release;
}

export async function getMusicReadinessFromApi(
  kind: "tracks" | "releases",
  id: string
): Promise<MusicReadinessResponse> {
  return request(
    `/music/${kind}/${encodeURIComponent(id)}/readiness`,
    MusicReadinessResponseSchema
  );
}

export async function proxyMusicRequest(
  method: string,
  segments: string[],
  rawBody?: unknown
): Promise<{ body: unknown; status: number }> {
  const [kind, id, action] = segments;
  if ((kind !== "tracks" && kind !== "releases") || segments.length > 3) {
    throw new MusicApiError(404, { message: "Music route not found" });
  }

  if (!id) {
    if (method === "GET") {
      const body = kind === "tracks" ? await listMusicTracksFromApi() : await listMusicReleasesFromApi();
      return {
        body: {
          schemaVersion: "music-admin-response/v1",
          [kind]: body,
        },
        status: 200,
      };
    }
    if (method === "POST") {
      const record =
        kind === "tracks"
          ? await createMusicTrackInApi(parseInput(CreateMusicTrackInputSchema, rawBody))
          : await createMusicReleaseInApi(parseInput(CreateMusicReleaseInputSchema, rawBody));
      return {
        body: { schemaVersion: "music-admin-response/v1", [kind === "tracks" ? "track" : "release"]: record },
        status: 201,
      };
    }
  }

  if (id && !action && method === "GET") {
    const record =
      kind === "tracks" ? await getMusicTrackFromApi(id) : await getMusicReleaseFromApi(id);
    return {
      body: { schemaVersion: "music-admin-response/v1", [kind === "tracks" ? "track" : "release"]: record },
      status: 200,
    };
  }
  if (id && !action && method === "PATCH") {
    const record =
      kind === "tracks"
        ? await updateMusicTrackInApi(id, parseInput(UpdateMusicTrackInputSchema, rawBody))
        : await updateMusicReleaseInApi(id, parseInput(UpdateMusicReleaseInputSchema, rawBody));
    return {
      body: { schemaVersion: "music-admin-response/v1", [kind === "tracks" ? "track" : "release"]: record },
      status: 200,
    };
  }
  if (id && !action && method === "DELETE") {
    const actionInput = parseInput(MusicPublicationActionInputSchema, rawBody);
    const body = await request(`/music/${kind}/${encodeURIComponent(id)}`, MusicDeleteResponseSchema, {
      method: "DELETE",
      body: JSON.stringify(actionInput),
    });
    return { body, status: 200 };
  }
  if (id && action === "readiness" && method === "GET") {
    return { body: await getMusicReadinessFromApi(kind, id), status: 200 };
  }
  if (id && (action === "publish" || action === "unpublish") && method === "POST") {
    const path = `/music/${kind}/${encodeURIComponent(id)}/${action}`;
    const actionInput = parseInput(MusicPublicationActionInputSchema, rawBody);
    const init = { method: "POST", body: JSON.stringify(actionInput) };
    const body =
      kind === "tracks"
        ? await request(path, MusicTrackResponseSchema, init)
        : await request(path, MusicReleaseResponseSchema, init);
    return { body, status: 200 };
  }
  throw new MusicApiError(405, { message: "Method not allowed" });
}
