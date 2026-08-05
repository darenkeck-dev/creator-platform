import type { PublicComboPredictedTone } from "@media-manager/contracts";

export const TONE_WHEEL_DIMENSIONS = [
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
] as const satisfies readonly (keyof PublicComboPredictedTone)[];

const FALLBACK_VALUES = [0.65, -0.3, 0.45, -0.1, 1, 0.55, 0.15, -0.25, 0.95, 0.45];
const CENTER = 12;
const NEUTRAL_RADIUS = 5.8;
const AMPLITUDE_RADIUS = 3.2;

export type ToneWheelPoint = { x: number; y: number };

export function toneWheelValues(tone?: PublicComboPredictedTone): number[] {
  return tone ? TONE_WHEEL_DIMENSIONS.map((dimension) => tone[dimension]) : [...FALLBACK_VALUES];
}

export function toneWheelPoints(values: readonly number[]): ToneWheelPoint[] {
  if (values.length !== TONE_WHEEL_DIMENSIONS.length) {
    throw new Error(`Tone wheel requires ${TONE_WHEEL_DIMENSIONS.length} values`);
  }

  return values.map((value, index) => {
    const boundedValue = Math.max(-1, Math.min(1, value));
    const radius = NEUTRAL_RADIUS + boundedValue * AMPLITUDE_RADIUS;
    const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
    return {
      x: CENTER + Math.cos(angle) * radius,
      y: CENTER + Math.sin(angle) * radius,
    };
  });
}

export function toneWheelPolygon(points: readonly ToneWheelPoint[]): string {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}
