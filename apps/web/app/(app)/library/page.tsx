import { ASSET_TAG_FACETS, ASSET_TYPES, type AssetListResponse } from "@media-manager/contracts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CreateFolderForm } from "@/components/create-folder-form";
import { fetchAssetByIdFromApi, fetchAssetsFromApi } from "@/lib/assets-api";

type LibraryPageProps = {
  searchParams?: Promise<{
    type?: string;
    origin?: string;
    facet?: string;
    sort?: string;
    containerId?: string;
  }>;
};

function parseType(value: string | undefined): "video" | "audio" | "image" | "folder" | undefined {
  if (!value) {
    return undefined;
  }

  return ASSET_TYPES.includes(value as (typeof ASSET_TYPES)[number])
    ? (value as "video" | "audio" | "image" | "folder")
    : undefined;
}

function parseFacet(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return ASSET_TAG_FACETS.includes(value as (typeof ASSET_TAG_FACETS)[number]) ? value : undefined;
}

function parseOrigin(
  value: string | undefined
): "uploaded" | "generated" | "derived" | "manual" | undefined {
  if (value === "uploaded" || value === "generated" || value === "derived" || value === "manual") {
    return value;
  }

  return undefined;
}

function parseSort(value: string | undefined): "newest" | "oldest" {
  return value === "oldest" ? "oldest" : "newest";
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = (await searchParams) ?? {};
  const type = parseType(params.type);
  const origin = parseOrigin(params.origin);
  const facet = parseFacet(params.facet);
  const sort = parseSort(params.sort);
  const containerId = params.containerId?.trim() || undefined;

  const assets: AssetListResponse["assets"] = await fetchAssetsFromApi({
    type,
    origin,
    facet,
    sort,
    containerId,
  });
  const containerAsset = containerId ? await fetchAssetByIdFromApi(containerId) : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and filter your assets.</p>
      </header>

      <CreateFolderForm containerId={containerId} />

      {containerId ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Nested view:</span>
          <Badge variant="secondary">{containerAsset?.title ?? "Unknown folder"}</Badge>
          <span className="text-xs text-muted-foreground/70">{containerId}</span>
          <Link className="underline" href="/library">
            Back to root
          </Link>
        </div>
      ) : null}

      <form
        className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-5"
        method="GET"
      >
        {containerId ? <input name="containerId" type="hidden" value={containerId} /> : null}
        <label className="space-y-1 text-sm" htmlFor="type-filter">
          <span className="text-muted-foreground">Type</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={type ?? "all"}
            id="type-filter"
            name="type"
          >
            <option value="all">All types</option>
            {ASSET_TYPES.map((assetType) => (
              <option key={assetType} value={assetType}>
                {assetType}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm" htmlFor="facet-filter">
          <span className="text-muted-foreground">Facet tag</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={facet ?? "all"}
            id="facet-filter"
            name="facet"
          >
            <option value="all">All facets</option>
            {ASSET_TAG_FACETS.map((tagFacet) => (
              <option key={tagFacet} value={tagFacet}>
                {tagFacet}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm" htmlFor="origin-filter">
          <span className="text-muted-foreground">Origin</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={origin ?? "all"}
            id="origin-filter"
            name="origin"
          >
            <option value="all">All origins</option>
            <option value="uploaded">uploaded</option>
            <option value="generated">generated</option>
            <option value="derived">derived</option>
            <option value="manual">manual</option>
          </select>
        </label>

        <label className="space-y-1 text-sm" htmlFor="sort-filter">
          <span className="text-muted-foreground">Sort</span>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            defaultValue={sort}
            id="sort-filter"
            name="sort"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button className="h-10 rounded-md border px-4 text-sm font-medium" type="submit">
            Apply
          </button>
          <Link
            className="h-10 rounded-md border px-4 text-sm font-medium leading-10"
            href="/library"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Sort: {sort}</Badge>
        {type ? <Badge variant="secondary">Type: {type}</Badge> : null}
        {origin ? <Badge variant="secondary">Origin: {origin}</Badge> : null}
        {facet ? <Badge variant="secondary">Facet: {facet}</Badge> : null}
        {containerId ? (
          <Badge variant="secondary">Container: {containerAsset?.title ?? "Unknown folder"}</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assets match the selected filters.</p>
        ) : null}
        {assets.map((asset) => (
          <article
            className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
            key={asset.id}
          >
            <Link href={`/asset/${asset.id}`}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{asset.type}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Origin: {asset.origin ?? "uploaded"}
              </p>
              <h2 className="mt-2 text-base font-medium">{asset.title}</h2>
              <p className="mt-3 text-xs text-muted-foreground">ID: {asset.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status: {asset.status}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Conversion: {(asset.conversion?.status ?? "not_started").replaceAll("_", " ")}
              </p>
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {asset.containerId ? (
                <span>Container: {asset.containerId}</span>
              ) : (
                <span>Container: root</span>
              )}
              <span>Sources: {asset.sourceAssetIds?.length ?? 0}</span>
              {asset.type === "folder" ? (
                <Link className="underline" href={`/library?containerId=${asset.id}`}>
                  Open folder
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
