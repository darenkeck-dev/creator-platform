import { Link } from "react-router-dom";

export type LinkItem = {
  label: string;
  href: string;
  external?: boolean;
};

type LinksSectionProps = {
  links: LinkItem[];
};

export function LinksSection({ links }: LinksSectionProps) {
  return (
    <section aria-label="Links">
      <div className="flex flex-wrap gap-2">
        {links.map((link) =>
          link.external === false ? (
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-white/90 transition hover:bg-white/10"
              key={link.label}
              to={link.href}
            >
              {link.label}
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                width="16"
              >
                <rect height="16" rx="2.5" width="16" x="4" y="4" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </Link>
          ) : (
            <a
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-white/90 transition hover:bg-white/10"
              href={link.href}
              key={link.label}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
              <svg
                aria-hidden="true"
                fill="none"
                height="14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                width="14"
              >
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          )
        )}
      </div>
    </section>
  );
}
