import {
  AssetListResponseSchema,
  type AssetListResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { getAssets } from "@/lib/assets";

export async function GET() {
  const assets = await getAssets();
  const response: AssetListResponse = AssetListResponseSchema.parse({ assets });
  return NextResponse.json(response);
}
