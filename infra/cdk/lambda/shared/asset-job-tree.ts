import { QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  AssetRecordSchema,
  type AssetRecord,
  type JobAssetSummary,
  type JobPreview,
  type JobPreviewSummary,
  type JobOptions,
  type JobTarget,
  type JobType,
} from "@media-manager/contracts";
import { createHash } from "node:crypto";
import { safeReadAssetRecordWithUpgrade } from "./asset-record-versioning";

const MAX_PREVIEW_ITEMS = 1000;

export function toContainerIndexPk(containerId?: string): string {
  return `CONTAINER#${containerId ?? "ROOT"}`;
}

export async function safeReadAsset(
  db: DynamoDBDocumentClient,
  tableName: string,
  item: Record<string, unknown>
): Promise<AssetRecord | null> {
  const upgraded = await safeReadAssetRecordWithUpgrade({ db, tableName, item });
  const parsed = AssetRecordSchema.safeParse(upgraded ?? item);
  return parsed.success ? parsed.data : null;
}

export async function fetchChildren(
  db: DynamoDBDocumentClient,
  tableName: string,
  containerIndex: string,
  ownerEmail: string,
  parentId: string
): Promise<AssetRecord[]> {
  const children: AssetRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: containerIndex,
        KeyConditionExpression: "gsi2pk = :containerPk",
        FilterExpression: "ownerEmail = :ownerEmail",
        ExpressionAttributeValues: {
          ":containerPk": toContainerIndexPk(parentId),
          ":ownerEmail": ownerEmail,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of page.Items ?? []) {
      const asset = await safeReadAsset(db, tableName, item);
      if (asset && asset.containerId === parentId && asset.ownerEmail === ownerEmail) {
        children.push(asset);
      }
    }

    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return children;
}

function pathFor(parentPath: string | undefined, title: string): string {
  return parentPath ? `${parentPath} / ${title}` : `Library / ${title}`;
}

function summarize(items: JobAssetSummary[]): JobPreviewSummary {
  const skipped = items.filter((item) => item.actionStatus === "skipped").length;
  return {
    totalItems: items.length,
    folders: items.filter((item) => item.type === "folder").length,
    audio: items.filter((item) => item.type === "audio").length,
    video: items.filter((item) => item.type === "video").length,
    images: items.filter((item) => item.type === "image").length,
    skipped,
    processableItems: items.length - skipped,
    skippedItems: skipped,
  };
}

export function toJobAssetSummary(asset: AssetRecord, path: string): JobAssetSummary {
  return {
    id: asset.id,
    title: asset.title,
    type: asset.type,
    containerId: asset.containerId,
    path,
    actionStatus: "processable",
  };
}

function processabilityFor(
  type: JobType,
  asset: JobAssetSummary,
  options: JobOptions
): Pick<JobAssetSummary, "actionStatus" | "skipReason"> {
  if (type === "delete_assets") {
    return { actionStatus: "processable" };
  }

  if (type === "reprocess_tone") {
    if (asset.type === "folder") {
      return { actionStatus: "container" };
    }
    return asset.type === "audio" || asset.type === "video"
      ? { actionStatus: "processable" }
      : { actionStatus: "skipped", skipReason: "Tone processing supports audio and video assets." };
  }

  const profile = options.processingProfile;
  if (asset.type === "folder") {
    return { actionStatus: "container" };
  }
  if (profile === "folder-meta-v1") {
    return { actionStatus: "skipped", skipReason: "Folder metadata profile does not convert media assets." };
  }
  if (!profile) {
    return { actionStatus: "processable" };
  }
  if (profile.startsWith("video-") && asset.type !== "video") {
    return { actionStatus: "skipped", skipReason: "Selected profile only supports video assets." };
  }
  if (profile.startsWith("audio-") && asset.type !== "audio") {
    return { actionStatus: "skipped", skipReason: "Selected profile only supports audio assets." };
  }
  if (profile.startsWith("image-") && asset.type !== "image") {
    return { actionStatus: "skipped", skipReason: "Selected profile only supports image assets." };
  }
  return { actionStatus: "processable" };
}

export async function expandAssetTree(params: {
  db: DynamoDBDocumentClient;
  tableName: string;
  containerIndex: string;
  ownerEmail: string;
  roots: AssetRecord[];
  includeDescendants: boolean;
  maxItems?: number;
}): Promise<{ roots: JobAssetSummary[]; items: JobAssetSummary[]; truncated: boolean }> {
  const maxItems = params.maxItems ?? MAX_PREVIEW_ITEMS;
  const rootIds = new Set(params.roots.map((root) => root.id));
  const visited = new Set<string>();
  const roots: JobAssetSummary[] = [];
  const items: JobAssetSummary[] = [];
  let truncated = false;

  async function visit(asset: AssetRecord, path: string, isRoot: boolean): Promise<void> {
    if (visited.has(asset.id) || truncated) {
      return;
    }
    visited.add(asset.id);

    const summary = toJobAssetSummary(asset, path);
    if (isRoot) {
      roots.push(summary);
    }
    items.push(summary);

    if (items.length >= maxItems) {
      truncated = true;
      return;
    }

    if (!params.includeDescendants || asset.type !== "folder") {
      return;
    }

    const children = await fetchChildren(
      params.db,
      params.tableName,
      params.containerIndex,
      params.ownerEmail,
      asset.id
    );
    children.sort((a, b) => a.title.localeCompare(b.title));

    for (const child of children) {
      if (rootIds.has(child.id) && !visited.has(child.id)) {
        continue;
      }
      await visit(child, pathFor(path, child.title), false);
    }
  }

  for (const root of params.roots) {
    await visit(root, pathFor(undefined, root.title), true);
  }

  return { roots, items, truncated };
}

export function buildJobPreview(input: {
  type: JobType;
  target: JobTarget;
  options?: JobOptions;
  ownerEmail: string;
  roots: JobAssetSummary[];
  items: JobAssetSummary[];
  truncated: boolean;
}): JobPreview {
  const options = input.options ?? {};
  const roots = input.roots.map((item) => ({
    ...item,
    ...processabilityFor(input.type, item, options),
  }));
  const items = input.items.map((item) => ({
    ...item,
    ...processabilityFor(input.type, item, options),
  }));
  const previewWithoutToken = {
    type: input.type,
    target: input.target,
    options,
    summary: summarize(items),
    roots,
    items,
    confirmationToken: "pending",
    truncated: input.truncated,
  } satisfies JobPreview;

  return {
    ...previewWithoutToken,
    confirmationToken: buildConfirmationToken(input.ownerEmail, previewWithoutToken),
  };
}

export function buildConfirmationToken(ownerEmail: string, preview: JobPreview): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ownerEmail,
        type: preview.type,
        target: preview.target,
        options: preview.options,
        itemIds: preview.items.map((item) => item.id),
        totalItems: preview.summary.totalItems,
      })
    )
    .digest("hex");
}
