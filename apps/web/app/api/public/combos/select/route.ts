import {
  PublicComboSelectionRequestSchema,
  PublicComboSelectionResponseSchema,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { PublicComboSelectionApiError, selectPublicComboFromApi } from "@/lib/assets-api";

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = PublicComboSelectionRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsedBody.error.issues },
      { status: 400 }
    );
  }

  try {
    const selected = await selectPublicComboFromApi(parsedBody.data);
    return NextResponse.json(PublicComboSelectionResponseSchema.parse(selected));
  } catch (error) {
    if (error instanceof PublicComboSelectionApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Public combo selection failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
