"use client";

import { MusicReleaseResponseSchema } from "@media-manager/contracts";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MusicClientError, musicErrorMessage, musicRequest } from "@/lib/music-client";

export function ReleaseCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await musicRequest("releases", MusicReleaseResponseSchema, {
        method: "POST",
        body: JSON.stringify({
          schemaVersion: "music-release-create/v1",
          title: title.trim(),
          ...(releaseDate ? { releaseDate } : {}),
          ...(type ? { type } : {}),
          trackIds: [],
          purchaseLinks: [],
        }),
      });
      router.push(`/releases/${result.release.id}`);
    } catch (caught) {
      setError(
        caught instanceof MusicClientError
          ? musicErrorMessage(caught.payload)
          : caught instanceof Error
            ? caught.message
            : "Could not create release"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="max-w-2xl space-y-6 rounded-xl border bg-card p-5 sm:p-7" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium">
        Title
        <Input autoFocus maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Release date <span className="text-xs font-normal text-muted-foreground">Optional for drafts</span>
          <Input onChange={(event) => setReleaseDate(event.target.value)} type="date" value={releaseDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Type <span className="text-xs font-normal text-muted-foreground">Optional for drafts</span>
          <select className="h-9 rounded-md border px-3 text-sm" onChange={(event) => setType(event.target.value)} value={type}>
            <option value="">Select later</option>
            <option value="single">Single</option>
            <option value="ep">EP</option>
            <option value="album">Album</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <Button disabled={busy || !title.trim()} type="submit">
        {busy ? "Creating..." : "Create draft"}
      </Button>
    </form>
  );
}
