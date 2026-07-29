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
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-[0.2em] text-white/65">Links</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) =>
          link.external === false ? (
            <Link
              className="rounded-full border px-3 py-1 text-xs text-white/90 transition hover:bg-white/10"
              key={link.label}
              to={link.href}
            >
              {link.label}
            </Link>
          ) : (
            <a
              className="rounded-full border px-3 py-1 text-xs text-white/90 transition hover:bg-white/10"
              href={link.href}
              key={link.label}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
          )
        )}
      </div>
    </section>
  );
}
