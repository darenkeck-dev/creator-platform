import { AssetToneVectorValuesSchema, type AssetToneVectorValues } from "./asset-vector.js";

export const COMBO_TONE_PREDICTOR_VERSION = "combo-tone-predictor/v0";
export const COMBO_TONE_SAMPLE_SIZE = 5;

export interface ComboTonePredictor {
  readonly version: typeof COMBO_TONE_PREDICTOR_VERSION;
  predict(input: {
    audioTone: AssetToneVectorValues;
    videoTone: AssetToneVectorValues;
  }): AssetToneVectorValues;
}

export type ComboToneCandidate<T> = {
  candidate: T;
  predictedTone: AssetToneVectorValues;
};

export type RankedComboToneCandidate<T> = ComboToneCandidate<T> & {
  distance: number;
};

export const comboTonePredictorV0: ComboTonePredictor = {
  version: COMBO_TONE_PREDICTOR_VERSION,
  predict({ audioTone, videoTone }) {
    const audio = AssetToneVectorValuesSchema.parse(audioTone);
    const video = AssetToneVectorValuesSchema.parse(videoTone);
    return AssetToneVectorValuesSchema.parse(
      audio.map((value, index) => clamp(value * 0.6 + (video[index] as number) * 0.4))
    );
  },
};

export function squaredEuclideanToneDistance(
  left: AssetToneVectorValues,
  right: AssetToneVectorValues
): number {
  const a = AssetToneVectorValuesSchema.parse(left);
  const b = AssetToneVectorValuesSchema.parse(right);
  return a.reduce((total, value, index) => {
    const delta = value - (b[index] as number);
    return total + delta * delta;
  }, 0);
}

export function rankComboToneCandidates<T>(
  targetTone: AssetToneVectorValues,
  candidates: Array<ComboToneCandidate<T>>
): Array<RankedComboToneCandidate<T>> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      distance: squaredEuclideanToneDistance(targetTone, candidate.predictedTone),
    }))
    .sort((left, right) => left.distance - right.distance);
}

export function sampleNearestComboToneCandidate<T>(
  ranked: Array<RankedComboToneCandidate<T>>,
  random: () => number = Math.random
): RankedComboToneCandidate<T> | null {
  const nearest = ranked.slice(0, COMBO_TONE_SAMPLE_SIZE);
  if (nearest.length === 0) {
    return null;
  }

  const weights = nearest.map(({ distance }) => 1 / (1 + distance));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let sample = Math.min(Math.max(random(), 0), 1 - Number.EPSILON) * totalWeight;

  for (let index = 0; index < nearest.length; index += 1) {
    sample -= weights[index] as number;
    if (sample < 0) {
      return nearest[index] as RankedComboToneCandidate<T>;
    }
  }

  return nearest[nearest.length - 1] as RankedComboToneCandidate<T>;
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
