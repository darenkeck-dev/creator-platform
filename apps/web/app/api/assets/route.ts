import {
  AssetDetailResponseSchema,
  AssetListResponseSchema,
  AssetOriginSchema,
  AssetTagFacetSchema,
  AssetTypeSchema,
  CreateAssetInputSchema,
  type AssetDetailResponse,
  type AssetListResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { createAssetInApi, fetchAssetsFromApi } from "@/lib/assets-api";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const rawType = url.searchParams.get("type") ?? undefined;
  const rawOrigin = url.searchParams.get("origin") ?? undefined;
  const rawFacet = url.searchParams.get("facet") ?? undefined;
  const rawContainerId = url.searchParams.get("containerId") ?? undefined;
  const rawSort = url.searchParams.get("sort") ?? "newest";

  const parsedType = rawType ? AssetTypeSchema.safeParse(rawType) : { success: true as const };
  const parsedOrigin = rawOrigin
    ? AssetOriginSchema.safeParse(rawOrigin)
    : { success: true as const };
  const parsedFacet = rawFacet
    ? AssetTagFacetSchema.safeParse(rawFacet)
    : { success: true as const };
  const sort = rawSort === "oldest" ? "oldest" : rawSort === "newest" ? "newest" : null;

  if (!parsedType.success || !parsedOrigin.success || !parsedFacet.success || !sort) {
    return NextResponse.json({ message: "Invalid query parameters" }, { status: 400 });
  }

  const assets = await fetchAssetsFromApi({
    type: rawType as "video" | "audio" | "image" | "folder" | undefined,
    origin: rawOrigin as "uploaded" | "generated" | "derived" | "manual" | undefined,
    facet: rawFacet,
    containerId: rawContainerId,
    sort,
  });
  const response: AssetListResponse = AssetListResponseSchema.parse({ assets });
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = CreateAssetInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const asset = await createAssetInApi(parsedBody.data);
    const response: AssetDetailResponse = AssetDetailResponseSchema.parse({ asset });
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create asset" }, { status: 500 });
  }
}
