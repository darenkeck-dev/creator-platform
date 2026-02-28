import {
  AssetIdParamSchema,
  MultipartInitInputSchema,
  MultipartInitResponseSchema,
  type MultipartInitResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { initMultipartUploadInApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function POST(request: Request, context: { params: Promise<Params> }) {
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

  const parsedBody = MultipartInitInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const data = await initMultipartUploadInApi(parsedParams.data.id, parsedBody.data);
    const response: MultipartInitResponse = MultipartInitResponseSchema.parse(data);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to init multipart upload" }, { status: 500 });
  }
}
