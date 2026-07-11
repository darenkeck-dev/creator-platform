"use client";

import { useEffect, useState } from "react";

import { ComboPlayer } from "./combo-player";

export type ToneReviewScores = {
  valence: number;
  arousal: number;
  dominance: number;
  warmth: number;
  tension: number;
  intimacy: number;
  instability: number;
  nostalgia: number;
  beauty: number;
  menace: number;
};

export type ComboToneReviewPayload = {
  targetType: "combo";
  targetId: string;
  sourceVideoAssetId: string;
  sourceAudioAssetId: string;
  keywords: string[];
  scores: ToneReviewScores;
};

export type ComboToneReviewPlayerProps = {
  combo: {
    comboId: string;
    videoAssetId: string;
    audioAssetId: string;
    videoTitle: string;
    audioTitle: string;
    videoSrc: string;
    audioSrc: string;
  };
  scores: ToneReviewScores;
  className?: string;
  loadingNext?: boolean;
  minKeywordsToSubmit?: number;
  onNext?: () => void;
  onSubmit: (payload: ComboToneReviewPayload) => Promise<void> | void;
};

type KeywordNode = {
  label: string;
  description: string;
  children?: KeywordNode[];
};

type KeywordLeaf = KeywordNode & {
  rootIndex: number;
  branchIndex: number;
  leafIndex: number;
};

const MAX_KEYWORDS = 24;
const DEFAULT_MIN_KEYWORDS_TO_SUBMIT = 3;
const KEYWORDS_PER_PAGE = 5;
const ADJACENT_KEYWORDS_PER_PAGE = 3;
const MAX_KEYWORD_PILE_COLUMNS = 4;

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

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

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

function pickKeywordsFromDistinctRoots(
  candidates: KeywordLeaf[],
  excluded: Set<string>,
  count: number,
  random: () => number
) {
  const roots = shuffled(
    [...new Set(candidates.map((candidate) => candidate.rootIndex))],
    random
  );
  const picked: KeywordLeaf[] = [];

  for (const rootIndex of roots) {
    if (picked.length >= count) {
      break;
    }

    const rootCandidates = candidates.filter((candidate) => candidate.rootIndex === rootIndex);
    const [candidate] = pickKeywords(rootCandidates, excluded, 1, random);
    if (candidate) {
      picked.push(candidate);
    }
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
    ...pickKeywordsFromDistinctRoots(differentRootLeaves, excluded, randomExplorationCount, random),
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
  return pickKeywords(keywordLeaves(), new Set(), KEYWORDS_PER_PAGE, seededRandom(seed));
}

function keywordPilePlacements(keywords: string[]) {
  const heights = [1, 0];

  return keywords.map((keyword) => {
    let column = 0;
    const existingColumns = heights.map((height, index) => ({ height, index }));
    const allExistingColumnsEven = heights.every((height) => height === heights[0]);

    if (allExistingColumnsEven && (heights[0] ?? 0) >= 2 && heights.length < MAX_KEYWORD_PILE_COLUMNS) {
      column = heights.length;
      heights.push(0);
    } else {
      const eligibleColumns = existingColumns.filter(({ index }) => {
        return index === 0 || (heights[index - 1] ?? 0) > (heights[index] ?? 0);
      });
      column = eligibleColumns.sort((left, right) => left.height - right.height || left.index - right.index)[0]?.index ?? 0;
    }

    const rowFromBottom = heights[column] ?? 0;
    heights[column] = rowFromBottom + 1;
    return { column, keyword, rowFromBottom };
  });
}

export function neutralToneReviewScores(): ToneReviewScores {
  return {
    valence: 0,
    arousal: 0,
    dominance: 0,
    warmth: 0,
    tension: 0,
    intimacy: 0,
    instability: 0,
    nostalgia: 0,
    beauty: 0,
    menace: 0,
  };
}

export function ComboToneReviewPlayer({
  combo,
  scores,
  className,
  loadingNext = false,
  minKeywordsToSubmit = DEFAULT_MIN_KEYWORDS_TO_SUBMIT,
  onNext,
  onSubmit,
}: ComboToneReviewPlayerProps) {
  const keywordSeed = `combo:${combo.comboId}`;
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [keywordOptions, setKeywordOptions] = useState<KeywordLeaf[]>(() => initialKeywordOptions(keywordSeed));
  const [shownKeywords, setShownKeywords] = useState<string[]>(() => keywordOptions.map((keyword) => keyword.label));
  const [lastSelectedKeyword, setLastSelectedKeyword] = useState<string | undefined>();
  const [keywordRound, setKeywordRound] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const selectedKeywordSet = new Set(selectedKeywords);
  const keywordPlacements = keywordPilePlacements(selectedKeywords);
  const pileRows = Math.max(1, ...keywordPlacements.map((placement) => placement.rowFromBottom + 1));
  const pileGridRows = pileRows + 1;

  useEffect(() => {
    const initialOptions = initialKeywordOptions(keywordSeed);
    setSelectedKeywords([]);
    setKeywordOptions(initialOptions);
    setShownKeywords(initialOptions.map((keyword) => keyword.label));
    setLastSelectedKeyword(undefined);
    setKeywordRound(0);
    setSubmitting(false);
    setSubmitSucceeded(false);
  }, [keywordSeed]);

  function toggleKeyword(keyword: string) {
    setSubmitSucceeded(false);
    const selecting = !selectedKeywordSet.has(keyword);
    setSelectedKeywords((previous) =>
      previous.includes(keyword)
        ? previous.filter((entry) => entry !== keyword)
        : [...previous, keyword].slice(0, MAX_KEYWORDS)
    );
    setLastSelectedKeyword((previous) =>
      selecting ? keyword : previous === keyword ? undefined : previous
    );
  }

  function showNextKeywordOptions() {
    const nextRound = keywordRound + 1;
    const nextOptions = buildAdaptiveKeywordOptions({
      seed: keywordSeed,
      selectedKeywords,
      shownKeywords,
      anchorKeyword: lastSelectedKeyword,
      round: nextRound,
    });
    setKeywordRound(nextRound);
    setKeywordOptions(nextOptions);
    setShownKeywords((previous) => unique([...previous, ...nextOptions.map((keyword) => keyword.label)]));
  }

  async function submitReview() {
    setSubmitting(true);
    setSubmitSucceeded(false);
    try {
      await onSubmit({
        targetType: "combo",
        targetId: combo.comboId,
        sourceVideoAssetId: combo.videoAssetId,
        sourceAudioAssetId: combo.audioAssetId,
        keywords: selectedKeywords,
        scores,
      });
      setSubmitSucceeded(true);
    } finally {
      setSubmitting(false);
    }
  }

  const submitButton = selectedKeywords.length > 0 ? (
    <button
      className="inline-flex w-28 items-center justify-center rounded-full border border-sky-200/90 bg-sky-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_24px_rgba(56,189,248,0.55)] transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:border-white/35 disabled:bg-black/55 disabled:text-white/60 disabled:shadow-none"
      disabled={submitting || selectedKeywords.length < minKeywordsToSubmit}
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
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        "Submit"
      )}
    </button>
  ) : null;

  return (
    <div
      className={cx("relative overflow-hidden rounded-2xl border bg-black shadow-sm", className)}
      style={{ minHeight: 420, height: "min(72vh, 760px)" }}
    >
      <ComboPlayer
        key={combo.comboId}
        audioSrc={combo.audioSrc}
        audioTitle={combo.audioTitle}
        defaultAudioMuted={false}
        audioMutedByDefault={false}
        className="h-full w-full"
        comboId={combo.comboId}
        preload="auto"
        variant="background"
        videoSrc={combo.videoSrc}
        videoTitle={combo.videoTitle}
      />

      {onNext ? (
        <button
          className={cx(
            "pointer-events-auto rounded-full border bg-black/45 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-70",
            submitSucceeded ? "border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.45)]" : "border-white/50"
          )}
          disabled={loadingNext}
          onClick={onNext}
          style={{ bottom: 24, position: "absolute", right: 24, zIndex: 120 }}
          type="button"
        >
          {loadingNext ? "Loading..." : "Next"}
        </button>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 px-4 py-4 sm:px-6 sm:py-6" style={{ zIndex: 120 }}>
        <div className="pointer-events-auto grid grid-cols-[1fr_auto] items-center gap-2 text-white sm:grid-cols-[1fr_minmax(0,auto)_1fr] sm:gap-8">
          <div className="hidden sm:block" />
          <div className="flex min-w-0 flex-wrap justify-center gap-2 sm:max-w-[min(72vw,48rem)]">
            {keywordOptions.map((node) => {
              const selected = selectedKeywordSet.has(node.label);
              return (
                <button
                  className={cx(
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
            className="flex h-8 min-w-8 items-center justify-end px-1 text-xl font-semibold text-white transition hover:text-white/75 sm:min-w-10 sm:justify-start"
            onClick={showNextKeywordOptions}
            type="button"
          >
            &gt;
          </button>
        </div>
      </div>

      {selectedKeywords.length > 0 ? (
        <div
          className="pointer-events-none"
          style={{ bottom: 24, left: 24, maxWidth: "calc(100% - 9rem)", position: "absolute", zIndex: 120 }}
        >
          <div
            className="pointer-events-auto grid items-end gap-2 overflow-visible"
            style={{
              gridTemplateColumns: `repeat(${Math.max(2, Math.min(MAX_KEYWORD_PILE_COLUMNS, keywordPlacements.length + 1))}, max-content)`,
              gridTemplateRows: `repeat(${pileGridRows}, max-content)`,
            }}
          >
            <div style={{ gridColumn: 1, gridRow: pileGridRows }}>{submitButton}</div>
            {keywordPlacements.map(({ column, keyword, rowFromBottom }) => (
              <button
                className="rounded-full border border-sky-400 bg-transparent px-3 py-1.5 text-sm text-white shadow-sm transition hover:bg-sky-400/15"
                key={keyword}
                onClick={() => toggleKeyword(keyword)}
                style={{ gridColumn: column + 1, gridRow: pileGridRows - rowFromBottom }}
                title={`Remove ${keyword} from this review.`}
                type="button"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loadingNext ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/35 border-t-white" />
        </div>
      ) : null}
    </div>
  );
}
