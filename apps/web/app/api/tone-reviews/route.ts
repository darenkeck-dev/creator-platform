import {
  ToneReviewInputSchema,
  ToneReviewListQuerySchema,
  ToneReviewListResponseSchema,
  ToneReviewResponseSchema,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { listToneReviewsFromApi, submitToneReviewInApi } from "@/lib/assets-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedQuery = ToneReviewListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: "Invalid query parameters", issues: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  try {
    const reviews = await listToneReviewsFromApi(parsedQuery.data);
    return NextResponse.json(ToneReviewListResponseSchema.parse(reviews));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list tone reviews";
    return NextResponse.json({ message }, { status: 500 });
  }
}

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
