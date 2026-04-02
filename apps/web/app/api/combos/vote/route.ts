import {
  ComboDetailResponseSchema,
  ComboVoteByAssetsInputSchema,
  type ComboDetailResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { voteOnComboByAssetsInApi } from "@/lib/assets-api";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = ComboVoteByAssetsInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const combo = await voteOnComboByAssetsInApi(parsedBody.data);
    const response: ComboDetailResponse = ComboDetailResponseSchema.parse({ combo });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to vote on combo pair" }, { status: 500 });
  }
}
