from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


AssetType = Literal["audio", "video"]
SourceKind = Literal["file", "s3"]


@dataclass(frozen=True)
class FileSource:
    kind: Literal["file"]
    path: Path


@dataclass(frozen=True)
class S3Source:
    kind: Literal["s3"]
    bucket: str
    key: str
    content_type: str | None = None


AssetSource = FileSource | S3Source


@dataclass(frozen=True)
class MediaAsset:
    id: str
    type: AssetType
    source: AssetSource
    title: str


@dataclass(frozen=True)
class ComboSpec:
    id: str
    audio_id: str
    video_id: str


@dataclass(frozen=True)
class MediaManifest:
    assets: list[MediaAsset]
    combos: list[ComboSpec]


def load_manifest(path: Path) -> MediaManifest:
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    manifest = resolve_file_sources(parse_manifest(payload), path.parent)
    validate_manifest(manifest)
    return manifest


def parse_manifest(payload: Any) -> MediaManifest:
    if not isinstance(payload, dict):
        raise ValueError("manifest must be a JSON object")

    assets_payload = payload.get("assets")
    combos_payload = payload.get("combos")

    if not isinstance(assets_payload, list):
        raise ValueError("manifest.assets must be an array")
    if combos_payload is None:
        combos_payload = []
    if not isinstance(combos_payload, list):
        raise ValueError("manifest.combos must be an array when provided")

    return MediaManifest(
        assets=[parse_asset(asset) for asset in assets_payload],
        combos=[parse_combo(combo) for combo in combos_payload],
    )


def parse_asset(payload: Any) -> MediaAsset:
    if not isinstance(payload, dict):
        raise ValueError("asset must be an object")

    asset_id = require_string(payload, "id")
    asset_type = require_string(payload, "type")
    if asset_type not in ("audio", "video"):
        raise ValueError(f"asset {asset_id} has unsupported type {asset_type}")

    return MediaAsset(
        id=asset_id,
        type=asset_type,
        source=parse_source(payload.get("source")),
        title=require_string(payload, "title"),
    )


def parse_source(payload: Any) -> AssetSource:
    if not isinstance(payload, dict):
        raise ValueError("asset.source must be an object")

    kind = require_string(payload, "kind")
    if kind == "file":
        return FileSource(kind="file", path=Path(require_string(payload, "path")))
    if kind == "s3":
        content_type = payload.get("contentType")
        if content_type is not None and not isinstance(content_type, str):
            raise ValueError("source.contentType must be a string when provided")
        return S3Source(
            kind="s3",
            bucket=require_string(payload, "bucket"),
            key=require_string(payload, "key"),
            content_type=content_type,
        )

    raise ValueError(f"unsupported source kind {kind}")


def parse_combo(payload: Any) -> ComboSpec:
    if not isinstance(payload, dict):
        raise ValueError("combo must be an object")

    return ComboSpec(
        id=require_string(payload, "id"),
        audio_id=require_string(payload, "audioId"),
        video_id=require_string(payload, "videoId"),
    )


def validate_manifest(manifest: MediaManifest) -> None:
    asset_ids: set[str] = set()
    assets_by_id: dict[str, MediaAsset] = {}

    for asset in manifest.assets:
        if asset.id in asset_ids:
            raise ValueError(f"duplicate asset id {asset.id}")
        asset_ids.add(asset.id)
        assets_by_id[asset.id] = asset

    combo_ids: set[str] = set()
    for combo in manifest.combos:
        if combo.id in combo_ids:
            raise ValueError(f"duplicate combo id {combo.id}")
        combo_ids.add(combo.id)

        audio = assets_by_id.get(combo.audio_id)
        video = assets_by_id.get(combo.video_id)
        if audio is None:
            raise ValueError(f"combo {combo.id} references missing audio {combo.audio_id}")
        if video is None:
            raise ValueError(f"combo {combo.id} references missing video {combo.video_id}")
        if audio.type != "audio":
            raise ValueError(f"combo {combo.id} audioId {combo.audio_id} is not audio")
        if video.type != "video":
            raise ValueError(f"combo {combo.id} videoId {combo.video_id} is not video")


def validate_local_files(manifest: MediaManifest) -> None:
    missing: list[str] = []
    for asset in manifest.assets:
        if asset.source.kind == "file" and not asset.source.path.exists():
            missing.append(f"{asset.id}: {asset.source.path}")

    if missing:
        raise ValueError("missing local files: " + ", ".join(missing))


def resolve_file_sources(manifest: MediaManifest, base_dir: Path) -> MediaManifest:
    assets: list[MediaAsset] = []
    for asset in manifest.assets:
        if asset.source.kind == "file" and not asset.source.path.is_absolute():
            source = FileSource(kind="file", path=base_dir / asset.source.path)
            assets.append(
                MediaAsset(id=asset.id, type=asset.type, source=source, title=asset.title)
            )
        else:
            assets.append(asset)

    return MediaManifest(assets=assets, combos=manifest.combos)


def source_to_dict(source: AssetSource) -> dict[str, str]:
    if source.kind == "file":
        return {"kind": "file", "path": str(source.path)}

    output = {"kind": "s3", "bucket": source.bucket, "key": source.key}
    if source.content_type:
        output["contentType"] = source.content_type
    return output


def require_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or value == "":
        raise ValueError(f"{key} must be a non-empty string")
    return value
