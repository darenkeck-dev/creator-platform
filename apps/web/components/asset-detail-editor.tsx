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
  children?: Asset[];
  sourceAssets?: Asset[];
};

type FolderOption = {
  id: string;
  title: string;
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

export function AssetDetailEditor({ initialAsset, children = [], sourceAssets = [] }: Props) {
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
  const [containerIdDraft, setContainerIdDraft] = useState(initialAsset.containerId ?? "");
  const [folders, setFolders] = useState<FolderOption[]>([]);

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
  const conversionStatus = asset.conversion?.status ?? "not_started";
  const containerFolder = folders.find((folder) => folder.id === asset.containerId) ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadFolders = async () => {
      try {
        const response = await fetch("/api/assets?type=folder&sort=newest", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as { assets?: Array<{ id: string; title: string }> };
        if (cancelled || !Array.isArray(json.assets)) {
          return;
        }

        setFolders(
          json.assets
            .filter((entry) => typeof entry.id === "string" && typeof entry.title === "string")
            .map((entry) => ({ id: entry.id, title: entry.title }))
        );
      } catch {
        // best effort only
      }
    };

    void loadFolders();

    return () => {
      cancelled = true;
    };
  }, []);

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
      setContainerIdDraft(data.asset.containerId ?? "");
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

  async function moveAsset(nextContainerIdOverride?: string) {
    const nextContainerId = (nextContainerIdOverride ?? containerIdDraft).trim();

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/move`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          containerId: nextContainerId.length > 0 ? nextContainerId : null,
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
      setContainerIdDraft(data.asset.containerId ?? "");
      setStatusMessage("Asset location updated.");
      router.refresh();
    } catch {
      setStatusMessage("Could not move asset. Check the container ID and try again.");
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
        setContainerIdDraft(latest.containerId ?? "");
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
            <dt className="text-muted-foreground">Origin</dt>
            <dd className="font-medium capitalize">{asset.origin ?? "uploaded"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Container</dt>
            <dd className="font-medium">
              {asset.containerId ? (
                <span>
                  {containerFolder?.title ?? "Unknown folder"}{" "}
                  <span className="text-xs text-muted-foreground/70">{asset.containerId}</span>
                </span>
              ) : (
                "root"
              )}
            </dd>
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
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Original</dt>
            <dd className="font-medium">
              s3://{asset.original.bucket}/{asset.original.key}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Nested Location</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Move this asset under a folder. Folder IDs are shown as secondary text.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Select
            onValueChange={(value) => setContainerIdDraft(value === "__root__" ? "" : value)}
            value={containerIdDraft || "__root__"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Root</SelectItem>
              {folders
                .filter((folder) => folder.id !== asset.id)
                .map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <span>{folder.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground/70">{folder.id}</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void moveAsset()} type="button" variant="outline">
            Update Location
          </Button>
        </div>
        <div className="mt-3">
          <Button
            onClick={() => {
              setContainerIdDraft("");
              void moveAsset("");
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Move to Root
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Lineage Context</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Source Assets</p>
            <div className="mt-2 space-y-2 text-sm">
              {sourceAssets.length === 0 ? (
                <p className="text-muted-foreground">No linked source assets.</p>
              ) : (
                sourceAssets.map((source) => (
                  <button
                    className="block text-left underline"
                    key={`source-${source.id}`}
                    onClick={() => router.push(`/asset/${source.id}`)}
                    type="button"
                  >
                    {source.title} ({source.id})
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Child Assets</p>
            <div className="mt-2 space-y-2 text-sm">
              {children.length === 0 ? (
                <p className="text-muted-foreground">No child assets.</p>
              ) : (
                children.map((child) => (
                  <button
                    className="block text-left underline"
                    key={`child-${child.id}`}
                    onClick={() => router.push(`/asset/${child.id}`)}
                    type="button"
                  >
                    {child.title} ({child.id})
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
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
