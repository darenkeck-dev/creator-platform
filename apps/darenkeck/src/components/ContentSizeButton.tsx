import type { Ref } from "react";

type ContentSizeButtonProps = {
  buttonRef?: Ref<HTMLButtonElement>;
  expanded: boolean;
  onClick: () => void;
  tabIndex?: number;
};

export function ContentSizeButton({
  buttonRef,
  expanded,
  onClick,
  tabIndex,
}: ContentSizeButtonProps) {
  const label = expanded ? "Minimize page" : "Restore page";

  return (
    <button
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all duration-200 ease-in-out hover:bg-black/35 print:hidden"
      data-content-minimize={expanded ? "" : undefined}
      data-content-restore={expanded ? undefined : ""}
      onClick={onClick}
      ref={buttonRef}
      tabIndex={tabIndex}
      title={expanded ? "Minimize" : "Restore"}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        width="20"
      >
        <rect height="16" rx="2.5" width="16" x="4" y="4" />
        {expanded ? <path d="M8 12h8" /> : <path d="M12 8v8M8 12h8" />}
      </svg>
    </button>
  );
}
