export type NeighborCandidate<T = unknown> = {
  id: string;
  vector: number[];
  item?: T;
};

export type NeighborResult<T = unknown> = NeighborCandidate<T> & {
  similarity: number;
  distance: number;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions differ: ${a.length} vs ${b.length}`);
  }
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const aNorm = Math.sqrt(a.reduce((sum, value) => sum + value ** 2, 0));
  const bNorm = Math.sqrt(b.reduce((sum, value) => sum + value ** 2, 0));
  if (aNorm === 0 || bNorm === 0) {
    return 0;
  }
  return dot / (aNorm * bNorm);
}

export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  if (norm === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / norm);
}

export function topKNearestNeighbors<T>(
  query: number[],
  candidates: Array<NeighborCandidate<T>>,
  k: number
): Array<NeighborResult<T>> {
  return candidates
    .map((candidate) => {
      const similarity = cosineSimilarity(query, candidate.vector);
      return {
        ...candidate,
        similarity,
        distance: 1 - similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
