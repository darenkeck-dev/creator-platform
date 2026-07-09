import { JobDetailResponseSchema } from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { fetchJobFromApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const params = await context.params;
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ message: "Invalid job id" }, { status: 400 });
  }

  try {
    const job = await fetchJobFromApi(id);
    const response = JobDetailResponseSchema.parse(job);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch job";
    if (message.includes("404")) {
      return NextResponse.json({ message: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
