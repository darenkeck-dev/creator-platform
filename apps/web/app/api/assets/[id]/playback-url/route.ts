import {
  AssetIdParamSchema,
  AssetPlaybackUrlResponseSchema,
  type AssetPlaybackUrlResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { getPlaybackUrlInApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const parsedParams = AssetIdParamSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Invalid asset id" }, { status: 400 });
  }

  try {
    const playback = await getPlaybackUrlInApi(parsedParams.data.id);
    const response: AssetPlaybackUrlResponse = AssetPlaybackUrlResponseSchema.parse(playback);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "Failed to fetch playback URL" }, { status: 500 });
  }
}
