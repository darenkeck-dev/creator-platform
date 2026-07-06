from __future__ import annotations

import json
from json import JSONDecodeError
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .combo import build_combo_analysis_rows
from .export import build_asset_tone_rows, build_audio_model, build_video_model, read_jsonl
from .manifest import ComboSpec, FileSource, MediaAsset, MediaManifest
from .tone import TONE_TAXONOMY_VERSION


PRIMARY_VIDEO_MODELS = ["openai"]


def build_single_asset_manifest(
    asset_type: str,
    source_path: Path,
    asset_id: str,
    title: str | None = None,
) -> MediaManifest:
    if asset_type not in ("audio", "video"):
        raise ValueError(f"unsupported asset type {asset_type}")

    return MediaManifest(
        assets=[
            MediaAsset(
                id=asset_id,
                type=asset_type,  # type: ignore[arg-type]
                source=FileSource(kind="file", path=source_path.expanduser()),
                title=title or asset_id,
            )
        ],
        combos=[],
    )


def analyze_audio_file(
    source_path: Path,
    asset_id: str,
    title: str | None = None,
    model_name: str = "openai",
    essentia_embedding_model: Path | None = None,
    essentia_valence_arousal_model: Path | None = None,
    essentia_output_range: str = "deam",
    openai_audio_model: str = "gpt-audio",
    openai_api_key_env: str = "OPENAI_API_KEY",
) -> dict[str, Any]:
    manifest = build_single_asset_manifest("audio", source_path, asset_id, title)
    audio_model = build_audio_model(
        model_name,
        essentia_embedding_model=essentia_embedding_model,
        essentia_valence_arousal_model=essentia_valence_arousal_model,
        essentia_output_range=essentia_output_range,
        openai_audio_model=openai_audio_model,
        openai_api_key_env=openai_api_key_env,
    )
    return build_asset_tone_rows(manifest, audio_model=audio_model)[0]


def analyze_video_file(
    source_path: Path,
    asset_id: str,
    title: str | None = None,
    model_names: list[str] | None = None,
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
) -> dict[str, Any]:
    manifest = build_single_asset_manifest("video", source_path, asset_id, title)
    expanded_model_names = expand_video_models(model_names or ["openai"])
    rows: list[dict[str, Any]] = []

    for model_name in expanded_model_names:
        video_model = build_video_model(
            model_name,
            openclip_model=openclip_model,
            openclip_pretrained=openclip_pretrained,
            openai_model=openai_model,
            openai_api_key_env=openai_api_key_env,
            openai_image_detail=openai_image_detail,
            siglip_model=siglip_model,
            qwen_model=qwen_model,
            qwen_max_new_tokens=qwen_max_new_tokens,
            qwen_torch_dtype=qwen_torch_dtype,
            qwen_device_map=qwen_device_map,
            dinov2_model=dinov2_model,
            embedding_dir=embedding_dir,
            video_frame_rate=video_frame_rate,
            video_max_frames=video_max_frames,
        )
        rows.append(build_asset_tone_rows(manifest, video_model=video_model)[0])

    return combine_asset_analysis_rows(rows)[0]


def expand_video_models(model_names: list[str]) -> list[str]:
    expanded: list[str] = []
    for model_name in model_names:
        if model_name == "primary":
            expanded.extend(PRIMARY_VIDEO_MODELS)
        else:
            expanded.append(model_name)
    return expanded


def combine_asset_analysis_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(row["assetId"], []).append(row)

    combined_rows: list[dict[str, Any]] = []
    for asset_id in sorted(grouped):
        asset_rows = grouped[asset_id]
        base = asset_rows[0]
        combined: dict[str, Any] = {
            "schemaVersion": "asset-analysis/v1",
            "assetId": asset_id,
            "assetType": base["assetType"],
            "source": base["source"],
            "toneTaxonomyVersion": base.get("toneTaxonomyVersion") or TONE_TAXONOMY_VERSION,
            "modelRuns": [],
            "createdAt": base.get("createdAt") or datetime.now(UTC).isoformat(),
        }

        embeddings: dict[str, Any] = {}
        for row in asset_rows:
            if "tone" in row and "tone" not in combined:
                combined["tone"] = row["tone"]
            embeddings.update(row.get("embeddings", {}))
            combined["modelRuns"].extend(row.get("modelRuns", []))

        if embeddings:
            combined["embeddings"] = embeddings
        combined_rows.append(combined)

    return combined_rows


def build_combo_analysis_from_files(
    audio_analysis_path: Path,
    video_analysis_path: Path,
    combo_id: str,
    out_audio_asset_id: str | None = None,
    out_video_asset_id: str | None = None,
) -> dict[str, Any]:
    audio_row = read_one_analysis_row(audio_analysis_path, out_audio_asset_id)
    video_row = read_one_analysis_row(video_analysis_path, out_video_asset_id)
    audio_id = audio_row["assetId"]
    video_id = video_row["assetId"]
    manifest = MediaManifest(
        assets=[
            MediaAsset(
                id=audio_id,
                type="audio",
                source=FileSource(kind="file", path=Path(str(audio_row.get("source", {}).get("path", "")))),
                title=str(audio_row.get("title") or audio_id),
            ),
            MediaAsset(
                id=video_id,
                type="video",
                source=FileSource(kind="file", path=Path(str(video_row.get("source", {}).get("path", "")))),
                title=str(video_row.get("title") or video_id),
            ),
        ],
        combos=[ComboSpec(id=combo_id, audio_id=audio_id, video_id=video_id)],
    )
    return build_combo_analysis_rows(manifest, [audio_row, video_row])[0]


def read_analysis_rows(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.startswith("{"):
        try:
            return [json.loads(text)]
        except JSONDecodeError:
            return read_jsonl(path)
    if text.startswith("["):
        try:
            payload = json.loads(text)
        except JSONDecodeError:
            return read_jsonl(path)
        if not isinstance(payload, list):
            raise RuntimeError(f"analysis JSON must be an object or array: {path}")
        return payload
    return read_jsonl(path)


def read_one_analysis_row(path: Path, asset_id: str | None = None) -> dict[str, Any]:
    rows = read_analysis_rows(path)
    if asset_id is not None:
        for row in rows:
            if row.get("assetId") == asset_id:
                return row
        raise RuntimeError(f"missing assetId {asset_id} in {path}")
    if len(rows) != 1:
        raise RuntimeError(f"expected exactly one analysis row in {path}, found {len(rows)}")
    return rows[0]


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
