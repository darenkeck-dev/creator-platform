import { ToneWordPicker, ToneWordSubmitPile, useToneWordPicker } from "@media-manager/shared";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

type ToneExplorerProps = {
  disabled: boolean;
  loading: boolean;
  error: string | null;
  open: boolean;
  onSubmit: (keywords: string[]) => void;
};

export function ToneExplorer({ disabled, loading, error, open, onSubmit }: ToneExplorerProps) {
  const picker = useToneWordPicker({
    seed: "darenkeck-tone-explorer",
    explorationMode: "distinct-other-roots",
    maxSelectedWords: 6,
  });

  return (
    <>
      <div
        aria-hidden={!open}
        className={`pointer-events-none fixed inset-x-0 top-[calc(max(1.5rem,env(safe-area-inset-top))+4rem)] z-[120] px-3 transition-opacity duration-200 sm:top-[max(1.5rem,env(safe-area-inset-top))] sm:px-20 print:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
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
          onSubmit={() => onSubmit(picker.selectedWords)}
          onToggleWord={picker.toggleWord}
          selectedWords={picker.selectedWords}
          showWhenEmpty
          submitDisabled={disabled || loading}
          submitTitle={picker.selectedWords.length > 0 ? "Start tone walk" : "Start random walk"}
          submitting={loading}
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

export function ToneExplorerIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="24"
    >
      <circle cx="12" cy="12" r="2.4" />
      <path d="M4.5 9.2c2.8-4.7 9.3-6.1 13.7-2.8 3.4 2.6 2.5 6.5-.8 8.8-3.6 2.6-9.5 2.7-12.7-.7-2.1-2.2-1.6-4.2-.2-5.3Z" />
      <path d="M8.1 3.8c4.5 1 8.5 5.6 8.1 10.1-.3 3.7-3.3 6.8-6.4 5.7-3.5-1.3-4.8-7.1-3.1-11.4.8-2.1 1.3-3.4 1.4-4.4Z" />
      <circle cx="18.8" cy="6.2" fill="currentColor" r="1" stroke="none" />
    </svg>
  );
}
