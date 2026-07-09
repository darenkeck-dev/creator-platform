import { CreateJobInputSchema, CreateJobResponseSchema } from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { createJobInApi } from "@/lib/assets-api";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = CreateJobInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const created = await createJobInApi(parsedBody.data);
    const response = CreateJobResponseSchema.parse(created);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json({ message }, { status: 500 });
  }
}
