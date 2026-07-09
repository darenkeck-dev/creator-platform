import type { AssetListResponse } from "@media-manager/contracts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { LibraryAssetBrowser } from "@/components/library-asset-browser";
import { fetchAssetByIdFromApi, fetchAssetsFromApi } from "@/lib/assets-api";

type LibraryPageProps = {
  searchParams?: Promise<{
    containerId?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = (await searchParams) ?? {};
  const containerId = params.containerId?.trim() || undefined;

  const assets: AssetListResponse["assets"] = await fetchAssetsFromApi({
    containerId,
  });
  const containerAsset = containerId ? await fetchAssetByIdFromApi(containerId) : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and manage your assets.</p>
      </header>

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

      <LibraryAssetBrowser assets={assets} containerId={containerId} />
    </section>
  );
}
