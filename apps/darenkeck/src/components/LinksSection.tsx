import { Link } from "react-router-dom";

export type LinkItem = {
  label: string;
  href: string;
  external?: boolean;
};

type LinksSectionProps = {
  links: LinkItem[];
  moreLink?: Pick<LinkItem, "href" | "label">;
};

export function LinksSection({ links, moreLink }: LinksSectionProps) {
  return (
    <section aria-label="Links" className="relative border-t border-white/15 pt-4">
      {moreLink ? (
        <Link
          aria-label={moreLink.label}
          className="absolute -top-1 left-1/2 flex h-4 w-8 -translate-x-1/2 -translate-y-full items-center justify-center text-white/55 transition hover:text-white"
          title={moreLink.label}
          to={moreLink.href}
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="m6 4 6 5 6-5" />
            <path d="m6 11 6 5 6-5" />
          </svg>
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {links.map((link) =>
          link.external === false ? (
            <Link
              className="text-[13px] font-medium text-white/65 transition hover:text-white"
              key={link.label}
              to={link.href}
            >
              {link.label}
            </Link>
          ) : (
            <a
              className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-white/65 transition hover:text-white"
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
