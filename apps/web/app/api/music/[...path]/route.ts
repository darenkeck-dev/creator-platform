import { NextResponse } from "next/server";

import { MusicApiError, proxyMusicRequest } from "@/lib/music-api";

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context) {
  let body: unknown;
  if (request.method === "POST" || request.method === "PATCH" || request.method === "DELETE") {
    try {
      body = (await request.json()) as unknown;
    } catch {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }
  }
  try {
    const result = await proxyMusicRequest(request.method, (await context.params).path, body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof MusicApiError) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    console.error("Music proxy failed", error);
    return NextResponse.json({ message: "Music proxy failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
