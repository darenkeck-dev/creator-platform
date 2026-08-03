export type ReviewWordNode = {
  label: string;
  description: string;
  children?: ReviewWordNode[];
};

export type ReviewWord = {
  label: string;
  description: string;
  rootLabel: string;
  branchLabel: string;
  rootIndex: number;
  branchIndex: number;
  leafIndex: number;
};

export type ReviewWordExplorationMode = "any-other-root" | "distinct-other-roots";

export type AdaptiveReviewWordOptionsInput = {
  seed: string;
  selectedWords: string[];
  shownWords: string[];
  anchorWord?: string;
  round: number;
  explorationMode: ReviewWordExplorationMode;
};

export const REVIEW_WORDS_PER_PAGE = 5;
const ADJACENT_WORDS_PER_PAGE = 3;

export const REVIEW_KEYWORD_TREE: ReviewWordNode[] = [
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
          {
            label: "reflective",
            description: "Inward-looking and thoughtful with emotional weight.",
          },
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

export const REVIEW_WORDS: ReviewWord[] = REVIEW_KEYWORD_TREE.flatMap((root, rootIndex) =>
  (root.children ?? []).flatMap((branch, branchIndex) =>
    (branch.children ?? []).map((leaf, leafIndex) => ({
      label: leaf.label,
      description: leaf.description,
      rootLabel: root.label,
      branchLabel: branch.label,
      rootIndex,
      branchIndex,
      leafIndex,
    }))
  )
);

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

function pickWords(
  candidates: ReviewWord[],
  excluded: Set<string>,
  count: number,
  random: () => number
) {
  const picked: ReviewWord[] = [];
  for (const candidate of shuffled(candidates, random)) {
    if (picked.length >= count) break;
    if (excluded.has(candidate.label)) continue;
    excluded.add(candidate.label);
    picked.push(candidate);
  }
  return picked;
}

function pickWordsFromDistinctRoots(
  candidates: ReviewWord[],
  excluded: Set<string>,
  count: number,
  random: () => number
) {
  const roots = shuffled([...new Set(candidates.map((candidate) => candidate.rootIndex))], random);
  const picked: ReviewWord[] = [];

  for (const rootIndex of roots) {
    if (picked.length >= count) break;
    const [candidate] = pickWords(
      candidates.filter((word) => word.rootIndex === rootIndex),
      excluded,
      1,
      random
    );
    if (candidate) picked.push(candidate);
  }

  return picked;
}

export function initialReviewWordOptions(seed: string) {
  return pickWords(REVIEW_WORDS, new Set(), REVIEW_WORDS_PER_PAGE, seededRandom(seed));
}

export function buildAdaptiveReviewWordOptions(input: AdaptiveReviewWordOptionsInput) {
  const random = seededRandom(`${input.seed}:${input.round}:${input.anchorWord ?? "random"}`);
  const selectedSet = new Set(input.selectedWords);
  const shownSet = new Set(input.shownWords);
  const excluded = new Set([...selectedSet, ...shownSet]);
  const anchor = input.anchorWord
    ? REVIEW_WORDS.find((word) => word.label === input.anchorWord)
    : undefined;

  if (!anchor) {
    return pickWords(REVIEW_WORDS, excluded, REVIEW_WORDS_PER_PAGE, random);
  }

  const sameBranch = REVIEW_WORDS.filter(
    (word) => word.rootIndex === anchor.rootIndex && word.branchIndex === anchor.branchIndex
  );
  const sameRoot = REVIEW_WORDS.filter(
    (word) => word.rootIndex === anchor.rootIndex && word.branchIndex !== anchor.branchIndex
  );
  const adjacent = [
    ...pickWords(sameBranch, excluded, ADJACENT_WORDS_PER_PAGE, random),
    ...pickWords(sameRoot, excluded, ADJACENT_WORDS_PER_PAGE, random),
  ].slice(0, ADJACENT_WORDS_PER_PAGE);
  const explorationCount = REVIEW_WORDS_PER_PAGE - adjacent.length;
  const otherRootWords = REVIEW_WORDS.filter((word) => word.rootIndex !== anchor.rootIndex);
  const explorationPicker =
    input.explorationMode === "distinct-other-roots" ? pickWordsFromDistinctRoots : pickWords;
  const exploration = [
    ...explorationPicker(otherRootWords, excluded, explorationCount, random),
    ...pickWords(REVIEW_WORDS, excluded, explorationCount, random),
  ].slice(0, explorationCount);
  const options = shuffled([...adjacent, ...exploration], random);

  if (options.length === REVIEW_WORDS_PER_PAGE) return options;

  const fallbackExcluded = new Set([...selectedSet, ...options.map((option) => option.label)]);
  return [
    ...options,
    ...pickWords(REVIEW_WORDS, fallbackExcluded, REVIEW_WORDS_PER_PAGE - options.length, random),
  ];
}
