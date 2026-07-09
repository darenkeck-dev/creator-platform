import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  CreateJobInputSchema,
  CreateJobResponseSchema,
  JobDetailResponseSchema,
  JobPreviewInputSchema,
  JobPreviewResponseSchema,
  JobRecordSchema,
  type AssetRecord,
  type JobPreview,
  type JobTarget,
  type JobType,
} from "@media-manager/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  buildConfirmationToken,
  buildJobPreview,
  expandAssetTree,
  safeReadAsset,
} from "../shared/asset-job-tree";

type HttpEvent = {
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
    routeKey?: string;
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
  body?: string | null;
  pathParameters?: Record<string, string | undefined>;
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const sqs = new SQSClient({});

function response(statusCode: number, body: unknown): { statusCode: number; body: string } {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

function getRequiredEnv(
  name: "ASSETS_TABLE_NAME" | "ASSETS_CONTAINER_INDEX" | "BULK_ACTIONS_QUEUE_URL"
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
  return body ? JSON.parse(body) : {};
}

async function fetchAssetById(tableName: string, id: string): Promise<AssetRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  return result.Item ? await safeReadAsset(db, tableName, result.Item) : null;
}

async function loadRoots(
  tableName: string,
  ownerEmail: string,
  target: JobTarget
): Promise<AssetRecord[] | { error: { statusCode: number; body: unknown } }> {
  const roots: AssetRecord[] = [];
  const seen = new Set<string>();

  for (const id of target.assetIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);

    const asset = await fetchAssetById(tableName, id);
    if (!asset) {
      return { error: { statusCode: 404, body: { message: `Asset not found: ${id}` } } };
    }
    if (asset.ownerEmail !== ownerEmail) {
      return { error: { statusCode: 403, body: { message: "Forbidden" } } };
    }
    roots.push(asset);
  }

  return roots;
}

async function createPreview(params: {
  type: JobType;
  target: JobTarget;
  options?: z.infer<typeof CreateJobInputSchema>["options"];
  ownerEmail: string;
}): Promise<JobPreview | { error: { statusCode: number; body: unknown } }> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const containerIndex = getRequiredEnv("ASSETS_CONTAINER_INDEX");
  const rootsResult = await loadRoots(tableName, params.ownerEmail, params.target);
  if (!Array.isArray(rootsResult)) {
    return rootsResult;
  }

  const expanded = await expandAssetTree({
    db,
    tableName,
    containerIndex,
    ownerEmail: params.ownerEmail,
    roots: rootsResult,
    includeDescendants: params.target.includeDescendants,
  });

  return buildJobPreview({
    type: params.type,
    target: params.target,
    options: params.options ?? {},
    ownerEmail: params.ownerEmail,
    roots: expanded.roots,
    items: expanded.items,
    truncated: expanded.truncated,
  });
}

async function previewJob(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const ownerEmail = getOwnerEmail(event);
  const parsed = JobPreviewInputSchema.safeParse(parseBody(event.body));
  if (!parsed.success) {
    return response(400, { message: "Invalid request body", issues: parsed.error.issues });
  }

  const preview = await createPreview({
    type: parsed.data.type,
    target: parsed.data.target,
    options: parsed.data.options,
    ownerEmail,
  });
  if ("error" in preview) {
    return response(preview.error.statusCode, preview.error.body);
  }
  if (preview.truncated) {
    return response(413, { message: "Job preview is too large", preview });
  }

  const payload = JobPreviewResponseSchema.parse({ preview });
  return response(200, payload);
}

async function createJob(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const queueUrl = getRequiredEnv("BULK_ACTIONS_QUEUE_URL");
  const ownerEmail = getOwnerEmail(event);
  const parsed = CreateJobInputSchema.safeParse(parseBody(event.body));
  if (!parsed.success) {
    return response(400, { message: "Invalid request body", issues: parsed.error.issues });
  }

  const preview = await createPreview({
    type: parsed.data.type,
    target: parsed.data.target,
    options: parsed.data.options,
    ownerEmail,
  });
  if ("error" in preview) {
    return response(preview.error.statusCode, preview.error.body);
  }
  if (preview.truncated) {
    return response(413, { message: "Job preview is too large", preview });
  }

  const expectedToken = buildConfirmationToken(ownerEmail, preview);
  if (parsed.data.confirmationToken !== expectedToken) {
    return response(409, { message: "Job preview changed. Review and confirm again." });
  }

  const now = new Date().toISOString();
  const id = `job_${randomUUID()}`;
  const job = JobRecordSchema.parse({
    id,
    schemaVersion: 1,
    ownerEmail,
    type: parsed.data.type,
    status: "queued",
    target: parsed.data.target,
    options: parsed.data.options,
    preview,
    totalItems: preview.summary.totalItems,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    message: "Queued job",
    failures: [],
    createdAt: now,
    updatedAt: now,
  });

  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `JOB#${id}`,
        sk: "META",
        gsi1pk: `OWNER#${ownerEmail}#JOBS`,
        gsi1sk: `${now}#${id}`,
        ...job,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ jobId: id }),
    })
  );

  const payload = CreateJobResponseSchema.parse({ job });
  return response(202, payload);
}

async function getJob(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const ownerEmail = getOwnerEmail(event);
  const id = event.pathParameters?.id;
  if (!id) {
    return response(400, { message: "Missing job id" });
  }

  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `JOB#${id}`,
        sk: "META",
      },
    })
  );
  if (!result.Item) {
    return response(404, { message: "Job not found" });
  }

  const parsed = JobRecordSchema.safeParse(result.Item);
  if (!parsed.success) {
    return response(500, { message: "Job record failed validation" });
  }
  if (parsed.data.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const payload = JobDetailResponseSchema.parse({ job: parsed.data });
  return response(200, payload);
}

export async function handler(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  try {
    const method = event.requestContext?.http?.method;
    const routeKey = event.requestContext?.routeKey;

    if (method === "POST" && routeKey === "POST /jobs/preview") {
      return await previewJob(event);
    }
    if (method === "POST" && routeKey === "POST /jobs") {
      return await createJob(event);
    }
    if (method === "GET" && routeKey === "GET /jobs/{id}") {
      return await getJob(event);
    }

    return response(404, { message: "Not found" });
  } catch (error) {
    console.error("Jobs API error", { error });
    return response(500, { message: "Internal server error" });
  }
}
