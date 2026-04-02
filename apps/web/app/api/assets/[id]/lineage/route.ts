import {
  AssetIdParamSchema,
  AssetLineageResponseSchema,
  type AssetLineageResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { fetchAssetLineageFromApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  try {
    const lineage = await fetchAssetLineageFromApi(parsedParams.data.id);
    const response: AssetLineageResponse = AssetLineageResponseSchema.parse(lineage);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to fetch asset lineage" }, { status: 500 });
  }
}
