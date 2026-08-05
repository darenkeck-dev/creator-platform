// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import {
  TONE_WHEEL_DIMENSIONS,
  toneWheelPoints,
  toneWheelPolygon,
  toneWheelValues,
} from "../src/lib/tone-wheel";

describe("tone wheel", () => {
  it("maps all ten labeled dimensions in canonical order", () => {
    const values = toneWheelValues({
      valence: -1,
      arousal: -0.8,
      dominance: -0.6,
      warmth: -0.4,
      tension: -0.2,
      intimacy: 0,
      instability: 0.2,
      nostalgia: 0.4,
      beauty: 0.6,
      menace: 1,
    });

    expect(TONE_WHEEL_DIMENSIONS).toHaveLength(10);
    expect(values).toEqual([-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 1]);
  });

  it("maps signed values inward and outward from the neutral ring", () => {
    const points = toneWheelPoints([-1, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    const radii = points.map(({ x, y }) => Math.hypot(x - 12, y - 12));

    expect(radii[0]).toBeCloseTo(2.6);
    expect(radii[1]).toBeCloseTo(5.8);
    expect(radii[2]).toBeCloseTo(9);
    expect(toneWheelPolygon(points).split(" ")).toHaveLength(10);
  });

  it("rejects incomplete wheel values", () => {
    expect(() => toneWheelPoints([0, 1])).toThrow("Tone wheel requires 10 values");
  });
});
