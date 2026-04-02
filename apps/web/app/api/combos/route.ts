import {
  ComboDetailResponseSchema,
  ComboListResponseSchema,
  CreateComboInputSchema,
  type ComboDetailResponse,
  type ComboListResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { createComboInApi, listCombosFromApi } from "@/lib/assets-api";

export async function GET() {
  try {
    const combos = await listCombosFromApi();
    const response: ComboListResponse = ComboListResponseSchema.parse({ combos });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to fetch combos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = CreateComboInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const combo = await createComboInApi(parsedBody.data);
    const response: ComboDetailResponse = ComboDetailResponseSchema.parse({ combo });
    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create combo" }, { status: 500 });
  }
}
