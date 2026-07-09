import {
  COMBO_ANALYSIS_SCHEMA_VERSION,
  TONE_TAXONOMY_VERSION,
  type AssetAnalysis,
  type ComboAnalysis,
  type ComboFeatures,
  type ToneVector,
} from "./schemas.js";
import { toneDimensions } from "./taxonomy.js";
import { computeCongruence, normalizedTone, round } from "./tone-vector.js";

export const COMBO_VECTOR_BLOCKS = {
  audioTone: 0.15,
  videoTone: 0.15,
  deltaTone: 0.35,
  absDeltaTone: 0.25,
  interactionTone: 0.1,
} as const;

export function computeComboFeatures(audioTone: ToneVector, videoTone: ToneVector): ComboFeatures {
  const normalizedAudio = normalizedTone(audioTone);
  const normalizedVideo = normalizedTone(videoTone);
  const deltaTone = mapTone(
    (dimension) => (normalizedVideo[dimension] ?? 0) - (normalizedAudio[dimension] ?? 0)
  );
  const absDeltaTone = mapTone((dimension) => Math.abs(abs(deltaTone, dimension)));
  const interactionTone = mapTone(
    (dimension) => (normalizedAudio[dimension] ?? 0) * (normalizedVideo[dimension] ?? 0)
  );

  return {
    audioTone: normalizedAudio,
    videoTone: normalizedVideo,
    deltaTone,
    absDeltaTone,
    interactionTone,
    congruence: computeCongruence(normalizedAudio, normalizedVideo),
    contrast: round(mean(Object.values(absDeltaTone)) / 2),
    intensity: mean([
      ...toneDimensions().map((dimension) => Math.abs(abs(normalizedAudio, dimension))),
      ...toneDimensions().map((dimension) => Math.abs(abs(normalizedVideo, dimension))),
    ]),
    strongestMatches: strongestMatches(normalizedAudio, normalizedVideo, absDeltaTone),
    strongestContrasts: strongestContrasts(absDeltaTone),
  };
}

export function comboNearestNeighborVector(features: ComboFeatures): number[] {
  const vector: number[] = [];
  for (const [block, weight] of Object.entries(COMBO_VECTOR_BLOCKS) as Array<
    [keyof typeof COMBO_VECTOR_BLOCKS, number]
  >) {
    const tone = features[block] as ToneVector;
    vector.push(...toneDimensions().map((dimension) => round(abs(tone, dimension) * weight)));
  }
  return vector;
}

export function comboVectorLayout(): Record<string, unknown> {
  return {
    description: "Computed relationship geometry only; not a quality or meaning score.",
    dimensions: toneDimensions(),
    blocks: Object.entries(COMBO_VECTOR_BLOCKS).map(([name, weight]) => ({
      name,
      weight,
      dimensions: toneDimensions(),
    })),
  };
}

export function buildComboAnalysis(input: {
  comboId: string;
  audioAnalysis: AssetAnalysis;
  videoAnalysis: AssetAnalysis;
  audioTitle?: string;
  videoTitle?: string;
  createdAt?: string;
}): ComboAnalysis {
  if (!input.audioAnalysis.tone?.value) {
    throw new Error(`Audio analysis ${input.audioAnalysis.assetId} does not contain tone.value`);
  }
  if (!input.videoAnalysis.tone?.value) {
    throw new Error(`Video analysis ${input.videoAnalysis.assetId} does not contain tone.value`);
  }

  const features = computeComboFeatures(
    input.audioAnalysis.tone.value,
    input.videoAnalysis.tone.value
  );
  return {
    schemaVersion: COMBO_ANALYSIS_SCHEMA_VERSION,
    comboId: input.comboId,
    audioAssetId: input.audioAnalysis.assetId,
    videoAssetId: input.videoAnalysis.assetId,
    toneTaxonomyVersion: TONE_TAXONOMY_VERSION,
    audioTitle: input.audioTitle,
    videoTitle: input.videoTitle,
    features,
    nearestNeighborVector: comboNearestNeighborVector(features),
    vectorLayout: comboVectorLayout(),
    sourceAnalyses: {
      audio: sourceAnalysisSummary(input.audioAnalysis),
      video: sourceAnalysisSummary(input.videoAnalysis),
    },
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function strongestMatches(
  audioTone: ToneVector,
  videoTone: ToneVector,
  absDeltaTone: ToneVector
): string[] {
  const matches: Array<{ strength: number; dimension: string }> = [];
  for (const dimension of toneDimensions()) {
    if (abs(absDeltaTone, dimension) > 0.25) {
      continue;
    }
    if (abs(audioTone, dimension) === 0 || abs(videoTone, dimension) === 0) {
      continue;
    }
    if (abs(audioTone, dimension) > 0 !== abs(videoTone, dimension) > 0) {
      continue;
    }
    const strength =
      (Math.abs(abs(audioTone, dimension)) + Math.abs(abs(videoTone, dimension))) / 2;
    if (strength >= 0.25) {
      matches.push({ strength, dimension });
    }
  }
  matches.sort((a, b) => b.strength - a.strength);
  return matches.slice(0, 5).map((match) => match.dimension);
}

function strongestContrasts(absDeltaTone: ToneVector): string[] {
  return Object.entries(absDeltaTone)
    .filter(([, value]) => value >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dimension]) => dimension);
}

function sourceAnalysisSummary(row: AssetAnalysis): Record<string, unknown> {
  return {
    assetId: row.assetId,
    contributors: row.tone?.contributors ?? [],
    modelRunCount: row.modelRuns.length,
  };
}

function mapTone(callback: (dimension: keyof ToneVector) => number): ToneVector {
  return Object.fromEntries(
    toneDimensions().map((dimension) => [dimension, round(callback(dimension))])
  ) as ToneVector;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function abs(tone: ToneVector, dimension: keyof ToneVector): number {
  return tone[dimension] ?? 0;
}
