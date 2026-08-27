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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color] duration-200 ease-in-out print:hidden ${expanded ? "hover:bg-black/35" : "bg-black/55 shadow-lg backdrop-blur-md hover:bg-black/65 supports-[backdrop-filter]:bg-black/35"}`}
      data-content-minimize={expanded ? "" : undefined}
      data-content-restore={expanded ? undefined : ""}
      onClick={onClick}
      ref={buttonRef}
      style={{
        color: expanded ? "var(--primary-red)" : "var(--primary-blue)",
        filter: `drop-shadow(0 0 2px ${expanded ? "var(--primary-red)" : "var(--primary-blue)"})`,
      }}
      tabIndex={tabIndex}
      title={expanded ? "Minimize" : "Restore"}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
        width="24"
      >
        {expanded ? <path d="M8 12h8" /> : <path d="M12 8v8M8 12h8" />}
      </svg>
    </button>
  );
}
