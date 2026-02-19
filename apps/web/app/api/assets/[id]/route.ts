import {
  AssetDetailResponseSchema,
  AssetIdParamSchema,
  type AssetDetailResponse
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { getAssetById } from "@/lib/assets";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  const { id } = parsedParams.data;
  const asset = await getAssetById(id);

  if (!asset) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  const response: AssetDetailResponse = AssetDetailResponseSchema.parse({ asset });
  return NextResponse.json(response);
}
