import type { PublicMusicCatalogResponse } from "@media-manager/contracts";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  fetchMusicCatalog,
  formatMusicDuration,
  formatMusicReleaseDate,
  sortMusicReleases,
} from "../lib/music";
import { setPageMetadata } from "../lib/page-metadata";
import { DocumentShell } from "./DocumentShell";
import { useMusicPlayback } from "./MusicPlaybackContext";
import { ShellLoader } from "./ShellLoader";

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-xs font-medium text-white/60 transition hover:text-cyan-100"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
      <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="12">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  );
}

export function MusicPage() {
  const location = useLocation();
  const [catalog, setCatalog] = useState<PublicMusicCatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playback = useMusicPlayback();

  useEffect(() => {
    setPageMetadata({
      title: "Music / Daren Keck",
      description: "Music releases by Daren Keck.",
      url: "https://darenkeck.com/music",
    });

    const controller = new AbortController();
    void fetchMusicCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        console.error("Music catalog failed to load", reason);
        setError(reason instanceof Error ? reason.message : "Music catalog failed to load.");
      });
    return () => controller.abort();
  }, []);

  const releases = catalog ? sortMusicReleases(catalog.releases) : [];

  useEffect(() => {
    if (!catalog || !location.hash) return;
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [catalog, location.hash]);

  return (
    <DocumentShell breadcrumbs={[{ label: "darenkeck", to: "/" }, { label: "music" }]}>
      {!catalog && !error ? (
        <div
          aria-label="Loading releases"
          className="flex justify-center border-y border-white/15 py-8"
        >
          <ShellLoader />
        </div>
      ) : null}
      {error ? <p className="border-y border-white/15 py-8 text-red-200">{error}</p> : null}
      {catalog && releases.length === 0 ? (
        <p className="border-y border-white/15 py-8 text-white/65">No published releases yet.</p>
      ) : null}
      {playback.error ? <p className="mb-4 text-sm text-red-200">{playback.error}</p> : null}

      {releases.length > 0 ? (
        <div className="divide-y divide-white/15 border-y border-white/15">
          {releases.map((release) => (
          <article
            className="grid scroll-mt-24 gap-6 pt-8 sm:grid-cols-[12rem_minmax(0,1fr)]"
            id={`release-${release.id}`}
            key={release.id}
          >
            <img
              alt={release.coverAlt}
              className="mx-auto aspect-square w-full max-w-48 rounded-xl border border-white/15 object-cover sm:mx-0"
              decoding="async"
              loading="lazy"
              src={release.coverUrl}
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">
                {formatMusicReleaseDate(release.releaseDate)} / {release.type}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{release.title}</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {release.purchaseLinks.map((link) => (
                  <ExternalLink href={link.url} key={`${link.label}-${link.url}`} label={link.label} />
                ))}
              </div>
              <ol className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {release.tracks.map((track, trackIndex) => {
                  const current = playback.currentTrackId === track.id;
                  const loading = playback.loadingTrackId === track.id;
                  return (
                    <li key={track.id}>
                      <button
                        aria-current={current ? "true" : undefined}
                        className={`group flex w-full items-center gap-3 px-2 py-3 text-left transition hover:bg-white/[0.05] ${current ? "text-cyan-100" : "text-white"}`}
                        disabled={loading}
                        onClick={() => playback.playTrack(release, trackIndex)}
                        type="button"
                      >
                        <span className="flex w-5 shrink-0 justify-end text-xs tabular-nums text-white/45">
                          {current && playback.playing ? (
                            <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          ) : (
                            trackIndex + 1
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {track.title}
                          {loading ? (
                            <>
                              {" "}
                              <span aria-hidden="true" className="track-loading-ellipsis">
                                ...
                              </span>
                              <span className="sr-only"> loading</span>
                            </>
                          ) : null}
                        </span>
                        {formatMusicDuration(track.durationSeconds) ? (
                          <span className="text-xs tabular-nums text-white/45">
                            {formatMusicDuration(track.durationSeconds)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </article>
          ))}
        </div>
      ) : null}
    </DocumentShell>
  );
}
