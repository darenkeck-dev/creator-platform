# @media-manager/tone-core

TypeScript-native tone analysis core for Media Manager Lambda workflows.

This package is the production-oriented Node path. The Python `apps/tone-embedding` CLI remains the experimental/reference implementation.

## Provides

- `asset-analysis/v1`, `combo-analysis/v1`, and tone taxonomy schemas.
- OpenAI audio and video analysis helpers.
- Video frame extraction through direct `ffmpeg` child process execution.
- Tone descriptor to vector mapping and tone word generation.
- Combo feature/vector generation.
- Cosine similarity/distance and top-k nearest-neighbor helpers.

## Local Smoke CLI

```bash
bun packages/tone-core/src/cli.ts analyze audio input.mp3 --asset-id audio-1 --out audio.analysis.json
bun packages/tone-core/src/cli.ts analyze video input.mp4 --asset-id video-1 --out video.analysis.json
```

Required environment:

- `OPENAI_API_KEY`
- `FFMPEG_PATH` if `ffmpeg` is not on `PATH`
- `OPENAI_AUDIO_STRUCTURE_MODEL` optional; defaults to `gpt-5`
