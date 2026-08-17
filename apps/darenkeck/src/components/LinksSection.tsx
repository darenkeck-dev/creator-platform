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
    <section aria-label="Links" className="border-t border-white/15 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {links.map((link) =>
          link.external === false ? (
            <Link
              className="text-xs font-medium text-white/65 transition hover:text-white"
              key={link.label}
              to={link.href}
            >
              {link.label}
            </Link>
          ) : (
            <a
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-white/65 transition hover:text-white"
              href={link.href}
              key={link.label}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
              <svg
                aria-hidden="true"
                fill="none"
                height="12"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                width="12"
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
