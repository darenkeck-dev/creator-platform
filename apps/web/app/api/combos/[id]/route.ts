import {
  ComboDeleteResponseSchema,
  ComboDetailResponseSchema,
  type ComboDeleteResponse,
  type ComboDetailResponse,
} from "@media-manager/contracts";
import { NextResponse } from "next/server";

import { deleteComboInApi, fetchComboByIdFromApi } from "@/lib/assets-api";

type Params = {
  id: string;
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "Invalid combo id" }, { status: 400 });
  }

  try {
    const combo = await fetchComboByIdFromApi(id);
    const response: ComboDetailResponse = ComboDetailResponseSchema.parse({ combo });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch combo";
    if (message.includes("not found")) {
      return NextResponse.json({ message: "Combo not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Failed to fetch combo" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<Params> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "Invalid combo id" }, { status: 400 });
  }

  try {
    const deleted = await deleteComboInApi(id);
    const response: ComboDeleteResponse = ComboDeleteResponseSchema.parse(deleted);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete combo";
    if (message.includes("not found")) {
      return NextResponse.json({ message: "Combo not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Failed to delete combo" }, { status: 500 });
  }
}
