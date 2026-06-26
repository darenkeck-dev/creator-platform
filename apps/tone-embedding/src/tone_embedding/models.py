from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Literal, Protocol

from .manifest import FileSource, MediaAsset
from .tone import TONE_DIMENSIONS, ToneVector


@dataclass(frozen=True)
class ToneExtraction:
    tone: ToneVector | None = None
    embedding_path: str | None = None
    raw_scores: dict[str, float] | None = None
    metadata: dict[str, Any] | None = None
    kind: Literal["tone", "embedding", "semantic"] = "tone"


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


VIDEO_PROMPT_PAIRS = (
    ("valence", "a joyful uplifting visual scene", "a sad bleak visual scene"),
    ("arousal", "an energetic intense visual scene", "a calm still visual scene"),
    ("warmth", "a warm inviting visual atmosphere", "a cold distant visual atmosphere"),
    ("tension", "a tense suspenseful visual scene", "a relaxed peaceful visual scene"),
    ("menace", "a threatening ominous visual scene", "a safe comforting visual scene"),
    ("beauty", "a beautiful aesthetically pleasing visual scene", "an ugly unpleasant visual scene"),
    ("instability", "a chaotic unstable disorienting visual scene", "a stable orderly balanced visual scene"),
    ("intimacy", "an intimate personal close visual scene", "an impersonal distant detached visual scene"),
    ("nostalgia", "a nostalgic memory-like visual scene", "a modern clinical present-day visual scene"),
)
VIDEO_PROMPT_PAIR_VERSION = "video-affect-v1"
SIGLIP_SCORE_TEMPERATURE = 4.0


class OpenClipVideoToneModel:
    name = "openclip/frame-tone"
    version = "adapter-0.1.0"
    license = "model-dependent"

    def __init__(
        self,
        model_name: str = "ViT-B-32",
        pretrained: str = "laion2b_s34b_b79k",
        frame_rate: float = 1.0,
        max_frames: int = 12,
    ) -> None:
        self.model_name = model_name
        self.pretrained = pretrained
        self.frame_rate = frame_rate
        self.max_frames = max_frames
        self._openclip: Any | None = None
        self._torch: Any | None = None
        self._model: Any | None = None
        self._preprocess: Any | None = None
        self._tokenizer: Any | None = None
        self._text_features: dict[str, Any] | None = None

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        if not isinstance(asset.source, FileSource):
            raise RuntimeError("OpenCLIP video extraction currently requires a local file source")
        if not asset.source.path.exists():
            raise RuntimeError(f"video file not found: {asset.source.path}")

        frames = sample_video_frames(asset.source.path, self.frame_rate, self.max_frames)
        if not frames:
            raise RuntimeError(f"no video frames sampled from {asset.source.path}")

        openclip, torch, model, preprocess, tokenizer = self._load_model()
        text_features = self._get_text_features(openclip, torch, model, tokenizer)
        frame_scores: list[dict[str, float]] = []

        with torch.no_grad():
            for frame in frames:
                image = preprocess(frame).unsqueeze(0)
                image_features = model.encode_image(image)
                image_features = normalize_tensor(image_features)
                frame_scores.append(score_video_prompt_pairs(image_features, text_features, torch))

        tone, raw_scores = aggregate_video_prompt_scores(frame_scores)
        return ToneExtraction(tone=tone, raw_scores=raw_scores)

    def parameters(self) -> dict[str, Any]:
        return {
            "openclipModel": self.model_name,
            "openclipPretrained": self.pretrained,
            "frameRate": self.frame_rate,
            "maxFrames": self.max_frames,
            "promptPairVersion": VIDEO_PROMPT_PAIR_VERSION,
        }

    def _load_model(self) -> tuple[Any, Any, Any, Any, Any]:
        if self._model is None or self._preprocess is None or self._tokenizer is None:
            try:
                import open_clip
                import torch
            except ImportError as error:
                raise RuntimeError(
                    "OpenCLIP video extraction requires open_clip_torch and torch"
                ) from error

            model, _, preprocess = open_clip.create_model_and_transforms(
                self.model_name,
                pretrained=self.pretrained,
            )
            model.eval()
            self._openclip = open_clip
            self._torch = torch
            self._model = model
            self._preprocess = preprocess
            self._tokenizer = open_clip.get_tokenizer(self.model_name)

        return self._openclip, self._torch, self._model, self._preprocess, self._tokenizer

    def _get_text_features(self, openclip: Any, torch: Any, model: Any, tokenizer: Any) -> dict[str, Any]:
        if self._text_features is None:
            prompts = [prompt for _, positive, negative in VIDEO_PROMPT_PAIRS for prompt in (positive, negative)]
            with torch.no_grad():
                tokens = tokenizer(prompts)
                features = normalize_tensor(model.encode_text(tokens))

            self._text_features = dict(zip(prompts, features, strict=True))

        return self._text_features


class SiglipVideoToneModel:
    name = "siglip/frame-tone"
    version = "adapter-0.1.0"
    license = "model-dependent-apache-2.0-for-google-siglip"

    def __init__(
        self,
        model_name: str = "google/siglip-base-patch16-224",
        frame_rate: float = 1.0,
        max_frames: int = 12,
    ) -> None:
        self.model_name = model_name
        self.frame_rate = frame_rate
        self.max_frames = max_frames
        self._torch: Any | None = None
        self._processor: Any | None = None
        self._model: Any | None = None

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        if not isinstance(asset.source, FileSource):
            raise RuntimeError("SigLIP video extraction currently requires a local file source")
        if not asset.source.path.exists():
            raise RuntimeError(f"video file not found: {asset.source.path}")

        frames = sample_video_frames(asset.source.path, self.frame_rate, self.max_frames)
        if not frames:
            raise RuntimeError(f"no video frames sampled from {asset.source.path}")

        torch, processor, model = self._load_model()
        prompts = [prompt for _, positive, negative in VIDEO_PROMPT_PAIRS for prompt in (positive, negative)]
        frame_scores: list[dict[str, float]] = []

        with torch.no_grad():
            for frame in frames:
                inputs = processor(text=prompts, images=frame, padding=True, return_tensors="pt")
                outputs = model(**inputs)
                logits = outputs.logits_per_image[0]
                prompt_scores = dict(zip(prompts, logits.tolist(), strict=True))
                frame_scores.append(score_siglip_prompt_pairs(prompt_scores))

        tone, raw_scores = aggregate_video_prompt_scores(frame_scores)
        return ToneExtraction(tone=tone, raw_scores=raw_scores)

    def parameters(self) -> dict[str, Any]:
        return {
            "siglipModel": self.model_name,
            "frameRate": self.frame_rate,
            "maxFrames": self.max_frames,
            "promptPairVersion": VIDEO_PROMPT_PAIR_VERSION,
            "scoreTransform": "tanh-logit-delta",
            "scoreTemperature": SIGLIP_SCORE_TEMPERATURE,
        }

    def _load_model(self) -> tuple[Any, Any, Any]:
        if self._model is None or self._processor is None:
            try:
                import torch
                from transformers import AutoModel, AutoProcessor
            except ImportError as error:
                raise RuntimeError("SigLIP video extraction requires torch and transformers") from error

            self._torch = torch
            self._processor = AutoProcessor.from_pretrained(self.model_name)
            self._model = AutoModel.from_pretrained(self.model_name)
            self._model.eval()

        return self._torch, self._processor, self._model


class QwenVLVideoToneModel:
    name = "qwen-vl/scene-tone"
    version = "adapter-0.1.0"
    license = "model-dependent-apache-2.0-for-qwen2.5-vl"

    def __init__(
        self,
        model_name: str = "Qwen/Qwen2.5-VL-7B-Instruct",
        frame_rate: float = 0.5,
        max_frames: int = 6,
        max_new_tokens: int = 512,
        torch_dtype: str = "auto",
        device_map: str = "auto",
    ) -> None:
        self.model_name = model_name
        self.frame_rate = frame_rate
        self.max_frames = max_frames
        self.max_new_tokens = max_new_tokens
        self.torch_dtype = torch_dtype
        self.device_map = device_map
        self.prompt_version = "video-tone-descriptors-v1"
        self._torch: Any | None = None
        self._processor: Any | None = None
        self._model: Any | None = None

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        if not isinstance(asset.source, FileSource):
            raise RuntimeError("Qwen-VL video extraction currently requires a local file source")
        if not asset.source.path.exists():
            raise RuntimeError(f"video file not found: {asset.source.path}")

        frames = sample_video_frames(asset.source.path, self.frame_rate, self.max_frames)
        if not frames:
            raise RuntimeError(f"no video frames sampled from {asset.source.path}")

        torch, processor, model = self._load_model()
        messages = [
            {
                "role": "user",
                "content": [
                    *({"type": "image", "image": frame} for frame in frames),
                    {"type": "text", "text": qwen_scene_tone_prompt()},
                ],
            }
        ]

        try:
            from qwen_vl_utils import process_vision_info
        except ImportError as error:
            raise RuntimeError("Qwen-VL video extraction requires qwen-vl-utils") from error

        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        if hasattr(model, "device"):
            inputs = inputs.to(model.device)

        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
                do_sample=False,
            )

        input_token_count = inputs.input_ids.shape[1]
        generated_ids = generated_ids[:, input_token_count:]
        response = processor.batch_decode(generated_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]
        metadata = {
            "response": response,
            "targetStructuredSchema": "tone-descriptors/v1",
        }
        return ToneExtraction(kind="semantic", metadata=metadata)

    def parameters(self) -> dict[str, Any]:
        return {
            "qwenModel": self.model_name,
            "frameRate": self.frame_rate,
            "maxFrames": self.max_frames,
            "maxNewTokens": self.max_new_tokens,
            "torchDtype": self.torch_dtype,
            "deviceMap": self.device_map,
            "mkldnnDisabled": True,
            "promptVersion": self.prompt_version,
        }

    def _load_model(self) -> tuple[Any, Any, Any]:
        if self._model is None or self._processor is None:
            try:
                import torch
                from transformers import AutoProcessor
            except ImportError as error:
                raise RuntimeError("Qwen-VL video extraction requires torch and transformers") from error

            if hasattr(torch.backends, "mkldnn"):
                torch.backends.mkldnn.enabled = False
            self._torch = torch
            self._processor = AutoProcessor.from_pretrained(self.model_name)
            torch_dtype: Any = "auto"
            if self.torch_dtype != "auto":
                torch_dtype = getattr(torch, self.torch_dtype)
            device_map: Any = self.device_map
            if self.device_map == "cpu":
                device_map = {"": "cpu"}
            self._model = qwen_model_class().from_pretrained(
                self.model_name,
                torch_dtype=torch_dtype,
                device_map=device_map,
            )
            self._model.eval()

        return self._torch, self._processor, self._model


class DinoV2VideoEmbeddingModel:
    name = "dinov2/frame-embedding"
    version = "adapter-0.1.0"
    license = "model-dependent-apache-2.0-for-facebook-dinov2"

    def __init__(
        self,
        model_name: str = "facebook/dinov2-small",
        frame_rate: float = 1.0,
        max_frames: int = 12,
        embedding_dir: Path | None = None,
    ) -> None:
        self.model_name = model_name
        self.frame_rate = frame_rate
        self.max_frames = max_frames
        self.embedding_dir = embedding_dir
        self._torch: Any | None = None
        self._processor: Any | None = None
        self._model: Any | None = None

    def extract(self, asset: MediaAsset) -> ToneExtraction:
        if not isinstance(asset.source, FileSource):
            raise RuntimeError("DINOv2 video extraction currently requires a local file source")
        if not asset.source.path.exists():
            raise RuntimeError(f"video file not found: {asset.source.path}")

        frames = sample_video_frames(asset.source.path, self.frame_rate, self.max_frames)
        if not frames:
            raise RuntimeError(f"no video frames sampled from {asset.source.path}")

        torch, processor, model = self._load_model()
        inputs = processor(images=frames, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)
            frame_embeddings = getattr(outputs, "pooler_output", None)
            if frame_embeddings is None:
                frame_embeddings = outputs.last_hidden_state[:, 0]
            frame_embeddings = normalize_tensor(frame_embeddings)
            embedding = frame_embeddings.mean(dim=0)
            embedding_norm = float(embedding.norm().item())

        embedding_path = self._write_embedding(asset.id, embedding)
        raw_scores = dino_embedding_stats(frame_embeddings, embedding, embedding_norm)
        return ToneExtraction(
            embedding_path=str(embedding_path) if embedding_path else None,
            raw_scores=raw_scores,
            kind="embedding",
        )

    def parameters(self) -> dict[str, Any]:
        return {
            "dinov2Model": self.model_name,
            "frameRate": self.frame_rate,
            "maxFrames": self.max_frames,
        }

    def _load_model(self) -> tuple[Any, Any, Any]:
        if self._model is None or self._processor is None:
            try:
                import torch
                from transformers import AutoImageProcessor, AutoModel
            except ImportError as error:
                raise RuntimeError(
                    "DINOv2 video extraction requires torch and transformers"
                ) from error

            self._torch = torch
            self._processor = AutoImageProcessor.from_pretrained(self.model_name)
            self._model = AutoModel.from_pretrained(self.model_name)
            self._model.eval()

        return self._torch, self._processor, self._model

    def _write_embedding(self, asset_id: str, embedding: Any) -> Path | None:
        if self.embedding_dir is None:
            return None

        try:
            import numpy as np
        except ImportError as error:
            raise RuntimeError("DINOv2 embedding export requires numpy") from error

        self.embedding_dir.mkdir(parents=True, exist_ok=True)
        path = self.embedding_dir / asset_id / "dinov2.npy"
        path.parent.mkdir(parents=True, exist_ok=True)
        np.save(path, embedding.detach().cpu().numpy())
        return Path("embeddings") / asset_id / "dinov2.npy"


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
        self._embedding_predictor: object | None = None
        self._valence_arousal_predictor: object | None = None

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

        embedding_model = self._get_embedding_predictor(TensorflowPredictMusiCNN)
        embeddings = embedding_model(audio)
        predictions = self._get_valence_arousal_predictor(TensorflowPredict2D)(embeddings)
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

    def parameters(self) -> dict[str, Any]:
        return {
            "embeddingModel": str(self.embedding_model) if self.embedding_model else None,
            "valenceArousalModel": str(self.valence_arousal_model) if self.valence_arousal_model else None,
            "outputRange": self.output_range,
        }

    def _get_embedding_predictor(self, constructor: Callable[..., object]) -> object:
        if self._embedding_predictor is None:
            self._embedding_predictor = constructor(
                graphFilename=str(self.embedding_model),
                output="model/dense/BiasAdd",
            )
        return self._embedding_predictor

    def _get_valence_arousal_predictor(self, constructor: Callable[..., object]) -> object:
        if self._valence_arousal_predictor is None:
            self._valence_arousal_predictor = constructor(
                graphFilename=str(self.valence_arousal_model),
                input="model/Placeholder",
                output="model/Identity",
            )
        return self._valence_arousal_predictor


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


def sample_video_frames(path: Path, frame_rate: float, max_frames: int) -> list[Any]:
    try:
        import cv2
        from PIL import Image
    except ImportError as error:
        raise RuntimeError(
            "OpenCLIP video extraction requires opencv-python-headless and pillow"
        ) from error

    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        return []

    source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    interval = max(1, int(source_fps / max(frame_rate, 0.001)))
    frames: list[Any] = []
    index = 0

    try:
        while len(frames) < max_frames:
            ok, frame = capture.read()
            if not ok:
                break
            if index % interval == 0:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(Image.fromarray(rgb))
            index += 1
    finally:
        capture.release()

    return frames


def normalize_tensor(tensor: Any) -> Any:
    return tensor / tensor.norm(dim=-1, keepdim=True)


def score_video_prompt_pairs(image_features: Any, text_features: dict[str, Any], torch: Any) -> dict[str, float]:
    scores: dict[str, float] = {}
    for dimension, positive, negative in VIDEO_PROMPT_PAIRS:
        positive_score = cosine_similarity(image_features, text_features[positive], torch)
        negative_score = cosine_similarity(image_features, text_features[negative], torch)
        scores[dimension] = clamp_score(positive_score - negative_score)
    return scores


def score_siglip_prompt_pairs(prompt_scores: dict[str, float]) -> dict[str, float]:
    scores: dict[str, float] = {}
    for dimension, positive, negative in VIDEO_PROMPT_PAIRS:
        scores[dimension] = tanh_score(prompt_scores[positive] - prompt_scores[negative], SIGLIP_SCORE_TEMPERATURE)
    return scores


def cosine_similarity(image_features: Any, text_feature: Any, torch: Any) -> float:
    return float(torch.matmul(image_features, text_feature.unsqueeze(-1)).item())


def aggregate_video_prompt_scores(frame_scores: list[dict[str, float]]) -> tuple[ToneVector, dict[str, float]]:
    tone = zero_tone()
    raw_scores: dict[str, float] = {}

    for dimension, _, _ in VIDEO_PROMPT_PAIRS:
        values = [scores[dimension] for scores in frame_scores if dimension in scores]
        if not values:
            continue

        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        tone[dimension] = round(mean, 6)
        raw_scores[f"{dimension}.mean"] = round(mean, 6)
        raw_scores[f"{dimension}.min"] = round(min(values), 6)
        raw_scores[f"{dimension}.max"] = round(max(values), 6)
        raw_scores[f"{dimension}.std"] = round(math.sqrt(variance), 6)

    return tone, raw_scores


def dino_embedding_stats(frame_embeddings: Any, embedding: Any, embedding_norm: float) -> dict[str, float]:
    frame_norms = frame_embeddings.norm(dim=-1)
    return {
        "frameCount": float(frame_embeddings.shape[0]),
        "embeddingDim": float(embedding.shape[0]),
        "embeddingNorm": round(embedding_norm, 6),
        "frameEmbeddingNormMean": round(float(frame_norms.mean().item()), 6),
        "frameEmbeddingNormStd": round(float(frame_norms.std(unbiased=False).item()), 6),
    }


def clamp_score(value: float) -> float:
    return round(max(-1.0, min(1.0, value)), 6)


def tanh_score(value: float, temperature: float) -> float:
    if temperature <= 0:
        raise ValueError("temperature must be greater than zero")
    return round(math.tanh(value / temperature), 6)


def qwen_scene_tone_prompt() -> str:
    return (
        "Describe the visual tone for audio/video pairing. Use compact natural language, not JSON. "
        "Prefer descriptor phrases that can later be converted into structured tone data. "
        "Use strength words such as weak, medium, strong, or extreme when useful. "
        "Use descriptor dimensions when they fit: valence, arousal, warmth, tension, menace, "
        "instability, beauty, nostalgia, intimacy, dominance. "
        "Use descriptor words when they fit: uplifting, melancholic, energetic, subdued, warm, cold, "
        "tense, relaxed, threatening, safe, unstable, stable, beautiful, harsh, nostalgic, "
        "unsentimental, intimate, distant, commanding, delicate. "
        "Keep the answer short: 3 to 8 bullet-like lines plus one short rationale.\n\n"
        "Examples:\n"
        "- strong warmth:cold\n"
        "- medium instability:unstable\n"
        "- weak intimacy:distant\n"
        "Rationale: The scene feels cool, unsettled, and emotionally removed.\n\n"
        "- medium valence:uplifting\n"
        "- strong beauty:beautiful\n"
        "- weak tension:relaxed\n"
        "Rationale: Bright composition and graceful motion suggest a pleasant, low-pressure mood.\n\n"
        "Now describe only the sampled frames."
    )


def parse_qwen_scene_tone_response(response: str) -> dict[str, Any]:
    text = response.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            preview = text.replace("\n", " ")[:500]
            raise RuntimeError(f"Qwen-VL response did not contain JSON: {preview}")
        parsed = json.loads(text[start : end + 1])

    if not isinstance(parsed, dict):
        raise RuntimeError("Qwen-VL response JSON must be an object")
    return parsed


def tone_from_vlm_payload(payload: dict[str, Any]) -> ToneVector:
    tone_payload = payload.get("tone")
    if not isinstance(tone_payload, dict):
        raise RuntimeError("Qwen-VL response missing tone object")

    tone = zero_tone()
    for dimension in TONE_DIMENSIONS:
        value = tone_payload.get(dimension, 0.0)
        try:
            tone[dimension] = clamp_score(float(value))
        except (TypeError, ValueError) as error:
            raise RuntimeError(f"Qwen-VL tone value for {dimension} must be numeric") from error
    return tone


def qwen_model_class() -> Any:
    try:
        from transformers import AutoModelForImageTextToText

        return AutoModelForImageTextToText
    except ImportError:
        pass

    try:
        from transformers import Qwen2_5_VLForConditionalGeneration

        return Qwen2_5_VLForConditionalGeneration
    except ImportError as error:
        raise RuntimeError("installed transformers does not expose a Qwen-VL model class") from error
