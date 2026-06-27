from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .manifest import MediaManifest, source_to_dict
from .models import (
    EssentiaAudioToneModel,
    DinoV2VideoEmbeddingModel,
    ModelRun,
    OpenAIAudioToneModel,
    OpenAIVideoToneModel,
    OpenClipVideoToneModel,
    PlaceholderAudioToneModel,
    PlaceholderVideoToneModel,
    QwenVLVideoToneModel,
    SiglipVideoToneModel,
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
        model_run = ModelRun.from_adapter(model).to_dict()
        parameters = model_parameters(model, extraction)
        row = {
            "assetId": asset.id,
            "assetType": asset.type,
            "source": source_to_dict(asset.source),
            "modelRuns": [],
            "createdAt": created_at,
        }

        if extraction.kind == "tone":
            if extraction.tone is None:
                raise RuntimeError(f"tone model {model.name} did not return tone values")
            tone_words = tone_to_words(extraction.tone)
            row["tone"] = {
                "value": extraction.tone,
                "words": tone_words,
                "contributors": [model.name],
            }
            model_run_row = {
                "kind": "tone",
                "model": model_run,
                "parameters": parameters,
                "tone": extraction.tone,
                "toneWords": tone_words,
                "rawScores": extraction.raw_scores or {},
            }
            if extraction.metadata:
                model_run_row["metadata"] = extraction.metadata
            row["modelRuns"].append(model_run_row)
        elif extraction.kind == "embedding":
            if extraction.embedding_path is None:
                raise RuntimeError(f"embedding model {model.name} did not return an embedding path")
            embedding = embedding_metadata(model.name, extraction.embedding_path, extraction.raw_scores or {})
            row["embeddings"] = {embedding["kind"]: embedding}
            row["modelRuns"].append(
                {
                    "kind": "embedding",
                    "model": model_run,
                    "parameters": parameters,
                    "embedding": embedding,
                    "rawScores": extraction.raw_scores or {},
                }
            )
        else:
            row["modelRuns"].append(
                {
                    "kind": "semantic",
                    "model": model_run,
                    "parameters": parameters,
                    "metadata": extraction.metadata or {},
                    "rawScores": extraction.raw_scores or {},
                }
            )
        rows.append(row)

    return rows


def embedding_metadata(model_name: str, path: str, raw_scores: dict[str, float]) -> dict[str, Any]:
    kind = "dinov2" if model_name.startswith("dinov2/") else model_name
    dimensions = raw_scores.get("embeddingDim")
    output: dict[str, Any] = {
        "kind": kind,
        "path": path,
        "model": model_name,
    }
    if dimensions is not None:
        output["dimensions"] = int(dimensions)
    return output


def model_parameters(model: ToneModelAdapter, extraction: Any) -> dict[str, Any]:
    parameters_method = getattr(model, "parameters", None)
    parameters = parameters_method() if callable(parameters_method) else {}
    raw_scores = extraction.raw_scores or {}
    embedding_dim = raw_scores.get("embeddingDim")
    if embedding_dim is not None:
        parameters = {**parameters, "embeddingDim": int(embedding_dim)}
    return parameters


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
    openai_audio_model: str = "gpt-audio",
    openai_api_key_env: str = "OPENAI_API_KEY",
) -> ToneModelAdapter:
    if model_name == "placeholder":
        return PlaceholderAudioToneModel()
    if model_name == "essentia":
        return EssentiaAudioToneModel(
            embedding_model=essentia_embedding_model,
            valence_arousal_model=essentia_valence_arousal_model,
            output_range=essentia_output_range,
        )
    if model_name == "openai":
        return OpenAIAudioToneModel(
            model_name=openai_audio_model,
            api_key_env=openai_api_key_env,
        )

    raise ValueError(f"unsupported audio model {model_name}")


def build_video_model(
    model_name: str,
    openclip_model: str = "ViT-B-32",
    openclip_pretrained: str = "laion2b_s34b_b79k",
    openai_model: str = "gpt-5",
    openai_api_key_env: str = "OPENAI_API_KEY",
    openai_image_detail: str = "low",
    siglip_model: str = "google/siglip-base-patch16-224",
    qwen_model: str = "Qwen/Qwen2.5-VL-7B-Instruct",
    qwen_max_new_tokens: int = 512,
    qwen_torch_dtype: str = "auto",
    qwen_device_map: str = "auto",
    dinov2_model: str = "facebook/dinov2-small",
    embedding_dir: Path | None = None,
    video_frame_rate: float = 1.0,
    video_max_frames: int = 12,
) -> ToneModelAdapter:
    if model_name == "placeholder":
        return PlaceholderVideoToneModel()
    if model_name == "openclip":
        return OpenClipVideoToneModel(
            model_name=openclip_model,
            pretrained=openclip_pretrained,
            frame_rate=video_frame_rate,
            max_frames=video_max_frames,
        )
    if model_name == "openai":
        return OpenAIVideoToneModel(
            model_name=openai_model,
            api_key_env=openai_api_key_env,
            frame_rate=video_frame_rate,
            max_frames=video_max_frames,
            image_detail=openai_image_detail,
        )
    if model_name == "siglip":
        return SiglipVideoToneModel(
            model_name=siglip_model,
            frame_rate=video_frame_rate,
            max_frames=video_max_frames,
        )
    if model_name == "qwen-vl":
        return QwenVLVideoToneModel(
            model_name=qwen_model,
            frame_rate=video_frame_rate,
            max_frames=video_max_frames,
            max_new_tokens=qwen_max_new_tokens,
            torch_dtype=qwen_torch_dtype,
            device_map=qwen_device_map,
        )
    if model_name == "dinov2":
        return DinoV2VideoEmbeddingModel(
            model_name=dinov2_model,
            frame_rate=video_frame_rate,
            max_frames=video_max_frames,
            embedding_dir=embedding_dir,
        )

    raise ValueError(f"unsupported video model {model_name}")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, sort_keys=True) + "\n")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            row = json.loads(stripped)
            if not isinstance(row, dict):
                raise RuntimeError(f"JSONL row {line_number} in {path} must be an object")
            rows.append(row)
    return rows
