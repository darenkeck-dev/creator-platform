from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .bundle import create_bundle, extract_bundle, inspect_bundle
from .export import build_asset_tone_rows, build_audio_model, build_video_model, write_jsonl
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
        "--video-model",
        choices=["placeholder", "openclip", "siglip", "qwen-vl", "dinov2"],
        default="placeholder",
        help="Video tone adapter to use.",
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
    extract_parser.add_argument(
        "--openclip-model",
        default="ViT-B-32",
        help="OpenCLIP model name used by --video-model openclip.",
    )
    extract_parser.add_argument(
        "--openclip-pretrained",
        default="laion2b_s34b_b79k",
        help="OpenCLIP pretrained checkpoint used by --video-model openclip.",
    )
    extract_parser.add_argument(
        "--dinov2-model",
        default="facebook/dinov2-small",
        help="DINOv2 checkpoint used by --video-model dinov2.",
    )
    extract_parser.add_argument(
        "--siglip-model",
        default="google/siglip-base-patch16-224",
        help="SigLIP checkpoint used by --video-model siglip.",
    )
    extract_parser.add_argument(
        "--qwen-model",
        default="Qwen/Qwen2.5-VL-7B-Instruct",
        help="Qwen-VL checkpoint used by --video-model qwen-vl.",
    )
    extract_parser.add_argument(
        "--qwen-max-new-tokens",
        type=int,
        default=512,
        help="Maximum generated tokens for --video-model qwen-vl.",
    )
    extract_parser.add_argument(
        "--qwen-torch-dtype",
        default="auto",
        choices=["auto", "float32", "float16", "bfloat16"],
        help="Torch dtype for --video-model qwen-vl.",
    )
    extract_parser.add_argument(
        "--qwen-device-map",
        default="auto",
        help="Transformers device_map for --video-model qwen-vl.",
    )
    extract_parser.add_argument(
        "--embedding-out-dir",
        type=Path,
        help="Directory for embedding files emitted by embedding-based adapters.",
    )
    extract_parser.add_argument(
        "--video-frame-rate",
        type=float,
        default=1.0,
        help="Frames per second to sample for video tone extraction.",
    )
    extract_parser.add_argument(
        "--video-max-frames",
        type=int,
        default=12,
        help="Maximum sampled frames per video for video tone extraction.",
    )

    preprocess_parser = subparsers.add_parser("preprocess")
    preprocess_parser.add_argument("manifest", type=Path)
    preprocess_parser.add_argument("--out-dir", type=Path, required=True)
    preprocess_parser.add_argument(
        "--execute",
        action="store_true",
        help="Run preprocessing commands. By default commands are printed only.",
    )

    bundle_parser = subparsers.add_parser("bundle")
    bundle_subparsers = bundle_parser.add_subparsers(dest="bundle_command", required=True)
    bundle_create_parser = bundle_subparsers.add_parser("create")
    bundle_create_parser.add_argument("--analysis", type=Path, required=True)
    bundle_create_parser.add_argument("--out", type=Path, required=True)
    bundle_create_parser.add_argument("--asset-id")
    bundle_inspect_parser = bundle_subparsers.add_parser("inspect")
    bundle_inspect_parser.add_argument("bundle", type=Path)
    bundle_extract_parser = bundle_subparsers.add_parser("extract")
    bundle_extract_parser.add_argument("bundle", type=Path)
    bundle_extract_parser.add_argument("--out-dir", type=Path, required=True)

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
        video_model = build_video_model(
            args.video_model,
            openclip_model=args.openclip_model,
            openclip_pretrained=args.openclip_pretrained,
            siglip_model=args.siglip_model,
            qwen_model=args.qwen_model,
            qwen_max_new_tokens=args.qwen_max_new_tokens,
            qwen_torch_dtype=args.qwen_torch_dtype,
            qwen_device_map=args.qwen_device_map,
            dinov2_model=args.dinov2_model,
            embedding_dir=args.embedding_out_dir or args.out.parent / "embeddings",
            video_frame_rate=args.video_frame_rate,
            video_max_frames=args.video_max_frames,
        )
        try:
            rows = build_asset_tone_rows(manifest, audio_model=audio_model, video_model=video_model)
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

    if args.command == "bundle" and args.bundle_command == "create":
        try:
            manifest = create_bundle(args.analysis, args.out, asset_id=args.asset_id)
        except RuntimeError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        print(json.dumps(manifest, indent=2, sort_keys=True))
        print(f"wrote bundle to {args.out}")
        return 0

    if args.command == "bundle" and args.bundle_command == "inspect":
        try:
            manifest = inspect_bundle(args.bundle)
        except RuntimeError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        print(json.dumps(manifest, indent=2, sort_keys=True))
        return 0

    if args.command == "bundle" and args.bundle_command == "extract":
        extract_bundle(args.bundle, args.out_dir)
        print(f"extracted bundle to {args.out_dir}")
        return 0

    parser.error("unsupported command")


if __name__ == "__main__":
    raise SystemExit(main())
