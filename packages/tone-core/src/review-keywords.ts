import type { ToneVector } from "./schemas.js";
import { descriptorMappings } from "./taxonomy.js";
import { round } from "./tone-vector.js";

const REVIEW_KEYWORD_ALIASES: Record<string, string[]> = {
  calm: ["peaceful"],
  playful: ["joyful"],
  cheerful: ["joyful"],
  celebratory: ["uplifting", "energetic"],
  breezy: ["relaxed"],
  carefree: ["relaxed"],
  sunny: ["uplifting", "warm"],
  beautiful: ["beautiful"],
  magical: ["beautiful"],
  radiant: ["beautiful", "uplifting"],
  serene: ["peaceful"],
  quiet: ["subdued"],
  relaxed: ["relaxed"],
  comforting: ["cozy", "safe"],
  gentle: ["safe", "delicate"],
  grounded: ["stable"],
  personal: ["intimate"],
  loving: ["intimate", "warm"],
  vulnerable: ["fragile", "intimate"],
  wistful: ["melancholic", "nostalgic"],
  blue: ["sad", "subdued"],
  reflective: ["subdued", "nostalgic"],
  grief: ["sad"],
  heartbreak: ["sad"],
  mourning: ["sad", "subdued"],
  nostalgic: ["nostalgic"],
  lonely: ["sad", "distant"],
  yearning: ["melancholic", "nostalgic"],
  worried: ["tense"],
  nervous: ["tense", "unstable"],
  uneasy: ["tense"],
  foreboding: ["threatening", "suspenseful"],
  doomed: ["threatening", "sad"],
  haunted: ["threatening", "nostalgic"],
  enigmatic: ["suspenseful"],
  secretive: ["suspenseful", "distant"],
  suspenseful: ["suspenseful"],
  tense: ["tense"],
  agitated: ["tense", "energetic", "unstable"],
  abrasive: ["harsh"],
  hostile: ["threatening"],
  combative: ["threatening", "commanding"],
  confrontational: ["tense", "commanding"],
  rebellious: ["commanding", "unstable"],
  forceful: ["commanding"],
  resistant: ["commanding", "tense"],
  vast: ["commanding"],
  dominant: ["commanding"],
  majestic: ["commanding", "beautiful"],
  eerie: ["suspenseful", "threatening"],
  surreal: ["unstable"],
  unstable: ["unstable"],
  ominous: ["threatening"],
  sinister: ["threatening"],
  bleak: ["sad", "cold"],
};

export function reviewKeywordsToToneScores(keywords: string[]): Partial<ToneVector> {
  const mappings = descriptorMappings();
  const descriptors = [
    ...new Set(
      keywords.flatMap((keyword) => {
        const normalized = keyword.trim().toLowerCase();
        return REVIEW_KEYWORD_ALIASES[normalized] ?? (mappings[normalized] ? [normalized] : []);
      })
    ),
  ];
  const scores: Partial<ToneVector> = {};

  for (const descriptor of descriptors) {
    for (const mapping of mappings[descriptor] ?? []) {
      scores[mapping.dimension] = round(
        Math.max(-1, Math.min(1, (scores[mapping.dimension] ?? 0) + mapping.weight))
      );
    }
  }

  return scores;
}
