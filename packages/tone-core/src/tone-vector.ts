import {
  StructuredToneDescriptorSchema,
  type StructuredToneDescriptor,
  type ToneVector,
} from "./schemas.js";
import {
  avoidRules,
  descriptorMappings,
  descriptorRules,
  strengthScores,
  toneDimensions,
} from "./taxonomy.js";

export function emptyToneVector(): ToneVector {
  return Object.fromEntries(toneDimensions().map((dimension) => [dimension, 0])) as ToneVector;
}

export function normalizedTone(tone: Partial<Record<keyof ToneVector, number>>): ToneVector {
  return Object.fromEntries(
    toneDimensions().map((dimension) => [
      dimension,
      round(clamp(Number(tone[dimension] ?? 0), -1, 1)),
    ])
  ) as ToneVector;
}

export function structuredDescriptorsToTone(descriptors: StructuredToneDescriptor[]): ToneVector {
  const tone = emptyToneVector();
  const scores = strengthScores();
  const descriptorScores = descriptorMappings();

  for (const rawDescriptor of descriptors) {
    const descriptor = StructuredToneDescriptorSchema.parse(rawDescriptor);
    const strength = descriptor.strength ?? descriptor.strengthLabel ?? "none";
    const magnitude =
      descriptor.strengthValue === undefined
        ? scores[strength]
        : clamp(Number(descriptor.strengthValue), 0, 1);
    if (magnitude === undefined) {
      throw new Error(`Unsupported descriptor strength: ${strength}`);
    }

    const mappings = descriptorScores[descriptor.descriptor];
    if (!mappings) {
      throw new Error(`Unsupported tone descriptor: ${descriptor.descriptor}`);
    }

    for (const mapping of mappings) {
      tone[mapping.dimension] = round((tone[mapping.dimension] ?? 0) + magnitude * mapping.weight);
    }
  }

  return normalizedTone(tone);
}

export function toneToWords(tone: ToneVector): {
  summary: string;
  primary: string[];
  secondary: string[];
  avoid: string[];
} {
  const descriptors: Array<{ strength: number; word: string }> = [];
  for (const rule of descriptorRules()) {
    const value = tone[rule.dimension] ?? 0;
    if (Math.abs(value) >= rule.threshold) {
      descriptors.push({
        strength: Math.abs(value),
        word: value > 0 ? rule.positiveDescriptor : rule.negativeDescriptor,
      });
    }
  }

  descriptors.sort((a, b) => b.strength - a.strength);
  const rankedWords = unique(descriptors.map((descriptor) => descriptor.word));
  let primary = rankedWords.slice(0, 3);
  let secondary = rankedWords.slice(3, 8);

  if (primary.length === 0) {
    primary = ["neutral", "balanced"];
    secondary = ["ambiguous"];
  }

  const avoidMap = avoidRules();
  const avoid = unique([...primary, ...secondary].flatMap((word) => avoidMap[word] ?? [])).filter(
    (word) => !primary.includes(word) && !secondary.includes(word)
  );

  return {
    summary: summarizeDescriptors(primary, secondary),
    primary,
    secondary,
    avoid,
  };
}

export function computeCongruence(audioTone: ToneVector, videoTone: ToneVector): number {
  const dimensions = toneDimensions();
  const dot = dimensions.reduce(
    (sum, dimension) => sum + (audioTone[dimension] ?? 0) * (videoTone[dimension] ?? 0),
    0
  );
  const audioNorm = Math.sqrt(
    dimensions.reduce((sum, dimension) => sum + (audioTone[dimension] ?? 0) ** 2, 0)
  );
  const videoNorm = Math.sqrt(
    dimensions.reduce((sum, dimension) => sum + (videoTone[dimension] ?? 0) ** 2, 0)
  );
  if (audioNorm === 0 || videoNorm === 0) {
    return 0;
  }
  return round(dot / (audioNorm * videoNorm));
}

export function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function summarizeDescriptors(primary: string[], secondary: string[]): string {
  const words = primary.slice(0, 3).length > 0 ? primary.slice(0, 3) : secondary.slice(0, 3);
  if (words.length === 0) {
    return "No clear tone descriptors.";
  }
  return `A ${words.join(", ")} tone.`;
}

function unique(words: string[]): string[] {
  return [...new Set(words)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
