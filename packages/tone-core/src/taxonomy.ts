import taxonomy from "./taxonomies/tone-taxonomy.v2.json" with { type: "json" };
import {
  TONE_TAXONOMY_VERSION,
  ToneDimensionSchema,
  type StructuredToneDescriptor,
  type ToneDimension,
} from "./schemas.js";

type RawTaxonomyDimension = {
  id: string;
  descriptorThreshold: number;
  positiveDescriptor: string;
  negativeDescriptor: string;
};

export type DescriptorMapping = {
  dimension: ToneDimension;
  weight: number;
  confidence?: number;
  basis?: string;
};

type RawTaxonomyDescriptor = {
  slug: string;
  status: string;
  mappings?: Array<{
    dimension: string;
    weight: number;
    confidence?: number;
    basis?: string;
  }>;
};

type RawToneTaxonomy = {
  schemaVersion: string;
  toneDimensions: string[];
  dimensions: RawTaxonomyDimension[];
  descriptors: RawTaxonomyDescriptor[];
  strengthScale: Record<string, number>;
  avoidRules: Record<string, string>;
};

const toneTaxonomy = taxonomy as RawToneTaxonomy;

export function loadToneTaxonomy(): RawToneTaxonomy {
  if (toneTaxonomy.schemaVersion !== TONE_TAXONOMY_VERSION) {
    throw new Error(`Unsupported tone taxonomy version: ${toneTaxonomy.schemaVersion}`);
  }
  return toneTaxonomy;
}

export function toneDimensions(): ToneDimension[] {
  return loadToneTaxonomy().toneDimensions.map((dimension) => ToneDimensionSchema.parse(dimension));
}

export function descriptorRules(): Array<{
  dimension: ToneDimension;
  threshold: number;
  positiveDescriptor: string;
  negativeDescriptor: string;
}> {
  return loadToneTaxonomy().dimensions.map((dimension) => ({
    dimension: ToneDimensionSchema.parse(dimension.id),
    threshold: dimension.descriptorThreshold,
    positiveDescriptor: dimension.positiveDescriptor,
    negativeDescriptor: dimension.negativeDescriptor,
  }));
}

export function strengthScores(): Record<string, number> {
  return loadToneTaxonomy().strengthScale;
}

export function avoidRules(): Record<string, string> {
  return loadToneTaxonomy().avoidRules;
}

export function descriptorMappings(): Record<string, DescriptorMapping[]> {
  const output: Record<string, DescriptorMapping[]> = {};
  for (const descriptor of loadToneTaxonomy().descriptors) {
    if (descriptor.status !== "active" || !descriptor.mappings || descriptor.mappings.length === 0) {
      continue;
    }
    output[descriptor.slug] = descriptor.mappings.map((mapping) => ({
      dimension: ToneDimensionSchema.parse(mapping.dimension),
      weight: mapping.weight,
      confidence: mapping.confidence,
      basis: mapping.basis,
    }));
  }
  return output;
}

export function supportedDescriptors(): string[] {
  return Object.keys(descriptorMappings());
}

export function normalizeDescriptor(
  descriptor: StructuredToneDescriptor
): StructuredToneDescriptor {
  const mappings = descriptorMappings()[descriptor.descriptor];
  if (!mappings) {
    throw new Error(`Unsupported tone descriptor: ${descriptor.descriptor}`);
  }
  if (!descriptor.dimension) {
    return descriptor;
  }
  return {
    ...descriptor,
    mappedDimension: mappings[0]?.dimension,
    modelDimension: descriptor.dimension,
  };
}
