"use client";

import {
  AssetDetailResponseSchema,
  ASSET_TAG_FACETS,
  ASSET_TAG_WEIGHTS,
  type AssetDetailResponse,
  type AssetTag,
  type UpdateAssetInput,
} from "@media-manager/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetPlayer } from "@/components/asset-player";
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

type Props = {
  initialAsset: Asset;
};

function tagsEqual(a: AssetTag[], b: AssetTag[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function shouldPollAsset(asset: Asset) {
  const conversionStatus = asset.conversion?.status;
  return (
    asset.status === "processing" ||
    conversionStatus === "queued" ||
    conversionStatus === "processing"
  );
}

export function AssetDetailEditor({ initialAsset }: Props) {
  const router = useRouter();
  const [asset, setAsset] = useState<Asset>(initialAsset);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(initialAsset.title);
  const [description, setDescription] = useState(initialAsset.description);
  const [tags, setTags] = useState<AssetTag[]>(initialAsset.tags);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = useMemo(() => {
    return (
      title !== asset.title || description !== asset.description || !tagsEqual(tags, asset.tags)
    );
  }, [asset.description, asset.tags, asset.title, description, tags, title]);

  const streamReady = asset.status === "ready" && asset.stream?.hlsMasterUrl;
  const conversionStatus = asset.conversion?.status ?? "not_started";

  async function saveChanges() {
    if (!dirty || saving) {
      return true;
    }

    setSaving(true);
    setStatusMessage(null);

    const payload: UpdateAssetInput = {
      title: title.trim(),
      description: description.trim(),
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
        const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
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
  }, [asset, dirty, editMode, saving]);

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
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{asset.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conversion</dt>
            <dd className="font-medium capitalize">{conversionStatus.replaceAll("_", " ")}</dd>
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
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Original</dt>
            <dd className="font-medium">
              s3://{asset.original.bucket}/{asset.original.key}
            </dd>
          </div>
        </dl>
      </div>

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

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Tags</h3>
              {editMode ? (
                <Button
                  onClick={() =>
                    setTags((previous) => [
                      ...previous,
                      { value: "", source: "user", weight: "moderate" },
                    ])
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Add Tag
                </Button>
              ) : null}
            </div>

            {editMode ? (
              <div className="space-y-3 rounded-lg border bg-background p-4">
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
    </section>
  );
}
