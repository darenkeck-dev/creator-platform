"use client";

import type { AssetDetailResponse } from "@media-manager/contracts";

import { AssetPlayer } from "@/components/asset-player";
import { ComboPlayer } from "@/components/combo-player";

type Asset = AssetDetailResponse["asset"];

type ReviewMediaPlayerProps =
  | {
      targetType: "combo";
      id: string;
      videoTitle: string;
      audioTitle: string;
      videoSrc: string;
      audioSrc: string;
    }
  | {
      targetType: "video";
      asset: Asset;
    }
  | {
      targetType: "audio";
      asset: Asset;
    };

export function ReviewMediaPlayer(props: ReviewMediaPlayerProps) {
  return (
    <div
      className={
        props.targetType === "combo"
          ? "relative h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-2xl border bg-black shadow-sm"
          : props.targetType === "audio"
            ? "min-h-48 rounded-xl border bg-card p-4 shadow-sm"
            : ""
      }
    >
      {props.targetType === "combo" ? (
        <ComboPlayer
          key={props.id}
          audioSrc={props.audioSrc}
          audioTitle={props.audioTitle}
          defaultAudioMuted={false}
          audioMutedByDefault={false}
          className="h-full w-full"
          comboId={props.id}
          preload="auto"
          variant="background"
          videoSrc={props.videoSrc}
          videoTitle={props.videoTitle}
        />
      ) : (
        <AssetPlayer asset={props.asset} />
      )}
    </div>
  );
}
