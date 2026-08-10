"use client";

import type { AssetDetailResponse } from "@media-manager/contracts";
import { useEffect, useRef, useState } from "react";

type Asset = AssetDetailResponse["asset"];

type Props = {
  asset: Asset;
  loop?: boolean;
};

export function AssetPlayer({ asset, loop = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [directPlaybackUrl, setDirectPlaybackUrl] = useState<string | null>(null);
  const [directPlaybackLoading, setDirectPlaybackLoading] = useState(false);

  const isVideoReady =
    asset.type === "video" && asset.status === "ready" && !!asset.stream?.hlsMasterUrl;

  useEffect(() => {
    if (!(asset.type === "audio" || asset.type === "image")) {
      setDirectPlaybackUrl(null);
      setDirectPlaybackLoading(false);
      return;
    }

    let cancelled = false;
    setDirectPlaybackLoading(true);
    setPlayerError(null);

    const load = async () => {
      try {
        const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/playback-url`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load playback URL.");
        }

        const json = (await response.json()) as { playbackUrl?: string };
        if (!json.playbackUrl) {
          throw new Error("Playback URL was missing.");
        }

        if (!cancelled) {
          setDirectPlaybackUrl(json.playbackUrl);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load playback URL.";
          setPlayerError(message);
        }
      } finally {
        if (!cancelled) {
          setDirectPlaybackLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [asset.id, asset.type]);

  useEffect(() => {
    if (!isVideoReady) {
      setPlayerError(null);
      return;
    }

    const video = videoRef.current;
    const streamUrl = asset.stream?.hlsMasterUrl;
    if (!video || !streamUrl) {
      return;
    }

    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;

    const setup = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        return;
      }

      const hlsModule = await import("hls.js");
      const Hls = hlsModule.default;

      if (!Hls.isSupported() || cancelled) {
        setPlayerError("Your browser does not support HLS playback.");
        return;
      }

      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean }) => {
        if (data.fatal) {
          setPlayerError("Playback failed while loading the stream.");
        }
      });
      hlsInstance = hls;
    };

    void setup();

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
    };
  }, [asset.stream?.hlsMasterUrl, isVideoReady]);

  if (isVideoReady) {
    return (
      <div className="space-y-3">
        <video
          ref={videoRef}
          controls
          className="w-full rounded-lg border bg-black"
          loop={loop}
          poster={asset.stream?.posterUrl}
          preload="metadata"
        />
        {playerError ? <p className="text-sm text-destructive">{playerError}</p> : null}
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <p className="text-sm text-muted-foreground">
        Video stream is not ready yet. Current conversion status is{" "}
        {(asset.conversion?.status ?? "not_started").replaceAll("_", " ")}.
      </p>
    );
  }

  if (asset.type === "folder") {
    return <p className="text-sm text-muted-foreground">Folders do not have playback.</p>;
  }

  if (asset.type === "audio") {
    if (directPlaybackLoading) {
      return <p className="text-sm text-muted-foreground">Loading audio playback...</p>;
    }

    if (directPlaybackUrl) {
      return (
        <audio controls className="w-full" loop={loop} preload="metadata" src={directPlaybackUrl} />
      );
    }

    return (
      <p className="text-sm text-muted-foreground">
        Audio playback is unavailable. Current conversion status is{" "}
        {(asset.conversion?.status ?? "not_started").replaceAll("_", " ")}.
      </p>
    );
  }

  if (directPlaybackLoading) {
    return <p className="text-sm text-muted-foreground">Loading image preview...</p>;
  }

  if (directPlaybackUrl) {
    return (
      <img
        alt={asset.title}
        className="max-h-[28rem] w-full rounded-lg border object-contain"
        src={directPlaybackUrl}
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Image preview is unavailable. Current conversion status is{" "}
      {(asset.conversion?.status ?? "not_started").replaceAll("_", " ")}.
    </p>
  );
}
