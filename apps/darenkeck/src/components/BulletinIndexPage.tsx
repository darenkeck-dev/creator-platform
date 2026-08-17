import { useEffect } from "react";
import { Link } from "react-router-dom";

import { bulletins, formatBulletinDate } from "../lib/bulletins";
import { setPageMetadata } from "../lib/page-metadata";
import { BulletinSummary } from "./BulletinSummary";
import { DocumentShell } from "./DocumentShell";

export function BulletinIndexPage() {
  useEffect(() => {
    setPageMetadata({
      title: "News / Daren Keck",
      description: "News and project updates from Daren Keck.",
      url: "https://darenkeck.com/news",
    });
  }, []);

  return (
    <DocumentShell
      bottomAligned
      breadcrumbs={[{ label: "darenkeck", to: "/" }, { label: "news" }]}
      className="bulletin-document"
    >
      {bulletins.length ? (
        <ol className="divide-y divide-white/15 border-y border-white/15">
          {bulletins.map((bulletin) => (
            <li
              className="group grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-4 py-6 transition hover:bg-white/[0.04] sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6 sm:px-3"
              key={bulletin.slug}
            >
              <Link aria-label={`Read ${bulletin.title}`} to={`/news/${bulletin.slug}`}>
                {bulletin.image ? (
                  <img
                    alt={bulletin.imageAlt ?? ""}
                    className="h-20 w-20 rounded-lg object-cover sm:h-20 sm:w-24"
                    decoding="async"
                    loading="lazy"
                    src={bulletin.image}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-20 w-20 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/25 sm:w-24"
                  >
                    <svg fill="none" height="30" viewBox="0 0 24 24" width="30">
                      <path d="M4 5.5h16v13H4z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 9h4v4H7zM13 9h4M13 12h4M7 16h10" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                )}
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    className="text-xl font-semibold text-white transition group-hover:text-yellow-100"
                    to={`/news/${bulletin.slug}`}
                  >
                    {bulletin.title}
                  </Link>
                  <time
                    className="text-xs uppercase tracking-[0.14em] text-white/50"
                    dateTime={bulletin.date}
                  >
                    {formatBulletinDate(bulletin.date)}
                  </time>
                </div>
                <BulletinSummary className="mt-2 leading-6 text-white/65">
                  {bulletin.summary}
                </BulletinSummary>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-y border-white/15 py-8 text-white/65">
          No published bulletins yet.
        </p>
      )}
    </DocumentShell>
  );
}
