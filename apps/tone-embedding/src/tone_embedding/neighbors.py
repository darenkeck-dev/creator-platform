from __future__ import annotations

import math
from typing import Any


def top_k_neighbors(
    query_row: dict[str, Any],
    candidate_rows: list[dict[str, Any]],
    top_k: int = 10,
) -> list[dict[str, Any]]:
    query_vector = require_vector(query_row)
    scored: list[tuple[float, dict[str, Any]]] = []

    for candidate in candidate_rows:
        candidate_vector = require_vector(candidate)
        scored.append((cosine_similarity(query_vector, candidate_vector), candidate))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [neighbor_result(score, row) for score, row in scored[:top_k]]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right):
        raise RuntimeError(f"vector length mismatch: {len(left)} != {len(right)}")

    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return round(dot / (left_norm * right_norm), 6)


def require_vector(row: dict[str, Any]) -> list[float]:
    vector = row.get("nearestNeighborVector")
    if not isinstance(vector, list) or not all(isinstance(value, int | float) for value in vector):
        raise RuntimeError(f"combo row {row.get('comboId')} does not contain nearestNeighborVector")
    return [float(value) for value in vector]


def neighbor_result(score: float, row: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": score,
        "comboId": row.get("comboId"),
        "audioAssetId": row.get("audioAssetId"),
        "videoAssetId": row.get("videoAssetId"),
        "features": row.get("features", {}),
    }
