from __future__ import annotations

import json
import tarfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


BUNDLE_SCHEMA = "tone-analysis-bundle/v1"
BUNDLE_ANALYSIS_PATH = "asset-analysis.jsonl"
BUNDLE_MANIFEST_PATH = "manifest.json"


def create_bundle(analysis_path: Path, out_path: Path, asset_id: str | None = None) -> dict[str, Any]:
    rows = read_jsonl(analysis_path)
    if asset_id is not None:
        rows = [row for row in rows if row.get("assetId") == asset_id]
        if not rows:
            raise RuntimeError(f"analysis file has no row for asset {asset_id}")

    bundle_root = analysis_path.parent
    embedding_paths = sorted(collect_embedding_paths(rows))
    manifest = {
        "schema": BUNDLE_SCHEMA,
        "createdAt": datetime.now(UTC).isoformat(),
        "analysisPath": BUNDLE_ANALYSIS_PATH,
        "analysisSchemas": sorted(
            {
                schema
                for row in rows
                if isinstance((schema := row.get("schemaVersion")), str)
            }
        ),
        "assetIds": [row["assetId"] for row in rows],
        "embeddings": embedding_paths,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(out_path, "w:gz") as archive:
        analysis_bytes = "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows).encode("utf-8")
        add_bytes(archive, BUNDLE_ANALYSIS_PATH, analysis_bytes)
        for embedding_path in embedding_paths:
            source = bundle_root / embedding_path
            if not source.is_file():
                raise RuntimeError(f"bundle embedding file not found: {source}")
            archive.add(source, arcname=embedding_path)

        add_bytes(
            archive,
            BUNDLE_MANIFEST_PATH,
            json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8"),
        )

    return manifest


def add_bytes(archive: tarfile.TarFile, arcname: str, content: bytes) -> None:
    import io

    info = tarfile.TarInfo(arcname)
    info.size = len(content)
    info.mtime = int(datetime.now(UTC).timestamp())
    archive.addfile(info, io.BytesIO(content))


def inspect_bundle(bundle_path: Path) -> dict[str, Any]:
    with tarfile.open(bundle_path, "r:gz") as archive:
        manifest_member = archive.extractfile(BUNDLE_MANIFEST_PATH)
        if manifest_member is None:
            raise RuntimeError(f"bundle missing {BUNDLE_MANIFEST_PATH}: {bundle_path}")
        return json.loads(manifest_member.read().decode("utf-8"))


def extract_bundle(bundle_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(bundle_path, "r:gz") as archive:
        archive.extractall(out_dir, filter="data")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            rows.append(json.loads(line))
    return rows


def collect_embedding_paths(rows: list[dict[str, Any]]) -> set[str]:
    paths: set[str] = set()
    for row in rows:
        embeddings = row.get("embeddings")
        if not isinstance(embeddings, dict):
            continue
        for embedding in embeddings.values():
            if not isinstance(embedding, dict):
                continue
            path = embedding.get("path")
            if isinstance(path, str):
                if Path(path).is_absolute() or ".." in Path(path).parts:
                    raise RuntimeError(f"embedding path must be bundle-relative: {path}")
                paths.add(path)
    return paths
