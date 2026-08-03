import {
  ASSET_TONE_VECTOR_DIMENSIONS,
  AssetToneVectorValuesSchema,
  type AssetToneVectorValues,
} from "./asset-vector.js";
import { reviewKeywordsToToneScores } from "./review-keywords.js";
import { TONE_TAXONOMY_VERSION, type ToneDimension, type ToneVector } from "./schemas.js";

export type ToneQuery = {
  values: Partial<ToneVector>;
  dimensions: ToneDimension[];
  taxonomyVersion: typeof TONE_TAXONOMY_VERSION;
};

export type ToneQueryCandidate<T> = {
  candidate: T;
  predictedTone: AssetToneVectorValues;
};

export type RankedToneQueryCandidate<T> = ToneQueryCandidate<T> & {
  distance: number;
};

export function reviewWordsToToneQuery(words: string[]): ToneQuery | null {
  const values = reviewKeywordsToToneScores(words);
  const dimensions = ASSET_TONE_VECTOR_DIMENSIONS.filter(
    (dimension) => values[dimension] !== undefined
  );
  if (dimensions.length === 0) {
    return null;
  }

  return {
    values,
    dimensions,
    taxonomyVersion: TONE_TAXONOMY_VERSION,
  };
}

export function toneQueryRetrievalVector(query: ToneQuery): AssetToneVectorValues {
  return AssetToneVectorValuesSchema.parse(
    ASSET_TONE_VECTOR_DIMENSIONS.map((dimension) => query.values[dimension] ?? 0)
  );
}

export function complementaryToneQueryVector(
  query: ToneQuery,
  source: AssetToneVectorValues,
  sourceWeight: number,
  targetWeight: number
): AssetToneVectorValues {
  const sourceTone = AssetToneVectorValuesSchema.parse(source);
  return AssetToneVectorValuesSchema.parse(
    ASSET_TONE_VECTOR_DIMENSIONS.map((dimension, index) => {
      const queryValue = query.values[dimension];
      if (queryValue === undefined) {
        return 0;
      }
      return Math.max(
        -1,
        Math.min(1, (queryValue - sourceWeight * (sourceTone[index] as number)) / targetWeight)
      );
    })
  );
}

export function maskedToneQueryDistance(
  query: ToneQuery,
  candidate: AssetToneVectorValues
): number {
  const tone = AssetToneVectorValuesSchema.parse(candidate);
  return query.dimensions.reduce((total, dimension) => {
    const index = ASSET_TONE_VECTOR_DIMENSIONS.indexOf(dimension);
    const delta = (query.values[dimension] as number) - (tone[index] as number);
    return total + delta * delta;
  }, 0);
}

export function rankToneQueryCandidates<T>(
  query: ToneQuery,
  candidates: Array<ToneQueryCandidate<T>>
): Array<RankedToneQueryCandidate<T>> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      distance: maskedToneQueryDistance(query, candidate.predictedTone),
    }))
    .sort((left, right) => left.distance - right.distance);
}
