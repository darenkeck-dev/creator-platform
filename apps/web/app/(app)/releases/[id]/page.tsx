import { notFound } from "next/navigation";

import { ReleaseWorkspace } from "@/components/release-workspace";
import { fetchAssetByIdFromApi, fetchAssetsFromApi } from "@/lib/assets-api";
import {
  getMusicReadinessFromApi,
  getMusicReleaseFromApi,
  listMusicTracksFromApi,
  MusicApiError,
} from "@/lib/music-api";
import { runWithConcurrency } from "@/lib/upload-files";

export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    notFound();
  let release;
  try {
    release = await getMusicReleaseFromApi(id);
  } catch (error) {
    if (error instanceof MusicApiError && error.status === 404) notFound();
    throw error;
  }
  const [catalogTracks, readiness, imageOptions, audioOptions] = await Promise.all([
    listMusicTracksFromApi(),
    getMusicReadinessFromApi("releases", release.id),
    fetchAssetsFromApi({ type: "image", scope: "all", sort: "newest" }),
    fetchAssetsFromApi({ type: "audio", scope: "all", sort: "newest" }),
  ]);
  const trackById = new Map(catalogTracks.map((track) => [track.id, track]));
  const tracks = release.trackIds.flatMap((id) => {
    const track = trackById.get(id);
    return track ? [track] : [];
  });
  const assetIds = [
    ...(release.coverAssetId ? [release.coverAssetId] : []),
    ...tracks.map((track) => track.assetId),
  ];
  const assetResults = await runWithConcurrency(assetIds, 3, fetchAssetByIdFromApi);
  const failedAsset = assetResults.find((result) => !result.ok);
  if (failedAsset && !failedAsset.ok) throw failedAsset.error;
  const assets = assetResults.flatMap((result) =>
    result.ok && result.value ? [result.value] : []
  );
  return (
    <ReleaseWorkspace
      audioOptions={audioOptions}
      catalogTracks={catalogTracks}
      imageOptions={imageOptions}
      initialAssets={assets}
      initialReadiness={readiness}
      initialRelease={release}
      initialTracks={tracks}
    />
  );
}
