import { AssetIdParamSchema, type AssetDetailResponse } from "@media-manager/contracts";
import { notFound } from "next/navigation";

import { AssetDetailEditor } from "@/components/asset-detail-editor";
import { FolderDetailView } from "@/components/folder-detail-view";
import {
  fetchAssetByIdFromApi,
  fetchAssetChildrenFromApi,
  fetchAssetLineageFromApi,
} from "@/lib/assets-api";

type AssetPageProps = {
  params: Promise<{ id: string }>;
};

async function fetchAssetById(id: string): Promise<AssetDetailResponse["asset"] | null> {
  return fetchAssetByIdFromApi(id);
}

export default async function AssetDetailPage({ params }: AssetPageProps) {
  const parsedParams = AssetIdParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }

  const asset = await fetchAssetById(parsedParams.data.id);

  if (!asset) {
    notFound();
  }

  const [childrenResult, lineageResult] = await Promise.allSettled([
    fetchAssetChildrenFromApi(asset.id),
    fetchAssetLineageFromApi(asset.id),
  ]);

  const children = childrenResult.status === "fulfilled" ? childrenResult.value.assets : [];
  const sourceAssets = lineageResult.status === "fulfilled" ? lineageResult.value.sources : [];

  if (asset.type === "folder") {
    return <FolderDetailView children={children} folder={asset} />;
  }

  return <AssetDetailEditor children={children} initialAsset={asset} sourceAssets={sourceAssets} />;
}
