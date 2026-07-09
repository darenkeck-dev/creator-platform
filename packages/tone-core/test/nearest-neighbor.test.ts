/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { cosineDistance, cosineSimilarity, topKNearestNeighbors } from "../src/nearest-neighbor.js";

describe("nearest-neighbor helpers", () => {
  it("computes cosine similarity and distance", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineDistance([1, 0], [1, 0])).toBe(0);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns top k neighbors", () => {
    const neighbors = topKNearestNeighbors(
      [1, 0],
      [
        { id: "a", vector: [0, 1] },
        { id: "b", vector: [1, 0] },
      ],
      1
    );

    expect(neighbors.map((neighbor) => neighbor.id)).toEqual(["b"]);
  });
});
