"use client";

import { Folder, Music, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type AssetOption = {
  id: string;
  title: string;
  type: "video" | "audio" | "image" | "folder";
  containerId?: string;
};

type Props = Record<string, never>;

async function loadContainerAssets(containerId?: string): Promise<AssetOption[]> {
  const params = new URLSearchParams({ sort: "newest" });
  if (containerId) {
    params.set("containerId", containerId);
  }

  const response = await fetch(`/api/assets?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as {
    assets?: Array<{
      id: string;
      title: string;
      type: "video" | "audio" | "image" | "folder";
      containerId?: string;
    }>;
  };
  if (!Array.isArray(json.assets)) {
    return [];
  }

  return json.assets;
}

function typeIcon(type: AssetOption["type"]) {
  if (type === "folder") {
    return <Folder className="h-4 w-4 text-amber-500" />;
  }

  if (type === "audio") {
    return <Music className="h-4 w-4 text-sky-500" />;
  }

  return <Video className="h-4 w-4 text-emerald-500" />;
}

export function ComboCreateForm(_: Props) {
  const router = useRouter();
  const [videoAssetId, setVideoAssetId] = useState("");
  const [audioAssetId, setAudioAssetId] = useState("");
  const [videoContainerId, setVideoContainerId] = useState<string | undefined>(undefined);
  const [audioContainerId, setAudioContainerId] = useState<string | undefined>(undefined);
  const [videoStack, setVideoStack] = useState<string[]>([]);
  const [audioStack, setAudioStack] = useState<string[]>([]);
  const [videoEntries, setVideoEntries] = useState<AssetOption[]>([]);
  const [audioEntries, setAudioEntries] = useState<AssetOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const selectedVideo = useMemo(
    () => videoEntries.find((entry) => entry.id === videoAssetId),
    [videoAssetId, videoEntries]
  );
  const selectedAudio = useMemo(
    () => audioEntries.find((entry) => entry.id === audioAssetId),
    [audioAssetId, audioEntries]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const assets = await loadContainerAssets(videoContainerId);
      if (!cancelled) {
        setVideoEntries(assets);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [videoContainerId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const assets = await loadContainerAssets(audioContainerId);
      if (!cancelled) {
        setAudioEntries(assets);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [audioContainerId]);

  function openVideoFolder(folderId: string) {
    setVideoStack((prev) => [...prev, videoContainerId ?? "__root__"]);
    setVideoContainerId(folderId);
  }

  function openAudioFolder(folderId: string) {
    setAudioStack((prev) => [...prev, audioContainerId ?? "__root__"]);
    setAudioContainerId(folderId);
  }

  function upVideoFolder() {
    setVideoStack((prev) => {
      if (prev.length === 0) {
        setVideoContainerId(undefined);
        return prev;
      }

      const next = [...prev];
      const last = next.pop();
      setVideoContainerId(last && last !== "__root__" ? last : undefined);
      return next;
    });
  }

  function upAudioFolder() {
    setAudioStack((prev) => {
      if (prev.length === 0) {
        setAudioContainerId(undefined);
        return prev;
      }

      const next = [...prev];
      const last = next.pop();
      setAudioContainerId(last && last !== "__root__" ? last : undefined);
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoAssetId || !audioAssetId) {
      setMessage("Select both a video and an audio asset.");
      return;
    }

    setMessage(null);

    const params = new URLSearchParams({ videoAssetId, audioAssetId });
    router.push(`/combos/preview?${params.toString()}`);
  }

  return (
    <form className="rounded-xl border bg-card p-4 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-base font-semibold">Preview Combo</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Video</p>
          <div className="rounded-md border bg-background">
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              Folder: {videoContainerId ?? "root"}
            </div>
            <div className="max-h-56 overflow-auto p-2">
              {videoEntries
                .filter((entry) => entry.type === "folder" || entry.type === "video")
                .map((entry) => (
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                    key={entry.id}
                    onClick={() => {
                      if (entry.type === "folder") {
                        openVideoFolder(entry.id);
                        return;
                      }
                      setVideoAssetId(entry.id);
                    }}
                    type="button"
                  >
                    {typeIcon(entry.type)}
                    <span className="truncate">{entry.title}</span>
                    <span className="text-xs text-muted-foreground/70">{entry.id}</span>
                  </button>
                ))}
              <button
                className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                onClick={upVideoFolder}
                type="button"
              >
                <span className="text-muted-foreground">..</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Selected: {selectedVideo?.title ?? "none"}
            {selectedVideo ? (
              <span className="ml-1 text-muted-foreground/70">{selectedVideo.id}</span>
            ) : null}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Audio</p>
          <div className="rounded-md border bg-background">
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              Folder: {audioContainerId ?? "root"}
            </div>
            <div className="max-h-56 overflow-auto p-2">
              {audioEntries
                .filter((entry) => entry.type === "folder" || entry.type === "audio")
                .map((entry) => (
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                    key={entry.id}
                    onClick={() => {
                      if (entry.type === "folder") {
                        openAudioFolder(entry.id);
                        return;
                      }
                      setAudioAssetId(entry.id);
                    }}
                    type="button"
                  >
                    {typeIcon(entry.type)}
                    <span className="truncate">{entry.title}</span>
                    <span className="text-xs text-muted-foreground/70">{entry.id}</span>
                  </button>
                ))}
              <button
                className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                onClick={upAudioFolder}
                type="button"
              >
                <span className="text-muted-foreground">..</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Selected: {selectedAudio?.title ?? "none"}
            {selectedAudio ? (
              <span className="ml-1 text-muted-foreground/70">{selectedAudio.id}</span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" variant="outline">
          Preview Pair
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
