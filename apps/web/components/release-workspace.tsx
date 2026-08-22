"use client";

import {
  AssetDetailResponseSchema,
  MusicDeleteResponseSchema,
  MusicReadinessResponseSchema,
  MusicReleaseResponseSchema,
  MusicTrackListResponseSchema,
  MusicTrackResponseSchema,
  type AssetRecord,
  type MusicReadinessResponse,
  type MusicReleaseRecord,
  type MusicTrackRecord,
  type PurchaseLink,
} from "@media-manager/contracts";
import { ArrowDown, ArrowUp, ImagePlus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AssetPlayer } from "@/components/asset-player";
import { MusicHlsAudio } from "@/components/music-hls-audio";
import { PurchaseLinkEditor } from "@/components/purchase-link-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssetUploadError, uploadAssetFile } from "@/lib/browser-asset-upload";
import { MusicClientError, musicErrorMessage, musicRequest } from "@/lib/music-client";
import {
  canAddTrackCount,
  findTrackByAssetId,
  issuesForEntity,
  mergeAuthoritativeTracks,
  moveItem,
  remainingTrackCapacity,
  removeCatalogTrack,
  toneWarnings,
  upsertCatalogTrack,
} from "@/lib/music-ui";
import { runWithConcurrency, titleFromFileName } from "@/lib/upload-files";

type Props = {
  initialRelease: MusicReleaseRecord;
  initialTracks: MusicTrackRecord[];
  initialAssets: AssetRecord[];
  imageOptions: AssetRecord[];
  audioOptions: AssetRecord[];
  catalogTracks: MusicTrackRecord[];
  initialReadiness: MusicReadinessResponse;
};

function errorText(error: unknown): string {
  if (error instanceof MusicClientError) return musicErrorMessage(error.payload);
  return error instanceof Error ? error.message : "Request failed";
}

async function fetchAsset(id: string, signal?: AbortSignal): Promise<AssetRecord | null> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal,
    });
    if (![429, 503].includes(response.status) || attempt === 3) break;
    await new Promise((resolve) => window.setTimeout(resolve, 100 * 2 ** attempt));
    if (signal?.aborted) throw new DOMException("Asset request aborted", "AbortError");
  }
  if (!response) return null;
  if (!response.ok) return null;
  const parsed = AssetDetailResponseSchema.safeParse((await response.json()) as unknown);
  return parsed.success ? parsed.data.asset : null;
}

async function fetchLinkedAssets(ids: string[], signal?: AbortSignal): Promise<AssetRecord[]> {
  const results = await runWithConcurrency(ids, 3, (id) => fetchAsset(id, signal));
  return results.flatMap((result) => (result.ok && result.value ? [result.value] : []));
}

type TrackRecovery = {
  key: string;
  file: File;
  message: string;
  status?: number;
  asset?: AssetRecord;
  track?: MusicTrackRecord;
};

class TrackCreationError extends MusicClientError {
  constructor(
    readonly asset: AssetRecord,
    cause: unknown
  ) {
    super(
      cause instanceof MusicClientError ? cause.status : 0,
      cause instanceof MusicClientError
        ? cause.payload
        : { message: cause instanceof Error ? cause.message : "Track creation failed" }
    );
  }
}

export function ReleaseWorkspace({
  initialRelease,
  initialTracks,
  initialAssets,
  imageOptions,
  audioOptions,
  catalogTracks,
  initialReadiness,
}: Props) {
  const router = useRouter();
  const audioInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const coverAltInput = useRef<HTMLInputElement>(null);
  const mutationLock = useRef(false);
  const mounted = useRef(true);
  const [release, setRelease] = useState(initialRelease);
  const [tracks, setTracks] = useState(initialTracks);
  const [assets, setAssets] = useState(initialAssets);
  const [catalog, setCatalog] = useState(catalogTracks);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [title, setTitle] = useState(initialRelease.title);
  const [releaseDate, setReleaseDate] = useState(initialRelease.releaseDate ?? "");
  const [type, setType] = useState(initialRelease.type ?? "");
  const [coverAlt, setCoverAlt] = useState(initialRelease.coverAlt ?? "");
  const [description, setDescription] = useState(initialRelease.description ?? "");
  const [purchaseLinks, setPurchaseLinks] = useState<PurchaseLink[]>(initialRelease.purchaseLinks);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedAudio, setSelectedAudio] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [trackRecoveries, setTrackRecoveries] = useState<TrackRecovery[]>([]);
  const [coverRecovery, setCoverRecovery] = useState<AssetRecord | null>(null);
  const [coverAltNeedsEntry, setCoverAltNeedsEntry] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [dirtyTrackIds, setDirtyTrackIds] = useState<Set<string>>(() => new Set());
  const editable = release.publicationStatus === "draft";
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const cover = release.coverAssetId ? assetById.get(release.coverAssetId) : undefined;
  const warnings = toneWarnings(assets);
  const remainingTracks = remainingTrackCapacity(tracks.length);
  const isBusy = busy !== null;
  const releaseFormDirty =
    title.trim() !== release.title ||
    releaseDate !== (release.releaseDate ?? "") ||
    type !== (release.type ?? "") ||
    coverAlt.trim() !== (release.coverAlt ?? "") ||
    description.trim() !== (release.description ?? "") ||
    JSON.stringify(purchaseLinks) !== JSON.stringify(release.purchaseLinks);
  const hasDirtyTracks = dirtyTrackIds.size > 0;

  function setTrackDirty(id: string, dirty: boolean) {
    setDirtyTrackIds((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function resetForm(nextRelease: MusicReleaseRecord) {
    setTitle(nextRelease.title);
    setReleaseDate(nextRelease.releaseDate ?? "");
    setType(nextRelease.type ?? "");
    setCoverAlt(nextRelease.coverAlt ?? "");
    setDescription(nextRelease.description ?? "");
    setPurchaseLinks(nextRelease.purchaseLinks);
    setCoverAltNeedsEntry(Boolean(nextRelease.coverAssetId && !nextRelease.coverAlt));
  }

  async function refreshCatalogPreservingDrafts(localTracks = tracks) {
    const trackResult = await musicRequest("tracks", MusicTrackListResponseSchema);
    const merged = mergeAuthoritativeTracks(localTracks, trackResult.tracks, dirtyTrackIds);
    if (mounted.current) {
      setCatalog(trackResult.tracks);
      setTracks(merged);
    }
    return { catalog: trackResult.tracks, tracks: merged };
  }

  async function loadAuthoritative(resetEditableFields: boolean) {
    const [releaseResult, trackResult, readinessResult] = await Promise.all([
      musicRequest(`releases/${release.id}`, MusicReleaseResponseSchema),
      musicRequest("tracks", MusicTrackListResponseSchema),
      musicRequest(`releases/${release.id}/readiness`, MusicReadinessResponseSchema),
    ]);
    const trackById = new Map(trackResult.tracks.map((track) => [track.id, track]));
    const nextTracks = releaseResult.release.trackIds.flatMap((id) => {
      const track = trackById.get(id);
      return track ? [track] : [];
    });
    const linkedIds = [
      ...(releaseResult.release.coverAssetId ? [releaseResult.release.coverAssetId] : []),
      ...nextTracks.map((track) => track.assetId),
    ];
    const nextAssets = await fetchLinkedAssets(linkedIds);
    if (!mounted.current) return;
    setRelease(releaseResult.release);
    setCatalog(trackResult.tracks);
    setTracks(
      resetEditableFields ? nextTracks : mergeAuthoritativeTracks(tracks, nextTracks, dirtyTrackIds)
    );
    setReadiness(readinessResult);
    setAssets(nextAssets);
    if (resetEditableFields) {
      resetForm(releaseResult.release);
      setDirtyTrackIds(new Set());
    }
  }

  async function reloadAfterConflict() {
    if (
      (releaseFormDirty || hasDirtyTracks) &&
      !window.confirm("Reloading will discard your unsaved release and track edits. Continue?")
    ) {
      return;
    }
    if (!beginMutation("reload")) return;
    try {
      await loadAuthoritative(true);
      setConflict(null);
      setError(null);
      setNotice("Latest release data loaded.");
    } catch (caught) {
      setError(`Could not reload the latest release: ${errorText(caught)}`);
    } finally {
      finishMutation();
    }
  }

  function beginMutation(label: string): boolean {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(label);
    setError(null);
    setReadiness((current) => ({ ...current, ready: false }));
    return true;
  }

  function finishMutation() {
    mutationLock.current = false;
    if (mounted.current) setBusy(null);
  }

  async function handleMutationError(caught: unknown, recoveryMessage?: string) {
    if (caught instanceof MusicClientError && caught.status === 409) {
      try {
        await refreshCatalogPreservingDrafts();
      } catch {
        // The explicit reload action remains available if catalog refresh also fails.
      }
      setConflict(errorText(caught));
      setError("A newer catalog revision exists. Your unsaved edits were preserved.");
      return;
    }
    setError(recoveryMessage ?? errorText(caught));
  }

  async function refreshChecks() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy("refresh");
    setError(null);
    setNotice(null);
    try {
      const readinessResult = await musicRequest(
        `releases/${release.id}/readiness`,
        MusicReadinessResponseSchema
      );
      const linkedIds = [
        ...(release.coverAssetId ? [release.coverAssetId] : []),
        ...tracks.map((track) => track.assetId),
      ];
      const nextAssets = await fetchLinkedAssets(linkedIds);
      if (mounted.current) {
        setReadiness(readinessResult);
        setAssets(nextAssets);
        setNotice("Release status refreshed.");
      }
    } catch (caught) {
      setError(`Could not refresh release status: ${errorText(caught)}`);
    } finally {
      finishMutation();
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function saveRelease() {
    if (!beginMutation("release")) return;
    setNotice(null);
    try {
      const result = await musicRequest(`releases/${release.id}`, MusicReleaseResponseSchema, {
        method: "PATCH",
        body: JSON.stringify({
          schemaVersion: "music-release-update/v1",
          expectedRevision: release.revision,
          title: title.trim(),
          releaseDate: releaseDate || null,
          type: type || null,
          coverAlt: coverAlt.trim() || null,
          description: description.trim() || null,
          purchaseLinks,
        }),
      });
      setRelease(result.release);
      setCoverAltNeedsEntry(Boolean(result.release.coverAssetId && !result.release.coverAlt));
      setNotice("Release saved.");
      router.refresh();
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
    }
  }

  async function patchTrackIds(nextTracks: MusicTrackRecord[]) {
    const result = await musicRequest(`releases/${release.id}`, MusicReleaseResponseSchema, {
      method: "PATCH",
      body: JSON.stringify({
        schemaVersion: "music-release-update/v1",
        expectedRevision: release.revision,
        trackIds: nextTracks.map((track) => track.id),
      }),
    });
    setRelease(result.release);
    setTracks(nextTracks);
    try {
      await refreshCatalogPreservingDrafts(nextTracks);
    } catch {
      setNotice("Track order saved, but current track revisions could not be refreshed.");
    }
    router.refresh();
  }

  async function moveTrack(index: number, direction: -1 | 1) {
    if (!beginMutation("order")) return;
    try {
      await patchTrackIds(moveItem(tracks, index, direction));
      setNotice("Track order saved.");
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
    }
  }

  async function saveTrack(track: MusicTrackRecord) {
    if (!beginMutation(track.id)) return;
    try {
      const result = await musicRequest(`tracks/${track.id}`, MusicTrackResponseSchema, {
        method: "PATCH",
        body: JSON.stringify({
          schemaVersion: "music-track-update/v1",
          expectedRevision: track.revision,
          title: track.title.trim(),
          purchaseLinks: track.purchaseLinks,
        }),
      });
      setTracks((current) => current.map((item) => (item.id === track.id ? result.track : item)));
      setCatalog((current) => upsertCatalogTrack(current, result.track));
      setDirtyTrackIds((current) => {
        const next = new Set(current);
        next.delete(track.id);
        return next;
      });
      setNotice(`${result.track.title} saved.`);
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
    }
  }

  async function uploadCover(file: File) {
    if (!beginMutation("cover")) return;
    let uploadedAsset: AssetRecord | null = null;
    try {
      const asset = await uploadAssetFile(file, "image", coverRecovery ?? undefined, "unlisted");
      uploadedAsset = asset;
      const result = await musicRequest(`releases/${release.id}`, MusicReleaseResponseSchema, {
        method: "PATCH",
        body: JSON.stringify({
          schemaVersion: "music-release-update/v1",
          expectedRevision: release.revision,
          coverAssetId: asset.id,
          coverAlt: null,
        }),
      });
      setRelease(result.release);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setCoverRecovery(null);
      setCoverAlt("");
      setCoverAltNeedsEntry(true);
      window.setTimeout(() => coverAltInput.current?.focus(), 0);
      setNotice("Cover uploaded and linked. Enter new alt text before publishing.");
      router.refresh();
    } catch (caught) {
      const recoverableAsset = caught instanceof AssetUploadError ? caught.asset : uploadedAsset;
      if (recoverableAsset) setCoverRecovery(recoverableAsset);
      await handleMutationError(
        caught,
        recoverableAsset
          ? `${errorText(caught)} Asset ${recoverableAsset.id} was preserved for retry.`
          : undefined
      );
    } finally {
      finishMutation();
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function linkExistingCover() {
    if (!selectedImage) return;
    if (!beginMutation("cover")) return;
    try {
      const result = await musicRequest(`releases/${release.id}`, MusicReleaseResponseSchema, {
        method: "PATCH",
        body: JSON.stringify({
          schemaVersion: "music-release-update/v1",
          expectedRevision: release.revision,
          coverAssetId: selectedImage,
          coverAlt: null,
        }),
      });
      setRelease(result.release);
      const asset = imageOptions.find((item) => item.id === selectedImage);
      if (asset) setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setSelectedImage("");
      setCoverAlt("");
      setCoverAltNeedsEntry(true);
      window.setTimeout(() => coverAltInput.current?.focus(), 0);
      setNotice("Existing cover linked. Enter new alt text before publishing.");
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
    }
  }

  async function createTrackForAsset(asset: AssetRecord, fallbackTitle = asset.title) {
    const existing =
      catalog.find((track) => track.assetId === asset.id) ??
      tracks.find((track) => track.assetId === asset.id);
    if (existing) return existing;
    try {
      const track = (
        await musicRequest("tracks", MusicTrackResponseSchema, {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: "music-track-create/v1",
            title: fallbackTitle,
            assetId: asset.id,
            purchaseLinks: [],
          }),
        })
      ).track;
      setCatalog((current) => upsertCatalogTrack(current, track));
      return track;
    } catch (caught) {
      try {
        const refreshed = await musicRequest("tracks", MusicTrackListResponseSchema);
        setCatalog(refreshed.tracks);
        const reconciled = findTrackByAssetId(refreshed.tracks, asset.id);
        if (reconciled) return reconciled;
      } catch {
        // Preserve the original create status when reconciliation is unavailable.
      }
      throw new TrackCreationError(asset, caught);
    }
  }

  async function uploadTracks(files: File[]) {
    if (!files.length) return;
    if (!canAddTrackCount(tracks.length, files.length)) {
      setError(
        `This release has room for ${remainingTracks} more ${remainingTracks === 1 ? "track" : "tracks"}. No files were uploaded.`
      );
      if (audioInput.current) audioInput.current.value = "";
      return;
    }
    if (!beginMutation("tracks")) return;
    setNotice(null);
    try {
      const results = await runWithConcurrency(files, 2, async (file) => {
        const asset = await uploadAssetFile(file, "audio", undefined, "unlisted");
        const track = await createTrackForAsset(asset, titleFromFileName(file.name));
        return { file, asset, track };
      });
      const successes = results.flatMap((result) => (result.ok ? [result.value] : []));
      const recoveries = results.flatMap((result, index): TrackRecovery[] => {
        if (result.ok) return [];
        const caught = result.error;
        return [
          {
            key: `${files[index]!.name}-${files[index]!.size}-${Date.now()}-${index}`,
            file: files[index]!,
            message: errorText(caught),
            status: caught instanceof MusicClientError ? caught.status : undefined,
            asset:
              caught instanceof AssetUploadError || caught instanceof TrackCreationError
                ? caught.asset
                : undefined,
          },
        ];
      });
      setTrackRecoveries((current) => [...current, ...recoveries]);
      if (successes.length) {
        const existingIds = new Set(tracks.map((track) => track.id));
        const nextTracks = [
          ...tracks,
          ...successes.map(({ track }) => track).filter((track) => !existingIds.has(track.id)),
        ];
        try {
          await patchTrackIds(nextTracks);
        } catch (caught) {
          setTrackRecoveries((current) => [
            ...current,
            ...successes.map(({ file, asset, track }, index) => ({
              key: `${asset.id}-${Date.now()}-${index}`,
              file,
              asset,
              track,
              message: "Track was created but could not be linked to this release.",
            })),
          ]);
          throw caught;
        }
        setAssets((current) => [
          ...current,
          ...successes
            .map(({ asset }) => asset)
            .filter((asset) => !current.some((item) => item.id === asset.id)),
        ]);
      }
      const failed = results.length - successes.length;
      if (failed) setError(`${successes.length} tracks added; ${failed} need attention below.`);
      else
        setNotice(
          `${successes.length} ${successes.length === 1 ? "track" : "tracks"} uploaded in selected order.`
        );
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
      if (audioInput.current) audioInput.current.value = "";
    }
  }

  async function retryTrackRecovery(recovery: TrackRecovery) {
    if (!canAddTrackCount(tracks.length, 1)) {
      setError("This release already has the maximum of 20 tracks.");
      return;
    }
    if (!beginMutation("track-recovery")) return;
    let asset = recovery.asset;
    let track = recovery.track;
    try {
      if (!track) {
        asset = await uploadAssetFile(recovery.file, "audio", asset, "unlisted");
        track = await createTrackForAsset(asset, titleFromFileName(recovery.file.name));
      }
      await patchTrackIds([...tracks, track]);
      setAssets((current) => [asset!, ...current.filter((item) => item.id !== asset!.id)]);
      setTrackRecoveries((current) => current.filter((item) => item.key !== recovery.key));
      setNotice(`${track.title} recovered and linked without creating another asset.`);
    } catch (caught) {
      if (caught instanceof AssetUploadError) asset = caught.asset;
      if (caught instanceof TrackCreationError) asset = caught.asset;
      setTrackRecoveries((current) =>
        current.map((item) =>
          item.key === recovery.key
            ? {
                ...item,
                asset,
                track,
                message: errorText(caught),
                status: caught instanceof MusicClientError ? caught.status : item.status,
              }
            : item
        )
      );
      if (caught instanceof TrackCreationError) {
        setError(`${caught.status ? `HTTP ${caught.status}: ` : ""}${caught.message}`);
      } else {
        await handleMutationError(caught);
      }
    } finally {
      finishMutation();
    }
  }

  async function addExistingAudio() {
    const asset = audioOptions.find((item) => item.id === selectedAudio);
    if (!asset) return;
    if (!canAddTrackCount(tracks.length, 1)) {
      setError("This release already has the maximum of 20 tracks.");
      return;
    }
    if (!beginMutation("tracks")) return;
    try {
      const track = await createTrackForAsset(asset);
      if (tracks.some((item) => item.id === track.id))
        throw new Error("That audio is already in this release.");
      await patchTrackIds([...tracks, track]);
      setAssets((current) => [...current, asset]);
      setSelectedAudio("");
      setNotice(`${track.title} added.`);
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
    }
  }

  async function removeTrack(track: MusicTrackRecord) {
    if (!beginMutation(track.id)) return;
    try {
      const remaining = tracks.filter((item) => item.id !== track.id);
      await patchTrackIds(remaining);
      setDirtyTrackIds((current) => {
        const next = new Set(current);
        next.delete(track.id);
        return next;
      });
      if (track.publicationStatus === "draft") {
        await musicRequest(`tracks/${track.id}`, MusicDeleteResponseSchema, {
          method: "DELETE",
          body: JSON.stringify({
            schemaVersion: "music-publication-action/v1",
            expectedRevision: track.revision,
          }),
        });
        setCatalog((current) => removeCatalogTrack(current, track.id));
        setNotice(
          `${track.title} removed and its draft music record deleted. The asset remains in Library.`
        );
      } else {
        setNotice(`${track.title} removed. Its published track record and asset remain available.`);
      }
    } catch (caught) {
      await handleMutationError(caught);
    } finally {
      finishMutation();
    }
  }

  async function publicationAction(action: "publish" | "unpublish") {
    if (!beginMutation(action)) return;
    try {
      const result = await musicRequest(
        `releases/${release.id}/${action}`,
        MusicReleaseResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: "music-publication-action/v1",
            expectedRevision: release.revision,
          }),
        }
      );
      setRelease(result.release);
      setPublishOpen(false);
      setNotice(action === "publish" ? "Release published." : "Release returned to draft.");
      await loadAuthoritative(false);
      router.refresh();
    } catch (caught) {
      await handleMutationError(caught);
      setPublishOpen(false);
    } finally {
      finishMutation();
    }
  }

  async function deleteRelease() {
    if (!window.confirm("Delete this draft release? Tracks and assets will remain.")) return;
    if (!beginMutation("delete")) return;
    try {
      await musicRequest(`releases/${release.id}`, MusicDeleteResponseSchema, {
        method: "DELETE",
        body: JSON.stringify({
          schemaVersion: "music-publication-action/v1",
          expectedRevision: release.revision,
        }),
      });
      router.push("/releases");
      router.refresh();
    } catch (caught) {
      await handleMutationError(caught);
      finishMutation();
    }
  }

  const filteredAudio = audioOptions.filter((asset) =>
    asset.title.toLowerCase().includes(assetSearch.trim().toLowerCase())
  );

  return (
    <section className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant={release.publicationStatus === "published" ? "default" : "secondary"}>
            {release.publicationStatus}
          </Badge>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{release.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="Refresh release status"
            className="h-9 w-9 p-0"
            disabled={isBusy}
            onClick={() => void refreshChecks()}
            title="Refresh release status"
            variant="outline"
          >
            <RefreshCw className={busy === "refresh" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          {release.publicationStatus === "published" ? (
            <Button
              disabled={isBusy}
              onClick={() => void publicationAction("unpublish")}
              variant="outline"
            >
              Unpublish
            </Button>
          ) : (
            <Dialog onOpenChange={setPublishOpen} open={publishOpen}>
              <DialogTrigger asChild>
                <Button disabled={!readiness.ready || isBusy}>Publish</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish {release.title}?</DialogTitle>
                  <DialogDescription>
                    This publishes the release and every linked track, and makes the cover and audio
                    assets public.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setPublishOpen(false)} variant="outline">
                    Cancel
                  </Button>
                  <Button disabled={isBusy} onClick={() => void publicationAction("publish")}>
                    Publish release
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {editable ? (
            <Button disabled={isBusy} onClick={() => void deleteRelease()} variant="destructive">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          aria-live="assertive"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {conflict ? (
        <div
          aria-live="assertive"
          className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div>
            <p className="font-medium">{conflict}</p>
            <p className="mt-1 text-xs">
              Local release and track edits remain unchanged. Reload only when you are ready to
              replace them.
            </p>
          </div>
          <Button
            disabled={isBusy}
            onClick={() => void reloadAfterConflict()}
            size="sm"
            variant="outline"
          >
            Reload latest
          </Button>
        </div>
      ) : null}
      {notice ? (
        <div
          aria-live="polite"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <div className="space-y-6">
          <article className="space-y-5 rounded-xl border bg-card p-5">
            <div className="flex justify-end">
              <Button disabled={!editable || isBusy} onClick={() => void saveRelease()} size="sm">
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Title
              <Input
                disabled={!editable || isBusy}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Release date
                <Input
                  disabled={!editable || isBusy}
                  onChange={(event) => setReleaseDate(event.target.value)}
                  type="date"
                  value={releaseDate}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Type
                <select
                  className="h-9 rounded-md border px-3 text-sm"
                  disabled={!editable || isBusy}
                  onChange={(event) => setType(event.target.value)}
                  value={type}
                >
                  <option value="">Not set</option>
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Cover alt text
              <Input
                aria-invalid={coverAltNeedsEntry}
                disabled={!editable || isBusy}
                maxLength={300}
                onChange={(event) => {
                  setCoverAlt(event.target.value);
                  setCoverAltNeedsEntry(!event.target.value.trim());
                }}
                ref={coverAltInput}
                value={coverAlt}
              />
              {coverAltNeedsEntry ? (
                <span className="text-xs text-amber-400">
                  Describe the new cover before publishing.
                </span>
              ) : null}
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Description
              <Textarea
                disabled={!editable || isBusy}
                maxLength={5000}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                value={description}
              />
            </label>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Release purchase links</h3>
              <PurchaseLinkEditor
                disabled={!editable || isBusy}
                links={purchaseLinks}
                onChange={setPurchaseLinks}
              />
            </div>
          </article>

          <article className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Tracks</h2>
            {editable ? (
              <div className="grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-2">
                <div>
                  <input
                    aria-label="Choose audio files to upload"
                    accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.opus,.aiff"
                    className="sr-only"
                    multiple
                    onChange={(event) => void uploadTracks(Array.from(event.target.files ?? []))}
                    ref={audioInput}
                    type="file"
                  />
                  <Button
                    aria-label="Upload audio files"
                    disabled={isBusy || remainingTracks === 0}
                    onClick={() => audioInput.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4" /> Upload audio files
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Files upload two at a time; track records retain file-selection order.
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    aria-label="Search owned audio assets"
                    disabled={isBusy || remainingTracks === 0}
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder="Search owned audio"
                    value={assetSearch}
                  />
                  <div className="flex gap-2">
                    <select
                      aria-label="Select an existing owned audio asset"
                      className="h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
                      disabled={isBusy || remainingTracks === 0}
                      onChange={(event) => setSelectedAudio(event.target.value)}
                      value={selectedAudio}
                    >
                      <option value="">Select audio asset</option>
                      {filteredAudio.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.title} · {asset.status}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={!selectedAudio || isBusy || remainingTracks === 0}
                      onClick={() => void addExistingAudio()}
                      size="sm"
                      type="button"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {trackRecoveries.length ? (
              <div
                aria-live="polite"
                className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
              >
                <h3 className="text-sm font-medium text-amber-200">Uploads needing attention</h3>
                {trackRecoveries.map((recovery) => (
                  <div
                    className="flex flex-col gap-2 rounded-md bg-background/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    key={recovery.key}
                  >
                    <div>
                      <p className="font-medium">{recovery.file.name}</p>
                      <p className="text-xs text-amber-300">
                        {recovery.status ? `HTTP ${recovery.status}: ` : ""}
                        {recovery.message}
                      </p>
                      {recovery.asset ? (
                        <Link
                          className="text-xs text-primary underline"
                          href={`/asset/${encodeURIComponent(recovery.asset.id)}`}
                        >
                          Open preserved asset {recovery.asset.id}
                        </Link>
                      ) : null}
                    </div>
                    <Button
                      disabled={isBusy || remainingTracks === 0}
                      onClick={() => void retryTrackRecovery(recovery)}
                      size="sm"
                      variant="outline"
                    >
                      Retry safely
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {tracks.length === 0 ? (
              <p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                No tracks linked yet.
              </p>
            ) : null}
            <ol className="space-y-3">
              {tracks.map((track, index) => {
                const asset = assetById.get(track.assetId);
                const trackIssues = issuesForEntity(readiness.issues, track.id, track.assetId);
                const trackEditable = editable && track.publicationStatus === "draft";
                return (
                  <li className="rounded-lg border bg-background/40 p-4" key={track.id}>
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            aria-label={`Track ${index + 1} title`}
                            disabled={!trackEditable || isBusy}
                            onChange={(event) => {
                              const baseline = catalog.find((item) => item.id === track.id);
                              setTrackDirty(
                                track.id,
                                Boolean(
                                  baseline &&
                                  (event.target.value !== baseline.title ||
                                    JSON.stringify(track.purchaseLinks) !==
                                      JSON.stringify(baseline.purchaseLinks))
                                )
                              );
                              setTracks((current) =>
                                current.map((item) =>
                                  item.id === track.id
                                    ? { ...item, title: event.target.value }
                                    : item
                                )
                              );
                            }}
                            value={track.title}
                          />
                          <div className="flex shrink-0 gap-1">
                            <Button
                              aria-label={`Move ${track.title} up`}
                              disabled={!editable || index === 0 || isBusy}
                              onClick={() => void moveTrack(index, -1)}
                              size="sm"
                              variant="ghost"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={`Move ${track.title} down`}
                              disabled={!editable || index === tracks.length - 1 || isBusy}
                              onClick={() => void moveTrack(index, 1)}
                              size="sm"
                              variant="ghost"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              disabled={!trackEditable || isBusy}
                              onClick={() => void saveTrack(track)}
                              size="sm"
                              variant="outline"
                            >
                              Save
                            </Button>
                            <Button
                              aria-label={`Remove ${track.title}`}
                              disabled={!editable || isBusy}
                              onClick={() => void removeTrack(track)}
                              size="sm"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <PurchaseLinkEditor
                          disabled={!trackEditable || isBusy}
                          links={track.purchaseLinks}
                          onChange={(links) => {
                            const baseline = catalog.find((item) => item.id === track.id);
                            setTrackDirty(
                              track.id,
                              Boolean(
                                baseline &&
                                (track.title !== baseline.title ||
                                  JSON.stringify(links) !== JSON.stringify(baseline.purchaseLinks))
                              )
                            );
                            setTracks((current) =>
                              current.map((item) =>
                                item.id === track.id ? { ...item, purchaseLinks: links } : item
                              )
                            );
                          }}
                        />
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="secondary">Asset {asset?.status ?? "missing"}</Badge>
                          <Badge variant="secondary">
                            Tone{" "}
                            {asset?.toneAnalysis?.status?.replaceAll("_", " ") ?? "not started"}
                          </Badge>
                          {track.publicationStatus === "published" ? (
                            <Badge>published track</Badge>
                          ) : null}
                        </div>
                        {asset?.status === "ready" && asset.stream?.hlsMasterUrl ? (
                          <MusicHlsAudio title={track.title} url={asset.stream.hlsMasterUrl} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            HLS preview will appear when this asset is ready.
                          </p>
                        )}
                        {trackIssues.map((issue) => (
                          <p
                            className="text-xs text-amber-400"
                            key={`${issue.code}-${issue.entityId}`}
                          >
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        </div>

        <aside className="space-y-6">
          <article className="space-y-4 rounded-xl border bg-card p-5">
            {cover ? (
              <AssetPlayer asset={cover} />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed bg-muted/30">
                <ImagePlus className="h-9 w-9 text-muted-foreground" />
              </div>
            )}
            {editable ? (
              <>
                <input
                  aria-label="Choose a cover image to upload"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.gif"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                  ref={coverInput}
                  type="file"
                />
                <Button
                  aria-label={
                    coverRecovery
                      ? "Retry cover upload using the preserved asset"
                      : "Upload cover image"
                  }
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => coverInput.current?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4" />{" "}
                  {coverRecovery ? "Retry cover upload" : "Upload cover"}
                </Button>
                {coverRecovery ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Reselect the same file to retry safely, or{" "}
                    <Link
                      className="text-primary underline"
                      href={`/asset/${encodeURIComponent(coverRecovery.id)}`}
                    >
                      open preserved asset {coverRecovery.id}
                    </Link>
                    .
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <select
                    aria-label="Select an existing owned cover image"
                    className="h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
                    disabled={isBusy}
                    onChange={(event) => setSelectedImage(event.target.value)}
                    value={selectedImage}
                  >
                    <option value="">Existing image</option>
                    {imageOptions.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.title} · {asset.status}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!selectedImage || isBusy}
                    onClick={() => void linkExistingCover()}
                    size="sm"
                  >
                    Use
                  </Button>
                </div>
              </>
            ) : null}
          </article>

          <article className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Readiness</h2>
              <span
                className={
                  readiness.ready
                    ? "text-sm font-medium text-emerald-400"
                    : "text-sm font-medium text-amber-400"
                }
              >
                {readiness.ready ? "Ready" : "Blocked"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Refreshes while this tab is active.</p>
            {readiness.issues.length ? (
              <ul className="space-y-2">
                {readiness.issues.map((issue) => (
                  <li
                    className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
                    key={`${issue.code}-${issue.entityId}`}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                All publishing requirements are met.
              </p>
            )}
            {warnings.map((warning) => (
              <p
                className="rounded-md border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300"
                key={warning}
              >
                {warning}
              </p>
            ))}
          </article>
        </aside>
      </div>
    </section>
  );
}
