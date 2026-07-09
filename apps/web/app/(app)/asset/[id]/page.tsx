import { AssetIdParamSchema, type AssetDetailResponse } from "@media-manager/contracts";
import { notFound } from "next/navigation";

import { AssetDetailEditor } from "@/components/asset-detail-editor";
import { FolderDetailView } from "@/components/folder-detail-view";
import { fetchAssetByIdFromApi, fetchAssetChildrenFromApi } from "@/lib/assets-api";

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

  if (asset.type === "folder") {
    const childrenResult = await fetchAssetChildrenFromApi(asset.id).catch(() => null);
    const children = childrenResult?.assets ?? [];
    return <FolderDetailView children={children} folder={asset} />;
  }

  return <AssetDetailEditor initialAsset={asset} />;
}
