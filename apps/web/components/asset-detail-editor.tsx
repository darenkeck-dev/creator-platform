"use client";

import {
  AssetDetailResponseSchema,
  ASSET_TAG_FACETS,
  ASSET_TAG_WEIGHTS,
  ASSET_VISIBILITIES,
  type AssetDetailResponse,
  type AssetTag,
  type AssetVisibility,
  type ToneReviewRecord,
  type UpdateAssetInput,
} from "@media-manager/contracts";
import { FolderInput, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetPlayer } from "@/components/asset-player";
import { MoveAssetsDialog } from "@/components/move-assets-dialog";
import { ReprocessAssetsDialog } from "@/components/reprocess-assets-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Asset = AssetDetailResponse["asset"];
type ToneScores = NonNullable<NonNullable<Asset["toneAnalysis"]>["scores"]>;

type Props = {
  initialAsset: Asset;
  initialReviews: ToneReviewRecord[];
};

function tagsEqual(a: AssetTag[], b: AssetTag[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function shouldPollAsset(asset: Asset) {
  const conversionStatus = asset.conversion?.status;
  const toneAnalysisStatus = asset.toneAnalysis?.status;
  return (
    asset.status === "processing" ||
    conversionStatus === "queued" ||
    conversionStatus === "processing" ||
    toneAnalysisStatus === "queued" ||
    toneAnalysisStatus === "processing"
  );
}

function formatAuditDetails(details: Record<string, string | number | boolean> | undefined) {
  if (!details) {
    return null;
  }

  const entries = Object.entries(details);
  if (entries.length === 0) {
    return null;
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

const TONE_SCORE_LABELS: Array<[keyof ToneScores, string]> = [
  ["valence", "Valence"],
  ["arousal", "Arousal"],
  ["dominance", "Dominance"],
  ["warmth", "Warmth"],
  ["tension", "Tension"],
  ["intimacy", "Intimacy"],
  ["instability", "Instability"],
  ["nostalgia", "Nostalgia"],
  ["beauty", "Beauty"],
  ["menace", "Menace"],
];

function ToneWordList({ label, words }: { label: string; words?: string[] }) {
  if (!words || words.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {words.map((word) => (
          <Badge key={`${label}-${word}`} variant="secondary">
            {word}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ToneScoreList({
  originalScores,
  adjustedScores,
}: {
  originalScores?: ToneScores;
  adjustedScores?: ToneScores;
}) {
  if (!originalScores) {
    return null;
  }

  const visibleScores = TONE_SCORE_LABELS.flatMap(([key, label]) => {
    const originalValue = originalScores[key];
    const adjustedValue = adjustedScores?.[key];
    return typeof originalValue === "number"
      ? [{ key, label, originalValue, value: adjustedValue ?? originalValue }]
      : [];
  });

  if (visibleScores.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-foreground/60 bg-background" />
          Extracted
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="flex items-center">
            <span className="h-1.5 w-4 rounded-l-full bg-emerald-500" />
            <span
              className="h-3 w-2 bg-emerald-500"
              style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
            />
          </span>
          Adjusted
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-7 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500" />
          Adjustment
        </span>
      </div>
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {visibleScores.map((score) => {
          const originalValue = Math.max(-1, Math.min(1, score.originalValue));
          const adjustedValue = Math.max(-1, Math.min(1, score.value));
          const originalPercent = 50 + originalValue * 50;
          const adjustedPercent = 50 + adjustedValue * 50;
          const delta = adjustedValue - originalValue;
          const deltaStartPercent = Math.min(originalPercent, adjustedPercent);
          const deltaWidthPercent = Math.abs(adjustedPercent - originalPercent);
          return (
            <div
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 px-1"
              key={score.key}
            >
              <div className="text-xs font-medium">{score.label}</div>
              <div
                aria-label={`${score.label}: extracted ${originalValue.toFixed(2)}, adjusted ${adjustedValue.toFixed(2)}, delta ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`}
                className="relative mx-3 h-6"
                role="img"
              >
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                <div className="absolute left-1/2 top-1/2 z-10 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/50" />
                {delta !== 0 ? (
                  <div
                    className={`absolute top-1/2 z-20 h-1.5 -translate-y-1/2 ${
                      delta > 0 ? "rounded-l-full bg-emerald-500" : "rounded-r-full bg-amber-500"
                    }`}
                    style={{
                      left:
                        delta > 0 ? `${deltaStartPercent}%` : `calc(${deltaStartPercent}% + 7px)`,
                      width: `max(0px, calc(${deltaWidthPercent}% - 7px))`,
                    }}
                  />
                ) : null}
                <span
                  className="absolute top-1/2 z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/60 bg-background"
                  style={{ left: `${originalPercent}%` }}
                  title={`Extracted ${originalValue.toFixed(2)}`}
                />
                {delta !== 0 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute top-1/2 z-40 h-3 w-2 ${delta > 0 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{
                      clipPath:
                        delta > 0
                          ? "polygon(0 0, 100% 50%, 0 100%)"
                          : "polygon(100% 0, 0 50%, 100% 100%)",
                      left: `${adjustedPercent}%`,
                      transform: delta > 0 ? "translate(-100%, -50%)" : "translate(0, -50%)",
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AssetDetailEditor({ initialAsset, initialReviews }: Props) {
  const router = useRouter();
  const [asset, setAsset] = useState<Asset>(initialAsset);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(initialAsset.title);
  const [description, setDescription] = useState(initialAsset.description);
  const [visibility, setVisibility] = useState<AssetVisibility>(initialAsset.visibility);
  const [tags, setTags] = useState<AssetTag[]>(initialAsset.tags);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newTagFacet, setNewTagFacet] = useState<string>("__freeform__");
  const [newTagValue, setNewTagValue] = useState("");
  const [newTagWeight, setNewTagWeight] = useState<string>("__none__");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const dirty = useMemo(() => {
    return (
      title !== asset.title ||
      description !== asset.description ||
      visibility !== asset.visibility ||
      !tagsEqual(tags, asset.tags)
    );
  }, [
    asset.description,
    asset.tags,
    asset.title,
    asset.visibility,
    description,
    tags,
    title,
    visibility,
  ]);

  const streamReady = asset.status === "ready" && asset.stream?.hlsMasterUrl;
  const assetId = asset.id;
  const assetStatus = asset.status;
  const conversionStatus = asset.conversion?.status ?? "not_started";
  const toneAnalysisStatus = asset.toneAnalysis?.status ?? "not_started";
  const auditLog = [...(asset.auditLog ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  function addTagFromDraft() {
    const value = newTagValue.trim();
    if (value.length === 0) {
      return;
    }

    const facet =
      newTagFacet !== "__freeform__" &&
      ASSET_TAG_FACETS.includes(newTagFacet as (typeof ASSET_TAG_FACETS)[number])
        ? (newTagFacet as (typeof ASSET_TAG_FACETS)[number])
        : undefined;
    const weight =
      newTagWeight !== "__none__" &&
      ASSET_TAG_WEIGHTS.includes(newTagWeight as (typeof ASSET_TAG_WEIGHTS)[number])
        ? (newTagWeight as (typeof ASSET_TAG_WEIGHTS)[number])
        : undefined;

    setTags((previous) => [...previous, { facet, value, weight, source: "user" }]);
    setNewTagValue("");
    setNewTagFacet("__freeform__");
    setNewTagWeight("__none__");
  }

  async function saveChanges() {
    if (!dirty || saving) {
      return true;
    }

    setSaving(true);
    setStatusMessage(null);

    const payload: UpdateAssetInput = {
      title: title.trim(),
      description: description.trim(),
      visibility,
      tags: tags
        .map((tag) => ({
          ...tag,
          value: tag.value.trim(),
          source: "user" as const,
        }))
        .filter((tag) => tag.value.length > 0),
    };

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error("Failed to save changes");
      }

      const data = (await response.json()) as { asset?: Asset };
      if (!data.asset) {
        throw new Error("Invalid save response");
      }

      setAsset(data.asset);
      setTitle(data.asset.title);
      setDescription(data.asset.description);
      setVisibility(data.asset.visibility);
      setTags(data.asset.tags);
      setStatusMessage("Changes saved.");
      return true;
    } catch {
      setStatusMessage("Could not save changes. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function leaveEditMode() {
    if (dirty) {
      setLeaveDialogOpen(true);
      return;
    }

    setEditMode(false);
  }

  function discardChangesAndLeaveEditMode() {
    setTitle(asset.title);
    setDescription(asset.description);
    setVisibility(asset.visibility);
    setTags(asset.tags);
    setLeaveDialogOpen(false);
    setEditMode(false);
  }

  async function saveAndLeaveEditMode() {
    const ok = await saveChanges();
    if (!ok) {
      return;
    }

    setLeaveDialogOpen(false);
    setEditMode(false);
  }

  async function deleteAsset() {
    if (deleting) {
      return;
    }

    setDeleting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete asset");
      }

      router.push("/library");
      router.refresh();
    } catch {
      setStatusMessage("Could not delete asset. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function moveAsset(nextContainerId: string | null) {
    const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/move`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        containerId: nextContainerId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to move asset");
    }

    const data = (await response.json()) as { asset?: Asset };
    if (!data.asset) {
      throw new Error("Invalid move response");
    }

    setAsset(data.asset);
    setStatusMessage("Asset location updated.");
    router.refresh();
  }

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editMode || !dirty) {
        return;
      }

      void saveChanges();
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, editMode]);

  useEffect(() => {
    if (editMode || saving || dirty || !shouldPollAsset(asset)) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as unknown;
        const parsed = AssetDetailResponseSchema.safeParse(json);
        if (!parsed.success || cancelled) {
          return;
        }

        const latest = parsed.data.asset;
        setAsset(latest);
        setTitle(latest.title);
        setDescription(latest.description);
        setVisibility(latest.visibility);
        setTags(latest.tags);
      } catch {
        // best effort polling
      }
    };

    const intervalId = setInterval(() => {
      void poll();
    }, 4000);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [assetId, assetStatus, conversionStatus, dirty, editMode, saving, toneAnalysisStatus]);

  useEffect(() => {
    const onLinkClick = (event: MouseEvent) => {
      if (!editMode || !dirty || saving) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) {
        return;
      }

      event.preventDefault();
      void (async () => {
        const ok = await saveChanges();
        if (ok) {
          window.location.href = nextUrl.href;
        }
      })();
    };

    document.addEventListener("click", onLinkClick, true);
    return () => {
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [dirty, editMode, saving]);

  useEffect(() => {
    const onPopState = () => {
      if (!editMode || !dirty) {
        return;
      }

      void saveChanges();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty, editMode]);

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{asset.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {asset.type === "audio" || asset.type === "video" ? (
            <Button
              onClick={() =>
                router.push(
                  `/review?targetType=${asset.type}&assetId=${encodeURIComponent(asset.id)}`
                )
              }
              type="button"
            >
              Review
            </Button>
          ) : null}
          <ReprocessAssetsDialog
            assetIds={[asset.id]}
            onJobCreated={() => {
              setStatusMessage("Tone reprocessing job started.");
              router.refresh();
            }}
            type="reprocess_tone"
          />
          <ReprocessAssetsDialog
            assetIds={[asset.id]}
            onJobCreated={() => {
              setStatusMessage("Conversion reprocessing job started.");
              router.refresh();
            }}
            type="reprocess_conversion"
          />
          <Button
            aria-label="Move asset"
            onClick={() => setMoveDialogOpen(true)}
            title="Move asset"
            type="button"
            variant="outline"
          >
            <FolderInput aria-hidden="true" className="h-4 w-4" />
          </Button>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
          <Button
            aria-label="Delete asset"
            className="h-9 w-9 px-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            onClick={() => setDeleteDialogOpen(true)}
            title="Delete asset"
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <h2 className="whitespace-nowrap text-base font-semibold capitalize">
            Status: {asset.status}
          </h2>
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <dt className="text-muted-foreground">Conversion</dt>
              <dd className="font-medium capitalize">{conversionStatus.replaceAll("_", " ")}</dd>
            </div>
            <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <dt className="text-muted-foreground">Tone Analysis</dt>
              <dd className="font-medium capitalize">{toneAnalysisStatus.replaceAll("_", " ")}</dd>
            </div>
            <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">{asset.type}</dd>
            </div>
            <div className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <dt className="text-muted-foreground">Visibility</dt>
              <dd className="font-medium capitalize">{asset.visibility}</dd>
            </div>
          </dl>
          <Button
            aria-label="Refresh status"
            className="ml-auto h-8 w-8 px-0"
            onClick={() => router.refresh()}
            size="sm"
            title="Refresh status"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
        <details className="mt-4 border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium">Details</summary>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Asset ID</dt>
              <dd className="break-all font-medium">{asset.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Origin</dt>
              <dd className="font-medium capitalize">{asset.origin ?? "uploaded"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="break-all font-medium">{asset.ownerEmail}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Conversion Profile</dt>
              <dd className="font-medium">{asset.conversion?.profile ?? "N/A"}</dd>
            </div>
            {asset.generation ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Generation</dt>
                <dd className="font-medium">
                  {asset.generation.provider} / {asset.generation.model} (
                  {asset.generation.workflowId})
                </dd>
              </div>
            ) : null}
            {asset.conversion?.errorMessage ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Conversion Error</dt>
                <dd className="font-medium text-red-700 dark:text-red-300">
                  {asset.conversion.errorMessage}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Tone Profile</dt>
              <dd className="font-medium">{asset.toneAnalysis?.profile ?? "N/A"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tone Updated</dt>
              <dd className="font-medium">{asset.toneAnalysis?.updatedAt ?? "N/A"}</dd>
            </div>
            {asset.toneAnalysis?.errorMessage ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Tone Analysis Error</dt>
                <dd className="font-medium text-red-700 dark:text-red-300">
                  {asset.toneAnalysis.errorMessage}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Container</dt>
              <dd className="font-medium">{asset.containerId ?? "root"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Root</dt>
              <dd className="font-medium">{asset.rootId ?? asset.id}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">MediaConvert Job</dt>
              <dd className="break-all font-medium">{asset.conversion?.jobId ?? "N/A"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Tone Analysis Artifact</dt>
              <dd className="break-all font-medium">
                {asset.toneAnalysis?.analysisBucket && asset.toneAnalysis.analysisKey
                  ? `s3://${asset.toneAnalysis.analysisBucket}/${asset.toneAnalysis.analysisKey}`
                  : "N/A"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Tone Bundle Artifact</dt>
              <dd className="break-all font-medium">
                {asset.toneAnalysis?.bundleBucket && asset.toneAnalysis.bundleKey
                  ? `s3://${asset.toneAnalysis.bundleBucket}/${asset.toneAnalysis.bundleKey}`
                  : "N/A"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Original</dt>
              <dd className="break-all font-medium">
                s3://{asset.original.bucket}/{asset.original.key}
              </dd>
            </div>
          </dl>
        </details>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Playback</h2>
        <div className="mt-3">
          <AssetPlayer asset={asset} />
        </div>
        {streamReady ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">HLS Master</dt>
              <dd className="font-medium break-all">{asset.stream?.hlsMasterUrl}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Poster</dt>
              <dd className="font-medium break-all">{asset.stream?.posterUrl ?? "N/A"}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Tone Analysis</h2>
          <Badge variant="secondary">{toneAnalysisStatus.replaceAll("_", " ")}</Badge>
        </div>
        {asset.toneAnalysis?.summary || asset.toneAnalysis?.scores ? (
          <div className="mt-4 space-y-5">
            {asset.toneAnalysis.summary ? (
              <p className="text-sm font-medium">{asset.toneAnalysis.summary}</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <ToneWordList label="Primary" words={asset.toneAnalysis.primaryWords} />
              <ToneWordList label="Secondary" words={asset.toneAnalysis.secondaryWords} />
              <ToneWordList label="Avoid" words={asset.toneAnalysis.avoidWords} />
            </div>
            <ToneScoreList
              adjustedScores={asset.toneAnalysis.adjustedScores}
              originalScores={asset.toneAnalysis.scores}
            />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {asset.toneAnalysis.caption ? (
                <div>
                  <dt className="text-muted-foreground">Caption</dt>
                  <dd className="font-medium">{asset.toneAnalysis.caption}</dd>
                </div>
              ) : null}
              {asset.toneAnalysis.mood ? (
                <div>
                  <dt className="text-muted-foreground">Mood</dt>
                  <dd className="font-medium">{asset.toneAnalysis.mood}</dd>
                </div>
              ) : null}
              {asset.toneAnalysis.semanticSummary ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Semantic Summary</dt>
                  <dd className="font-medium">{asset.toneAnalysis.semanticSummary}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Tone summary and scores will appear here when analysis completes.
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Metadata</h2>
          {editMode ? (
            <div className="flex items-center gap-2">
              <Button disabled={!dirty || saving} onClick={() => void saveChanges()} type="button">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={() => void leaveEditMode()} type="button" variant="secondary">
                Leave Edit Mode
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditMode(true)} type="button" variant="outline">
              Edit
            </Button>
          )}
        </div>
        <div className="mt-4 space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="asset-title">
              Title
            </label>
            <Input
              disabled={!editMode}
              id="asset-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="asset-description">
              Description
            </label>
            <Textarea
              disabled={!editMode}
              id="asset-description"
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="asset-visibility">
              Visibility
            </label>
            <Select
              disabled={!editMode}
              onValueChange={(value) => setVisibility(value as AssetVisibility)}
              value={visibility}
            >
              <SelectTrigger id="asset-visibility">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_VISIBILITIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Tags</h3>
              {editMode ? (
                <span className="text-xs text-muted-foreground">Facet + freeform tags</span>
              ) : null}
            </div>

            {editMode ? (
              <div className="space-y-3 rounded-lg border bg-background p-4">
                <div className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
                  <Select onValueChange={setNewTagFacet} value={newTagFacet}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="freeform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__freeform__">freeform</SelectItem>
                      {ASSET_TAG_FACETS.map((facet) => (
                        <SelectItem key={facet} value={facet}>
                          {facet}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    className="h-10"
                    onChange={(event) => setNewTagValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTagFromDraft();
                      }
                    }}
                    placeholder="add a tag"
                    value={newTagValue}
                  />

                  <Select onValueChange={setNewTagWeight} value={newTagWeight}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="weight" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">weight</SelectItem>
                      {ASSET_TAG_WEIGHTS.map((weight) => (
                        <SelectItem key={weight} value={weight}>
                          {weight}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center justify-end">
                    <Button onClick={addTagFromDraft} size="sm" type="button" variant="outline">
                      Add
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 rounded-md border bg-card p-3">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags yet</p>
                  ) : (
                    tags.map((tag, index) => (
                      <button
                        className="inline-flex"
                        key={`tag-chip-${index}`}
                        onClick={() => {
                          setTags((previous) =>
                            previous.filter((_, tagIndex) => tagIndex !== index)
                          );
                        }}
                        type="button"
                      >
                        <Badge variant="secondary">
                          {tag.facet ? `${tag.facet}: ${tag.value}` : tag.value}
                          {tag.weight ? ` (${tag.weight})` : ""}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>

                {tags.map((tag, index) => (
                  <div
                    className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[1fr_1.2fr_1fr_auto]"
                    key={`tag-${index}`}
                  >
                    <Select
                      disabled={!editMode}
                      onValueChange={(nextFacet: string) => {
                        const rawFacet = nextFacet === "__freeform__" ? "" : nextFacet;
                        const normalizedFacet = ASSET_TAG_FACETS.includes(
                          rawFacet as (typeof ASSET_TAG_FACETS)[number]
                        )
                          ? (rawFacet as (typeof ASSET_TAG_FACETS)[number])
                          : undefined;
                        setTags((previous) => {
                          const next = [...previous];
                          next[index] = {
                            ...next[index],
                            facet: normalizedFacet,
                            source: "user",
                          };
                          return next;
                        });
                      }}
                      value={tag.facet ?? "__freeform__"}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="freeform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__freeform__">freeform</SelectItem>
                        {ASSET_TAG_FACETS.map((facet) => (
                          <SelectItem key={facet} value={facet}>
                            {facet}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      className="h-10"
                      disabled={!editMode}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setTags((previous) => {
                          const next = [...previous];
                          next[index] = { ...next[index], value: nextValue, source: "user" };
                          return next;
                        });
                      }}
                      placeholder="value"
                      value={tag.value}
                    />

                    <Select
                      disabled={!editMode}
                      onValueChange={(nextWeight: string) => {
                        const rawWeight = nextWeight === "__none__" ? "" : nextWeight;
                        const normalizedWeight = ASSET_TAG_WEIGHTS.includes(
                          rawWeight as (typeof ASSET_TAG_WEIGHTS)[number]
                        )
                          ? (rawWeight as (typeof ASSET_TAG_WEIGHTS)[number])
                          : undefined;

                        setTags((previous) => {
                          const next = [...previous];
                          next[index] = {
                            ...next[index],
                            weight: normalizedWeight,
                            source: "user",
                          };
                          return next;
                        });
                      }}
                      value={tag.weight ?? "__none__"}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="weight" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">weight</SelectItem>
                        {ASSET_TAG_WEIGHTS.map((weight) => (
                          <SelectItem key={weight} value={weight}>
                            {weight}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center justify-end">
                      <Button
                        onClick={() => {
                          setTags((previous) =>
                            previous.filter((_, tagIndex) => tagIndex !== index)
                          );
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-4">
                {asset.tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags</p>
                ) : (
                  asset.tags.map((tag, index) => (
                    <Badge key={`asset-tag-${index}`} variant="secondary">
                      {tag.facet ? `${tag.facet}: ${tag.value}` : tag.value}
                    </Badge>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Activity Log</h2>
        <div className="mt-4 space-y-3">
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            auditLog.map((entry) => {
              const details = formatAuditDetails(entry.details);
              return (
                <div className="rounded-lg border bg-background p-3 text-sm" key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          entry.level === "error"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                            : undefined
                        }
                        variant="secondary"
                      >
                        {entry.level}
                      </Badge>
                      <span className="font-medium">{entry.message}</span>
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                      {entry.at}
                    </time>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {entry.category.replaceAll("_", " ")} · {entry.source}
                    {entry.code ? ` · ${entry.code}` : ""}
                  </div>
                  {details ? <p className="mt-2 text-xs text-muted-foreground">{details}</p> : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {asset.type === "audio" || asset.type === "video" ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Reviews</h2>
            <Button
              onClick={() =>
                router.push(
                  `/review?targetType=${asset.type}&assetId=${encodeURIComponent(asset.id)}`
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Review This Asset
            </Button>
          </div>
          {initialReviews.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No reviews for this asset yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {initialReviews.map((review) => (
                <article className="rounded-lg border bg-background p-3" key={review.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">{review.reviewSource}</span>
                    <time className="text-xs text-muted-foreground" dateTime={review.createdAt}>
                      {new Date(review.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {review.keywords.map((keyword) => (
                      <Badge key={`${review.id}-${keyword}`} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                  {review.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">{review.notes}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Dialog onOpenChange={setLeaveDialogOpen} open={leaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved edits. Save before leaving edit mode?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setLeaveDialogOpen(false)} type="button" variant="secondary">
              Continue Editing
            </Button>
            <Button
              onClick={() => void discardChangesAndLeaveEditMode()}
              type="button"
              variant="outline"
            >
              Discard Changes
            </Button>
            <Button disabled={saving} onClick={() => void saveAndLeaveEditMode()} type="button">
              {saving ? "Saving..." : "Save and Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              This permanently deletes this asset and its related objects. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deleting}
              onClick={() => setDeleteDialogOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={deleting}
              onClick={() => void deleteAsset()}
              type="button"
              variant="destructive"
            >
              {deleting ? "Deleting..." : "Delete Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveAssetsDialog
        assetCount={1}
        currentContainerId={asset.containerId}
        excludedFolderIds={asset.type === "folder" ? [asset.id] : []}
        onConfirm={moveAsset}
        onOpenChange={setMoveDialogOpen}
        open={moveDialogOpen}
        title="Move Asset"
      />
    </section>
  );
}
