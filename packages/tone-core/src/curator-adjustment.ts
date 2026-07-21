import type { ToneVector } from "./schemas.js";
import { toneDimensions } from "./taxonomy.js";
import { round } from "./tone-vector.js";

export type PartialToneVector = Partial<ToneVector>;

export type CuratorScoreAdjustmentDimension = {
  curatorScoreSum: number;
  curatorReviewCount: number;
};

export type CuratorScoreAdjustment = {
  adjustedScores: PartialToneVector;
  curatorReviewCount: number;
  dimensions: Partial<Record<keyof ToneVector, CuratorScoreAdjustmentDimension>>;
};

export function combineModelAndCuratorScores(
  modelScores: PartialToneVector,
  curatorScores: PartialToneVector[]
): CuratorScoreAdjustment {
  const adjustedScores: PartialToneVector = {};
  const dimensions: CuratorScoreAdjustment["dimensions"] = {};
  let curatorReviewCount = 0;

  for (const reviewScores of curatorScores) {
    if (toneDimensions().some((dimension) => typeof reviewScores[dimension] === "number")) {
      curatorReviewCount += 1;
    }
  }

  for (const dimension of toneDimensions()) {
    const modelScore = modelScores[dimension];
    if (typeof modelScore !== "number") {
      continue;
    }

    const values = curatorScores.flatMap((scores) => {
      const value = scores[dimension];
      return typeof value === "number" ? [clamp(value)] : [];
    });
    if (values.length === 0) {
      continue;
    }

    const curatorScoreSum = round(values.reduce((sum, value) => sum + value, 0));
    dimensions[dimension] = {
      curatorScoreSum,
      curatorReviewCount: values.length,
    };
    adjustedScores[dimension] = round(
      clamp((clamp(modelScore) + curatorScoreSum) / (1 + values.length))
    );
  }

  return { adjustedScores, curatorReviewCount, dimensions };
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
