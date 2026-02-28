import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  ASSET_SCHEMA_VERSION,
  AssetListResponseSchema,
  AssetRecordSchema,
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
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type AssetRecord = z.infer<typeof AssetRecordSchema>;

function response(statusCode: number, body: unknown): { statusCode: number; body: string } {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

function getRequiredEnv(name: "ASSETS_TABLE_NAME" | "ASSETS_CREATED_AT_INDEX"): string {
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
  ownerEmail: string
): AssetRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  const processingProfile =
    input.processingProfile ??
    (input.type === "video"
      ? "video-standard-v1"
      : input.type === "audio"
        ? "audio-passthrough-v1"
        : "image-passthrough-v1");

  return {
    id,
    schemaVersion: ASSET_SCHEMA_VERSION,
    ownerEmail,
    type: input.type,
    title: input.title,
    description: input.description,
    status: "draft",
    original: {
      bucket: "pending",
      key: input.original?.key ?? `incoming/${id}`,
      size: input.original?.size ?? 0,
      contentType: input.original?.contentType ?? "application/octet-stream",
    },
    tags: input.tags.map((tag) => ({ ...tag, source: "user" as const })),
    createdAt: now,
    updatedAt: now,
    searchText: [input.title, input.description].filter(Boolean).join(" ").trim(),
    processingProfile,
    conversion: {
      status: "not_started",
      profile: processingProfile,
      updatedAt: now,
    },
  };
}

async function createAsset(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = CreateAssetInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const asset = AssetRecordSchema.parse(buildAssetRecord(parsedBody.data, ownerEmail));

  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `ASSET#${asset.id}`,
        sk: "META",
        gsi1pk: "ASSET",
        gsi1sk: `${asset.createdAt}#${asset.id}`,
        ...asset,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    })
  );

  return response(201, { asset });
}

async function listAssets(): Promise<{ statusCode: number; body: string }> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const createdAtIndex = getRequiredEnv("ASSETS_CREATED_AT_INDEX");

  const result = await db.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: createdAtIndex,
      KeyConditionExpression: "gsi1pk = :gsiPk",
      ExpressionAttributeValues: {
        ":gsiPk": "ASSET",
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
  const payload = AssetListResponseSchema.parse({ assets });

  return response(200, payload);
}

export async function handler(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  try {
    const method = event.requestContext?.http?.method;

    if (method === "POST") {
      return await createAsset(event);
    }

    if (method === "GET") {
      return await listAssets();
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return response(500, { message });
  }
}
