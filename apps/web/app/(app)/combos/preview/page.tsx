import { notFound } from "next/navigation";

import { ComboPlayer } from "@/components/combo-player";
import { fetchAssetByIdFromApi, getPlaybackUrlInApi } from "@/lib/assets-api";

type PageProps = {
  searchParams?: Promise<{
    videoAssetId?: string;
    audioAssetId?: string;
  }>;
};

export default async function ComboPreviewPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const videoAssetId = params.videoAssetId?.trim();
  const audioAssetId = params.audioAssetId?.trim();

  if (!videoAssetId || !audioAssetId) {
    notFound();
  }

  const [videoAsset, audioAsset] = await Promise.all([
    fetchAssetByIdFromApi(videoAssetId),
    fetchAssetByIdFromApi(audioAssetId),
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
      videoSrc={videoPlayback.playbackUrl}
      videoTitle={videoAsset.title}
    />
  );
}
