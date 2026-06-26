from __future__ import annotations

import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from tone_embedding.bundle import create_bundle, extract_bundle, inspect_bundle
from tone_embedding.export import (
    build_asset_tone_rows,
    build_audio_model,
    build_training_rows,
    build_video_model,
)
from tone_embedding.manifest import (
    load_manifest,
    parse_manifest,
    validate_local_files,
    validate_manifest,
)
from tone_embedding.models import (
    DinoV2VideoEmbeddingModel,
    OpenClipVideoToneModel,
    QwenVLVideoToneModel,
    SiglipVideoToneModel,
    aggregate_video_prompt_scores,
    dino_embedding_stats,
    parse_qwen_scene_tone_response,
    parse_valence_arousal,
    score_siglip_prompt_pairs,
    EssentiaAudioToneModel,
    ToneExtraction,
    tone_from_vlm_payload,
)
from tone_embedding.preprocessing import build_preprocessing_plan
from tone_embedding.tone import structured_descriptors_to_tone, tone_to_words


def valid_payload() -> dict[str, object]:
    return {
        "assets": [
            {
                "id": "audio-1",
                "type": "audio",
                "title": "Audio",
                "source": {"kind": "file", "path": "audio.wav"},
            },
            {
                "id": "video-1",
                "type": "video",
                "title": "Video",
                "source": {
                    "kind": "s3",
                    "bucket": "media-originals-test",
                    "key": "incoming/video-1/original.mp4",
                    "contentType": "video/mp4",
                },
            },
        ],
        "combos": [{"id": "combo-1", "audioId": "audio-1", "videoId": "video-1"}],
    }


class ManifestTests(unittest.TestCase):
    def test_parse_valid_manifest(self) -> None:
        manifest = parse_manifest(valid_payload())

        self.assertEqual(len(manifest.assets), 2)
        self.assertEqual(len(manifest.combos), 1)
        self.assertEqual(manifest.assets[0].source.kind, "file")
        self.assertEqual(manifest.assets[1].source.kind, "s3")

    def test_build_training_rows(self) -> None:
        manifest = parse_manifest(valid_payload())

        rows = build_training_rows(manifest)

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["comboId"], "combo-1")
        self.assertEqual(rows[0]["audioSource"]["kind"], "file")
        self.assertEqual(rows[0]["videoSource"]["kind"], "s3")
        self.assertIn("valence", rows[0]["audioTone"])
        self.assertIn("summary", rows[0]["audioToneWords"])
        self.assertIsInstance(rows[0]["congruence"], float)

    def test_build_asset_tone_rows(self) -> None:
        manifest = parse_manifest(valid_payload())

        rows = build_asset_tone_rows(manifest)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["assetId"], "audio-1")
        self.assertEqual(rows[0]["assetType"], "audio")
        self.assertEqual(rows[0]["source"]["kind"], "file")
        self.assertIn("valence", rows[0]["tone"]["value"])
        self.assertIn("summary", rows[0]["tone"]["words"])
        self.assertEqual(rows[0]["modelRuns"][0]["rawScores"], {})
        self.assertEqual(rows[0]["modelRuns"][0]["model"]["name"], "placeholder/audio-tone")
        self.assertEqual(rows[0]["modelRuns"][0]["parameters"], {})
        self.assertNotIn("congruence", rows[0])
        self.assertEqual(rows[1]["assetId"], "video-1")
        self.assertEqual(rows[1]["assetType"], "video")
        self.assertEqual(rows[1]["modelRuns"][0]["model"]["name"], "placeholder/video-tone")

    def test_build_asset_tone_rows_includes_embedding_path(self) -> None:
        class FakeVideoEmbeddingModel:
            name = "fake/video-embedding"
            version = "0.1.0"
            license = "test"

            def extract(self, asset: object) -> ToneExtraction:
                return ToneExtraction(
                    embedding_path="embeddings/video-1.dinov2.npy",
                    raw_scores={"embeddingDim": 384.0},
                    kind="embedding",
                )

        manifest = parse_manifest(
            {
                "assets": [
                    {
                        "id": "video-1",
                        "type": "video",
                        "title": "Video",
                        "source": {"kind": "file", "path": "video.mp4"},
                    }
                ]
            }
        )

        rows = build_asset_tone_rows(manifest, video_model=FakeVideoEmbeddingModel())

        self.assertEqual(rows[0]["embeddings"]["fake/video-embedding"]["path"], "embeddings/video-1.dinov2.npy")
        self.assertEqual(rows[0]["embeddings"]["fake/video-embedding"]["dimensions"], 384)
        self.assertEqual(rows[0]["modelRuns"][0]["kind"], "embedding")
        self.assertEqual(rows[0]["modelRuns"][0]["rawScores"]["embeddingDim"], 384.0)
        self.assertEqual(rows[0]["modelRuns"][0]["parameters"], {"embeddingDim": 384})
        self.assertNotIn("tone", rows[0])

    def test_build_asset_tone_rows_includes_model_metadata(self) -> None:
        class FakeVideoSemanticModel:
            name = "fake/scene-tone"
            version = "0.1.0"
            license = "test"

            def extract(self, asset: object) -> ToneExtraction:
                return ToneExtraction(
                    tone={
                        "valence": 0.25,
                        "arousal": 0.1,
                        "warmth": 0.2,
                        "tension": -0.1,
                        "menace": -0.5,
                        "beauty": 0.3,
                        "instability": -0.4,
                        "intimacy": 0.2,
                        "nostalgia": 0.0,
                        "dominance": 0.0,
                    },
                    raw_scores={"valence": 0.25},
                    metadata={"caption": "A calm room.", "tags": ["interior"]},
                )

        manifest = parse_manifest(
            {
                "assets": [
                    {
                        "id": "video-1",
                        "type": "video",
                        "title": "Video",
                        "source": {"kind": "file", "path": "video.mp4"},
                    }
                ]
            }
        )

        rows = build_asset_tone_rows(manifest, video_model=FakeVideoSemanticModel())

        self.assertEqual(rows[0]["modelRuns"][0]["metadata"]["caption"], "A calm room.")
        self.assertEqual(rows[0]["modelRuns"][0]["metadata"]["tags"], ["interior"])

    def test_build_asset_tone_rows_includes_semantic_model_run(self) -> None:
        class FakeVideoSemanticModel:
            name = "fake/scene-descriptors"
            version = "0.1.0"
            license = "test"

            def extract(self, asset: object) -> ToneExtraction:
                return ToneExtraction(
                    kind="semantic",
                    metadata={"response": "strong warmth:cold"},
                )

        manifest = parse_manifest(
            {
                "assets": [
                    {
                        "id": "video-1",
                        "type": "video",
                        "title": "Video",
                        "source": {"kind": "file", "path": "video.mp4"},
                    }
                ]
            }
        )

        rows = build_asset_tone_rows(manifest, video_model=FakeVideoSemanticModel())

        self.assertNotIn("tone", rows[0])
        self.assertEqual(rows[0]["modelRuns"][0]["kind"], "semantic")
        self.assertEqual(rows[0]["modelRuns"][0]["metadata"]["response"], "strong warmth:cold")

    def test_parse_manifest_allows_assets_without_combos(self) -> None:
        payload = valid_payload()
        del payload["combos"]

        manifest = parse_manifest(payload)

        self.assertEqual(len(manifest.assets), 2)
        self.assertEqual(manifest.combos, [])

    def test_preprocessing_plan_stages_s3_source(self) -> None:
        manifest = parse_manifest(valid_payload())

        plan = build_preprocessing_plan(manifest, out_dir=Path("out"))

        self.assertEqual(plan.commands[0][:4], ["ffmpeg", "-y", "-i", "audio.wav"])
        self.assertEqual(
            plan.commands[1],
            [
                "aws",
                "s3",
                "cp",
                "s3://media-originals-test/incoming/video-1/original.mp4",
                "out/sources/video-1/original.mp4",
            ],
        )
        self.assertEqual(plan.commands[2][:4], ["ffmpeg", "-y", "-i", "out/sources/video-1/original.mp4"])

    def test_missing_combo_asset_fails(self) -> None:
        manifest = parse_manifest(
            {
                "assets": [
                    {
                        "id": "audio-1",
                        "type": "audio",
                        "title": "Audio",
                        "source": {"kind": "file", "path": "audio.wav"},
                    }
                ],
                "combos": [
                    {"id": "combo-1", "audioId": "audio-1", "videoId": "video-1"}
                ],
            }
        )

        with self.assertRaisesRegex(ValueError, "missing video"):
            validate_manifest(manifest)

    def test_validate_local_files_ignores_s3_sources(self) -> None:
        manifest = parse_manifest(valid_payload())

        with self.assertRaisesRegex(ValueError, "audio-1"):
            validate_local_files(manifest)

    def test_missing_source_fails(self) -> None:
        payload = valid_payload()
        assets = payload["assets"]
        assert isinstance(assets, list)
        audio = assets[0]
        assert isinstance(audio, dict)
        del audio["source"]

        with self.assertRaisesRegex(ValueError, "asset.source"):
            parse_manifest(payload)

    def test_load_manifest_resolves_file_sources_relative_to_manifest(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            media = root / "media"
            media.mkdir()
            (media / "audio.wav").write_bytes(b"")
            manifest_path = root / "manifest.json"
            manifest_path.write_text(
                """
                {
                  "assets": [
                    {
                      "id": "audio-1",
                      "type": "audio",
                      "title": "Audio",
                      "source": { "kind": "file", "path": "./media/audio.wav" }
                    },
                    {
                      "id": "video-1",
                      "type": "video",
                      "title": "Video",
                      "source": { "kind": "s3", "bucket": "bucket", "key": "video.mp4" }
                    }
                  ],
                  "combos": [
                    { "id": "combo-1", "audioId": "audio-1", "videoId": "video-1" }
                  ]
                }
                """,
                encoding="utf-8",
            )

            manifest = load_manifest(manifest_path)

            self.assertEqual(manifest.assets[0].source.kind, "file")
            self.assertEqual(manifest.assets[0].source.path, root / "media" / "audio.wav")
            validate_local_files(manifest)

    def test_build_audio_model_selects_essentia(self) -> None:
        model = build_audio_model(
            "essentia",
            essentia_embedding_model=Path("embedding.pb"),
            essentia_valence_arousal_model=Path("valence.pb"),
        )

        self.assertIsInstance(model, EssentiaAudioToneModel)
        self.assertEqual(
            model.parameters(),
            {
                "embeddingModel": "embedding.pb",
                "valenceArousalModel": "valence.pb",
                "outputRange": "unit",
            },
        )

    def test_build_video_model_selects_openclip(self) -> None:
        model = build_video_model(
            "openclip",
            openclip_model="ViT-B-32",
            openclip_pretrained="laion2b_s34b_b79k",
            video_frame_rate=0.5,
            video_max_frames=4,
        )

        self.assertIsInstance(model, OpenClipVideoToneModel)
        self.assertEqual(model.frame_rate, 0.5)
        self.assertEqual(model.max_frames, 4)
        self.assertEqual(
            model.parameters(),
            {
                "openclipModel": "ViT-B-32",
                "openclipPretrained": "laion2b_s34b_b79k",
                "frameRate": 0.5,
                "maxFrames": 4,
                "promptPairVersion": "video-affect-v1",
            },
        )

    def test_build_video_model_selects_dinov2(self) -> None:
        model = build_video_model(
            "dinov2",
            dinov2_model="facebook/dinov2-small",
            embedding_dir=Path("embeddings"),
            video_frame_rate=0.25,
            video_max_frames=3,
        )

        self.assertIsInstance(model, DinoV2VideoEmbeddingModel)
        self.assertEqual(model.model_name, "facebook/dinov2-small")
        self.assertEqual(model.embedding_dir, Path("embeddings"))
        self.assertEqual(model.frame_rate, 0.25)
        self.assertEqual(model.max_frames, 3)
        self.assertEqual(
            model.parameters(),
            {
                "dinov2Model": "facebook/dinov2-small",
                "frameRate": 0.25,
                "maxFrames": 3,
            },
        )

    def test_build_video_model_selects_siglip(self) -> None:
        model = build_video_model(
            "siglip",
            siglip_model="google/siglip-base-patch16-224",
            video_frame_rate=0.5,
            video_max_frames=4,
        )

        self.assertIsInstance(model, SiglipVideoToneModel)
        self.assertEqual(
            model.parameters(),
            {
                "siglipModel": "google/siglip-base-patch16-224",
                "frameRate": 0.5,
                "maxFrames": 4,
                "promptPairVersion": "video-affect-v1",
                "scoreTransform": "tanh-logit-delta",
                "scoreTemperature": 4.0,
            },
        )

    def test_build_video_model_selects_qwen_vl(self) -> None:
        model = build_video_model(
            "qwen-vl",
            qwen_model="Qwen/Qwen2.5-VL-7B-Instruct",
            qwen_max_new_tokens=256,
            qwen_torch_dtype="float32",
            qwen_device_map="cpu",
            video_frame_rate=0.25,
            video_max_frames=3,
        )

        self.assertIsInstance(model, QwenVLVideoToneModel)
        self.assertEqual(
            model.parameters(),
            {
                "qwenModel": "Qwen/Qwen2.5-VL-7B-Instruct",
                "frameRate": 0.25,
                "maxFrames": 3,
                "maxNewTokens": 256,
                "torchDtype": "float32",
                "deviceMap": "cpu",
                "mkldnnDisabled": True,
                "promptVersion": "video-tone-descriptors-v1",
            },
        )

    def test_dinov2_embedding_path_is_bundle_relative(self) -> None:
        try:
            import numpy  # noqa: F401
        except ImportError:
            self.skipTest("numpy optional video dependency is not installed")

        model = DinoV2VideoEmbeddingModel(embedding_dir=Path("/tmp/tone-output/embeddings"))

        class FakeEmbedding:
            def detach(self) -> "FakeEmbedding":
                return self

            def cpu(self) -> "FakeEmbedding":
                return self

            def numpy(self) -> list[float]:
                return [0.1, 0.2]

        with TemporaryDirectory() as temp_dir:
            model.embedding_dir = Path(temp_dir) / "embeddings"
            path = model._write_embedding("video-1", FakeEmbedding())

            self.assertEqual(path, Path("embeddings/video-1/dinov2.npy"))
            self.assertTrue((Path(temp_dir) / "embeddings" / "video-1" / "dinov2.npy").is_file())

    def test_bundle_create_inspect_extract(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            embedding = root / "embeddings" / "video-1" / "dinov2.npy"
            embedding.parent.mkdir(parents=True)
            embedding.write_bytes(b"embedding")
            analysis = root / "asset-analysis.jsonl"
            analysis.write_text(
                json.dumps(
                    {
                        "assetId": "video-1",
                        "assetType": "video",
                        "embeddings": {
                            "dinov2": {
                                "kind": "dinov2",
                                "path": "embeddings/video-1/dinov2.npy",
                                "dimensions": 384,
                                "model": "dinov2/frame-embedding",
                            }
                        },
                        "modelRuns": [],
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            bundle = root / "asset-analysis.tonebundle.tar.gz"

            manifest = create_bundle(analysis, bundle)

            self.assertEqual(manifest["schema"], "tone-analysis-bundle/v1")
            self.assertEqual(manifest["analysisPath"], "asset-analysis.jsonl")
            self.assertEqual(manifest["embeddings"], ["embeddings/video-1/dinov2.npy"])
            self.assertEqual(inspect_bundle(bundle)["assetIds"], ["video-1"])

            extract_dir = root / "extracted"
            extract_bundle(bundle, extract_dir)

            self.assertTrue((extract_dir / "manifest.json").is_file())
            self.assertTrue((extract_dir / "asset-analysis.jsonl").is_file())
            self.assertEqual((extract_dir / "embeddings" / "video-1" / "dinov2.npy").read_bytes(), b"embedding")

    def test_bundle_create_filters_to_single_asset(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for asset_id in ("video-1", "video-2"):
                embedding = root / "embeddings" / asset_id / "dinov2.npy"
                embedding.parent.mkdir(parents=True)
                embedding.write_bytes(asset_id.encode("utf-8"))

            analysis = root / "asset-analysis.jsonl"
            analysis.write_text(
                "\n".join(
                    json.dumps(
                        {
                            "assetId": asset_id,
                            "assetType": "video",
                            "embeddings": {
                                "dinov2": {
                                    "kind": "dinov2",
                                    "path": f"embeddings/{asset_id}/dinov2.npy",
                                    "dimensions": 384,
                                    "model": "dinov2/frame-embedding",
                                }
                            },
                            "modelRuns": [],
                        }
                    )
                    for asset_id in ("video-1", "video-2")
                )
                + "\n",
                encoding="utf-8",
            )
            bundle = root / "video-2.tonebundle.tar.gz"

            manifest = create_bundle(analysis, bundle, asset_id="video-2")

            self.assertEqual(manifest["assetIds"], ["video-2"])
            self.assertEqual(manifest["embeddings"], ["embeddings/video-2/dinov2.npy"])

            extract_dir = root / "single-extracted"
            extract_bundle(bundle, extract_dir)
            rows = [json.loads(line) for line in (extract_dir / "asset-analysis.jsonl").read_text().splitlines()]
            self.assertEqual([row["assetId"] for row in rows], ["video-2"])
            self.assertTrue((extract_dir / "embeddings" / "video-2" / "dinov2.npy").is_file())
            self.assertFalse((extract_dir / "embeddings" / "video-1" / "dinov2.npy").exists())

    def test_essentia_requires_embedding_model(self) -> None:
        manifest = parse_manifest(valid_payload())
        audio_asset = manifest.assets[0]
        model = build_audio_model("essentia")

        with self.assertRaisesRegex(RuntimeError, "essentia-embedding-model"):
            model.extract(audio_asset)

    def test_essentia_predictors_are_cached_per_model_instance(self) -> None:
        calls = {"embedding": 0, "valence_arousal": 0}

        class FakeEmbeddingPredictor:
            def __init__(self, **_: object) -> None:
                calls["embedding"] += 1

        class FakeValenceArousalPredictor:
            def __init__(self, **_: object) -> None:
                calls["valence_arousal"] += 1

        model = EssentiaAudioToneModel(
            embedding_model=Path("embedding.pb"),
            valence_arousal_model=Path("valence.pb"),
        )

        self.assertIs(
            model._get_embedding_predictor(FakeEmbeddingPredictor),
            model._get_embedding_predictor(FakeEmbeddingPredictor),
        )
        self.assertIs(
            model._get_valence_arousal_predictor(FakeValenceArousalPredictor),
            model._get_valence_arousal_predictor(FakeValenceArousalPredictor),
        )
        self.assertEqual(calls, {"embedding": 1, "valence_arousal": 1})

    def test_parse_valence_arousal_normalizes_unit_output(self) -> None:
        valence, arousal = parse_valence_arousal([[0.75, 0.25]], output_range="unit")

        self.assertEqual(valence, 0.5)
        self.assertEqual(arousal, -0.5)

    def test_parse_valence_arousal_preserves_bipolar_output(self) -> None:
        valence, arousal = parse_valence_arousal([[-0.25, 0.75]], output_range="bipolar")

        self.assertEqual(valence, -0.25)
        self.assertEqual(arousal, 0.75)

    def test_parse_valence_arousal_normalizes_deam_output(self) -> None:
        valence, arousal = parse_valence_arousal([[7.0, 3.0]], output_range="deam")

        self.assertEqual(valence, 0.5)
        self.assertEqual(arousal, -0.5)

    def test_aggregate_video_prompt_scores_builds_tone_and_raw_stats(self) -> None:
        tone, raw_scores = aggregate_video_prompt_scores(
            [
                {"valence": 0.5, "arousal": -0.25, "warmth": 0.1},
                {"valence": -0.1, "arousal": 0.25, "warmth": 0.3},
            ]
        )

        self.assertEqual(tone["valence"], 0.2)
        self.assertEqual(tone["arousal"], 0.0)
        self.assertEqual(tone["warmth"], 0.2)
        self.assertEqual(raw_scores["valence.mean"], 0.2)
        self.assertEqual(raw_scores["valence.min"], -0.1)
        self.assertEqual(raw_scores["valence.max"], 0.5)
        self.assertEqual(raw_scores["valence.std"], 0.3)

    def test_dino_embedding_stats(self) -> None:
        class FakeNorms:
            def mean(self) -> object:
                return FakeItem(1.0)

            def std(self, unbiased: bool) -> object:
                self.unbiased = unbiased
                return FakeItem(0.25)

        class FakeFrameEmbeddings:
            shape = (3, 4)

            def norm(self, dim: int) -> FakeNorms:
                self.dim = dim
                return FakeNorms()

        class FakeEmbedding:
            shape = (4,)

        class FakeItem:
            def __init__(self, value: float) -> None:
                self.value = value

            def item(self) -> float:
                return self.value

        stats = dino_embedding_stats(FakeFrameEmbeddings(), FakeEmbedding(), 0.75)

        self.assertEqual(
            stats,
            {
                "frameCount": 3.0,
                "embeddingDim": 4.0,
                "embeddingNorm": 0.75,
                "frameEmbeddingNormMean": 1.0,
                "frameEmbeddingNormStd": 0.25,
            },
        )

    def test_parse_qwen_scene_tone_response_reads_fenced_json(self) -> None:
        payload = parse_qwen_scene_tone_response(
            """
            ```json
            {
              "caption": "A quiet hallway.",
              "tags": ["hallway", "quiet"],
              "tone": { "valence": -0.2, "arousal": 0.1, "menace": 0.4 },
              "rationale": "Dim space and empty corridor."
            }
            ```
            """
        )
        tone = tone_from_vlm_payload(payload)

        self.assertEqual(payload["caption"], "A quiet hallway.")
        self.assertEqual(tone["valence"], -0.2)
        self.assertEqual(tone["menace"], 0.4)
        self.assertEqual(tone["warmth"], 0.0)

    def test_score_siglip_prompt_pairs_uses_tanh_logit_delta(self) -> None:
        scores = score_siglip_prompt_pairs(
            {
                "a joyful uplifting visual scene": 2.0,
                "a sad bleak visual scene": -0.5,
                "an energetic intense visual scene": -1.0,
                "a calm still visual scene": 1.0,
                "a warm inviting visual atmosphere": 0.25,
                "a cold distant visual atmosphere": 0.75,
                "a tense suspenseful visual scene": 0.0,
                "a relaxed peaceful visual scene": 0.0,
                "a threatening ominous visual scene": 3.0,
                "a safe comforting visual scene": 0.0,
                "a beautiful aesthetically pleasing visual scene": 0.0,
                "an ugly unpleasant visual scene": 0.0,
                "a chaotic unstable disorienting visual scene": 0.0,
                "a stable orderly balanced visual scene": 0.0,
                "an intimate personal close visual scene": 0.0,
                "an impersonal distant detached visual scene": 0.0,
                "a nostalgic memory-like visual scene": 0.0,
                "a modern clinical present-day visual scene": 0.0,
            }
        )

        self.assertEqual(scores["valence"], 0.5546)
        self.assertEqual(scores["arousal"], -0.462117)
        self.assertEqual(scores["warmth"], -0.124353)
        self.assertEqual(scores["menace"], 0.635149)

    def test_tone_to_words_maps_subdued_melancholic_audio(self) -> None:
        words = tone_to_words(
            {
                "valence": -0.267608,
                "arousal": -0.30113,
                "warmth": -0.267608,
                "tension": -0.30113,
                "menace": 0.0,
            }
        )

        self.assertEqual(words["summary"], "A subdued, relaxed, melancholic tone.")
        self.assertIn("subdued", words["primary"])
        self.assertIn("relaxed", words["primary"])
        self.assertIn("melancholic", words["primary"])
        self.assertIn("cold", words["secondary"])
        self.assertIn("joyful", words["avoid"])

    def test_tone_to_words_maps_tense_uneasy_audio(self) -> None:
        words = tone_to_words(
            {
                "valence": -0.4,
                "arousal": 0.6,
                "warmth": -0.4,
                "tension": 0.6,
                "menace": 0.3,
            }
        )

        self.assertIn("tense", words["primary"])
        self.assertIn("energetic", words["primary"])
        self.assertIn("melancholic", words["primary"])
        self.assertIn("threatening", words["secondary"])

    def test_tone_to_words_prioritizes_strong_non_quadrant_dimensions(self) -> None:
        words = tone_to_words(
            {
                "valence": -0.085048,
                "arousal": -0.306266,
                "warmth": -0.607538,
                "tension": -0.108001,
                "menace": 0.363816,
                "beauty": -0.702287,
                "instability": 0.785595,
                "intimacy": -0.373503,
                "nostalgia": -0.576487,
            }
        )

        self.assertEqual(words["summary"], "A unstable, harsh, cold tone.")
        self.assertEqual(words["primary"], ["unstable", "harsh", "cold"])
        self.assertIn("unsentimental", words["secondary"])
        self.assertNotIn("neutral", words["primary"])

    def test_structured_descriptors_to_tone_maps_strengths(self) -> None:
        tone = structured_descriptors_to_tone(
            [
                {"strength": "strong", "dimension": "warmth", "descriptor": "cold"},
                {"strength": "medium", "dimension": "instability", "descriptor": "unstable"},
                {"strength": "weak", "dimension": "menace", "descriptor": "threatening"},
                {"strength": "extreme", "dimension": "valence", "descriptor": "uplifting"},
            ]
        )

        self.assertEqual(tone["warmth"], -0.85)
        self.assertEqual(tone["instability"], 0.55)
        self.assertEqual(tone["menace"], 0.25)
        self.assertEqual(tone["valence"], 1.0)

    def test_structured_descriptors_to_tone_rejects_dimension_mismatch(self) -> None:
        with self.assertRaisesRegex(ValueError, "belongs to warmth"):
            structured_descriptors_to_tone(
                [{"strength": "strong", "dimension": "valence", "descriptor": "cold"}]
            )


if __name__ == "__main__":
    unittest.main()
