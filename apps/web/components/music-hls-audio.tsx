"use client";

import { useEffect, useRef, useState } from "react";

export function MusicHlsAudio({ url, title }: { url: string; title: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    let cancelled = false;
    let hls: { destroy: () => void } | undefined;
    setError(null);
    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      const handleNativeError = () => setError("The native HLS preview could not be loaded.");
      audio.addEventListener("error", handleNativeError);
      audio.src = url;
      audio.load();
      return () => {
        audio.removeEventListener("error", handleNativeError);
        audio.removeAttribute("src");
        audio.load();
      };
    }
    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError("This browser does not support HLS playback.");
          return;
        }
        const instance = new Hls();
        instance.loadSource(url);
        instance.attachMedia(audio);
        instance.on(Hls.Events.ERROR, (_event, data: { fatal?: boolean }) => {
          if (data.fatal) setError("The HLS preview could not be loaded.");
        });
        hls = instance;
      })
      .catch(() => {
        if (!cancelled) setError("The HLS player could not be loaded.");
      });
    return () => {
      cancelled = true;
      hls?.destroy();
      audio.removeAttribute("src");
    };
  }, [attempt, url]);

  return (
    <div className="space-y-1">
      <audio aria-label={`Preview ${title}`} className="w-full" controls preload="metadata" ref={ref} />
      {error ? <div className="flex items-center justify-between gap-2 text-xs text-red-400" role="alert"><span>{error}</span><button className="rounded border px-2 py-1 text-foreground" onClick={() => setAttempt((current) => current + 1)} type="button">Retry preview</button></div> : null}
    </div>
  );
}
