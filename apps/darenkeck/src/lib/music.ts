import {
  PublicMusicCatalogResponseSchema,
  type PublicMusicCatalogResponse,
  type PublicMusicRelease,
} from "@media-manager/contracts";

function getApiBaseUrl(): string | null {
  const raw = import.meta.env.VITE_COMBO_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL;
  if (!raw) return null;
  return import.meta.env.DEV ? "" : raw.replace(/\/$/, "");
}

export async function fetchMusicCatalog(signal?: AbortSignal): Promise<PublicMusicCatalogResponse> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl && !import.meta.env.DEV) {
    throw new Error("Music catalog is unavailable.");
  }

  const response = await fetch(`${apiBaseUrl}/public/music`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Music catalog failed to load (${response.status}).`);
  }

  const parsed = PublicMusicCatalogResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Music catalog returned an invalid response.");
  }
  return parsed.data;
}

export function sortMusicReleases(releases: PublicMusicRelease[]): PublicMusicRelease[] {
  return [...releases].sort(
    (left, right) =>
      right.releaseDate.localeCompare(left.releaseDate) || left.title.localeCompare(right.title)
  );
}

export function formatMusicDuration(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainder = roundedSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function formatMusicReleaseDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
