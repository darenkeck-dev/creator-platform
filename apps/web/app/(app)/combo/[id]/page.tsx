import type { AssetDetailResponse } from "@media-manager/contracts";
import { notFound } from "next/navigation";

import { ComboPlayer } from "@/components/combo-player";
import { ToneReviewPanel } from "@/components/tone-review-panel";
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
type Asset = AssetDetailResponse["asset"];
type ToneScores = NonNullable<NonNullable<Asset["toneAnalysis"]>["scores"]>;

const TONE_SCORE_KEYS = [
  "valence",
  "arousal",
  "dominance",
  "warmth",
  "tension",
  "intimacy",
  "instability",
  "nostalgia",
  "beauty",
  "menace",
] as const;

function averageToneScores(
  videoScores: ToneScores | undefined,
  audioScores: ToneScores | undefined
) {
  if (!videoScores && !audioScores) {
    return undefined;
  }

  return Object.fromEntries(
    TONE_SCORE_KEYS.flatMap((key) => {
      const values = [videoScores?.[key], audioScores?.[key]].filter(
        (value): value is number => typeof value === "number"
      );
      if (values.length === 0) {
        return [];
      }
      return [[key, values.reduce((sum, value) => sum + value, 0) / values.length]];
    })
  );
}

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

  const videoKeywords = [
    ...(videoAsset.toneAnalysis?.primaryWords ?? []),
    ...(videoAsset.toneAnalysis?.secondaryWords ?? []),
  ];
  const audioKeywords = [
    ...(audioAsset.toneAnalysis?.primaryWords ?? []),
    ...(audioAsset.toneAnalysis?.secondaryWords ?? []),
  ];

  return (
    <div className="space-y-6">
      <ComboPlayer
        audioSrc={audioPlayback.playbackUrl}
        audioTitle={audioAsset.title}
        comboId={combo.id}
        videoSrc={videoPlayback.playbackUrl}
        videoTitle={videoAsset.title}
      />
      <ToneReviewPanel
        description="Submit human tone keywords and scores for the combo or either source asset."
        targets={[
          {
            targetType: "combo",
            targetId: combo.id,
            label: "Combo",
            taxonomyVersion:
              videoAsset.toneAnalysis?.toneTaxonomyVersion ??
              audioAsset.toneAnalysis?.toneTaxonomyVersion,
            initialKeywords: [...new Set([...videoKeywords, ...audioKeywords])],
            initialScores: averageToneScores(
              videoAsset.toneAnalysis?.scores,
              audioAsset.toneAnalysis?.scores
            ),
          },
          {
            targetType: "video",
            targetId: videoAsset.id,
            label: "Video",
            taxonomyVersion: videoAsset.toneAnalysis?.toneTaxonomyVersion,
            initialKeywords: videoKeywords,
            initialScores: videoAsset.toneAnalysis?.scores,
          },
          {
            targetType: "audio",
            targetId: audioAsset.id,
            label: "Audio",
            taxonomyVersion: audioAsset.toneAnalysis?.toneTaxonomyVersion,
            initialKeywords: audioKeywords,
            initialScores: audioAsset.toneAnalysis?.scores,
          },
        ]}
      />
    </div>
  );
}
