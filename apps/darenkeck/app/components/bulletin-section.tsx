import type { ReactNode } from "react";

type BulletinSectionProps = {
  items: ReactNode[];
};

export function BulletinSection({ items }: BulletinSectionProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs uppercase tracking-[0.2em] text-white/65">Bulletin</h2>
      <ul className="space-y-2 text-sm text-white/85">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
