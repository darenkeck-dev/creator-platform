import { JobPreviewInputSchema, JobPreviewResponseSchema } from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { previewJobInApi } from "@/lib/assets-api";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = JobPreviewInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const preview = await previewJobInApi(parsedBody.data);
    const response = JobPreviewResponseSchema.parse(preview);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview job";
    return NextResponse.json({ message }, { status: 500 });
  }
}
