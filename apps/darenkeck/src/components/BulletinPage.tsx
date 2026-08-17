import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { findBulletin, formatBulletinDate } from "../lib/bulletins";
import { setPageMetadata } from "../lib/page-metadata";
import { DocumentMarkdown } from "./DocumentMarkdown";
import { DocumentShell } from "./DocumentShell";
import { BulletinSummary } from "./BulletinSummary";

export function BulletinPage() {
  const { slug } = useParams();
  const bulletin = findBulletin(slug);

  useEffect(() => {
    if (!bulletin) {
      setPageMetadata({
        title: "News item not found / Daren Keck",
        description: "The requested news item does not exist.",
        url: window.location.href,
        index: false,
      });
      return;
    }
    setPageMetadata({
      title: `${bulletin.title} / Daren Keck`,
      description: bulletin.summaryText,
      url: `https://darenkeck.com/news/${bulletin.slug}`,
    });
  }, [bulletin]);

  if (!bulletin) {
    return (
      <DocumentShell
        breadcrumbs={[
          { label: "darenkeck", to: "/" },
          { label: "news", to: "/news" },
          { label: "not found" },
        ]}
      >
        <h1 className="text-3xl font-bold text-white">News item not found</h1>
        <p className="mt-4 text-white/70">This item may have moved or is not published.</p>
      </DocumentShell>
    );
  }

  return (
    <DocumentShell
      bottomAligned
      breadcrumbs={[
        { label: "darenkeck", to: "/" },
        { label: "news", to: "/news" },
        { label: bulletin.title },
      ]}
      className="bulletin-document"
    >
      <header className="mb-10 border-b border-white/20 pb-8">
        <time
          className="text-xs uppercase tracking-[0.16em] text-yellow-200/80"
          dateTime={bulletin.date}
        >
          {formatBulletinDate(bulletin.date)}
        </time>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {bulletin.title}
        </h1>
        <BulletinSummary className="mt-4 text-lg leading-7 text-white/70">
          {bulletin.summary}
        </BulletinSummary>
        {bulletin.image ? (
          <img
            alt={bulletin.imageAlt ?? ""}
            className="mt-8 max-h-[32rem] w-full rounded-xl object-cover shadow-xl shadow-black/25"
            decoding="async"
            loading="eager"
            src={bulletin.image}
          />
        ) : null}
      </header>
      <DocumentMarkdown>{bulletin.content}</DocumentMarkdown>
    </DocumentShell>
  );
}
