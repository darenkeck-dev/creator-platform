"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BackgroundVideoEdgeFadeProps = {
  videoElement: HTMLVideoElement | null;
  mode?: "pixel-sampled" | "css-fade";
};

const SAMPLE_INTERVAL_MS = 100;
const SAMPLE_STEP_PX = 16;
const SAMPLE_STRIP_HEIGHT = 4;
const LANDSCAPE_FADE_HEIGHT_VH = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function BackgroundVideoEdgeFade({
  videoElement,
  mode = "pixel-sampled",
}: BackgroundVideoEdgeFadeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stripCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallbackMode, setFallbackMode] = useState<"pixel-sampled" | "css-fade">(mode);
  const [overlayLeftPx, setOverlayLeftPx] = useState(0);
  const [overlayWidthPx, setOverlayWidthPx] = useState(0);
  const [overlayTopPx, setOverlayTopPx] = useState(0);
  const [overlayHeightPx, setOverlayHeightPx] = useState(0);

  useEffect(() => {
    setFallbackMode(mode);
  }, [mode]);

  const shouldUseCanvas = useMemo(() => fallbackMode === "pixel-sampled", [fallbackMode]);

  useEffect(() => {
    const computeGeometry = () => {
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (videoElement) {
        const rect = videoElement.getBoundingClientRect();
        const left = clamp(Math.round(rect.left), 0, viewportWidth);
        const right = clamp(Math.round(rect.right), 0, viewportWidth);
        const width = Math.max(0, right - left);
        const top = clamp(Math.round(rect.bottom), 0, viewportHeight);

        setOverlayLeftPx(left);
        setOverlayWidthPx(width > 0 ? width : viewportWidth);
        setOverlayTopPx(top);
        setOverlayHeightPx(Math.max(0, viewportHeight - top));
        return;
      }

      const top = Math.round(viewportHeight * (1 - LANDSCAPE_FADE_HEIGHT_VH / 100));
      setOverlayLeftPx(0);
      setOverlayWidthPx(viewportWidth);
      setOverlayTopPx(top);
      setOverlayHeightPx(Math.max(0, viewportHeight - top));
    };

    computeGeometry();
    const interval = window.setInterval(computeGeometry, SAMPLE_INTERVAL_MS);
    window.addEventListener("resize", computeGeometry);
    window.addEventListener("scroll", computeGeometry, { passive: true });

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", computeGeometry);
      window.removeEventListener("scroll", computeGeometry);
    };
  }, [videoElement]);

  useEffect(() => {
    if (!shouldUseCanvas || overlayHeightPx <= 0) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      setFallbackMode("css-fade");
      return;
    }

    if (!stripCanvasRef.current) {
      stripCanvasRef.current = document.createElement("canvas");
    }
    const stripCanvas = stripCanvasRef.current;
    const stripContext = stripCanvas.getContext("2d", { willReadFrequently: true });
    if (!stripContext) {
      setFallbackMode("css-fade");
      return;
    }

    const syncCanvasSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssWidth = Math.max(1, overlayWidthPx);
      const cssHeight = Math.max(1, overlayHeightPx);

      canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
      canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    };

    const drawCssLikeFallback = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const fallbackGradient = context.createLinearGradient(0, 0, 0, canvas.height);
      fallbackGradient.addColorStop(0, "rgba(6, 8, 14, 0)");
      fallbackGradient.addColorStop(0.28, "rgba(6, 8, 14, 0.38)");
      fallbackGradient.addColorStop(1, "rgba(4, 5, 8, 0.96)");
      context.fillStyle = fallbackGradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    };

    const drawSampledGradient = () => {
      if (
        !videoElement ||
        videoElement.readyState < 2 ||
        videoElement.videoWidth === 0 ||
        videoElement.videoHeight === 0
      ) {
        drawCssLikeFallback();
        return;
      }

      const sampleWidth = Math.max(1, Math.floor(canvas.width / SAMPLE_STEP_PX));
      stripCanvas.width = sampleWidth;
      stripCanvas.height = 1;

      const sourceY = Math.max(0, videoElement.videoHeight - SAMPLE_STRIP_HEIGHT);

      stripContext.clearRect(0, 0, stripCanvas.width, stripCanvas.height);
      stripContext.drawImage(
        videoElement,
        0,
        sourceY,
        videoElement.videoWidth,
        SAMPLE_STRIP_HEIGHT,
        0,
        0,
        stripCanvas.width,
        1
      );

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.filter = "blur(14px)";
      context.globalAlpha = 0.92;
      context.drawImage(stripCanvas, 0, 0, stripCanvas.width, 1, 0, 0, canvas.width, canvas.height);
      context.restore();

      const fadeToBlack = context.createLinearGradient(0, 0, 0, canvas.height);
      fadeToBlack.addColorStop(0, "rgba(0, 0, 0, 0)");
      fadeToBlack.addColorStop(0.4, "rgba(0, 0, 0, 0.42)");
      fadeToBlack.addColorStop(1, "rgba(0, 0, 0, 0.95)");
      context.fillStyle = fadeToBlack;
      context.fillRect(0, 0, canvas.width, canvas.height);
    };

    const tick = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        drawSampledGradient();
      } catch {
        setFallbackMode("css-fade");
      }
    };

    syncCanvasSize();
    tick();

    const resize = () => {
      syncCanvasSize();
      tick();
    };

    const interval = window.setInterval(tick, SAMPLE_INTERVAL_MS);
    window.addEventListener("resize", resize);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, [overlayHeightPx, overlayWidthPx, shouldUseCanvas, videoElement]);

  if (overlayHeightPx <= 0 || overlayWidthPx <= 0) {
    return null;
  }

  return (
    <>
      {shouldUseCanvas ? (
        <canvas
          className="pointer-events-none fixed z-[6]"
          ref={canvasRef}
          style={{
            left: `${overlayLeftPx}px`,
            top: `${overlayTopPx}px`,
            width: `${overlayWidthPx}px`,
            height: `${overlayHeightPx}px`,
          }}
        />
      ) : null}
      <div
        className={`pointer-events-none fixed z-[5] bg-[linear-gradient(180deg,rgba(6,8,14,0)_0%,rgba(6,8,14,0.38)_30%,rgba(4,5,8,0.96)_100%)] ${shouldUseCanvas ? "opacity-55" : "opacity-100"}`}
        style={{
          left: `${overlayLeftPx}px`,
          top: `${overlayTopPx}px`,
          width: `${overlayWidthPx}px`,
          height: `${overlayHeightPx}px`,
        }}
      />
    </>
  );
}
