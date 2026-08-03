import {
  AssetDetailResponseSchema,
  AssetIdParamSchema,
  type AssetDetailResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { confirmUploadInApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function POST(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  try {
    const asset = await confirmUploadInApi(parsedParams.data.id);
    const response: AssetDetailResponse = AssetDetailResponseSchema.parse({ asset });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.endsWith(": 409")) {
      return NextResponse.json({ message: "Uploaded object not found" }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to confirm upload" }, { status: 500 });
  }
}
