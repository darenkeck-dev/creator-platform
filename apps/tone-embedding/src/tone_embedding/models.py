from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .manifest import FileSource, MediaAsset
from .tone import TONE_DIMENSIONS, ToneVector


@dataclass(frozen=True)
class ToneExtraction:
    tone: ToneVector
    embedding_path: str | None = None
    raw_scores: dict[str, float] | None = None


class ToneModelAdapter(Protocol):
    name: str
    version: str
    license: str

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        pass


@dataclass(frozen=True)
class ModelRun:
    name: str
    version: str
    license: str

    @classmethod
    def from_adapter(cls, adapter: ToneModelAdapter) -> "ModelRun":
        return cls(name=adapter.name, version=adapter.version, license=adapter.license)

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "version": self.version, "license": self.license}


class PlaceholderAudioToneModel:
    name = "placeholder/audio-tone"
    version = "0.1.0"
    license = "internal-placeholder"

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        return ToneExtraction(tone=deterministic_tone(asset.id, "audio"))


class PlaceholderVideoToneModel:
    name = "placeholder/video-tone"
    version = "0.1.0"
    license = "internal-placeholder"

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        return ToneExtraction(tone=deterministic_tone(asset.id, "video"))


class EssentiaAudioToneModel:
    name = "essentia/music-tone"
    version = "adapter-0.1.0"
    license = "model-dependent-usually-cc-by-nc-sa-4.0"

    def __init__(
        self,
        embedding_model: Path | None = None,
        valence_arousal_model: Path | None = None,
        output_range: str = "unit",
    ) -> None:
        self.embedding_model = embedding_model
        self.valence_arousal_model = valence_arousal_model
        self.output_range = output_range

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        if not isinstance(asset.source, FileSource):
            raise RuntimeError("Essentia extraction currently requires a local file source")
        if self.embedding_model is None:
            raise RuntimeError("Essentia audio extraction requires --essentia-embedding-model")
        if self.valence_arousal_model is None:
            raise RuntimeError(
                "Essentia audio extraction requires --essentia-valence-arousal-model"
            )
        if not self.embedding_model.exists():
            raise RuntimeError(f"Essentia embedding model not found: {self.embedding_model}")
        if not self.valence_arousal_model.exists():
            raise RuntimeError(f"Essentia valence/arousal model not found: {self.valence_arousal_model}")

        try:
            from essentia.standard import MonoLoader, TensorflowPredictMusiCNN, TensorflowPredict2D
        except ImportError as error:
            raise RuntimeError(
                "Essentia audio extraction requires the essentia-tensorflow package"
            ) from error

        audio = MonoLoader(filename=str(asset.source.path), sampleRate=16000, resampleQuality=4)()

        embedding_model = TensorflowPredictMusiCNN(
            graphFilename=str(self.embedding_model),
            output="model/dense/BiasAdd",
        )
        embeddings = embedding_model(audio)
        predictions = TensorflowPredict2D(
            graphFilename=str(self.valence_arousal_model),
            input="model/Placeholder",
            output="model/Identity",
        )(embeddings)
        raw_valence, raw_arousal = read_valence_arousal_values(predictions)
        valence = normalize_model_score(raw_valence, self.output_range)
        arousal = normalize_model_score(raw_arousal, self.output_range)

        tone = zero_tone()
        tone["valence"] = valence
        tone["arousal"] = arousal
        tone["warmth"] = valence
        tone["tension"] = arousal
        tone["menace"] = round(max(0.0, arousal - valence), 6)
        return ToneExtraction(
            tone=tone,
            raw_scores={"valence": round(raw_valence, 6), "arousal": round(raw_arousal, 6)},
        )


def deterministic_tone(asset_id: str, salt: str) -> ToneVector:
    digest = hashlib.sha256(f"{salt}:{asset_id}".encode("utf-8")).digest()
    return {
        dimension: round((digest[index] / 255) * 2 - 1, 6)
        for index, dimension in enumerate(TONE_DIMENSIONS)
    }


def zero_tone() -> ToneVector:
    return {dimension: 0.0 for dimension in TONE_DIMENSIONS}


def parse_valence_arousal(predictions: object, output_range: str = "unit") -> tuple[float, float]:
    valence, arousal = read_valence_arousal_values(predictions)
    return normalize_model_score(valence, output_range), normalize_model_score(arousal, output_range)


def read_valence_arousal_values(predictions: object) -> tuple[float, float]:
    try:
        values = list(predictions[0])  # type: ignore[index]
    except Exception as error:
        raise RuntimeError("Unexpected Essentia valence/arousal output shape") from error

    if len(values) < 2:
        raise RuntimeError("Essentia valence/arousal output must contain at least two values")

    return float(values[0]), float(values[1])


def normalize_model_score(value: float, output_range: str) -> float:
    if output_range == "unit":
        return round(max(-1.0, min(1.0, value * 2 - 1)), 6)
    if output_range == "bipolar" and -1 <= value <= 1:
        return round(value, 6)
    if output_range == "deam":
        return round(max(-1.0, min(1.0, (value - 5) / 4)), 6)
    return round(max(-1.0, min(1.0, value)), 6)
