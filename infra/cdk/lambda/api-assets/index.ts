import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AssetOriginSchema,
  AssetTagFacetSchema,
  ASSET_SCHEMA_VERSION,
  AssetListResponseSchema,
  AssetRecordSchema,
  AssetTypeSchema,
  CreateAssetInputSchema,
} from "@media-manager/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type HttpEvent = {
  requestContext?: {
    http?: {
      method?: string;
    };
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
};

const ListAssetsQuerySchema = z.object({
  type: AssetTypeSchema.optional(),
  origin: AssetOriginSchema.optional(),
  facet: AssetTagFacetSchema.optional(),
  containerId: z.string().min(1).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type AssetRecord = z.infer<typeof AssetRecordSchema>;

function buildSearchText(input: {
  title: string;
  description: string;
  tags: Array<{ facet?: string; value: string }>;
  type: string;
  origin?: string;
  generationProvider?: string;
  generationModel?: string;
  generationWorkflowId?: string;
  processingProfile?: string;
  originalContentType?: string;
}): string {
  const tagTerms = input.tags.flatMap((tag) => [tag.facet, tag.value]);
  return [
    input.title,
    input.description,
    ...tagTerms,
    input.type,
    input.origin,
    input.generationProvider,
    input.generationModel,
    input.generationWorkflowId,
    input.processingProfile,
    input.originalContentType,
  ]
    .filter((term): term is string => typeof term === "string" && term.trim().length > 0)
    .map((term) => term.trim().toLowerCase())
    .join(" ");
}

function response(statusCode: number, body: unknown): { statusCode: number; body: string } {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

function toContainerIndexPk(containerId?: string): string {
  return `CONTAINER#${containerId ?? "ROOT"}`;
}

function getRequiredEnv(
  name: "ASSETS_TABLE_NAME" | "ASSETS_CREATED_AT_INDEX" | "ASSETS_CONTAINER_INDEX"
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getOwnerEmail(event: HttpEvent): string {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const parsed = z.string().email().safeParse(claims?.email);

  if (!parsed.success) {
    throw new Error("Unauthorized: missing email claim");
  }

  return parsed.data;
}

function parseBody(body: string | null | undefined): unknown {
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function buildAssetRecord(
  input: z.infer<typeof CreateAssetInputSchema>,
  ownerEmail: string,
  placement: {
    containerId?: string;
    parentId?: string;
    rootId: string;
    depth: number;
  }
): AssetRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  const processingProfile =
    input.processingProfile ??
    (input.type === "video"
      ? "video-standard-v1"
      : input.type === "audio"
        ? "audio-passthrough-v1"
        : input.type === "image"
          ? "image-passthrough-v1"
          : "folder-meta-v1");
  const isFolder = input.type === "folder";
  const origin = input.origin ?? (isFolder ? "manual" : "uploaded");

  return {
    id,
    schemaVersion: ASSET_SCHEMA_VERSION,
    ownerEmail,
    type: input.type,
    title: input.title,
    description: input.description,
    status: isFolder ? "ready" : "draft",
    visibility: input.visibility ?? "private",
    original: {
      bucket: "pending",
      key: input.original?.key ?? (isFolder ? `folders/${id}` : `incoming/${id}`),
      size: input.original?.size ?? 0,
      contentType:
        input.original?.contentType ??
        (isFolder ? "application/x-directory" : "application/octet-stream"),
    },
    tags: input.tags.map((tag) => ({ ...tag, source: "user" as const })),
    containerId: placement.containerId,
    parentId: placement.parentId,
    rootId: placement.rootId,
    depth: placement.depth,
    sourceAssetIds: input.sourceAssetIds ? [...new Set(input.sourceAssetIds)] : undefined,
    origin,
    generation: input.generation,
    createdAt: now,
    updatedAt: now,
    searchText: buildSearchText({
      title: input.title,
      description: input.description,
      tags: input.tags,
      type: input.type,
      origin,
      generationProvider: input.generation?.provider,
      generationModel: input.generation?.model,
      generationWorkflowId: input.generation?.workflowId,
      processingProfile,
      originalContentType: input.original?.contentType,
    }),
    processingProfile,
    conversion: isFolder
      ? {
          status: "passthrough_ready",
          profile: processingProfile,
          updatedAt: now,
          completedAt: now,
        }
      : {
          status: "not_started",
          profile: processingProfile,
          updatedAt: now,
        },
  };
}

async function getAssetById(tableName: string, id: string): Promise<AssetRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  const item = result.Item;
  if (!item) {
    return null;
  }

  const parsed = AssetRecordSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
}

async function createAsset(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = CreateAssetInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const requestedContainerId = parsedBody.data.containerId ?? parsedBody.data.parentId;
  let placement: {
    containerId?: string;
    parentId?: string;
    rootId: string;
    depth: number;
  } = {
    rootId: "pending",
    depth: 0,
  };

  if (requestedContainerId) {
    const container = await getAssetById(tableName, requestedContainerId);
    if (!container) {
      return response(400, { message: "Invalid containerId: referenced asset not found" });
    }

    if (container.ownerEmail !== ownerEmail) {
      return response(403, { message: "Forbidden: container belongs to another owner" });
    }

    placement = {
      containerId: container.id,
      parentId: container.id,
      rootId: container.rootId ?? container.id,
      depth: (container.depth ?? 0) + 1,
    };
  }

  if (parsedBody.data.sourceAssetIds && parsedBody.data.sourceAssetIds.length > 0) {
    const uniqueSourceIds = [...new Set(parsedBody.data.sourceAssetIds)];
    for (const sourceId of uniqueSourceIds) {
      const source = await getAssetById(tableName, sourceId);
      if (!source) {
        return response(400, { message: `Invalid sourceAssetIds: ${sourceId} not found` });
      }

      if (source.ownerEmail !== ownerEmail) {
        return response(403, { message: "Forbidden: source asset belongs to another owner" });
      }
    }
  }

  const asset = AssetRecordSchema.parse(buildAssetRecord(parsedBody.data, ownerEmail, placement));
  asset.rootId = asset.rootId ?? asset.id;

  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `ASSET#${asset.id}`,
        sk: "META",
        gsi1pk: "ASSET",
        gsi1sk: `${asset.createdAt}#${asset.id}`,
        gsi2pk: toContainerIndexPk(asset.containerId),
        gsi2sk: `${asset.createdAt}#${asset.id}`,
        ...asset,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    })
  );

  return response(201, { asset });
}

async function listAssets(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const parsedQuery = ListAssetsQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsedQuery.success) {
    return response(400, { message: "Invalid query parameters", issues: parsedQuery.error.issues });
  }

  const { type, origin, facet, containerId, sort } = parsedQuery.data;
  const ownerEmail = getOwnerEmail(event);
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const containerIndex = getRequiredEnv("ASSETS_CONTAINER_INDEX");

  const result = await db.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: containerIndex,
      KeyConditionExpression: "gsi2pk = :partitionKey",
      FilterExpression: "ownerEmail = :ownerEmail",
      ExpressionAttributeValues: {
        ":partitionKey": toContainerIndexPk(containerId),
        ":ownerEmail": ownerEmail,
      },
      ScanIndexForward: false,
      Limit: 100,
    })
  );

  const items = (result.Items ?? []) as Array<Record<string, unknown>>;
  const assets = items
    .map((item) => AssetRecordSchema.safeParse(item))
    .filter((parsed): parsed is z.SafeParseSuccess<AssetRecord> => parsed.success)
    .map((parsed) => parsed.data);
  const filtered = assets.filter((asset) => {
    if (type && asset.type !== type) {
      return false;
    }

    if (origin && asset.origin !== origin) {
      return false;
    }

    if (facet && !asset.tags.some((tag) => tag.facet === facet)) {
      return false;
    }

    return true;
  });

  const sorted = sort === "oldest" ? [...filtered].reverse() : filtered;
  const payload = AssetListResponseSchema.parse({ assets: sorted });

  return response(200, payload);
}

export async function handler(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  try {
    const method = event.requestContext?.http?.method;

    if (method === "POST") {
      return await createAsset(event);
    }

    if (method === "GET") {
      return await listAssets(event);
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return response(500, { message });
  }
}
