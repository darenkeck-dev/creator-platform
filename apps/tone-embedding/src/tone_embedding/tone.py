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
StructuredToneDescriptor = dict[str, str]

STRENGTH_SCORES = {
    "none": 0.0,
    "weak": 0.25,
    "medium": 0.55,
    "strong": 0.85,
    "extreme": 1.0,
}

DESCRIPTOR_RULES = (
    ("valence", 0.25, "uplifting", "melancholic"),
    ("arousal", 0.25, "energetic", "subdued"),
    ("warmth", 0.25, "warm", "cold"),
    ("tension", 0.25, "tense", "relaxed"),
    ("menace", 0.2, "threatening", "safe"),
    ("instability", 0.25, "unstable", "stable"),
    ("beauty", 0.25, "beautiful", "harsh"),
    ("nostalgia", 0.25, "nostalgic", "unsentimental"),
    ("intimacy", 0.25, "intimate", "distant"),
    ("dominance", 0.25, "commanding", "delicate"),
)

AVOID_RULES = {
    "uplifting": "melancholic",
    "melancholic": "joyful",
    "energetic": "subdued",
    "subdued": "energetic",
    "warm": "cold",
    "cold": "warm",
    "tense": "peaceful",
    "relaxed": "urgent",
    "threatening": "safe",
    "safe": "threatening",
    "unstable": "orderly",
    "stable": "chaotic",
    "beautiful": "harsh",
    "harsh": "polished",
    "nostalgic": "clinical",
    "unsentimental": "nostalgic",
    "intimate": "impersonal",
    "distant": "intimate",
    "commanding": "delicate",
    "delicate": "dominant",
}

DESCRIPTOR_TO_SCORE = {
    positive_word: (dimension, 1.0)
    for dimension, _, positive_word, _ in DESCRIPTOR_RULES
} | {
    negative_word: (dimension, -1.0)
    for dimension, _, _, negative_word in DESCRIPTOR_RULES
}


def tone_to_words(tone: ToneVector) -> dict[str, list[str] | str]:
    descriptors: list[tuple[float, str]] = []

    for dimension, threshold, positive_word, negative_word in DESCRIPTOR_RULES:
        value = tone.get(dimension, 0.0)
        if abs(value) >= threshold:
            descriptors.append((abs(value), positive_word if value > 0 else negative_word))

    descriptors.sort(key=lambda descriptor: descriptor[0], reverse=True)
    ranked_words = unique([word for _, word in descriptors])
    primary = ranked_words[:3]
    secondary = ranked_words[3:8]

    if not primary:
        primary = ["neutral", "balanced"]
        secondary = ["ambiguous"]

    avoid = unique(
        [
            AVOID_RULES[word]
            for word in primary + secondary
            if word in AVOID_RULES
        ]
    )
    avoid = [word for word in avoid if word not in primary and word not in secondary]

    return {
        "summary": summarize_descriptors(primary, secondary),
        "primary": primary,
        "secondary": secondary,
        "avoid": avoid,
    }


def structured_descriptors_to_tone(descriptors: list[StructuredToneDescriptor]) -> ToneVector:
    tone = {dimension: 0.0 for dimension in TONE_DIMENSIONS}

    for descriptor in descriptors:
        strength = descriptor.get("strength", "none")
        word = descriptor.get("descriptor", "")
        expected_dimension = descriptor.get("dimension")

        if strength not in STRENGTH_SCORES:
            raise ValueError(f"unsupported descriptor strength: {strength}")
        if word not in DESCRIPTOR_TO_SCORE:
            raise ValueError(f"unsupported tone descriptor: {word}")

        dimension, sign = DESCRIPTOR_TO_SCORE[word]
        if expected_dimension is not None and expected_dimension != dimension:
            raise ValueError(
                f"descriptor {word} belongs to {dimension}, not {expected_dimension}"
            )

        score = round(STRENGTH_SCORES[strength] * sign, 6)
        if abs(score) > abs(tone[dimension]):
            tone[dimension] = score

    return tone


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
