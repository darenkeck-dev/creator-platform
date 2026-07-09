from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from .manifest import MediaAsset, MediaManifest


@dataclass(frozen=True)
class PreprocessingPlan:
    commands: list[list[str]]


def build_preprocessing_plan(manifest: MediaManifest, out_dir: Path) -> PreprocessingPlan:
    commands: list[list[str]] = []

    for asset in manifest.assets:
        input_path = preprocessing_input_path(asset, out_dir)
        if asset.source.kind == "s3":
            commands.append(
                [
                    "aws",
                    "s3",
                    "cp",
                    f"s3://{asset.source.bucket}/{asset.source.key}",
                    str(input_path),
                ]
            )

        if asset.type == "audio":
            output = out_dir / "audio" / f"{asset.id}.wav"
            commands.append(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(input_path),
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    str(output),
                ]
            )
        else:
            output = out_dir / "frames" / asset.id / "%06d.jpg"
            commands.append(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(input_path),
                    "-vf",
                    "fps=1,scale=224:224:force_original_aspect_ratio=decrease,pad=224:224:(ow-iw)/2:(oh-ih)/2",
                    str(output),
                ]
            )

    return PreprocessingPlan(commands=commands)


def execute_preprocessing_plan(plan: PreprocessingPlan) -> None:
    for command in plan.commands:
        prepare_command_output(command)
        subprocess.run(command, check=True)


def prepare_command_output(command: list[str]) -> None:
    if not command:
        return

    output = Path(command[-1])
    output.parent.mkdir(parents=True, exist_ok=True)


def preprocessing_input_path(asset: MediaAsset, out_dir: Path) -> Path:
    if asset.source.kind == "file":
        return asset.source.path

    filename = Path(asset.source.key).name or asset.id
    return out_dir / "sources" / asset.id / filename
