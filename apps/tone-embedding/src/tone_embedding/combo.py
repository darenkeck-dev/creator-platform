from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from .manifest import MediaManifest
from .tone import TONE_DIMENSIONS, TONE_TAXONOMY_VERSION, ToneVector, compute_congruence


COMBO_VECTOR_BLOCKS = {
    "audioTone": 0.15,
    "videoTone": 0.15,
    "deltaTone": 0.35,
    "absDeltaTone": 0.25,
    "interactionTone": 0.10,
}


def build_combo_analysis_rows(
    manifest: MediaManifest,
    asset_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    assets_by_id = {asset.id: asset for asset in manifest.assets}
    tone_rows_by_id = {row.get("assetId"): row for row in asset_rows}
    created_at = datetime.now(UTC).isoformat()
    rows: list[dict[str, Any]] = []

    for combo in manifest.combos:
        audio_row = require_tone_row(tone_rows_by_id, combo.audio_id)
        video_row = require_tone_row(tone_rows_by_id, combo.video_id)
        audio_tone = audio_row["tone"]["value"]
        video_tone = video_row["tone"]["value"]
        features = compute_combo_features(audio_tone, video_tone)

        rows.append(
            {
                "schemaVersion": "combo-analysis/v1",
                "comboId": combo.id,
                "audioAssetId": combo.audio_id,
                "videoAssetId": combo.video_id,
                "toneTaxonomyVersion": TONE_TAXONOMY_VERSION,
                "audioTitle": assets_by_id[combo.audio_id].title,
                "videoTitle": assets_by_id[combo.video_id].title,
                "features": features,
                "nearestNeighborVector": combo_nearest_neighbor_vector(features),
                "vectorLayout": combo_vector_layout(),
                "sourceAnalyses": {
                    "audio": source_analysis_summary(audio_row),
                    "video": source_analysis_summary(video_row),
                },
                "createdAt": created_at,
            }
        )

    return rows


def compute_combo_features(audio_tone: ToneVector, video_tone: ToneVector) -> dict[str, Any]:
    normalized_audio = normalized_tone(audio_tone)
    normalized_video = normalized_tone(video_tone)
    delta_tone = {
        dimension: round(normalized_video[dimension] - normalized_audio[dimension], 6)
        for dimension in TONE_DIMENSIONS
    }
    abs_delta_tone = {
        dimension: round(abs(delta_tone[dimension]), 6)
        for dimension in TONE_DIMENSIONS
    }
    interaction_tone = {
        dimension: round(normalized_audio[dimension] * normalized_video[dimension], 6)
        for dimension in TONE_DIMENSIONS
    }

    return {
        "audioTone": normalized_audio,
        "videoTone": normalized_video,
        "deltaTone": delta_tone,
        "absDeltaTone": abs_delta_tone,
        "interactionTone": interaction_tone,
        "congruence": compute_congruence(normalized_audio, normalized_video),
        "contrast": mean(abs_delta_tone.values()) / 2,
        "intensity": mean(
            [abs(normalized_audio[dimension]) for dimension in TONE_DIMENSIONS]
            + [abs(normalized_video[dimension]) for dimension in TONE_DIMENSIONS]
        ),
        "strongestMatches": strongest_matches(normalized_audio, normalized_video, abs_delta_tone),
        "strongestContrasts": strongest_contrasts(abs_delta_tone),
    }


def combo_nearest_neighbor_vector(features: dict[str, Any]) -> list[float]:
    vector: list[float] = []
    for block, weight in COMBO_VECTOR_BLOCKS.items():
        tone = features[block]
        vector.extend(round(tone[dimension] * weight, 6) for dimension in TONE_DIMENSIONS)
    return vector


def combo_vector_layout() -> dict[str, Any]:
    return {
        "description": "Computed relationship geometry only; not a quality or meaning score.",
        "dimensions": list(TONE_DIMENSIONS),
        "blocks": [
            {"name": name, "weight": weight, "dimensions": list(TONE_DIMENSIONS)}
            for name, weight in COMBO_VECTOR_BLOCKS.items()
        ],
    }


def normalized_tone(tone: ToneVector) -> ToneVector:
    return {dimension: round(float(tone.get(dimension, 0.0)), 6) for dimension in TONE_DIMENSIONS}


def strongest_matches(
    audio_tone: ToneVector,
    video_tone: ToneVector,
    abs_delta_tone: ToneVector,
) -> list[str]:
    matches: list[tuple[float, str]] = []
    for dimension in TONE_DIMENSIONS:
        if abs_delta_tone[dimension] > 0.25:
            continue
        if audio_tone[dimension] == 0 or video_tone[dimension] == 0:
            continue
        if (audio_tone[dimension] > 0) != (video_tone[dimension] > 0):
            continue
        strength = (abs(audio_tone[dimension]) + abs(video_tone[dimension])) / 2
        if strength >= 0.25:
            matches.append((strength, dimension))

    matches.sort(reverse=True)
    return [dimension for _, dimension in matches[:5]]


def strongest_contrasts(abs_delta_tone: ToneVector) -> list[str]:
    contrasts = [
        (value, dimension)
        for dimension, value in abs_delta_tone.items()
        if value >= 0.5
    ]
    contrasts.sort(reverse=True)
    return [dimension for _, dimension in contrasts[:5]]


def require_tone_row(rows_by_id: dict[Any, dict[str, Any]], asset_id: str) -> dict[str, Any]:
    row = rows_by_id.get(asset_id)
    if row is None:
        raise RuntimeError(f"missing asset analysis row for {asset_id}")
    if not isinstance(row.get("tone"), dict) or not isinstance(row["tone"].get("value"), dict):
        raise RuntimeError(f"asset analysis row for {asset_id} does not contain tone.value")
    return row


def source_analysis_summary(row: dict[str, Any]) -> dict[str, Any]:
    tone = row.get("tone", {})
    return {
        "assetId": row.get("assetId"),
        "contributors": tone.get("contributors", []),
        "modelRunCount": len(row.get("modelRuns", [])),
    }


def mean(values: Any) -> float:
    values_list = list(values)
    if not values_list:
        return 0.0
    return round(sum(values_list) / len(values_list), 6)
