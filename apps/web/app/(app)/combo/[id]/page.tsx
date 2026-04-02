import { notFound } from "next/navigation";

import { ComboPlayer } from "@/components/combo-player";
import {
  fetchAssetByIdFromApi,
  fetchComboByIdFromApi,
  getPlaybackUrlInApi,
} from "@/lib/assets-api";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ComboDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  let combo;
  try {
    combo = await fetchComboByIdFromApi(id);
  } catch {
    notFound();
  }

  const [videoAsset, audioAsset] = await Promise.all([
    fetchAssetByIdFromApi(combo.videoAssetId),
    fetchAssetByIdFromApi(combo.audioAssetId),
  ]);

  if (!videoAsset || !audioAsset) {
    notFound();
  }

  const [videoPlayback, audioPlayback] = await Promise.all([
    videoAsset.stream?.hlsMasterUrl
      ? Promise.resolve({ playbackUrl: videoAsset.stream.hlsMasterUrl })
      : getPlaybackUrlInApi(videoAsset.id),
    getPlaybackUrlInApi(audioAsset.id),
  ]);

  return (
    <ComboPlayer
      audioSrc={audioPlayback.playbackUrl}
      audioTitle={audioAsset.title}
      comboId={combo.id}
      videoSrc={videoPlayback.playbackUrl}
      videoTitle={videoAsset.title}
    />
  );
}
