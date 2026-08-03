import type { AssetRecord } from "@media-manager/contracts";
import { buildAssetToneVectorRecord, type AssetToneVectorRecord } from "@media-manager/tone-core";

export function assetToneVectorRecordForAsset(asset: AssetRecord): AssetToneVectorRecord | null {
  if (
    (asset.type !== "audio" && asset.type !== "video") ||
    asset.visibility !== "public" ||
    asset.status !== "ready" ||
    asset.toneAnalysis?.status !== "ready" ||
    asset.toneAnalysis.toneTaxonomyVersion !== "tone-taxonomy/v2" ||
    !asset.toneAnalysis.scores
  ) {
    return null;
  }

  try {
    return buildAssetToneVectorRecord({
      assetId: asset.id,
      assetType: asset.type,
      modelScores: asset.toneAnalysis.scores,
      adjustedScores: asset.toneAnalysis.adjustedScores,
      visibility: asset.visibility,
      assetStatus: asset.status,
      toneStatus: asset.toneAnalysis.status,
      updatedAt: asset.updatedAt,
    });
  } catch {
    return null;
  }
}
