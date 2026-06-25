from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .manifest import MediaManifest, source_to_dict
from .models import (
    EssentiaAudioToneModel,
    ModelRun,
    PlaceholderAudioToneModel,
    PlaceholderVideoToneModel,
    ToneModelAdapter,
)
from .tone import compute_congruence, tone_to_words


def build_asset_tone_rows(
    manifest: MediaManifest,
    audio_model: ToneModelAdapter | None = None,
    video_model: ToneModelAdapter | None = None,
) -> list[dict[str, Any]]:
    audio_model = audio_model or PlaceholderAudioToneModel()
    video_model = video_model or PlaceholderVideoToneModel()
    created_at = datetime.now(UTC).isoformat()
    rows: list[dict[str, Any]] = []

    for asset in manifest.assets:
        model = audio_model if asset.type == "audio" else video_model
        extraction = model.extract(asset)
        rows.append(
            {
                "assetId": asset.id,
                "assetType": asset.type,
                "source": source_to_dict(asset.source),
                "tone": extraction.tone,
                "toneWords": tone_to_words(extraction.tone),
                "rawScores": extraction.raw_scores or {},
                "model": ModelRun.from_adapter(model).to_dict(),
                "createdAt": created_at,
            }
        )

    return rows


def build_training_rows(
    manifest: MediaManifest,
    audio_model: ToneModelAdapter | None = None,
    video_model: ToneModelAdapter | None = None,
) -> list[dict[str, Any]]:
    audio_model = audio_model or PlaceholderAudioToneModel()
    video_model = video_model or PlaceholderVideoToneModel()
    assets = {asset.id: asset for asset in manifest.assets}
    created_at = datetime.now(UTC).isoformat()
    rows: list[dict[str, Any]] = []

    for combo in manifest.combos:
        audio_asset = assets[combo.audio_id]
        video_asset = assets[combo.video_id]
        audio_extraction = audio_model.extract(audio_asset)
        video_extraction = video_model.extract(video_asset)
        audio_tone = audio_extraction.tone
        video_tone = video_extraction.tone

        rows.append(
            {
                "comboId": combo.id,
                "audioId": combo.audio_id,
                "videoId": combo.video_id,
                "audioSource": source_to_dict(audio_asset.source),
                "videoSource": source_to_dict(video_asset.source),
                "audioTone": audio_tone,
                "videoTone": video_tone,
                "audioToneWords": tone_to_words(audio_tone),
                "videoToneWords": tone_to_words(video_tone),
                "audioRawScores": audio_extraction.raw_scores or {},
                "videoRawScores": video_extraction.raw_scores or {},
                "congruence": compute_congruence(audio_tone, video_tone),
                "comboEmbeddingPath": None,
                "models": {
                    "audio": ModelRun.from_adapter(audio_model).to_dict(),
                    "video": ModelRun.from_adapter(video_model).to_dict(),
                },
                "humanLabels": [],
                "createdAt": created_at,
            }
        )

    return rows


def build_audio_model(
    model_name: str,
    essentia_embedding_model: Path | None = None,
    essentia_valence_arousal_model: Path | None = None,
    essentia_output_range: str = "unit",
) -> ToneModelAdapter:
    if model_name == "placeholder":
        return PlaceholderAudioToneModel()
    if model_name == "essentia":
        return EssentiaAudioToneModel(
            embedding_model=essentia_embedding_model,
            valence_arousal_model=essentia_valence_arousal_model,
            output_range=essentia_output_range,
        )

    raise ValueError(f"unsupported audio model {model_name}")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, sort_keys=True) + "\n")
