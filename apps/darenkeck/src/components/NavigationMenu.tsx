import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const links = [
  { className: "text-[var(--primary-blue)]", label: "Resume", to: "/dev" },
  { className: "text-[var(--primary-orange)]", label: "Blog", to: "/blog" },
  { className: "text-[var(--primary-red)]", label: "Music", to: "/music" },
];

export function NavigationMenu({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => onOpenChange?.(open), [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <nav
        aria-hidden={!open}
        aria-label="Primary"
        className={`absolute right-full top-0 z-20 mr-1 grid h-8 w-52 origin-right grid-cols-3 items-center overflow-hidden text-base transition-[opacity,transform] duration-200 ease-out min-[360px]:w-56 sm:w-60 ${open ? "scale-x-100 opacity-100" : "pointer-events-none scale-x-0 opacity-0"}`}
        data-home-navigation-menu
        inert={!open}
      >
        {links
          .filter((link) => link.to !== location.pathname)
          .map((link) => (
          <Link
            className={`flex h-8 items-center justify-center font-medium transition hover:brightness-125 ${link.className}`}
            key={link.to}
            to={link.to}
          >
            {link.label}
          </Link>
          ))}
      </nav>
      <button
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all duration-200 ease-in-out hover:bg-black/35"
        data-home-navigation-button
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg
          aria-hidden="true"
          className={`transition-transform duration-200 ease-out ${open ? "-rotate-90" : "rotate-0"}`}
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      </button>
    </div>
  );
}
