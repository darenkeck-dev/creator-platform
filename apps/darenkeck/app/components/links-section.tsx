type LinkItem = {
  label: string;
  href: string;
};

type LinksSectionProps = {
  links: LinkItem[];
};

export function LinksSection({ links }: LinksSectionProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-[0.2em] text-white/65">Links</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            className="rounded-full border px-3 py-1 text-xs text-white/90"
            href={link.href}
            key={link.label}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
