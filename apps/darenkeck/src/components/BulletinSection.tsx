import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";

import { type Bulletin, formatBulletinDate } from "../lib/bulletins";

const BulletinSummary = lazy(async () => {
  const module = await import("./BulletinSummary");
  return { default: module.BulletinSummary };
});

export function BulletinSection({ bulletins }: { bulletins: Bulletin[] }) {
  return (
    <section aria-label="Latest news">
      {bulletins.length ? (
        <ol className="space-y-2">
          {bulletins.map((bulletin) => (
            <li
              className="group grid grid-cols-[auto_minmax(0,1fr)] gap-3 bg-black/20 px-3 py-2 transition hover:bg-white/[0.06]"
              data-home-bulletin
              key={bulletin.slug}
            >
              <Link aria-label={`Read ${bulletin.title}`} to={`/news/${bulletin.slug}`}>
                {bulletin.image ? (
                  <img
                    alt={bulletin.imageAlt ?? ""}
                    className="h-14 w-14 rounded-md object-cover"
                    decoding="async"
                    loading="eager"
                    src={bulletin.image}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/25"
                  >
                    <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
                      <path d="M4 5.5h16v13H4z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 9h4v4H7zM13 9h4M13 12h4M7 16h10" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                )}
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <Link
                    className="font-semibold text-white transition group-hover:text-yellow-200"
                    to={`/news/${bulletin.slug}`}
                  >
                    {bulletin.title}
                  </Link>
                  <time
                    className="text-[10px] uppercase tracking-[0.12em] text-white/45"
                    dateTime={bulletin.date}
                  >
                    {formatBulletinDate(bulletin.date)}
                  </time>
                </div>
                <Suspense
                  fallback={
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">
                      {bulletin.summaryText}
                    </p>
                  }
                >
                  <BulletinSummary className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">
                    {bulletin.summary}
                  </BulletinSummary>
                </Suspense>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="bg-black/20 px-3 py-2 text-sm text-white/65">No bulletins published yet.</p>
      )}
    </section>
  );
}
