"use client";

import {
  AssetDetailResponseSchema,
  ASSET_TAG_FACETS,
  ASSET_TAG_WEIGHTS,
  ASSET_VISIBILITIES,
  type AssetDetailResponse,
  type AssetTag,
  type AssetVisibility,
  type UpdateAssetInput,
} from "@media-manager/contracts";
import { FolderInput, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetPlayer } from "@/components/asset-player";
import { MoveAssetsDialog } from "@/components/move-assets-dialog";
import { ReprocessAssetsDialog } from "@/components/reprocess-assets-dialog";
import { ToneReviewPanel } from "@/components/tone-review-panel";
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

function ToneScoreList({ scores }: { scores?: ToneScores }) {
  if (!scores) {
    return null;
  }

  const visibleScores = TONE_SCORE_LABELS.flatMap(([key, label]) => {
    const value = scores[key];
    return typeof value === "number" ? [{ key, label, value }] : [];
  });

  if (visibleScores.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visibleScores.map((score) => {
        const value = Math.max(-1, Math.min(1, score.value));
        const startPercent = value < 0 ? 50 + value * 50 : 50;
        const widthPercent = Math.abs(value) * 50;
        return (
          <div key={score.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{score.label}</span>
              <span className="text-muted-foreground">{score.value.toFixed(2)}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div className="absolute left-1/2 top-0 h-2 w-px bg-border" />
              <div
                className="absolute top-0 h-2 rounded-full bg-primary"
                style={{
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AssetDetailEditor({ initialAsset }: Props) {
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
        {!editMode ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setDeleteDialogOpen(true)} type="button" variant="destructive">
              Delete
            </Button>
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
            <Button onClick={() => setEditMode(true)} type="button" variant="outline">
              Edit
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button disabled={!dirty || saving} onClick={() => void saveChanges()} type="button">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button onClick={() => void leaveEditMode()} type="button" variant="secondary">
              Leave Edit Mode
            </Button>
          </div>
        )}
      </header>

      {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Status</h2>
          <Button onClick={() => router.refresh()} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Asset ID</dt>
            <dd className="font-medium">{asset.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-medium capitalize">{asset.type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Origin</dt>
            <dd className="font-medium capitalize">{asset.origin ?? "uploaded"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Container</dt>
            <dd className="font-medium">{asset.containerId ?? "root"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Root</dt>
            <dd className="font-medium">{asset.rootId ?? asset.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Depth</dt>
            <dd className="font-medium">{asset.depth ?? 0}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{asset.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Visibility</dt>
            <dd className="font-medium capitalize">{asset.visibility}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conversion</dt>
            <dd className="font-medium capitalize">{conversionStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tone Analysis</dt>
            <dd className="font-medium capitalize">{toneAnalysisStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="font-medium">{asset.ownerEmail}</dd>
          </div>
          {asset.conversion?.profile ? (
            <div>
              <dt className="text-muted-foreground">Profile</dt>
              <dd className="font-medium">{asset.conversion.profile}</dd>
            </div>
          ) : null}
          {asset.generation ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Generation</dt>
              <dd className="font-medium">
                {asset.generation.provider} / {asset.generation.model} (
                {asset.generation.workflowId})
              </dd>
            </div>
          ) : null}
          {asset.conversion?.jobId ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">MediaConvert Job</dt>
              <dd className="font-medium">{asset.conversion.jobId}</dd>
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
          {asset.toneAnalysis?.profile ? (
            <div>
              <dt className="text-muted-foreground">Tone Profile</dt>
              <dd className="font-medium">{asset.toneAnalysis.profile}</dd>
            </div>
          ) : null}
          {asset.toneAnalysis?.updatedAt ? (
            <div>
              <dt className="text-muted-foreground">Tone Updated</dt>
              <dd className="font-medium">{asset.toneAnalysis.updatedAt}</dd>
            </div>
          ) : null}
          {asset.toneAnalysis?.analysisBucket && asset.toneAnalysis.analysisKey ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Tone Analysis Artifact</dt>
              <dd className="font-medium">
                s3://{asset.toneAnalysis.analysisBucket}/{asset.toneAnalysis.analysisKey}
              </dd>
            </div>
          ) : null}
          {asset.toneAnalysis?.bundleBucket && asset.toneAnalysis.bundleKey ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Tone Bundle Artifact</dt>
              <dd className="font-medium">
                s3://{asset.toneAnalysis.bundleBucket}/{asset.toneAnalysis.bundleKey}
              </dd>
            </div>
          ) : null}
          {asset.toneAnalysis?.errorMessage ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Tone Analysis Error</dt>
              <dd className="font-medium text-red-700 dark:text-red-300">
                {asset.toneAnalysis.errorMessage}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Original</dt>
            <dd className="font-medium">
              s3://{asset.original.bucket}/{asset.original.key}
            </dd>
          </div>
        </dl>
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
            <ToneScoreList scores={asset.toneAnalysis.scores} />
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

      {asset.type === "audio" || asset.type === "video" ? (
        <ToneReviewPanel
          description="Review the extracted keywords and adjust scores for this asset."
          targets={[
            {
              targetType: asset.type,
              targetId: asset.id,
              label: asset.type === "audio" ? "Audio" : "Video",
              taxonomyVersion: asset.toneAnalysis?.toneTaxonomyVersion,
            },
          ]}
        />
      ) : null}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Editable Metadata</h2>
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
