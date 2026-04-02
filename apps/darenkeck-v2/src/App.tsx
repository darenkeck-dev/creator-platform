import { PublicRandomComboResponseSchema } from "@media-manager/contracts";
import { useEffect, useRef, useState } from "react";

import { BulletinSection } from "./components/BulletinSection";
import { LinksSection } from "./components/LinksSection";
import { ProfileHeader } from "./components/ProfileHeader";
import { SingleComboSlot } from "./components/SingleComboSlot";
import {
  SingleSlotKey,
  SlotManager,
  SlotManagerState,
  SlotPlaybackState,
  type ComboPayload,
  type SlotPlaybackAssignment,
} from "./lib/slot-manager";

function getApiBaseUrl(): string | null {
  const raw = import.meta.env.VITE_COMBO_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL;
  if (!raw) {
    return null;
  }

  if (import.meta.env.DEV) {
    return "";
  }

  return raw.replace(/\/$/, "");
}

async function fetchRandomCombo(): Promise<ComboPayload | null> {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl && !import.meta.env.DEV) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/public/combos/random`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }

  const parsed = PublicRandomComboResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return null;
  }

  return {
    comboId: parsed.data.comboId,
    videoTitle: parsed.data.videoTitle,
    audioTitle: parsed.data.audioTitle,
    videoSrc: parsed.data.videoSrc,
    audioSrc: parsed.data.audioSrc,
  };
}

export function App() {
  const [slotAssignment, setSlotAssignment] = useState<SlotPlaybackAssignment | null>(null);
  const [comboLoading, setComboLoading] = useState(false);
  const [comboError, setComboError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [managerState, setManagerState] = useState<SlotManagerState>(SlotManagerState.Idle);
  const [slotState, setSlotState] = useState<SlotPlaybackState>(SlotPlaybackState.Idle);
  const [combosPlayedCount, setCombosPlayedCount] = useState(0);
  const [isBulletinOpen, setIsBulletinOpen] = useState(true);
  const managerRef = useRef<SlotManager | null>(null);

  useEffect(() => {
    const manager = new SlotManager({
      fetchRandomCombo,
      events: {
        onComboChanged: setSlotAssignment,
        onLoadingChange: setComboLoading,
        onError: setComboError,
        onManagerStateChange: setManagerState,
        onSlotStateChange: (_slot, state) => {
          setSlotState(state);
        },
        onCombosPlayedChange: setCombosPlayedCount,
        onDebug: (event, data) => {
          console.log("[darenkeck-v2][SlotManager]", event, data ?? {});
        },
      },
    });
    managerRef.current = manager;
    void manager.init();

    return () => {
      manager.destroy();
      if (managerRef.current === manager) {
        managerRef.current = null;
      }
    };
  }, []);

  const handleTimelineEnded = () => {
    void managerRef.current?.handleSlotPlaybackEnded(SingleSlotKey.Primary);
  };

  const handlePlaybackReady = () => {
    managerRef.current?.handleSlotPlaybackReady(SingleSlotKey.Primary);
  };

  const handlePlaybackStateChange = (phase: string) => {
    managerRef.current?.handleSlotPlaybackPhaseChange(SingleSlotKey.Primary, phase);
  };

  const linkItems = [
    { label: "Github", href: "https://github.com/darenkeck-dev" },
    { label: "Soundcloud", href: "https://soundcloud.com/darenkeck" },
    { label: "Wayfarer Music Group", href: "https://wayfarermusicgroup.com/dir" },
  ];

  const bulletinItems = [
    <>
      My collaboration{" "}
      <a
        className="font-semibold text-yellow-300"
        href="https://wayfarermusicgroup.com/dir/shadow-dance-is-now-available/"
        rel="noreferrer"
        target="_blank"
      >
        Shadow Dance
      </a>{" "}
      with the talented{" "}
      <a className="text-yellow-300" href="https://billydenk.com" rel="noreferrer" target="_blank">
        Billy Denk
      </a>{" "}
      is out now! Listen on{" "}
      <a
        className="text-yellow-300"
        href="https://wayfarermusicgroup.bandcamp.com/track/shadow-dance"
        rel="noreferrer"
        target="_blank"
      >
        Bandcamp
      </a>{" "}
      or your favorite streaming platform.
    </>,
  ];

  return (
    <main className="relative isolate h-dvh overflow-hidden px-4 sm:px-6">
      {slotAssignment ? (
        <SingleComboSlot
          audioMuted={isAudioMuted}
          combo={slotAssignment.combo}
          playbackCycle={slotAssignment.playbackCycle}
          onPlaybackReady={handlePlaybackReady}
          onPlaybackStateChange={handlePlaybackStateChange}
          onTimelineEnded={handleTimelineEnded}
        />
      ) : null}
      <button
        aria-label={isAudioMuted ? "Unmute audio" : "Mute audio"}
        className="pointer-events-auto fixed z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm [left:max(1.5rem,env(safe-area-inset-left))] [top:max(1.5rem,env(safe-area-inset-top))]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsAudioMuted((previous) => !previous);
        }}
        title={isAudioMuted ? "Unmute audio" : "Mute audio"}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="24"
        >
          <path d="M11 5L6 9H3v6h3l5 4V5z" />
          {isAudioMuted ? (
            <>
              <path d="M16 9l5 6" />
              <path d="M21 9l-5 6" />
            </>
          ) : (
            <>
              <path d="M16 10.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5" />
              <path d="M18.8 7.7c1.7 1.5 2.7 3.8 2.7 6.3s-1 4.8-2.7 6.3" />
            </>
          )}
        </svg>
      </button>

      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.68))]" />

      <section className="relative z-20 mx-auto flex h-full w-full max-w-xl items-end py-6 sm:py-8">
        <div
          className={`glass-card rounded-2xl border transition-all duration-300 ease-in-out ${
            isBulletinOpen
              ? "w-full p-4 shadow-2xl shadow-black/35 sm:p-5"
              : "w-auto p-2 shadow-none"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/75">darenkeck-v2</p>
            <button
              aria-label={isBulletinOpen ? "Minimize bulletin" : "Maximize bulletin"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/90 transition-all duration-200 ease-in-out hover:bg-black/50"
              onClick={() => {
                setIsBulletinOpen((previous) => !previous);
              }}
              title={isBulletinOpen ? "Minimize" : "Maximize"}
              type="button"
            >
              {isBulletinOpen ? (
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="16"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <rect height="16" rx="2.5" width="16" x="4" y="4" />
                  <path d="M8 12h8" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="16"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <rect height="16" rx="2.5" width="16" x="4" y="4" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              )}
            </button>
          </div>

          <div
            className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
              isBulletinOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 space-y-5">
              <header className="space-y-2">
                <h1 className="text-3xl font-bold text-white">Hey!</h1>
                <p className="text-sm leading-relaxed text-white/85">
                  This is my personal page. I program at DEPT and write music at Wayfarer Records!
                </p>
                <p className="text-sm leading-relaxed text-white/80">
                  I'll occasionally link up fun projects here as well.
                </p>
              </header>
              <BulletinSection items={bulletinItems} />
              <LinksSection links={linkItems} />
              {!slotAssignment ? (
                <p className="text-xs text-white/70">
                  {comboLoading
                    ? "Loading combo player..."
                    : (comboError ?? "Combo playback unavailable. Set VITE_COMBO_API_BASE_URL.")}
                </p>
              ) : null}
              <p className="text-[11px] text-white/65">
                manager: {managerState} | slot: {slotState} | combos played: {combosPlayedCount}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
