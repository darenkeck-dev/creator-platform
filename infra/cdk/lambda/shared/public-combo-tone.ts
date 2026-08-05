import {
  PublicComboPredictedToneSchema,
  type AssetRecord,
  type PublicComboPredictedTone,
} from "@media-manager/contracts";
import { ASSET_TONE_VECTOR_DIMENSIONS, comboTonePredictorV0 } from "@media-manager/tone-core";

import { assetToneVectorRecordForAsset } from "./asset-tone-vector";

export function predictPublicComboTone(input: {
  audio: AssetRecord;
  video: AssetRecord;
}): PublicComboPredictedTone | undefined {
  const audioVector = assetToneVectorRecordForAsset(input.audio);
  const videoVector = assetToneVectorRecordForAsset(input.video);
  if (!audioVector || !videoVector) return undefined;

  const predicted = comboTonePredictorV0.predict({
    audioTone: audioVector.effectiveTone,
    videoTone: videoVector.effectiveTone,
  });
  return PublicComboPredictedToneSchema.parse(
    Object.fromEntries(
      ASSET_TONE_VECTOR_DIMENSIONS.map((dimension, index) => [dimension, predicted[index]])
    )
  );
}
