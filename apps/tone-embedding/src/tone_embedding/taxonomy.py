from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


TONE_TAXONOMY_VERSION = "tone-taxonomy/v1"
TAXONOMY_DIR = Path(__file__).resolve().parent / "taxonomies"


@lru_cache(maxsize=1)
def load_tone_taxonomy() -> dict[str, Any]:
    path = TAXONOMY_DIR / "tone-taxonomy.v1.json"
    with path.open("r", encoding="utf-8") as file:
        taxonomy = json.load(file)
    validate_tone_taxonomy(taxonomy)
    return taxonomy


def validate_tone_taxonomy(taxonomy: dict[str, Any]) -> None:
    if taxonomy.get("schemaVersion") != TONE_TAXONOMY_VERSION:
        raise ValueError(f"unsupported tone taxonomy version: {taxonomy.get('schemaVersion')}")
    if not isinstance(taxonomy.get("dimensions"), list) or not taxonomy["dimensions"]:
        raise ValueError("tone taxonomy dimensions must be a non-empty array")
    if not isinstance(taxonomy.get("toneDimensions"), list) or not taxonomy["toneDimensions"]:
        raise ValueError("tone taxonomy toneDimensions must be a non-empty array")
    if not isinstance(taxonomy.get("descriptors"), list) or not taxonomy["descriptors"]:
        raise ValueError("tone taxonomy descriptors must be a non-empty array")
    if not isinstance(taxonomy.get("strengthScale"), dict):
        raise ValueError("tone taxonomy strengthScale must be an object")
    if not isinstance(taxonomy.get("avoidRules"), dict):
        raise ValueError("tone taxonomy avoidRules must be an object")
    dimension_ids = {str(dimension["id"]) for dimension in taxonomy["dimensions"]}
    vector_dimensions = {str(dimension) for dimension in taxonomy["toneDimensions"]}
    if dimension_ids != vector_dimensions:
        raise ValueError("tone taxonomy dimensions and toneDimensions must contain the same ids")


def taxonomy_dimensions(taxonomy: dict[str, Any] | None = None) -> tuple[str, ...]:
    taxonomy = taxonomy or load_tone_taxonomy()
    return tuple(str(dimension) for dimension in taxonomy["toneDimensions"])


def descriptor_rules(taxonomy: dict[str, Any] | None = None) -> tuple[tuple[str, float, str, str], ...]:
    taxonomy = taxonomy or load_tone_taxonomy()
    return tuple(
        (
            str(dimension["id"]),
            float(dimension["descriptorThreshold"]),
            str(dimension["positiveDescriptor"]),
            str(dimension["negativeDescriptor"]),
        )
        for dimension in taxonomy["dimensions"]
    )


def strength_scores(taxonomy: dict[str, Any] | None = None) -> dict[str, float]:
    taxonomy = taxonomy or load_tone_taxonomy()
    return {str(name): float(value) for name, value in taxonomy["strengthScale"].items()}


def avoid_rules(taxonomy: dict[str, Any] | None = None) -> dict[str, str]:
    taxonomy = taxonomy or load_tone_taxonomy()
    return {str(name): str(value) for name, value in taxonomy["avoidRules"].items()}


def descriptor_to_score(taxonomy: dict[str, Any] | None = None) -> dict[str, tuple[str, float]]:
    return {
        positive_word: (dimension, 1.0)
        for dimension, _, positive_word, _ in descriptor_rules(taxonomy)
    } | {
        negative_word: (dimension, -1.0)
        for dimension, _, _, negative_word in descriptor_rules(taxonomy)
    }


def upgrade_tone_taxonomy(payload: dict[str, Any], target_version: str) -> dict[str, Any]:
    raise NotImplementedError(f"tone taxonomy upgrade to {target_version} is not implemented")


def downgrade_tone_taxonomy(payload: dict[str, Any], target_version: str) -> dict[str, Any]:
    raise NotImplementedError(f"tone taxonomy downgrade to {target_version} is not implemented")
