import type { PublicComboPredictedTone } from "@media-manager/contracts";
import { ToneWordPicker, ToneWordSubmitPile, useToneWordPicker } from "@media-manager/shared";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

import {
  TONE_WHEEL_DIMENSIONS,
  toneWheelPoints,
  toneWheelPolygon,
  toneWheelValues,
} from "../lib/tone-wheel";

type ToneExplorerProps = {
  disabled: boolean;
  loading: boolean;
  error: string | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (keywords: string[]) => void;
  showCloseControl: boolean;
};

export function ToneExplorer({
  disabled,
  loading,
  error,
  open,
  onClose,
  onSubmit,
  showCloseControl,
}: ToneExplorerProps) {
  const closeTimerRef = useRef<number | null>(null);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const picker = useToneWordPicker({
    seed: "darenkeck-tone-explorer",
    explorationMode: "distinct-other-roots",
    maxSelectedWords: 6,
  });

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscrollBehavior = root.style.overscrollBehavior;
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
      touchAction: body.style.touchAction,
    };

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.left = "0";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    body.style.position = "fixed";
    body.style.right = "0";
    body.style.top = `-${scrollY}px`;
    body.style.touchAction = "none";

    return () => {
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscrollBehavior;
      Object.assign(body.style, previousBodyStyles);
      window.scrollTo(scrollX, scrollY);
    };
  }, [open]);

  const closeExplorer = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setSubmitSucceeded(false);
    onClose();
  };

  const submitTone = () => {
    setSubmitSucceeded(true);
    onSubmit(picker.selectedWords);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setSubmitSucceeded(false);
      onClose();
    }, 1000);
  };

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[110] touch-none overscroll-none bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 print:hidden ${open ? "visible pointer-events-auto opacity-100" : "invisible pointer-events-none opacity-0"}`}
        data-tone-explorer-backdrop
      />

      {showCloseControl && open ? (
        <button
          aria-label="Close tone explorer"
          className="pointer-events-auto fixed z-[130] inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-300 bg-black/55 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.45)] backdrop-blur-sm transition hover:bg-black/75 [right:max(1.5rem,env(safe-area-inset-right))] [top:max(1.5rem,env(safe-area-inset-top))] print:hidden"
          data-tone-explorer-close
          onClick={closeExplorer}
          title="Close tone explorer"
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      ) : null}

      <div
        aria-hidden={!open}
        className={`pointer-events-none fixed inset-x-0 top-[33dvh] z-[120] -translate-y-1/2 px-3 transition-opacity duration-200 sm:px-20 print:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
        data-tone-explorer-suggestions
      >
        <ToneWordPicker
          className="pointer-events-auto"
          onNext={picker.showNextSuggestions}
          onToggleWord={picker.toggleWord}
          selectedWords={picker.selectedWordSet}
          suggestions={picker.suggestions}
          variant="combo-overlay"
        />
      </div>

      <div
        aria-hidden={!open}
        className={`pointer-events-none fixed left-4 z-[120] max-w-[calc(100vw-2rem)] transition-opacity duration-200 [bottom:max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:left-6 sm:[bottom:max(2.5rem,calc(env(safe-area-inset-bottom)+2rem))] print:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <ToneWordSubmitPile
          maxColumns={1}
          onSubmit={submitTone}
          onToggleWord={picker.toggleWord}
          selectedWords={picker.selectedWords}
          showWhenEmpty
          submitDisabled={disabled || loading || submitSucceeded}
          submitSucceeded={submitSucceeded}
          submitTitle={picker.selectedWords.length > 0 ? "Start tone walk" : "Start random walk"}
          submitting={loading && !submitSucceeded}
          wordTitle={(keyword) => `Remove ${keyword} from this walk.`}
        />
        {error ? (
          <p className="pointer-events-auto mt-2 max-w-sm rounded-lg border border-red-300/40 bg-black/70 px-3 py-2 text-xs text-red-100 shadow-lg backdrop-blur-sm">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}

type ToneExplorerExplainerProps = {
  onAccept: () => void;
  onDismiss: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export function ToneExplorerExplainer({
  onAccept,
  onDismiss,
  returnFocusRef,
}: ToneExplorerExplainerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable || focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [returnFocusRef]);

  return (
    <div
      aria-labelledby="tone-explorer-title"
      aria-describedby="tone-explorer-description"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm print:hidden"
      role="dialog"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/30 bg-slate-950/95 p-6 text-white shadow-2xl"
        ref={dialogRef}
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-sky-300/60 bg-sky-400/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.28)]">
          <ToneExplorerIcon />
        </div>
        <h2 className="text-xl font-semibold" id="tone-explorer-title">
          Walk by tone
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75" id="tone-explorer-description">
          Shape what plays next. Choose tone words and Submit to begin a nearby walk. Submit with
          none selected for a random walk.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-full px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={onDismiss}
            type="button"
          >
            Not now
          </button>
          <button
            autoFocus
            className="rounded-full border border-sky-200/90 bg-sky-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(56,189,248,0.4)] transition hover:bg-sky-300"
            onClick={onAccept}
            type="button"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToneExplorerIcon({ tone }: { tone?: PublicComboPredictedTone }) {
  const [displayedValues, setDisplayedValues] = useState(() => toneWheelValues(tone));
  const displayedValuesRef = useRef(displayedValues);
  displayedValuesRef.current = displayedValues;

  useEffect(() => {
    const startValues = displayedValuesRef.current;
    const targetValues = toneWheelValues(tone);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : 550;
    const startedAt = performance.now();
    let frameId = 0;

    const animate = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValues = startValues.map(
        (value, index) => value + ((targetValues[index] ?? value) - value) * eased
      );
      displayedValuesRef.current = nextValues;
      setDisplayedValues(nextValues);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [tone]);

  const points = toneWheelPoints(displayedValues);

  return (
    <svg
      aria-hidden="true"
      data-tone-wheel={tone ? "predicted" : "fallback"}
      fill="none"
      height="36"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      viewBox="0 0 24 24"
      width="36"
    >
      <circle cx="12" cy="12" opacity="0.2" r="5.8" strokeDasharray="1.2 1.8" />
      {points.map((point, index) => (
        <line
          key={TONE_WHEEL_DIMENSIONS[index]}
          opacity="0.45"
          strokeWidth="0.7"
          x1="12"
          x2={point.x}
          y1="12"
          y2={point.y}
        />
      ))}
      <polygon fill="currentColor" fillOpacity="0.12" points={toneWheelPolygon(points)} />
      <circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none" />
    </svg>
  );
}
