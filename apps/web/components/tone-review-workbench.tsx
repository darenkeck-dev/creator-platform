"use client";

import type { AssetDetailResponse, ToneReviewRecord, ToneReviewTargetType } from "@media-manager/contracts";
import { ComboToneReviewPlayer } from "@media-manager/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReviewMediaPlayer } from "@/components/review-media-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Asset = AssetDetailResponse["asset"];
type ToneScores = NonNullable<NonNullable<Asset["toneAnalysis"]>["scores"]>;
type ToneScoreKey = keyof ToneScores;

type ReviewTarget = {
  targetType: ToneReviewTargetType;
  targetId: string;
  label: string;
  title: string;
  taxonomyVersion?: "tone-taxonomy/v1" | "tone-taxonomy/v2";
  sourceVideoAssetId?: string;
  sourceAudioAssetId?: string;
};

type ReviewMedia =
  | {
      targetType: "combo";
      id: string;
      videoTitle: string;
      audioTitle: string;
      videoSrc: string;
      audioSrc: string;
    }
  | {
      targetType: "video";
      asset: Asset;
    }
  | {
      targetType: "audio";
      asset: Asset;
    };

type KeywordNode = {
  label: string;
  description: string;
  children?: KeywordNode[];
};

type Props = {
  target: ReviewTarget;
  media: ReviewMedia;
  targetReviews: Array<{
    review: ToneReviewRecord;
  }>;
};

const SCORE_KEYS: Array<[ToneScoreKey, string]> = [
  ["valence", "Valence"],
  ["arousal", "Arousal"],
  ["dominance", "Dominance"],
  ["warmth", "Warmth"],
  ["tension", "Tension"],
  ["intimacy", "Intimacy"],
  ["instability", "Instability"],
  ["nostalgia", "Nostalgia"],
  ["beauty", "Beauty"],
  ["menace", "Menace"],
];

const MAX_KEYWORDS = 24;
const MIN_KEYWORDS_TO_SUBMIT = 3;
const KEYWORDS_PER_PAGE = 5;
const ADJACENT_KEYWORDS_PER_PAGE = 3;

const SCORE_DESCRIPTIONS: Record<ToneScoreKey, string> = {
  valence:
    "How pleasant or unpleasant the selected target feels overall. Negative means unpleasant; positive means pleasant.",
  arousal:
    "How activated, energetic, or intense the selected target feels. Low means calm or still; high means energized or urgent.",
  dominance:
    "How powerful, forceful, large, or controlling the selected target feels. Low means fragile or submissive; high means potent or commanding.",
  warmth: "How emotionally warm, kind, safe, or human the selected target feels.",
  tension: "How strained, suspenseful, pressured, or unresolved the selected target feels.",
  intimacy: "How close, private, personal, or emotionally near the selected target feels.",
  instability:
    "How unpredictable, chaotic, volatile, or mentally unsettled the selected target feels.",
  nostalgia: "How memory-like, wistful, past-oriented, or longing the selected target feels.",
  beauty: "How aesthetically graceful, moving, elegant, or sublime the selected target feels.",
  menace: "How threatening, dangerous, predatory, or ominous the selected target feels.",
};

const KEYWORD_TREE: KeywordNode[] = [
  {
    label: "Joy / Pleasure",
    description: "Positive, pleasurable emotional tone, from light delight to high-energy celebration.",
    children: [
      {
        label: "Bright",
        description: "Clear, sunny, optimistic pleasure without much heaviness.",
        children: [
          { label: "playful", description: "Light, teasing, game-like joy." },
          { label: "cheerful", description: "Openly happy, upbeat, and positive." },
          { label: "sunny", description: "Warm, bright, and optimistic in feeling." },
        ],
      },
      {
        label: "Excited",
        description: "High-energy positive emotion with activation and lift.",
        children: [
          { label: "euphoric", description: "Overwhelming, elevated happiness." },
          { label: "thrilling", description: "Exciting, fast, and pleasurefully intense." },
          { label: "celebratory", description: "Triumphant, festive, or communal joy." },
        ],
      },
      {
        label: "Light",
        description: "Easy positive tone with low burden or seriousness.",
        children: [
          { label: "breezy", description: "Effortless, relaxed, and airy." },
          { label: "fun", description: "Enjoyable, lively, and accessible." },
          { label: "carefree", description: "Unburdened, free, and unconcerned." },
        ],
      },
    ],
  },
  {
    label: "Calm / Safety",
    description: "Low-arousal comfort, peace, and emotional safety.",
    children: [
      {
        label: "Peaceful",
        description: "Stillness and quiet emotional ease.",
        children: [
          { label: "serene", description: "Deeply calm, clear, and undisturbed." },
          { label: "quiet", description: "Soft, hushed, and low in activity." },
          { label: "still", description: "Motionless or suspended in a calm way." },
        ],
      },
      {
        label: "Safe",
        description: "Protection, comfort, and absence of threat.",
        children: [
          { label: "comforting", description: "Reassuring, soothing, and emotionally protective." },
          { label: "gentle", description: "Soft, careful, and non-threatening." },
          { label: "sheltered", description: "Protected from outside pressure or danger." },
        ],
      },
      {
        label: "Grounded",
        description: "Stable, balanced, and emotionally centered tone.",
        children: [
          { label: "stable", description: "Steady and unlikely to shift suddenly." },
          { label: "balanced", description: "Even, controlled, and proportionate." },
          { label: "relaxed", description: "Loose, easy, and unpressured." },
        ],
      },
    ],
  },
  {
    label: "Tenderness / Intimacy",
    description: "Close, private, warm, vulnerable, or affectionate emotional tone.",
    children: [
      {
        label: "Close",
        description: "Emotional nearness and personal access.",
        children: [
          { label: "personal", description: "Specific, individual, and directly felt." },
          { label: "private", description: "Intimate and not meant for a crowd." },
          { label: "confessional", description: "Revealing inner thoughts or feelings." },
        ],
      },
      {
        label: "Affectionate",
        description: "Care, love, and warmth directed toward someone or something.",
        children: [
          { label: "loving", description: "Clearly caring, attached, or devoted." },
          { label: "warm", description: "Kind, human, and emotionally inviting." },
          { label: "caring", description: "Protective, attentive, and compassionate." },
        ],
      },
      {
        label: "Fragile",
        description: "Soft vulnerability that could be easily hurt or disturbed.",
        children: [
          { label: "delicate", description: "Fine, subtle, and easily disrupted." },
          { label: "vulnerable", description: "Open to harm, exposure, or emotional risk." },
          { label: "soft", description: "Gentle, yielding, and low in force." },
        ],
      },
    ],
  },
  {
    label: "Sadness / Longing",
    description: "Negative or bittersweet low-to-mid arousal tone: loss, loneliness, memory, or yearning.",
    children: [
      {
        label: "Melancholy",
        description: "Reflective sadness with softness or beauty rather than acute pain.",
        children: [
          { label: "wistful", description: "Gently sad, reflective, and longing for something absent." },
          { label: "blue", description: "Plainly sad, subdued, or emotionally low." },
          { label: "reflective", description: "Inward-looking and thoughtful with emotional weight." },
        ],
      },
      {
        label: "Sorrow",
        description: "More direct sadness connected to loss, pain, or grief.",
        children: [
          { label: "grief", description: "Deep sadness tied to loss." },
          { label: "heartbreak", description: "Painful sadness around love, separation, or disappointment." },
          { label: "mourning", description: "Ritualized or sustained sadness after loss." },
        ],
      },
      {
        label: "Longing",
        description: "Desire for something absent, past, unreachable, or far away.",
        children: [
          { label: "nostalgic", description: "Emotionally tied to memory or the past." },
          { label: "lonely", description: "Isolated, alone, or emotionally separated." },
          { label: "yearning", description: "Strongly wanting something distant or missing." },
        ],
      },
    ],
  },
  {
    label: "Fear / Unease",
    description: "Anxiety, dread, vulnerability, or anticipation of harm.",
    children: [
      {
        label: "Anxiety",
        description: "Nervous uncertainty and anticipatory worry.",
        children: [
          { label: "worried", description: "Concerned that something may go wrong." },
          { label: "nervous", description: "Physically or emotionally tense with uncertainty." },
          { label: "uneasy", description: "Subtly uncomfortable or unsettled." },
        ],
      },
      {
        label: "Dread",
        description: "Heavier fear that something bad is approaching or inevitable.",
        children: [
          { label: "foreboding", description: "Suggesting danger before it arrives." },
          { label: "doomed", description: "Marked by inevitability and no clear escape." },
          { label: "haunted", description: "Troubled by memory, ghosts, or lingering threat." },
        ],
      },
      {
        label: "Vulnerability",
        description: "Fear rooted in exposure, weakness, or lack of protection.",
        children: [
          { label: "exposed", description: "Unprotected, seen, or open to harm." },
          { label: "helpless", description: "Unable to control or resist what is happening." },
          { label: "fragile", description: "Easily damaged emotionally or physically." },
        ],
      },
    ],
  },
  {
    label: "Anger / Friction",
    description: "Conflict, irritation, resistance, aggression, or combative force.",
    children: [
      {
        label: "Irritation",
        description: "Lower-scale anger, abrasion, or agitation.",
        children: [
          { label: "tense", description: "Tight, pressured, and emotionally strained." },
          { label: "abrasive", description: "Rough, harsh, or unpleasantly forceful." },
          { label: "agitated", description: "Restless, stirred up, and unsettled." },
        ],
      },
      {
        label: "Conflict",
        description: "Direct opposition, confrontation, or hostility.",
        children: [
          { label: "hostile", description: "Openly unfriendly or antagonistic." },
          { label: "combative", description: "Ready to fight or push back." },
          { label: "confrontational", description: "Directly challenging or opposing." },
        ],
      },
      {
        label: "Defiance",
        description: "Resistance with agency, force, or refusal to submit.",
        children: [
          { label: "rebellious", description: "Rejecting control, rules, or authority." },
          { label: "forceful", description: "Assertive, driving, and high in pressure." },
          { label: "resistant", description: "Pushing against something imposed." },
        ],
      },
    ],
  },
  {
    label: "Power / Awe",
    description: "Scale, dominance, grandeur, reverence, or overwhelming force.",
    children: [
      {
        label: "Grand",
        description: "Large-scale impact, size, or significance.",
        children: [
          { label: "vast", description: "Immense in space, feeling, or implication." },
          { label: "epic", description: "Large, dramatic, and high-stakes." },
          { label: "monumental", description: "Massive, enduring, and important." },
        ],
      },
      {
        label: "Commanding",
        description: "Dominant, controlling, or imposing power.",
        children: [
          { label: "dominant", description: "Clearly in control or above others in force." },
          { label: "forceful", description: "Strongly pushing, driving, or asserting itself." },
          { label: "imposing", description: "Large, serious, and hard to ignore." },
        ],
      },
      {
        label: "Sacred",
        description: "Reverent, transcendent, or spiritually elevated power.",
        children: [
          { label: "reverent", description: "Respectful, solemn, and spiritually attentive." },
          { label: "transcendent", description: "Beyond ordinary experience or scale." },
          { label: "majestic", description: "Noble, elevated, and grandly beautiful." },
        ],
      },
    ],
  },
  {
    label: "Mystery / Suspense",
    description: "Ambiguity, hidden information, anticipation, and unresolved tension.",
    children: [
      {
        label: "Curious",
        description: "Intrigue that pulls attention toward something unknown.",
        children: [
          { label: "enigmatic", description: "Difficult to interpret, but compelling." },
          { label: "cryptic", description: "Coded, hidden, or intentionally unclear." },
          { label: "secretive", description: "Withholding information or concealing intent." },
        ],
      },
      {
        label: "Suspenseful",
        description: "Tension around what may happen next.",
        children: [
          { label: "anticipatory", description: "Waiting for a significant event or reveal." },
          { label: "unresolved", description: "Open-ended, incomplete, or not settled." },
          { label: "cliffhanging", description: "Suspended at a point of imminent consequence." },
        ],
      },
      {
        label: "Noir",
        description: "Shadowed suspicion, concealment, and morally ambiguous atmosphere.",
        children: [
          { label: "shadowy", description: "Dark, partially hidden, or obscured." },
          { label: "suspicious", description: "Suggesting hidden motives or mistrust." },
          { label: "concealed", description: "Covered, masked, or kept from view." },
        ],
      },
    ],
  },
  {
    label: "Beauty / Wonder",
    description: "Aesthetic grace, enchantment, sublimity, or emotionally moving beauty.",
    children: [
      {
        label: "Elegant",
        description: "Refined, graceful, and aesthetically controlled beauty.",
        children: [
          { label: "graceful", description: "Smooth, poised, and aesthetically flowing." },
          { label: "refined", description: "Polished, precise, and restrained." },
          { label: "delicate", description: "Fine, subtle, and lightly beautiful." },
        ],
      },
      {
        label: "Sublime",
        description: "Beauty that feels large, overwhelming, or deeply moving.",
        children: [
          { label: "breathtaking", description: "Striking enough to stop attention." },
          { label: "radiant", description: "Glowing, luminous, or emotionally bright." },
          { label: "moving", description: "Emotionally affecting in an aesthetic way." },
        ],
      },
      {
        label: "Dreamlike",
        description: "Wonder shaped by unreality, enchantment, or soft imagination.",
        children: [
          { label: "magical", description: "Enchanting, impossible, or charmed." },
          { label: "luminous", description: "Softly glowing or filled with light." },
          { label: "enchanted", description: "Touched by spell-like wonder or charm." },
        ],
      },
    ],
  },
  {
    label: "Strangeness / Instability",
    description: "Uncanny, chaotic, disorienting, surreal, or mentally unstable tone.",
    children: [
      {
        label: "Uncanny",
        description: "Familiar but wrong, eerie, or subtly unnatural.",
        children: [
          { label: "eerie", description: "Quietly strange in a way that raises unease." },
          { label: "off-kilter", description: "Slightly wrong, tilted, or misaligned." },
          { label: "surreal", description: "Dream-logic or reality-bending strangeness." },
        ],
      },
      {
        label: "Chaotic",
        description: "Uncontrolled motion, fragmentation, volatility, or overload.",
        children: [
          { label: "unstable", description: "Likely to shift, break, or lose balance." },
          { label: "frantic", description: "Rushed, panicked, or uncontrolled energy." },
          { label: "fragmented", description: "Broken into pieces or difficult to hold together." },
        ],
      },
      {
        label: "Disoriented",
        description: "Loss of bearings, warped perception, or confused direction.",
        children: [
          { label: "dizzying", description: "Overwhelming or hard to track spatially or emotionally." },
          { label: "warped", description: "Bent, distorted, or perceptually altered." },
          { label: "unmoored", description: "Untethered, drifting, or lacking stable reference." },
        ],
      },
    ],
  },
  {
    label: "Darkness / Menace",
    description: "Threat, danger, bleakness, cruelty, or ominous hostile presence.",
    children: [
      {
        label: "Ominous",
        description: "Threatening atmosphere before danger is fully visible.",
        children: [
          { label: "threatening", description: "Clearly suggests harm or danger." },
          { label: "heavy", description: "Weighted, oppressive, and difficult to escape." },
          { label: "looming", description: "Approaching or hanging overhead as a threat." },
        ],
      },
      {
        label: "Predatory",
        description: "Active danger, cruelty, or hunting energy.",
        children: [
          { label: "dangerous", description: "Capable of causing harm." },
          { label: "sinister", description: "Secretly evil, threatening, or malicious." },
          { label: "cruel", description: "Emotionally cold, harmful, or without mercy." },
        ],
      },
      {
        label: "Bleak",
        description: "Darkness with emptiness, despair, or lack of relief.",
        children: [
          { label: "grim", description: "Severe, joyless, and harsh." },
          { label: "desolate", description: "Empty, abandoned, and emotionally barren." },
          { label: "hopeless", description: "Without visible escape, help, or recovery." },
        ],
      },
    ],
  },
];

const REVIEW_KEYWORD_TREE: KeywordNode[] = [
  {
    label: "Positive",
    description: "Pleasure, delight, lightness, beauty, or wonder.",
    children: [
      {
        label: "Joy",
        description: "Open positive emotion, from playful to celebratory.",
        children: [
          { label: "playful", description: "Light, teasing, game-like joy." },
          { label: "cheerful", description: "Openly happy, upbeat, and positive." },
          { label: "celebratory", description: "Triumphant, festive, or communal joy." },
        ],
      },
      {
        label: "Lightness",
        description: "Easy positive tone with low burden or seriousness.",
        children: [
          { label: "breezy", description: "Effortless, relaxed, and airy." },
          { label: "carefree", description: "Unburdened, free, and unconcerned." },
          { label: "sunny", description: "Warm, bright, and optimistic in feeling." },
        ],
      },
      {
        label: "Wonder",
        description: "Aesthetic lift, enchantment, or moving beauty.",
        children: [
          { label: "beautiful", description: "Aesthetically pleasing or moving." },
          { label: "magical", description: "Enchanting, impossible, or charmed." },
          { label: "radiant", description: "Glowing, luminous, or emotionally bright." },
        ],
      },
    ],
  },
  {
    label: "Calm / Tender",
    description: "Peace, safety, warmth, intimacy, or vulnerability.",
    children: [
      {
        label: "Peaceful",
        description: "Stillness and quiet emotional ease.",
        children: [
          { label: "serene", description: "Deeply calm, clear, and undisturbed." },
          { label: "quiet", description: "Soft, hushed, and low in activity." },
          { label: "relaxed", description: "Loose, easy, and unpressured." },
        ],
      },
      {
        label: "Safe",
        description: "Protection, comfort, and absence of threat.",
        children: [
          { label: "comforting", description: "Reassuring, soothing, and emotionally protective." },
          { label: "gentle", description: "Soft, careful, and non-threatening." },
          { label: "grounded", description: "Stable, balanced, and emotionally centered." },
        ],
      },
      {
        label: "Intimate",
        description: "Emotional nearness, affection, or private vulnerability.",
        children: [
          { label: "personal", description: "Specific, individual, and directly felt." },
          { label: "loving", description: "Clearly caring, attached, or devoted." },
          { label: "vulnerable", description: "Open to harm, exposure, or emotional risk." },
        ],
      },
    ],
  },
  {
    label: "Sad / Longing",
    description: "Melancholy, sorrow, nostalgia, loneliness, or yearning.",
    children: [
      {
        label: "Melancholy",
        description: "Reflective sadness with softness or beauty rather than acute pain.",
        children: [
          { label: "wistful", description: "Gently sad and longing for something absent." },
          { label: "blue", description: "Plainly sad, subdued, or emotionally low." },
          { label: "reflective", description: "Inward-looking and thoughtful with emotional weight." },
        ],
      },
      {
        label: "Loss",
        description: "Direct sadness connected to grief, heartbreak, or mourning.",
        children: [
          { label: "grief", description: "Deep sadness tied to loss." },
          { label: "heartbreak", description: "Painful sadness around love or separation." },
          { label: "mourning", description: "Sustained sadness after loss." },
        ],
      },
      {
        label: "Longing",
        description: "Desire for something absent, past, unreachable, or far away.",
        children: [
          { label: "nostalgic", description: "Emotionally tied to memory or the past." },
          { label: "lonely", description: "Isolated, alone, or emotionally separated." },
          { label: "yearning", description: "Strongly wanting something distant or missing." },
        ],
      },
    ],
  },
  {
    label: "Fear / Suspense",
    description: "Anxiety, dread, mystery, uncertainty, or anticipation.",
    children: [
      {
        label: "Anxiety",
        description: "Nervous uncertainty and anticipatory worry.",
        children: [
          { label: "worried", description: "Concerned that something may go wrong." },
          { label: "nervous", description: "Tense with uncertainty." },
          { label: "uneasy", description: "Subtly uncomfortable or unsettled." },
        ],
      },
      {
        label: "Dread",
        description: "Heavier fear that something bad is approaching or inevitable.",
        children: [
          { label: "foreboding", description: "Suggesting danger before it arrives." },
          { label: "doomed", description: "Marked by inevitability and no clear escape." },
          { label: "haunted", description: "Troubled by memory, ghosts, or lingering threat." },
        ],
      },
      {
        label: "Mystery",
        description: "Hidden information, ambiguity, or unresolved anticipation.",
        children: [
          { label: "enigmatic", description: "Difficult to interpret, but compelling." },
          { label: "secretive", description: "Withholding information or concealing intent." },
          { label: "suspenseful", description: "Tense around what may happen next." },
        ],
      },
    ],
  },
  {
    label: "Anger / Tension",
    description: "Irritation, conflict, pressure, resistance, or aggressive force.",
    children: [
      {
        label: "Pressure",
        description: "Tight, strained, agitated, or unresolved energy.",
        children: [
          { label: "tense", description: "Tight, pressured, and emotionally strained." },
          { label: "agitated", description: "Restless, stirred up, and unsettled." },
          { label: "abrasive", description: "Rough, harsh, or unpleasantly forceful." },
        ],
      },
      {
        label: "Conflict",
        description: "Direct opposition, confrontation, or hostility.",
        children: [
          { label: "hostile", description: "Openly unfriendly or antagonistic." },
          { label: "combative", description: "Ready to fight or push back." },
          { label: "confrontational", description: "Directly challenging or opposing." },
        ],
      },
      {
        label: "Defiance",
        description: "Resistance with agency, force, or refusal to submit.",
        children: [
          { label: "rebellious", description: "Rejecting control, rules, or authority." },
          { label: "forceful", description: "Assertive, driving, and high in pressure." },
          { label: "resistant", description: "Pushing against something imposed." },
        ],
      },
    ],
  },
  {
    label: "Power / Strange / Dark",
    description: "Awe, dominance, uncanniness, instability, menace, or bleakness.",
    children: [
      {
        label: "Power",
        description: "Scale, dominance, grandeur, or overwhelming force.",
        children: [
          { label: "vast", description: "Immense in space, feeling, or implication." },
          { label: "dominant", description: "Clearly in control or forceful." },
          { label: "majestic", description: "Noble, elevated, and grandly beautiful." },
        ],
      },
      {
        label: "Strange",
        description: "Uncanny, chaotic, disorienting, or surreal tone.",
        children: [
          { label: "eerie", description: "Quietly strange in a way that raises unease." },
          { label: "surreal", description: "Dream-logic or reality-bending strangeness." },
          { label: "unstable", description: "Likely to shift, break, or lose balance." },
        ],
      },
      {
        label: "Dark",
        description: "Threat, danger, bleakness, cruelty, or ominous presence.",
        children: [
          { label: "ominous", description: "Threatening atmosphere before danger is visible." },
          { label: "sinister", description: "Secretly evil, threatening, or malicious." },
          { label: "bleak", description: "Dark, empty, and lacking relief." },
        ],
      },
    ],
  },
];

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function initialScoreState(): Record<ToneScoreKey, number> {
  return Object.fromEntries(
    SCORE_KEYS.map(([key]) => [key, 0])
  ) as Record<ToneScoreKey, number>;
}

type KeywordLeaf = KeywordNode & {
  rootLabel: string;
  branchLabel: string;
  rootIndex: number;
  branchIndex: number;
  leafIndex: number;
};

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex] as T, next[index] as T];
  }
  return next;
}

function keywordLeaves() {
  return REVIEW_KEYWORD_TREE.flatMap((root, rootIndex) =>
    (root.children ?? []).flatMap((branch, branchIndex) =>
      (branch.children ?? []).map((leaf, leafIndex) => ({
        ...leaf,
        rootLabel: root.label,
        branchLabel: branch.label,
        rootIndex,
        branchIndex,
        leafIndex,
      }))
    )
  );
}

function pickKeywords(
  candidates: KeywordLeaf[],
  excluded: Set<string>,
  count: number,
  random: () => number
) {
  const picked: KeywordLeaf[] = [];
  for (const candidate of shuffled(candidates, random)) {
    if (picked.length >= count) {
      break;
    }
    if (excluded.has(candidate.label)) {
      continue;
    }
    excluded.add(candidate.label);
    picked.push(candidate);
  }
  return picked;
}

function buildAdaptiveKeywordOptions(input: {
  seed: string;
  selectedKeywords: string[];
  shownKeywords: string[];
  anchorKeyword?: string;
  round: number;
}) {
  const leaves = keywordLeaves();
  const random = seededRandom(`${input.seed}:${input.round}:${input.anchorKeyword ?? "random"}`);
  const selectedSet = new Set(input.selectedKeywords);
  const shownSet = new Set(input.shownKeywords);
  const excluded = new Set([...selectedSet, ...shownSet]);

  const anchor = input.anchorKeyword
    ? leaves.find((leaf) => leaf.label === input.anchorKeyword)
    : undefined;
  if (!anchor) {
    return pickKeywords(leaves, excluded, KEYWORDS_PER_PAGE, random);
  }

  const sameBranch = leaves.filter(
    (leaf) => leaf.rootIndex === anchor.rootIndex && leaf.branchIndex === anchor.branchIndex
  );
  const sameRoot = leaves.filter(
    (leaf) => leaf.rootIndex === anchor.rootIndex && leaf.branchIndex !== anchor.branchIndex
  );
  const adjacent = [
    ...pickKeywords(sameBranch, excluded, ADJACENT_KEYWORDS_PER_PAGE, random),
    ...pickKeywords(sameRoot, excluded, ADJACENT_KEYWORDS_PER_PAGE, random),
  ].slice(0, ADJACENT_KEYWORDS_PER_PAGE);
  const randomExplorationCount = KEYWORDS_PER_PAGE - adjacent.length;
  const differentRootLeaves = leaves.filter((leaf) => leaf.rootIndex !== anchor.rootIndex);
  const randomExploration = [
    ...pickKeywords(differentRootLeaves, excluded, randomExplorationCount, random),
    ...pickKeywords(leaves, excluded, randomExplorationCount, random),
  ].slice(0, randomExplorationCount);
  const options = shuffled([...adjacent, ...randomExploration], random);

  if (options.length === KEYWORDS_PER_PAGE) {
    return options;
  }

  const fallbackExcluded = new Set([...selectedSet, ...options.map((option) => option.label)]);
  return [
    ...options,
    ...pickKeywords(leaves, fallbackExcluded, KEYWORDS_PER_PAGE - options.length, random),
  ];
}

function initialKeywordOptions(seed: string) {
  const random = seededRandom(seed);
  return pickKeywords(keywordLeaves(), new Set(), KEYWORDS_PER_PAGE, random);
}

export function ToneReviewWorkbench({
  target,
  media,
  targetReviews,
}: Props) {
  const router = useRouter();
  const targetIndex = 0;
  const targetKey = String(targetIndex);
  const keywordSeed = `${target.targetType}:${target.targetId}`;
  const [selectedKeywordsByTarget, setSelectedKeywordsByTarget] = useState<Record<string, string[]>>(
    () => ({ "0": [] })
  );
  const [scoresByTarget, setScoresByTarget] = useState<Record<string, Record<ToneScoreKey, number>>>(
    () => ({ "0": initialScoreState() })
  );
  const [keywordOptionsByTarget, setKeywordOptionsByTarget] = useState<Record<string, KeywordLeaf[]>>(
    () => ({ [targetKey]: initialKeywordOptions(keywordSeed) })
  );
  const [shownKeywordsByTarget, setShownKeywordsByTarget] = useState<Record<string, string[]>>(
    () => ({ [targetKey]: keywordOptionsByTarget[targetKey]?.map((keyword) => keyword.label) ?? [] })
  );
  const [lastSelectedKeywordByTarget, setLastSelectedKeywordByTarget] = useState<Record<string, string | undefined>>({});
  const [keywordRoundByTarget, setKeywordRoundByTarget] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedKeywords = selectedKeywordsByTarget[targetKey] ?? [];
  const scores = scoresByTarget[targetKey] ?? initialScoreState();
  const currentKeywordOptions = keywordOptionsByTarget[targetKey] ?? [];
  const selectedKeywordSet = new Set(selectedKeywords);

  useEffect(() => {
    function handleNextLoading() {
      setLoadingNext(true);
    }

    window.addEventListener("review:next-loading", handleNextLoading);
    return () => window.removeEventListener("review:next-loading", handleNextLoading);
  }, []);

  function toggleKeyword(keyword: string) {
    setSubmitSucceeded(false);
    const selecting = !selectedKeywordSet.has(keyword);
    setSelectedKeywordsByTarget((previous) => {
      const current = previous[targetKey] ?? [];
      const next = current.includes(keyword)
        ? current.filter((entry) => entry !== keyword)
        : [...current, keyword].slice(0, MAX_KEYWORDS);
      return {
        ...previous,
        [targetKey]: next,
      };
    });
    setLastSelectedKeywordByTarget((previous) => ({
      ...previous,
      [targetKey]: selecting ? keyword : previous[targetKey] === keyword ? undefined : previous[targetKey],
    }));
  }

  function showNextKeywordOptions() {
    const nextRound = (keywordRoundByTarget[targetKey] ?? 0) + 1;
    const nextOptions = buildAdaptiveKeywordOptions({
      seed: keywordSeed,
      selectedKeywords,
      shownKeywords: shownKeywordsByTarget[targetKey] ?? [],
      anchorKeyword: lastSelectedKeywordByTarget[targetKey],
      round: nextRound,
    });
    setKeywordRoundByTarget((previous) => ({ ...previous, [targetKey]: nextRound }));
    setKeywordOptionsByTarget((previous) => ({ ...previous, [targetKey]: nextOptions }));
    setShownKeywordsByTarget((previous) => ({
      ...previous,
      [targetKey]: unique([
        ...(previous[targetKey] ?? []),
        ...nextOptions.map((keyword) => keyword.label),
      ]),
    }));
  }

  async function submitReview() {
    setSubmitting(true);
    setSubmitSucceeded(false);
    setMessage(null);

    try {
      const response = await fetch("/api/tone-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: target.targetType,
          targetId: target.targetId,
          reviewSource: "curator",
          ...(target.taxonomyVersion ? { taxonomyVersion: target.taxonomyVersion } : {}),
          ...(target.targetType === "combo"
            ? {
                sourceVideoAssetId: target.sourceVideoAssetId,
                sourceAudioAssetId: target.sourceAudioAssetId,
              }
            : {}),
          keywords: selectedKeywords,
          scores,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      setMessage(`Saved ${target.label.toLowerCase()} review.`);
      setSubmitSucceeded(true);
    } catch {
      setSubmitSucceeded(false);
      setMessage("Could not save review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComboReview(payload: {
    keywords: string[];
    scores: Record<ToneScoreKey, number>;
  }) {
    setSubmitSucceeded(false);
    setMessage(null);

    const response = await fetch("/api/tone-reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: target.targetType,
        targetId: target.targetId,
        reviewSource: "curator",
        ...(target.taxonomyVersion ? { taxonomyVersion: target.taxonomyVersion } : {}),
        ...(target.targetType === "combo"
          ? {
              sourceVideoAssetId: target.sourceVideoAssetId,
              sourceAudioAssetId: target.sourceAudioAssetId,
            }
          : {}),
        keywords: payload.keywords,
        scores: payload.scores,
      }),
    });

    if (!response.ok) {
      setMessage("Could not save review. Please try again.");
      throw new Error("Failed to submit review");
    }

    setMessage(`Saved ${target.label.toLowerCase()} review.`);
    setSubmitSucceeded(true);
  }

  function loadNextCombo() {
    if (media.targetType !== "combo") {
      return;
    }

    setLoadingNext(true);
    const params = new URLSearchParams({ targetType: "combo", next: String(Date.now()) });
    params.set("previousTargetId", media.id);
    if (target.sourceAudioAssetId) {
      params.set("previousAudioAssetId", target.sourceAudioAssetId);
    }
    router.push(`/review?${params.toString()}`);
    router.refresh();
  }

  const keywordPicker = (
    <div className="pointer-events-auto w-full space-y-1.5 text-white">
      <style>{`
        @keyframes tone-review-button-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {currentKeywordOptions.length > 0 ? (
        <div className="space-y-1.5" key={`${target.targetType}:${target.targetId}:${keywordRoundByTarget[targetKey] ?? 0}`}>
          <div className="flex items-center justify-center gap-2">
            <div className="flex min-w-0 flex-wrap justify-center gap-2" style={{ animation: "tone-review-button-in 140ms ease-out both" }}>
              {currentKeywordOptions.map((node) => {
                const selected = selectedKeywordSet.has(node.label);
                return (
                  <button
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition hover:border-white/70 hover:bg-white/20",
                      selected
                        ? "border-white/80 bg-white/85 text-black"
                        : "border-white/30 bg-white/10 text-white"
                    )}
                    key={node.label}
                    onClick={() => toggleKeyword(node.label)}
                    title={node.description}
                    type="button"
                  >
                    {node.label}
                  </button>
                );
              })}
            </div>
            <button
              aria-label="Show next keyword options"
              className="flex h-8 min-w-6 items-center justify-center px-1 text-xl font-semibold text-white transition hover:text-white/75"
              onClick={showNextKeywordOptions}
              type="button"
            >
              &gt;
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  const submitIconButton = selectedKeywords.length >= MIN_KEYWORDS_TO_SUBMIT ? (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-70"
      disabled={submitting}
      onClick={() => void submitReview()}
      title="Submit review"
      type="button"
    >
      {submitting ? (
        <svg
          aria-hidden="true"
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </svg>
      ) : submitSucceeded ? (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : null}
      {submitSucceeded ? "Saved" : "Submit"}
    </button>
  ) : null;

  const selectedKeywordRow = selectedKeywords.length > 0 ? (
    <div className="pointer-events-auto flex w-full min-w-0 max-w-full items-end justify-between gap-2 overflow-hidden">
      <div className="flex min-w-0 flex-1 gap-2" style={{ flexWrap: "wrap-reverse" }}>
        {selectedKeywords.map((keyword) => (
          <button
            className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-sm text-black shadow-sm transition hover:bg-white"
            key={keyword}
            onClick={() => toggleKeyword(keyword)}
            title={`Remove ${keyword} from this review.`}
            type="button"
          >
            {keyword}
          </button>
        ))}
      </div>
      {submitIconButton}
    </div>
  ) : null;

  const isAudioReview = media.targetType === "audio";

  return (
    <section className="space-y-6">
      <div className="space-y-6">
        <div className="relative">
          {media.targetType === "combo" ? (
            <ComboToneReviewPlayer
              combo={{
                comboId: media.id,
                videoAssetId: target.sourceVideoAssetId ?? "",
                audioAssetId: target.sourceAudioAssetId ?? "",
                videoTitle: media.videoTitle,
                audioTitle: media.audioTitle,
                videoSrc: media.videoSrc,
                audioSrc: media.audioSrc,
              }}
              loadingNext={loadingNext}
              onNext={loadNextCombo}
              onSubmit={(payload) => submitComboReview(payload)}
              scores={scores}
            />
          ) : isAudioReview ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-black p-4 shadow-sm sm:p-6">{keywordPicker}</div>
              <ReviewMediaPlayer {...media} />
              {selectedKeywordRow ? (
                <div className="pointer-events-none rounded-xl bg-black p-4 shadow-sm sm:p-6">
                  {selectedKeywordRow}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <ReviewMediaPlayer {...media} />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 py-4 sm:px-6 sm:py-6">
                {keywordPicker}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 py-4 sm:px-6 sm:py-6">
                {selectedKeywordRow}
              </div>
            </>
          )}
          {media.targetType !== "combo" && loadingNext ? (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/20">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/35 border-t-white" />
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reviewing
              </p>
              <h2 className="mt-1 text-lg font-semibold">{target.title}</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {SCORE_KEYS.map(([key, label]) => (
              <label className="block text-sm" key={key}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    {label}
                    <span
                      aria-label={`${label}: ${SCORE_DESCRIPTIONS[key]}`}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold text-muted-foreground"
                      role="img"
                      tabIndex={0}
                      title={SCORE_DESCRIPTIONS[key]}
                    >
                      i
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{scores[key].toFixed(2)}</span>
                </div>
                <input
                  className="w-full accent-primary"
                  max="1"
                  min="-1"
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setScoresByTarget((previous) => ({
                      ...previous,
                      [targetKey]: { ...scores, [key]: value },
                    }));
                  }}
                  step="0.05"
                  type="range"
                  value={scores[key]}
                />
              </label>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            {media.targetType !== "combo" ? (
              <Button disabled={submitting} onClick={() => void submitReview()} type="button">
                {submitting ? "Saving..." : "Save Review"}
              </Button>
            ) : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Reviews For This {target.label}</h2>
        <div className="mt-3 space-y-2">
          {targetReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews for this {target.label.toLowerCase()} yet.</p>
          ) : null}
          {targetReviews.map(({ review }) => (
            <div className="rounded-lg border px-3 py-2 text-sm" key={review.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{new Date(review.createdAt).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{review.reviewSource}</span>
              </div>
              {review.keywords.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {review.keywords.map((keyword) => (
                    <span className="rounded-full border px-2 py-0.5 text-xs" key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
