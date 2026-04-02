"use client";

import { AssetDetailResponseSchema } from "@media-manager/contracts";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  containerId?: string;
};

export function CreateFolderForm({ containerId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMessage("Folder name is required.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "folder",
          title: trimmedTitle,
          description: "",
          ...(containerId ? { containerId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create folder.");
      }

      const json = (await response.json()) as unknown;
      const parsed = AssetDetailResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("Folder response failed validation.");
      }

      setTitle("");
      setMessage("Folder created.");
      router.refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to create folder.";
      setMessage(nextMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="rounded-xl border bg-card p-4 shadow-sm" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-sm font-medium" htmlFor="folder-name">
            Create folder
          </label>
          <Input
            id="folder-name"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="New folder name"
            value={title}
          />
        </div>
        <Button disabled={submitting} type="submit" variant="outline">
          {submitting ? "Creating..." : "Create Folder"}
        </Button>
      </div>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
