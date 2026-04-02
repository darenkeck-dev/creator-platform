import type { ReactNode } from "react";

type BulletinSectionProps = {
  items: ReactNode[];
};

export function BulletinSection({ items }: BulletinSectionProps) {
  return (
    <section className="space-y-2">
      <ul className="space-y-2 text-sm leading-relaxed text-white/85">
        {items.map((item, index) => (
          <li className="bg-black/20 px-3 py-2" key={index}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
