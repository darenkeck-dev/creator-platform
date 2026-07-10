import { ToneReviewInputSchema, ToneReviewResponseSchema } from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { submitToneReviewInApi } from "@/lib/assets-api";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = ToneReviewInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const submitted = await submitToneReviewInApi(parsedBody.data);
    return NextResponse.json(ToneReviewResponseSchema.parse(submitted), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit tone review";
    return NextResponse.json({ message }, { status: 500 });
  }
}
