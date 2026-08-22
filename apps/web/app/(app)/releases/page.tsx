import { type MusicReadinessResponse } from "@media-manager/contracts";
import { ArrowRight, Disc3, Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getMusicReadinessFromApi, listMusicReleasesFromApi } from "@/lib/music-api";

export default async function ReleasesPage() {
  const releases = (await listMusicReleasesFromApi()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const readiness = new Map<string, MusicReadinessResponse | null>(
    await Promise.all(
      releases.map(async (release) => [
        release.id,
        await getMusicReadinessFromApi("releases", release.id).catch(() => null),
      ] as const)
    )
  );

  return (
    <section className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Catalog</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Releases</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build, validate, and publish official music releases.</p>
        </div>
        <Link className={buttonVariants()} href="/releases/new"><Plus className="h-4 w-4" /> Create Release</Link>
      </header>

      {releases.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center">
          <Disc3 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">No releases yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a draft, then add cover art and tracks.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {releases.map((release) => {
            const check = readiness.get(release.id);
            return (
              <Link
                className="grid gap-3 border-b p-4 transition last:border-b-0 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:px-5"
                href={`/releases/${release.id}`}
                key={release.id}
              >
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{release.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Updated {new Date(release.updatedAt).toLocaleDateString()}</p>
                </div>
                <p className="text-sm text-muted-foreground">{release.type?.toUpperCase() ?? "Type pending"} · {release.releaseDate ?? "Date pending"}</p>
                <p className="text-sm tabular-nums">{release.trackIds.length} {release.trackIds.length === 1 ? "track" : "tracks"}</p>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Badge variant={release.publicationStatus === "published" ? "default" : "secondary"}>{release.publicationStatus}</Badge>
                  <span className={check?.ready ? "text-sm text-emerald-400" : "text-sm text-amber-400"}>
                    {check ? (check.ready ? "Ready" : `${check.issues.length} blocker${check.issues.length === 1 ? "" : "s"}`) : "Check unavailable"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
