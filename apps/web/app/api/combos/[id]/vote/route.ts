import {
  ComboDetailResponseSchema,
  ComboVoteInputSchema,
  type ComboDetailResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { voteOnComboInApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "Invalid combo id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = ComboVoteInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const combo = await voteOnComboInApi(id, parsedBody.data);
    const response: ComboDetailResponse = ComboDetailResponseSchema.parse({ combo });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to vote on combo" }, { status: 500 });
  }
}
