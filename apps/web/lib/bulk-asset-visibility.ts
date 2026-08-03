export type BulkVisibilityAsset = {
  id: string;
  type: string;
};

export type AssetVisibility = "private" | "public";

export type BulkAssetVisibilityResult = {
  updatedIds: string[];
  failedIds: string[];
  skippedFolderIds: string[];
};

type BulkAssetVisibilityOptions = {
  fetch?: typeof globalThis.fetch;
  concurrency?: number;
};

export async function updateBulkAssetVisibility(
  assets: readonly BulkVisibilityAsset[],
  visibility: AssetVisibility,
  options: BulkAssetVisibilityOptions = {}
): Promise<BulkAssetVisibilityResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const concurrency = options.concurrency ?? 5;

  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be at least 1");
  }

  const mediaAssets = assets.filter((asset) => asset.type !== "folder");
  const succeeded = new Array<boolean>(mediaAssets.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < mediaAssets.length) {
      const index = nextIndex++;
      const asset = mediaAssets[index];

      try {
        const response = await fetchImpl(`/api/assets/${encodeURIComponent(asset.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visibility }),
        });
        succeeded[index] = response.ok;
      } catch {
        succeeded[index] = false;
      }
    }
  };

  const workerCount = Math.min(mediaAssets.length, Math.floor(concurrency));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    updatedIds: mediaAssets.filter((_, index) => succeeded[index]).map((asset) => asset.id),
    failedIds: mediaAssets.filter((_, index) => !succeeded[index]).map((asset) => asset.id),
    skippedFolderIds: assets.filter((asset) => asset.type === "folder").map((asset) => asset.id),
  };
}
