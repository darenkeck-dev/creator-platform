import { ToneReviewWorkbench } from "@/components/tone-review-workbench";
import { ReviewHeader } from "@/components/review-header";
import {
  fetchRandomPublicComboFromApi,
  fetchRandomReviewAssetFromApi,
  fetchAssetByIdFromApi,
  getPlaybackUrlInApi,
  listToneReviewsFromApi,
  listCombosFromApi,
} from "@/lib/assets-api";

async function safeFetchAssetById(id: string) {
  try {
    return await fetchAssetByIdFromApi(id);
  } catch {
    return null;
  }
}

type ReviewPageProps = {
  searchParams: Promise<{
    targetType?: "combo" | "audio" | "video";
    comboId?: string;
    reviewsCursor?: string;
    videoAssetId?: string;
    audioAssetId?: string;
    previousTargetId?: string;
    previousAudioAssetId?: string;
  }>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const {
    targetType = "combo",
    comboId,
    reviewsCursor,
    videoAssetId,
    audioAssetId,
    previousTargetId,
    previousAudioAssetId,
  } = await searchParams;
  const combos = await listCombosFromApi();

  const savedCombo = comboId ? combos.find((combo) => combo.id === comboId) : null;
  const randomCombo = targetType === "combo" && !comboId ? await fetchRandomPublicComboFromApi(previousAudioAssetId) : null;

  if (targetType === "audio" || targetType === "video") {
    const asset = await fetchRandomReviewAssetFromApi(targetType, previousTargetId);
    if (!asset) {
      return (
        <section className="space-y-3">
          <ReviewHeader targetType={targetType} />
          <p className="text-sm text-muted-foreground">
            No reviewable {targetType} assets are available yet.
          </p>
        </section>
      );
    }

    const label = targetType === "audio" ? "Audio" : "Video";
    const targetReviews = await listToneReviewsFromApi({
      targetType,
      targetId: asset.id,
      cursor: reviewsCursor,
      limit: 10,
    });

    return (
      <section className="space-y-6">
        <ReviewHeader currentTargetId={asset.id} targetType={targetType} />

        <ToneReviewWorkbench
          key={`${targetType}:${asset.id}`}
          media={{ targetType, asset }}
          targetReviews={targetReviews.reviews.map((review) => ({ review }))}
          target={{
            targetType,
            targetId: asset.id,
            label,
            title: asset.title,
            taxonomyVersion: asset.toneAnalysis?.toneTaxonomyVersion,
          }}
        />
      </section>
    );
  }

  const selectedCombo = savedCombo
    ? {
        id: savedCombo.id,
        videoAssetId: savedCombo.videoAssetId,
        audioAssetId: savedCombo.audioAssetId,
        videoTitle: savedCombo.videoAssetId,
        audioTitle: savedCombo.audioAssetId,
      }
    : comboId && videoAssetId && audioAssetId
        ? {
            id: comboId,
            videoAssetId,
            audioAssetId,
            videoTitle: videoAssetId,
            audioTitle: audioAssetId,
          }
      : randomCombo
        ? {
            id: randomCombo.comboId,
            videoAssetId: randomCombo.videoAssetId,
            audioAssetId: randomCombo.audioAssetId,
            videoTitle: randomCombo.videoTitle,
            audioTitle: randomCombo.audioTitle,
          }
        : null;

  if (!selectedCombo) {
    return (
      <section className="space-y-3">
        <ReviewHeader targetType="combo" />
        <p className="text-sm text-muted-foreground">
          No reviewable combos are available yet.
        </p>
      </section>
    );
  }

  const [videoAsset, audioAsset] = await Promise.all([
    safeFetchAssetById(selectedCombo.videoAssetId),
    safeFetchAssetById(selectedCombo.audioAssetId),
  ]);

  if ((!videoAsset || !audioAsset) && !randomCombo) {
    return (
      <section className="space-y-3">
        <ReviewHeader targetType="combo" />
        <p className="text-sm text-muted-foreground">
          The selected combo references an unavailable source asset.
        </p>
      </section>
    );
  }

  const [videoPlayback, audioPlayback] = randomCombo
    ? [{ playbackUrl: randomCombo.videoSrc }, { playbackUrl: randomCombo.audioSrc }]
    : await Promise.all([
        videoAsset!.stream?.hlsMasterUrl
          ? Promise.resolve({ playbackUrl: videoAsset!.stream.hlsMasterUrl })
          : getPlaybackUrlInApi(videoAsset!.id),
        getPlaybackUrlInApi(audioAsset!.id),
      ]);
  const targetReviews = await listToneReviewsFromApi({
    targetType: "combo",
    targetId: selectedCombo.id,
    cursor: reviewsCursor,
    limit: 10,
  });

  return (
    <section className="space-y-6">
      <ReviewHeader
        currentAudioAssetId={selectedCombo.audioAssetId}
        currentTargetId={selectedCombo.id}
        targetType="combo"
      />

      <ToneReviewWorkbench
        key={`combo:${selectedCombo.id}:${selectedCombo.videoAssetId}:${selectedCombo.audioAssetId}`}
        media={{
          targetType: "combo",
          id: selectedCombo.id,
          videoTitle: videoAsset?.title ?? selectedCombo.videoTitle,
          audioTitle: audioAsset?.title ?? selectedCombo.audioTitle,
          videoSrc: videoPlayback.playbackUrl,
          audioSrc: audioPlayback.playbackUrl,
        }}
        targetReviews={targetReviews.reviews.map((review) => ({ review }))}
        target={{
          targetType: "combo",
          targetId: selectedCombo.id,
          label: "Combo",
          title: `${videoAsset?.title ?? selectedCombo.videoTitle} + ${audioAsset?.title ?? selectedCombo.audioTitle}`,
          taxonomyVersion:
            videoAsset?.toneAnalysis?.toneTaxonomyVersion ??
            audioAsset?.toneAnalysis?.toneTaxonomyVersion,
          sourceVideoAssetId: selectedCombo.videoAssetId,
          sourceAudioAssetId: selectedCombo.audioAssetId,
        }}
      />
    </section>
  );
}
