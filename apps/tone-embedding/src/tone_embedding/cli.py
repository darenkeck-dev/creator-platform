from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .bundle import create_bundle, extract_bundle, inspect_bundle
from .combo import build_combo_analysis_rows
from .export import build_asset_tone_rows, build_audio_model, build_video_model, read_jsonl, write_jsonl
from .manifest import load_manifest, validate_local_files
from .neighbors import top_k_neighbors
from .preprocessing import build_preprocessing_plan, execute_preprocessing_plan
from .workflows import (
    analyze_audio_file,
    analyze_video_file,
    build_combo_analysis_from_files,
    read_analysis_rows,
    write_json,
)


def main(argv: list[str] | None = None) -> int:
    load_local_env_files()
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

    analyze_parser = subparsers.add_parser("analyze")
    analyze_subparsers = analyze_parser.add_subparsers(dest="analyze_command", required=True)
    analyze_audio_parser = analyze_subparsers.add_parser("audio")
    analyze_audio_parser.add_argument("input", type=Path)
    analyze_audio_parser.add_argument("--out", type=Path, required=True)
    analyze_audio_parser.add_argument("--asset-id", default="audio-1")
    analyze_audio_parser.add_argument("--title")
    analyze_audio_parser.add_argument(
        "--model",
        choices=["placeholder", "essentia", "openai"],
        default="openai",
        help="Audio tone adapter to use.",
    )
    analyze_audio_parser.add_argument("--essentia-embedding-model", type=Path)
    analyze_audio_parser.add_argument("--essentia-valence-arousal-model", type=Path)
    analyze_audio_parser.add_argument(
        "--essentia-output-range",
        choices=["unit", "bipolar", "deam"],
        default="deam",
    )
    analyze_audio_parser.add_argument("--openai-audio-model", default="gpt-audio")
    analyze_audio_parser.add_argument("--openai-api-key-env", default="OPENAI_API_KEY")

    analyze_video_parser = analyze_subparsers.add_parser("video")
    analyze_video_parser.add_argument("input", type=Path)
    analyze_video_parser.add_argument("--out", type=Path, required=True)
    analyze_video_parser.add_argument("--asset-id", default="video-1")
    analyze_video_parser.add_argument("--title")
    analyze_video_parser.add_argument(
        "--models",
        default="openai",
        help="Comma-separated video models. Use 'primary' for OpenAI-only Lambda-friendly analysis.",
    )
    add_video_model_options(analyze_video_parser)

    extract_parser = subparsers.add_parser("extract")
    extract_parser.add_argument("manifest", type=Path)
    extract_parser.add_argument("--out", type=Path, required=True)
    extract_parser.add_argument(
        "--audio-model",
        choices=["placeholder", "essentia", "openai"],
        default="placeholder",
        help="Audio tone adapter to use.",
    )
    extract_parser.add_argument(
        "--video-model",
        choices=["placeholder", "openclip", "openai", "siglip", "qwen-vl", "dinov2"],
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
        "--openai-model",
        default="gpt-5",
        help="OpenAI vision model used by --video-model openai.",
    )
    extract_parser.add_argument(
        "--openai-audio-model",
        default="gpt-audio",
        help="OpenAI audio-capable model used by --audio-model openai.",
    )
    extract_parser.add_argument(
        "--openai-api-key-env",
        default="OPENAI_API_KEY",
        help="Environment variable containing the OpenAI API key for --video-model openai.",
    )
    extract_parser.add_argument(
        "--openai-image-detail",
        choices=["low", "high", "auto"],
        default="low",
        help="OpenAI image detail setting for sampled frames.",
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
        help="Transformers device_map for --video-model qwen-vl. Use 'mps' for native macOS Apple Silicon GPU execution.",
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

    combo_parser = subparsers.add_parser("combo")
    combo_subparsers = combo_parser.add_subparsers(dest="combo_command", required=True)
    combo_analyze_parser = combo_subparsers.add_parser("analyze")
    combo_analyze_parser.add_argument("manifest", type=Path)
    combo_analyze_parser.add_argument("--analysis", type=Path, required=True)
    combo_analyze_parser.add_argument("--out", type=Path, required=True)
    combo_build_parser = combo_subparsers.add_parser("build")
    combo_build_parser.add_argument("--audio-analysis", type=Path, required=True)
    combo_build_parser.add_argument("--video-analysis", type=Path, required=True)
    combo_build_parser.add_argument("--out", type=Path, required=True)
    combo_build_parser.add_argument("--combo-id", default="combo-1")
    combo_build_parser.add_argument("--audio-asset-id")
    combo_build_parser.add_argument("--video-asset-id")

    neighbors_parser = subparsers.add_parser("neighbors")
    neighbors_subparsers = neighbors_parser.add_subparsers(dest="neighbors_command", required=True)
    neighbors_query_parser = neighbors_subparsers.add_parser("query")
    neighbors_query_parser.add_argument("--combo-analysis", type=Path, required=True)
    neighbors_query_parser.add_argument("--candidates", type=Path, required=True)
    neighbors_query_parser.add_argument("--out", type=Path)
    neighbors_query_parser.add_argument("--top-k", type=int, default=10)

    args = parser.parse_args(argv)

    if args.command == "manifest" and args.manifest_command == "validate":
        manifest = load_manifest(args.manifest)
        if args.check_files:
            validate_local_files(manifest)
        print(
            f"valid manifest: {len(manifest.assets)} assets, {len(manifest.combos)} combos"
        )
        return 0

    if args.command == "analyze" and args.analyze_command == "audio":
        try:
            row = analyze_audio_file(
                args.input,
                asset_id=args.asset_id,
                title=args.title,
                model_name=args.model,
                essentia_embedding_model=args.essentia_embedding_model,
                essentia_valence_arousal_model=args.essentia_valence_arousal_model,
                essentia_output_range=args.essentia_output_range,
                openai_audio_model=args.openai_audio_model,
                openai_api_key_env=args.openai_api_key_env,
            )
        except (RuntimeError, ValueError) as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        write_json(args.out, row)
        print(f"wrote audio analysis to {args.out}")
        return 0

    if args.command == "analyze" and args.analyze_command == "video":
        try:
            row = analyze_video_file(
                args.input,
                asset_id=args.asset_id,
                title=args.title,
                model_names=parse_csv(args.models),
                openclip_model=args.openclip_model,
                openclip_pretrained=args.openclip_pretrained,
                openai_model=args.openai_model,
                openai_api_key_env=args.openai_api_key_env,
                openai_image_detail=args.openai_image_detail,
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
        except (RuntimeError, ValueError) as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        write_json(args.out, row)
        print(f"wrote video analysis to {args.out}")
        return 0

    if args.command == "extract":
        manifest = load_manifest(args.manifest)
        audio_model = build_audio_model(
            args.audio_model,
            essentia_embedding_model=args.essentia_embedding_model,
            essentia_valence_arousal_model=args.essentia_valence_arousal_model,
            essentia_output_range=args.essentia_output_range,
            openai_audio_model=args.openai_audio_model,
            openai_api_key_env=args.openai_api_key_env,
        )
        video_model = build_video_model(
            args.video_model,
            openclip_model=args.openclip_model,
            openclip_pretrained=args.openclip_pretrained,
            openai_model=args.openai_model,
            openai_api_key_env=args.openai_api_key_env,
            openai_image_detail=args.openai_image_detail,
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
        except (RuntimeError, ValueError) as error:
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
        except (RuntimeError, ValueError) as error:
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

    if args.command == "combo" and args.combo_command == "analyze":
        manifest = load_manifest(args.manifest)
        try:
            rows = build_combo_analysis_rows(manifest, read_jsonl(args.analysis))
        except RuntimeError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        write_jsonl(args.out, rows)
        print(f"wrote {len(rows)} combo analysis rows to {args.out}")
        return 0

    if args.command == "combo" and args.combo_command == "build":
        try:
            row = build_combo_analysis_from_files(
                args.audio_analysis,
                args.video_analysis,
                combo_id=args.combo_id,
                out_audio_asset_id=args.audio_asset_id,
                out_video_asset_id=args.video_asset_id,
            )
        except RuntimeError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        write_json(args.out, row)
        print(f"wrote combo analysis to {args.out}")
        return 0

    if args.command == "neighbors" and args.neighbors_command == "query":
        try:
            query_rows = read_analysis_rows(args.combo_analysis)
            if len(query_rows) != 1:
                raise RuntimeError(f"expected exactly one query combo row, found {len(query_rows)}")
            results = top_k_neighbors(query_rows[0], read_analysis_rows(args.candidates), top_k=args.top_k)
        except RuntimeError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
        if args.out:
            write_json(args.out, results)
            print(f"wrote {len(results)} neighbor results to {args.out}")
        else:
            print(json.dumps(results, indent=2, sort_keys=True))
        return 0

    parser.error("unsupported command")


def load_local_env_files() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    app_dir = Path(__file__).resolve().parents[2]
    cwd = Path.cwd()
    for env_path in (
        app_dir / ".env",
        app_dir / ".env.local",
        cwd / ".env",
        cwd / ".env.local",
    ):
        if env_path.exists():
            load_dotenv(env_path, override=False)


def add_video_model_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--openclip-model", default="ViT-B-32")
    parser.add_argument("--openclip-pretrained", default="laion2b_s34b_b79k")
    parser.add_argument("--openai-model", default="gpt-5")
    parser.add_argument("--openai-api-key-env", default="OPENAI_API_KEY")
    parser.add_argument("--openai-image-detail", choices=["low", "high", "auto"], default="low")
    parser.add_argument("--dinov2-model", default="facebook/dinov2-small")
    parser.add_argument("--siglip-model", default="google/siglip-base-patch16-224")
    parser.add_argument("--qwen-model", default="Qwen/Qwen2.5-VL-7B-Instruct")
    parser.add_argument("--qwen-max-new-tokens", type=int, default=512)
    parser.add_argument("--qwen-torch-dtype", default="auto", choices=["auto", "float32", "float16", "bfloat16"])
    parser.add_argument("--qwen-device-map", default="auto")
    parser.add_argument("--embedding-out-dir", type=Path)
    parser.add_argument("--video-frame-rate", type=float, default=1.0)
    parser.add_argument("--video-max-frames", type=int, default=12)


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


if __name__ == "__main__":
    raise SystemExit(main())
