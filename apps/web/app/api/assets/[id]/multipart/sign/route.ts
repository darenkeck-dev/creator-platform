import {
  AssetIdParamSchema,
  MultipartSignInputSchema,
  MultipartSignResponseSchema,
  type MultipartSignResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { signMultipartPartInApi } from "@/lib/assets-api";

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

  const parsedBody = MultipartSignInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const data = await signMultipartPartInApi(parsedParams.data.id, parsedBody.data);
    const response: MultipartSignResponse = MultipartSignResponseSchema.parse(data);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to sign multipart part" }, { status: 500 });
  }
}
