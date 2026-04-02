import {
  AssetDeleteResponseSchema,
  AssetDetailResponseSchema,
  AssetIdParamSchema,
  UpdateAssetInputSchema,
  type AssetDeleteResponse,
  type AssetDetailResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { deleteAssetInApi, fetchAssetByIdFromApi, patchAssetInApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  const { id } = parsedParams.data;
  const asset = await fetchAssetByIdFromApi(id);

  if (!asset) {
    return NextResponse.json({ message: "Asset not found" }, { status: 404 });
  }

  const response: AssetDetailResponse = AssetDetailResponseSchema.parse({ asset });
  return NextResponse.json(response);
}

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = UpdateAssetInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const asset = await patchAssetInApi(parsedParams.data.id, parsedBody.data);
    const response: AssetDetailResponse = AssetDetailResponseSchema.parse({ asset });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  try {
    const deleted = await deleteAssetInApi(parsedParams.data.id);
    const response: AssetDeleteResponse = AssetDeleteResponseSchema.parse(deleted);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete asset";
    if (message.includes("not found")) {
      return NextResponse.json({ message: "Asset not found" }, { status: 404 });
    }

    if (message.includes("Forbidden")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Failed to delete asset" }, { status: 500 });
  }
}
