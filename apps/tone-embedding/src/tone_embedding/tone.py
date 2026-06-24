from __future__ import annotations

import math


TONE_DIMENSIONS = (
    "valence",
    "arousal",
    "dominance",
    "warmth",
    "tension",
    "intimacy",
    "instability",
    "nostalgia",
    "beauty",
    "menace",
)

ToneVector = dict[str, float]


def tone_to_words(tone: ToneVector) -> dict[str, list[str] | str]:
    valence = tone.get("valence", 0.0)
    arousal = tone.get("arousal", 0.0)
    tension = tone.get("tension", arousal)
    warmth = tone.get("warmth", valence)
    menace = tone.get("menace", 0.0)
    instability = tone.get("instability", 0.0)
    beauty = tone.get("beauty", 0.0)
    nostalgia = tone.get("nostalgia", 0.0)
    intimacy = tone.get("intimacy", 0.0)

    primary: list[str] = []
    secondary: list[str] = []
    avoid: list[str] = []

    if valence <= -0.2 and arousal <= -0.2:
        primary.extend(["subdued", "calm", "melancholic"])
        secondary.extend(["restrained", "introspective"])
        avoid.extend(["joyful", "energetic"])
    elif valence <= -0.2 and arousal >= 0.2:
        primary.extend(["tense", "uneasy", "urgent"])
        secondary.extend(["restless", "pressurized"])
        avoid.extend(["peaceful", "comforting"])
    elif valence >= 0.2 and arousal >= 0.2:
        primary.extend(["bright", "energetic", "uplifting"])
        secondary.extend(["active", "confident"])
        avoid.extend(["subdued", "melancholic"])
    elif valence >= 0.2 and arousal <= -0.2:
        primary.extend(["gentle", "peaceful", "warm"])
        secondary.extend(["comfortable", "settled"])
        avoid.extend(["threatening", "chaotic"])
    else:
        primary.extend(["neutral", "balanced"])
        secondary.append("ambiguous")

    if warmth <= -0.2:
        secondary.append("cool")
    elif warmth >= 0.2:
        secondary.append("warm")

    if tension >= 0.35:
        secondary.append("tense")
    elif tension <= -0.35:
        secondary.append("low-tension")

    if menace >= 0.25:
        primary.append("threatening")
        avoid.append("safe")
    elif menace <= 0.05:
        secondary.append("non-threatening")

    if instability >= 0.35:
        secondary.append("unstable")
    elif instability <= -0.35:
        secondary.append("stable")

    if beauty >= 0.35:
        secondary.append("beautiful")
    if nostalgia >= 0.35:
        secondary.append("nostalgic")
    if intimacy >= 0.35:
        secondary.append("intimate")

    primary = unique(primary)
    secondary = unique([word for word in secondary if word not in primary])
    avoid = unique([word for word in avoid if word not in primary and word not in secondary])

    return {
        "summary": summarize_descriptors(primary, secondary),
        "primary": primary,
        "secondary": secondary,
        "avoid": avoid,
    }


def summarize_descriptors(primary: list[str], secondary: list[str]) -> str:
    words = primary[:3] or secondary[:3]
    if not words:
        return "No clear tone descriptors."

    return "A " + ", ".join(words) + " tone."


def unique(words: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for word in words:
        if word not in seen:
            seen.add(word)
            output.append(word)
    return output


def compute_congruence(audio_tone: ToneVector, video_tone: ToneVector) -> float:
    shared_dimensions = [
        dimension
        for dimension in TONE_DIMENSIONS
        if dimension in audio_tone and dimension in video_tone
    ]
    if not shared_dimensions:
        return 0.0

    dot = sum(audio_tone[dimension] * video_tone[dimension] for dimension in shared_dimensions)
    audio_norm = math.sqrt(sum(audio_tone[dimension] ** 2 for dimension in shared_dimensions))
    video_norm = math.sqrt(sum(video_tone[dimension] ** 2 for dimension in shared_dimensions))

    if audio_norm == 0 or video_norm == 0:
        return 0.0

    return round(dot / (audio_norm * video_norm), 6)
