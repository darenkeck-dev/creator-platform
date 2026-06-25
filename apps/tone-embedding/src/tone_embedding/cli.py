from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .export import build_asset_tone_rows, build_audio_model, write_jsonl
from .manifest import load_manifest, validate_local_files
from .preprocessing import build_preprocessing_plan, execute_preprocessing_plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tone-embedding")
    subparsers = parser.add_subparsers(dest="command", required=True)

    manifest_parser = subparsers.add_parser("manifest")
    manifest_subparsers = manifest_parser.add_subparsers(dest="manifest_command", required=True)
    validate_parser = manifest_subparsers.add_parser("validate")
    validate_parser.add_argument("manifest", type=Path)
    validate_parser.add_argument(
        "--check-files",
        action="store_true",
        help="Verify local file sources exist. S3 sources are not checked.",
    )

    extract_parser = subparsers.add_parser("extract")
    extract_parser.add_argument("manifest", type=Path)
    extract_parser.add_argument("--out", type=Path, required=True)
    extract_parser.add_argument(
        "--audio-model",
        choices=["placeholder", "essentia"],
        default="placeholder",
        help="Audio tone adapter to use.",
    )
    extract_parser.add_argument(
        "--essentia-embedding-model",
        type=Path,
        help="Path to an Essentia embedding model file used by --audio-model essentia.",
    )
    extract_parser.add_argument(
        "--essentia-valence-arousal-model",
        type=Path,
        help="Path to an Essentia valence/arousal model file used by --audio-model essentia.",
    )
    extract_parser.add_argument(
        "--essentia-output-range",
        choices=["unit", "bipolar", "deam"],
        default="deam",
        help="Range emitted by the Essentia valence/arousal head before normalization.",
    )

    preprocess_parser = subparsers.add_parser("preprocess")
    preprocess_parser.add_argument("manifest", type=Path)
    preprocess_parser.add_argument("--out-dir", type=Path, required=True)
    preprocess_parser.add_argument(
        "--execute",
        action="store_true",
        help="Run preprocessing commands. By default commands are printed only.",
    )

    args = parser.parse_args(argv)

    if args.command == "manifest" and args.manifest_command == "validate":
        manifest = load_manifest(args.manifest)
        if args.check_files:
            validate_local_files(manifest)
        print(
            f"valid manifest: {len(manifest.assets)} assets, {len(manifest.combos)} combos"
        )
        return 0

    if args.command == "extract":
        manifest = load_manifest(args.manifest)
        audio_model = build_audio_model(
            args.audio_model,
            essentia_embedding_model=args.essentia_embedding_model,
            essentia_valence_arousal_model=args.essentia_valence_arousal_model,
            essentia_output_range=args.essentia_output_range,
        )
        try:
            rows = build_asset_tone_rows(manifest, audio_model=audio_model)
        except RuntimeError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        write_jsonl(args.out, rows)
        print(f"wrote {len(rows)} rows to {args.out}")
        return 0

    if args.command == "preprocess":
        manifest = load_manifest(args.manifest)
        plan = build_preprocessing_plan(manifest, args.out_dir)
        for command in plan.commands:
            print(" ".join(command), flush=True)
        if args.execute:
            execute_preprocessing_plan(plan)
        return 0

    parser.error("unsupported command")


if __name__ == "__main__":
    raise SystemExit(main())
