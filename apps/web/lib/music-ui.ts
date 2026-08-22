import {
  MUSIC_RELEASE_TRACK_LIMIT,
  type AssetRecord,
  type MusicReadinessIssue,
  type MusicTrackRecord,
  type PurchaseLink,
} from "@media-manager/contracts";

export const MUSIC_TRACK_LIMIT = MUSIC_RELEASE_TRACK_LIMIT;

export function remainingTrackCapacity(trackCount: number): number {
  return Math.max(0, MUSIC_TRACK_LIMIT - trackCount);
}

export function canAddTrackCount(trackCount: number, additionalCount: number): boolean {
  return additionalCount >= 0 && additionalCount <= remainingTrackCapacity(trackCount);
}

export function upsertCatalogTrack<T extends { id: string }>(tracks: readonly T[], track: T): T[] {
  return [track, ...tracks.filter((item) => item.id !== track.id)];
}

export function removeCatalogTrack<T extends { id: string }>(tracks: readonly T[], id: string): T[] {
  return tracks.filter((track) => track.id !== id);
}

export function findTrackByAssetId(
  tracks: readonly MusicTrackRecord[],
  assetId: string
): MusicTrackRecord | undefined {
  return tracks.find((track) => track.assetId === assetId);
}

export function mergeAuthoritativeTracks(
  localTracks: readonly MusicTrackRecord[],
  authoritativeTracks: readonly MusicTrackRecord[],
  dirtyTrackIds: ReadonlySet<string>
): MusicTrackRecord[] {
  const authoritativeById = new Map(authoritativeTracks.map((track) => [track.id, track]));
  return localTracks.map((local) => {
    const authoritative = authoritativeById.get(local.id);
    return authoritative && !dirtyTrackIds.has(local.id) ? authoritative : local;
  });
}

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function updatePurchaseLink(
  links: readonly PurchaseLink[],
  index: number,
  field: keyof PurchaseLink,
  value: string
): PurchaseLink[] {
  return links.map((link, linkIndex) =>
    linkIndex === index ? { ...link, [field]: value } : link
  );
}

export function toneWarnings(assets: readonly AssetRecord[]): string[] {
  return assets
    .filter(
      (asset) =>
        asset.type === "audio" &&
        asset.toneAnalysis &&
        asset.toneAnalysis.status !== "ready" &&
        asset.toneAnalysis.status !== "skipped"
    )
    .map(
      (asset) =>
        `${asset.title}: tone analysis is ${asset.toneAnalysis!.status.replaceAll("_", " ")}. This does not block publishing.`
    );
}

export function issuesForEntity(
  issues: readonly MusicReadinessIssue[],
  entityId: string,
  assetId?: string
): MusicReadinessIssue[] {
  return issues.filter(
    (issue) => issue.entityId === entityId || (assetId && issue.entityId === assetId)
  );
}
