"use client";

const MAX_KEYWORD_PILE_COLUMNS = 4;

export type ToneWordSubmitPileProps = {
  selectedWords: string[];
  onToggleWord: (word: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  submitSucceeded?: boolean;
  submitTitle: string;
  wordTitle: (word: string) => string;
  showWhenEmpty?: boolean;
  maxColumns?: number;
};

function keywordPilePlacements(keywords: string[], maxColumns: number) {
  const heights: number[] = Array.from({ length: Math.min(2, maxColumns) }, (_, index) =>
    index === 0 ? 1 : 0
  );

  return keywords.map((keyword) => {
    let column = 0;
    const existingColumns = heights.map((height, index) => ({ height, index }));
    const allExistingColumnsEven = heights.every((height) => height === heights[0]);

    if (allExistingColumnsEven && (heights[0] ?? 0) >= 2 && heights.length < maxColumns) {
      column = heights.length;
      heights.push(0);
    } else {
      const eligibleColumns = existingColumns.filter(({ index }) => {
        return index === 0 || (heights[index - 1] ?? 0) > (heights[index] ?? 0);
      });
      column =
        eligibleColumns.sort(
          (left, right) => left.height - right.height || left.index - right.index
        )[0]?.index ?? 0;
    }

    const rowFromBottom = heights[column] ?? 0;
    heights[column] = rowFromBottom + 1;
    return { column, keyword, rowFromBottom };
  });
}

export function ToneWordSubmitPile({
  selectedWords,
  onToggleWord,
  onSubmit,
  submitting = false,
  submitDisabled = false,
  submitSucceeded = false,
  submitTitle,
  wordTitle,
  showWhenEmpty = false,
  maxColumns = MAX_KEYWORD_PILE_COLUMNS,
}: ToneWordSubmitPileProps) {
  if (!showWhenEmpty && selectedWords.length === 0) {
    return null;
  }

  const boundedMaxColumns = Math.max(1, Math.min(MAX_KEYWORD_PILE_COLUMNS, maxColumns));
  const keywordPlacements = keywordPilePlacements(selectedWords, boundedMaxColumns);
  const pileRows = Math.max(
    1,
    ...keywordPlacements.map((placement) => placement.rowFromBottom + 1)
  );
  const pileGridRows = pileRows + 1;

  return (
    <div
      className="pointer-events-auto grid items-end gap-2 overflow-visible"
      style={{
        gridTemplateColumns: `repeat(${Math.max(1, Math.min(boundedMaxColumns, keywordPlacements.length + 1))}, max-content)`,
        gridTemplateRows: `repeat(${pileGridRows}, max-content)`,
      }}
    >
      <div style={{ gridColumn: 1, gridRow: pileGridRows }}>
        <button
          className="inline-flex w-28 items-center justify-center rounded-full border border-sky-200/90 bg-sky-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_24px_rgba(56,189,248,0.55)] transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:border-white/35 disabled:bg-black/55 disabled:text-white/60 disabled:shadow-none"
          disabled={submitting || submitDisabled}
          onClick={onSubmit}
          title={submitTitle}
          type="button"
        >
          {submitting ? (
            <svg
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
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
      </div>
      {keywordPlacements.map(({ column, keyword, rowFromBottom }) => (
        <button
          className="inline-flex w-32 items-center justify-between gap-1.5 rounded-full border border-sky-400 bg-black/45 px-3 py-1.5 text-sm text-white shadow-sm backdrop-blur-sm transition hover:bg-black/60"
          key={keyword}
          onClick={() => onToggleWord(keyword)}
          style={{ gridColumn: column + 1, gridRow: pileGridRows - rowFromBottom }}
          title={wordTitle(keyword)}
          type="button"
        >
          <span className="truncate">{keyword}</span>
          <svg
            aria-hidden="true"
            className="h-3 w-3 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 12 12"
          >
            <path d="M2 2l8 8M10 2L2 10" />
          </svg>
        </button>
      ))}
    </div>
  );
}
