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


class HelpFormatter(argparse.RawDescriptionHelpFormatter):
    def _get_help_string(self, action: argparse.Action) -> str | None:
        help_text = action.help
        if help_text is None:
            return None
        if "%(default)" in help_text:
            return help_text
        if (
            action.option_strings
            and not action.required
            and action.default is not None
            and action.default is not argparse.SUPPRESS
        ):
            return f"{help_text} (default: %(default)s)"
        return help_text


def main(argv: list[str] | None = None) -> int:
    load_local_env_files()
    parser = argparse.ArgumentParser(
        prog="tone-embedding",
        description="Generate versioned tone and semantic metadata for audio/video assets.",
        epilog="""examples:
  tone-embedding analyze audio input.mp3 --asset-id audio-1 --out audio.analysis.json
  tone-embedding analyze video input.mp4 --asset-id video-1 --models primary --out video.analysis.json
  tone-embedding bundle create --analysis video.analysis.json --asset-id video-1 --out video-1.tonebundle.tar.gz
  tone-embedding extract manifest.json --audio-model openai --video-model openai --out asset-analysis.jsonl

Run `tone-embedding COMMAND --help` for command-specific flags.
""",
        formatter_class=HelpFormatter,
    )
    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
        metavar="COMMAND",
        title="commands",
    )

    manifest_parser = subparsers.add_parser(
        "manifest",
        help="Validate manifest files.",
        description="Validate tone manifest files and optionally check local file sources.",
        formatter_class=HelpFormatter,
    )
    manifest_subparsers = manifest_parser.add_subparsers(dest="manifest_command", required=True, metavar="COMMAND", title="manifest commands")
    validate_parser = manifest_subparsers.add_parser(
        "validate",
        help="Validate a manifest JSON file.",
        description="Validate a manifest JSON file.",
        formatter_class=HelpFormatter,
    )
    validate_parser.add_argument("manifest", type=Path, metavar="MANIFEST", help="Manifest JSON file to validate.")
    validate_parser.add_argument(
        "--check-files",
        action="store_true",
        help="Verify local file sources exist. S3 sources are not checked.",
    )

    analyze_parser = subparsers.add_parser(
        "analyze",
        help="Analyze one local audio or video file.",
        description="Analyze one staged local media file and write a single asset-analysis/v1 JSON object.",
        epilog="Run `tone-embedding analyze audio --help` or `tone-embedding analyze video --help` for model and output flags.",
        formatter_class=HelpFormatter,
    )
    analyze_subparsers = analyze_parser.add_subparsers(dest="analyze_command", required=True, metavar="MEDIA_TYPE", title="media types")
    analyze_audio_parser = analyze_subparsers.add_parser(
        "audio",
        help="Analyze one audio file.",
        description="Analyze one audio file and write a single asset-analysis/v1 JSON object.",
        formatter_class=HelpFormatter,
    )
    analyze_audio_parser.add_argument("input", type=Path, metavar="AUDIO_FILE", help="Local audio file to analyze.")
    analyze_audio_parser.add_argument("--out", type=Path, required=True, metavar="JSON", help="Output asset-analysis JSON file.")
    analyze_audio_parser.add_argument("--asset-id", default="audio-1", metavar="ID", help="Asset id to write into the analysis row.")
    analyze_audio_parser.add_argument("--title", metavar="TITLE", help="Optional asset title.")
    analyze_audio_parser.add_argument(
        "--model",
        choices=["placeholder", "essentia", "openai"],
        default="openai",
        help="Audio tone adapter to use.",
    )
    analyze_audio_parser.add_argument("--essentia-embedding-model", type=Path, metavar="PATH", help="Essentia embedding model path used with --model essentia.")
    analyze_audio_parser.add_argument("--essentia-valence-arousal-model", type=Path, metavar="PATH", help="Essentia valence/arousal model path used with --model essentia.")
    analyze_audio_parser.add_argument(
        "--essentia-output-range",
        choices=["unit", "bipolar", "deam"],
        default="deam",
        help="Range emitted by the Essentia valence/arousal head before normalization.",
    )
    analyze_audio_parser.add_argument("--openai-audio-model", default="gpt-audio", metavar="MODEL", help="OpenAI audio-capable model used with --model openai.")
    analyze_audio_parser.add_argument("--openai-api-key-env", default="OPENAI_API_KEY", metavar="ENV", help="Environment variable containing the OpenAI API key.")

    analyze_video_parser = analyze_subparsers.add_parser(
        "video",
        help="Analyze one video file.",
        description="Analyze one video file and write a single asset-analysis/v1 JSON object.",
        formatter_class=HelpFormatter,
    )
    analyze_video_parser.add_argument("input", type=Path, metavar="VIDEO_FILE", help="Local video file to analyze.")
    analyze_video_parser.add_argument("--out", type=Path, required=True, metavar="JSON", help="Output asset-analysis JSON file.")
    analyze_video_parser.add_argument("--asset-id", default="video-1", metavar="ID", help="Asset id to write into the analysis row.")
    analyze_video_parser.add_argument("--title", metavar="TITLE", help="Optional asset title.")
    analyze_video_parser.add_argument(
        "--models",
        default="openai",
        help="Comma-separated video models. Use 'primary' for OpenAI-only Lambda-friendly analysis.",
    )
    add_video_model_options(analyze_video_parser)

    extract_parser = subparsers.add_parser(
        "extract",
        help="Analyze assets from a manifest.",
        description="Analyze manifest assets and write asset-analysis/v1 rows as JSONL.",
        formatter_class=HelpFormatter,
    )
    extract_parser.add_argument("manifest", type=Path, metavar="MANIFEST", help="Manifest JSON file.")
    extract_parser.add_argument("--out", type=Path, required=True, metavar="JSONL", help="Output asset-analysis JSONL file.")
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

    preprocess_parser = subparsers.add_parser(
        "preprocess",
        help="Plan or run source staging/preprocessing.",
        description="Build a preprocessing plan for manifest assets and optionally execute it.",
        formatter_class=HelpFormatter,
    )
    preprocess_parser.add_argument("manifest", type=Path, metavar="MANIFEST", help="Manifest JSON file.")
    preprocess_parser.add_argument("--out-dir", type=Path, required=True, metavar="DIR", help="Output directory for staged/preprocessed files.")
    preprocess_parser.add_argument(
        "--execute",
        action="store_true",
        help="Run preprocessing commands. By default commands are printed only.",
    )

    bundle_parser = subparsers.add_parser(
        "bundle",
        help="Create, inspect, or extract tone bundles.",
        description="Manage tone-analysis-bundle/v1 .tonebundle.tar.gz artifacts.",
        epilog="Run `tone-embedding bundle create --help`, `inspect --help`, or `extract --help` for command-specific flags.",
        formatter_class=HelpFormatter,
    )
    bundle_subparsers = bundle_parser.add_subparsers(dest="bundle_command", required=True, metavar="COMMAND", title="bundle commands")
    bundle_create_parser = bundle_subparsers.add_parser("create", help="Create a tone bundle.", description="Create one tone-analysis-bundle/v1 artifact.", formatter_class=HelpFormatter)
    bundle_create_parser.add_argument("--analysis", type=Path, required=True, metavar="JSON_OR_JSONL", help="Input asset-analysis JSON object, JSON array, or JSONL file.")
    bundle_create_parser.add_argument("--out", type=Path, required=True, metavar="BUNDLE", help="Output .tonebundle.tar.gz path.")
    bundle_create_parser.add_argument("--asset-id", metavar="ID", help="Optional asset id filter when the analysis file has multiple rows.")
    bundle_inspect_parser = bundle_subparsers.add_parser("inspect", help="Print a bundle manifest.", description="Print a tone bundle manifest JSON.", formatter_class=HelpFormatter)
    bundle_inspect_parser.add_argument("bundle", type=Path, metavar="BUNDLE", help="Bundle file to inspect.")
    bundle_extract_parser = bundle_subparsers.add_parser("extract", help="Extract bundle contents.", description="Extract a tone bundle to a directory.", formatter_class=HelpFormatter)
    bundle_extract_parser.add_argument("bundle", type=Path, metavar="BUNDLE", help="Bundle file to extract.")
    bundle_extract_parser.add_argument("--out-dir", type=Path, required=True, metavar="DIR", help="Directory to extract into.")

    combo_parser = subparsers.add_parser(
        "combo",
        help="Build combo-analysis/v1 rows.",
        description="Build descriptive combo-analysis/v1 rows from existing asset analysis outputs.",
        epilog="Run `tone-embedding combo analyze --help` or `tone-embedding combo build --help` for command-specific flags.",
        formatter_class=HelpFormatter,
    )
    combo_subparsers = combo_parser.add_subparsers(dest="combo_command", required=True, metavar="COMMAND", title="combo commands")
    combo_analyze_parser = combo_subparsers.add_parser("analyze", help="Analyze manifest combo definitions.", description="Build combo-analysis/v1 rows for combos defined in a manifest.", formatter_class=HelpFormatter)
    combo_analyze_parser.add_argument("manifest", type=Path, metavar="MANIFEST", help="Manifest JSON file with combo definitions.")
    combo_analyze_parser.add_argument("--analysis", type=Path, required=True, metavar="JSONL", help="Asset-analysis JSONL file.")
    combo_analyze_parser.add_argument("--out", type=Path, required=True, metavar="JSONL", help="Output combo-analysis JSONL file.")
    combo_build_parser = combo_subparsers.add_parser("build", help="Build one combo row from two analysis files.", description="Build one combo-analysis/v1 row from one audio and one video analysis file.", formatter_class=HelpFormatter)
    combo_build_parser.add_argument("--audio-analysis", type=Path, required=True, metavar="JSON", help="Audio asset-analysis JSON/JSONL file.")
    combo_build_parser.add_argument("--video-analysis", type=Path, required=True, metavar="JSON", help="Video asset-analysis JSON/JSONL file.")
    combo_build_parser.add_argument("--out", type=Path, required=True, metavar="JSON", help="Output combo-analysis JSON file.")
    combo_build_parser.add_argument("--combo-id", default="combo-1", metavar="ID", help="Combo id for the output row.")
    combo_build_parser.add_argument("--audio-asset-id", metavar="ID", help="Audio asset id to select when input has multiple rows.")
    combo_build_parser.add_argument("--video-asset-id", metavar="ID", help="Video asset id to select when input has multiple rows.")

    neighbors_parser = subparsers.add_parser(
        "neighbors",
        help="Run local nearest-neighbor checks.",
        description="Run local development nearest-neighbor queries over combo-analysis vectors.",
        epilog="Run `tone-embedding neighbors query --help` for query flags.",
        formatter_class=HelpFormatter,
    )
    neighbors_subparsers = neighbors_parser.add_subparsers(dest="neighbors_command", required=True, metavar="COMMAND", title="neighbors commands")
    neighbors_query_parser = neighbors_subparsers.add_parser("query", help="Query nearest combo-analysis vectors.", description="Query nearest combo-analysis vectors from local JSON/JSONL files.", formatter_class=HelpFormatter)
    neighbors_query_parser.add_argument("--combo-analysis", type=Path, required=True, metavar="JSON", help="Query combo-analysis JSON/JSONL file.")
    neighbors_query_parser.add_argument("--candidates", type=Path, required=True, metavar="JSONL", help="Candidate combo-analysis JSON/JSONL file.")
    neighbors_query_parser.add_argument("--out", type=Path, metavar="JSON", help="Optional output JSON file for query results.")
    neighbors_query_parser.add_argument("--top-k", type=int, default=10, metavar="N", help="Number of nearest neighbors to return.")

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
    parser.add_argument("--openclip-model", default="ViT-B-32", metavar="MODEL", help="OpenCLIP model name used with --models openclip.")
    parser.add_argument("--openclip-pretrained", default="laion2b_s34b_b79k", metavar="CHECKPOINT", help="OpenCLIP pretrained checkpoint used with --models openclip.")
    parser.add_argument("--openai-model", default="gpt-5", metavar="MODEL", help="OpenAI vision model used with --models openai or primary.")
    parser.add_argument("--openai-api-key-env", default="OPENAI_API_KEY", metavar="ENV", help="Environment variable containing the OpenAI API key.")
    parser.add_argument("--openai-image-detail", choices=["low", "high", "auto"], default="low", help="OpenAI image detail setting for sampled frames.")
    parser.add_argument("--dinov2-model", default="facebook/dinov2-small", metavar="MODEL", help="DINOv2 checkpoint used with --models dinov2.")
    parser.add_argument("--siglip-model", default="google/siglip-base-patch16-224", metavar="MODEL", help="SigLIP checkpoint used with --models siglip.")
    parser.add_argument("--qwen-model", default="Qwen/Qwen2.5-VL-7B-Instruct", metavar="MODEL", help="Qwen-VL checkpoint used with --models qwen-vl.")
    parser.add_argument("--qwen-max-new-tokens", type=int, default=512, metavar="N", help="Maximum generated tokens for --models qwen-vl.")
    parser.add_argument("--qwen-torch-dtype", default="auto", choices=["auto", "float32", "float16", "bfloat16"], help="Torch dtype for --models qwen-vl.")
    parser.add_argument("--qwen-device-map", default="auto", metavar="DEVICE", help="Transformers device_map for --models qwen-vl. Use 'mps' for native macOS Apple Silicon GPU execution.")
    parser.add_argument("--embedding-out-dir", type=Path, metavar="DIR", help="Directory for embedding files emitted by embedding-based adapters.")
    parser.add_argument("--video-frame-rate", type=float, default=1.0, metavar="FPS", help="Frames per second to sample for video analysis.")
    parser.add_argument("--video-max-frames", type=int, default=12, metavar="N", help="Maximum sampled frames per video.")


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


if __name__ == "__main__":
    raise SystemExit(main())
