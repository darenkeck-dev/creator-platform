import {
  AssetDetailResponseSchema,
  AssetListResponseSchema,
  CreateAssetInputSchema,
  type AssetDetailResponse,
  type AssetListResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { createAssetInApi, fetchAssetsFromApi } from "@/lib/assets-api";

export async function GET() {
  const assets = await fetchAssetsFromApi();
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
    const asset = await createAssetInApi({
      type: parsedBody.data.type,
      title: parsedBody.data.title,
      description: parsedBody.data.description,
    });
    const response: AssetDetailResponse = AssetDetailResponseSchema.parse({ asset });
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create asset" }, { status: 500 });
  }
}
