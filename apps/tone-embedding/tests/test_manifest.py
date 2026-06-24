from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from tone_embedding.export import build_audio_model, build_training_rows
from tone_embedding.manifest import (
    load_manifest,
    parse_manifest,
    validate_local_files,
    validate_manifest,
)
from tone_embedding.models import EssentiaAudioToneModel, parse_valence_arousal
from tone_embedding.preprocessing import build_preprocessing_plan
from tone_embedding.tone import tone_to_words


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

    def test_essentia_requires_embedding_model(self) -> None:
        manifest = parse_manifest(valid_payload())
        audio_asset = manifest.assets[0]
        model = build_audio_model("essentia")

        with self.assertRaisesRegex(RuntimeError, "essentia-embedding-model"):
            model.extract(audio_asset)

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

        self.assertEqual(words["summary"], "A subdued, calm, melancholic tone.")
        self.assertIn("subdued", words["primary"])
        self.assertIn("calm", words["primary"])
        self.assertIn("melancholic", words["primary"])
        self.assertIn("cool", words["secondary"])
        self.assertIn("non-threatening", words["secondary"])
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
        self.assertIn("uneasy", words["primary"])
        self.assertIn("threatening", words["primary"])


if __name__ == "__main__":
    unittest.main()
