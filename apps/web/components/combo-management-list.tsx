"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type ComboListItem = {
  id: string;
  videoAssetId: string;
  audioAssetId: string;
  videoTitle: string;
  audioTitle: string;
  score: number;
  upvotes: number;
  downvotes: number;
  thumbnailUrl?: string;
};

type Props = {
  items: ComboListItem[];
};

export function ComboManagementList({ items }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteCombo(id: string) {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm("Delete this combo?");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/combos/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete combo.");
      }

      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <ul className="divide-y">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No combos yet.</li>
        ) : null}
        {items.map((item) => (
          <li className="flex items-center gap-4 p-4" key={item.id}>
            <div className="h-16 w-28 overflow-hidden rounded-md border bg-muted">
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${item.videoTitle} thumbnail`}
                  className="h-full w-full object-cover"
                  src={item.thumbnailUrl}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No thumb
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link
                className="block truncate text-sm font-medium underline"
                href={`/combo/${item.id}`}
              >
                {item.videoTitle} + {item.audioTitle}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                Score {item.score} (up {item.upvotes} / down {item.downvotes})
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">{item.id}</p>
            </div>

            <Button
              onClick={() => void deleteCombo(item.id)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {deletingId === item.id ? "Deleting..." : "Delete"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
