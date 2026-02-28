import { AssetIdParamSchema, type AssetDetailResponse } from "@media-manager/contracts";
import { notFound } from "next/navigation";

import { AssetDetailEditor } from "@/components/asset-detail-editor";
import { fetchAssetByIdFromApi } from "@/lib/assets-api";

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

  return <AssetDetailEditor initialAsset={asset} />;
}
