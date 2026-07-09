import type { AssetListResponse } from "@media-manager/contracts";

import { LibraryAssetBrowser } from "@/components/library-asset-browser";
import { fetchAssetsFromApi } from "@/lib/assets-api";

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

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse and manage your assets.</p>
      </header>

      <LibraryAssetBrowser assets={assets} containerId={containerId} />
    </section>
  );
}
