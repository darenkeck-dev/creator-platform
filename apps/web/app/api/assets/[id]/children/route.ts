import {
  AssetChildrenResponseSchema,
  AssetIdParamSchema,
  type AssetChildrenResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { fetchAssetChildrenFromApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  try {
    const children = await fetchAssetChildrenFromApi(parsedParams.data.id);
    const response: AssetChildrenResponse = AssetChildrenResponseSchema.parse(children);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to fetch asset children" }, { status: 500 });
  }
}
