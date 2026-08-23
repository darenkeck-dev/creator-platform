import type { AssetListResponse, MusicReadinessResponse } from "@media-manager/contracts";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { LibraryAssetBrowser } from "@/components/library-asset-browser";
import { ReleaseListActions } from "@/components/release-list-actions";
import { Badge } from "@/components/ui/badge";
import { fetchAssetsFromApi } from "@/lib/assets-api";
import { getMusicReadinessFromApi, listMusicReleasesFromApi } from "@/lib/music-api";

type LibraryPageProps = {
  searchParams?: Promise<{
    containerId?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = (await searchParams) ?? {};
  const containerId = params.containerId?.trim() || undefined;

  const [assets, releases] = await Promise.all([
    fetchAssetsFromApi({
      containerId,
      libraryVisibility: "listed",
    }),
    containerId
      ? Promise.resolve([])
      : listMusicReleasesFromApi().then((items) =>
          items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        ),
  ] satisfies [Promise<AssetListResponse["assets"]>, ReturnType<typeof listMusicReleasesFromApi>]);
  const readiness = new Map<string, MusicReadinessResponse | null>(
    await Promise.all(
      releases.map(
        async (release) =>
          [
            release.id,
            await getMusicReadinessFromApi("releases", release.id).catch(() => null),
          ] as const
      )
    )
  );

  return (
    <section className="space-y-8">
      <LibraryAssetBrowser assets={assets} containerId={containerId} />

      {!containerId ? (
        <section className="space-y-4" id="releases">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 px-1">
              <h2 className="font-semibold">Releases</h2>
              <span className="text-xs tabular-nums text-muted-foreground">{releases.length}</span>
            </div>
            <ReleaseListActions />
          </div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_10rem_5rem_13rem] gap-3 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground max-lg:grid-cols-[minmax(0,1fr)_13rem]">
              <span>Release</span>
              <span className="max-lg:hidden">Details</span>
              <span className="max-lg:hidden">Tracks</span>
              <span>Status</span>
            </div>
            {releases.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No releases yet.</p>
            ) : (
              releases.map((release) => {
                const check = readiness.get(release.id);
                return (
                  <Link
                    className="grid grid-cols-[minmax(0,1fr)_10rem_5rem_13rem] items-center gap-3 border-b px-4 py-3 transition last:border-b-0 hover:bg-muted/40 max-lg:grid-cols-[minmax(0,1fr)_13rem]"
                    href={`/releases/${release.id}`}
                    key={release.id}
                  >
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{release.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {new Date(release.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground max-lg:hidden">
                      {release.type?.toUpperCase() ?? "Type pending"} ·{" "}
                      {release.releaseDate ?? "Date pending"}
                    </p>
                    <p className="text-sm tabular-nums max-lg:hidden">
                      {release.trackIds.length} {release.trackIds.length === 1 ? "track" : "tracks"}
                    </p>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Badge
                        variant={
                          release.publicationStatus === "published" ? "default" : "secondary"
                        }
                      >
                        {release.publicationStatus}
                      </Badge>
                      <span
                        className={
                          check?.ready ? "text-sm text-emerald-400" : "text-sm text-amber-400"
                        }
                      >
                        {check
                          ? check.ready
                            ? "Ready"
                            : `${check.issues.length} blocker${check.issues.length === 1 ? "" : "s"}`
                          : "Check unavailable"}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}
