import { NextResponse } from "next/server";

import { PublicRandomComboResponseSchema } from "@media-manager/contracts";

function getApiBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_COMBO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_BASE_URL;
  if (!raw) {
    return null;
  }

  return raw.replace(/\/$/, "");
}

export async function GET(): Promise<Response> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return NextResponse.json(
      {
        message:
          "Missing API base URL. Set NEXT_PUBLIC_COMBO_API_BASE_URL, NEXT_PUBLIC_API_BASE_URL, or API_BASE_URL.",
      },
      { status: 500 }
    );
  }

  try {
    const upstreamResponse = await fetch(`${apiBaseUrl}/public/combos/random`, {
      method: "GET",
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      const bodyText = await upstreamResponse.text();
      return new NextResponse(bodyText || '{"message":"Failed to fetch combo"}', {
        status: upstreamResponse.status,
        headers: {
          "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
        },
      });
    }

    const parsed = PublicRandomComboResponseSchema.safeParse(await upstreamResponse.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: `Invalid upstream random combo payload: ${parsed.error.message}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected proxy error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
