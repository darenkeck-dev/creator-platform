import { PublicRandomComboResponseSchema } from "@media-manager/contracts";
import { BackgroundComboStage } from "./background-combo-stage";
import { BulletinSection } from "./components/bulletin-section";
import { LinksSection } from "./components/links-section";
import { ProfileHeader } from "./components/profile-header";

export const dynamic = "force-dynamic";

type RandomComboPayload = {
  comboId: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
};

type VignetteStyle = {
  backgroundImage: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function buildVignetteStyle(vignetteStrength: number, cornerSharpness: number): VignetteStyle {
  const strength = clamp(vignetteStrength, 0, 1);
  const sharpness = clamp(cornerSharpness, 0, 1);

  const innerStop = (62 + sharpness * 12).toFixed(1);
  const midStop = (82 + sharpness * 8).toFixed(1);
  const midDarkness = (0.12 + strength * 0.24).toFixed(3);
  const edgeDarkness = (0.34 + strength * 0.5).toFixed(3);

  const linearTopOpacity = (0.06 + strength * 0.05).toFixed(3);
  const linearBottomOpacity = (0.56 + strength * 0.18).toFixed(3);

  return {
    backgroundImage: [
      `radial-gradient(140% 120% at 50% 50%, rgba(0,0,0,0) ${innerStop}%, rgba(0,0,0,${midDarkness}) ${midStop}%, rgba(0,0,0,${edgeDarkness}) 100%)`,
      `linear-gradient(180deg, rgba(0,0,0,${linearTopOpacity}), rgba(0,0,0,${linearBottomOpacity}))`,
    ].join(","),
  };
}

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

async function fetchRandomPublicCombo(): Promise<RandomComboPayload | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error(
      "Missing API base URL. Set NEXT_PUBLIC_COMBO_API_BASE_URL, NEXT_PUBLIC_API_BASE_URL, or API_BASE_URL."
    );
  }

  const response = await fetch(`${apiBaseUrl}/public/combos/random`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to fetch /public/combos/random: ${response.status} ${response.statusText}. Body: ${errorBody}`
    );
  }

  const parsed = PublicRandomComboResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`Invalid /public/combos/random payload: ${parsed.error.message}`);
  }

  return {
    comboId: parsed.data.comboId,
    videoTitle: parsed.data.videoTitle,
    audioTitle: parsed.data.audioTitle,
    videoSrc: parsed.data.videoSrc,
    audioSrc: parsed.data.audioSrc,
  };
}

export default async function HomePage() {
  const vignetteStrength = 0.9;
  const cornerSharpness = 0.1;
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
  const randomCombo = await fetchRandomPublicCombo();
  const videoSrc = randomCombo?.videoSrc ?? "";
  const audioSrc = randomCombo?.audioSrc ?? "";
  const videoTitle = randomCombo?.videoTitle ?? "Background Video";
  const audioTitle = randomCombo?.audioTitle ?? "Background Audio";
  const comboId = randomCombo?.comboId;
  const hasBackgroundCombo = videoSrc.length > 0 && audioSrc.length > 0;

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 pb-10 pt-6 sm:px-6">
      <div className="absolute inset-0 z-0">
        {hasBackgroundCombo ? (
          <BackgroundComboStage
            audioSrc={audioSrc}
            audioTitle={audioTitle}
            comboId={comboId}
            videoSrc={videoSrc}
            videoTitle={videoTitle}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(1000px_540px_at_20%_15%,rgba(72,122,255,0.35),transparent_58%),radial-gradient(900px_520px_at_82%_12%,rgba(10,222,190,0.22),transparent_56%),linear-gradient(145deg,#091125_0%,#090d16_100%)]" />
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={buildVignetteStyle(vignetteStrength, cornerSharpness)}
      />

      <section className="relative z-20 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-xl items-end">
        <details
          className="glass-card w-full rounded-2xl border p-4 shadow-2xl shadow-black/35 sm:p-5"
          open
        >
          <summary className="cursor-pointer list-none text-sm font-medium tracking-wide text-white/85">
            Open Bulletin
          </summary>

          <div className="mt-4 space-y-5">
            <ProfileHeader
              description="This is my personal page. I program at DEPT and write music at Wayfarer Records!"
              secondaryDescription="I'll occasionally link up fun projects here as well."
              siteLabel="darenkeck"
              title="Hey!"
            />
            <LinksSection links={linkItems} />
            <BulletinSection items={bulletinItems} />

            {!hasBackgroundCombo ? (
              <p className="text-xs text-white/70">
                Ensure `NEXT_PUBLIC_COMBO_API_BASE_URL` points to your API with
                `/public/combos/random`.
              </p>
            ) : null}
          </div>
        </details>
      </section>
    </main>
  );
}
