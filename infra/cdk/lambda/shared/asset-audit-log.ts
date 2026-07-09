import { randomUUID } from "node:crypto";
import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

type AuditLogCategory =
  | "upload"
  | "media_conversion"
  | "audio_conversion"
  | "tone_analysis"
  | "asset_metadata";

type AuditLogLevel = "info" | "warn" | "error";

type AuditLogDetails = Record<string, string | number | boolean | null | undefined>;

type AppendAssetAuditLogEntryInput = {
  db: DynamoDBDocumentClient;
  tableName: string;
  assetId: string;
  category: AuditLogCategory;
  level?: AuditLogLevel;
  source: string;
  code?: string;
  message: string;
  details?: AuditLogDetails;
};

const MAX_AUDIT_LOG_ENTRIES = 100;

function sanitizeDetails(
  details: AuditLogDetails | undefined
): Record<string, string | number | boolean> | undefined {
  if (!details) {
    return undefined;
  }

  const sanitized = Object.fromEntries(
    Object.entries(details).flatMap(([key, value]) => {
      if (value === null || value === undefined) {
        return [];
      }

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return [[key, value]];
      }

      return [];
    })
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export async function appendAssetAuditLogEntry(
  input: AppendAssetAuditLogEntryInput
): Promise<void> {
  const now = new Date().toISOString();
  const details = sanitizeDetails(input.details);
  const key = { pk: `ASSET#${input.assetId}`, sk: "META" };
  try {
    const current = await input.db.send(
      new GetCommand({
        TableName: input.tableName,
        Key: key,
        ProjectionExpression: "auditLog",
      })
    );
    const currentLog = Array.isArray(current.Item?.auditLog) ? current.Item.auditLog : [];
    const nextEntry = {
      id: randomUUID(),
      at: now,
      category: input.category,
      level: input.level ?? "info",
      message: input.message,
      source: input.source,
      ...(input.code ? { code: input.code } : {}),
      ...(details ? { details } : {}),
    };
    const nextLog = [...currentLog, nextEntry].slice(-MAX_AUDIT_LOG_ENTRIES);

    await input.db.send(
      new UpdateCommand({
        TableName: input.tableName,
        Key: key,
        ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
        UpdateExpression: "SET auditLog = :auditLog, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":auditLog": nextLog,
          ":updatedAt": now,
        },
      })
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Asset audit log append failed",
        assetId: input.assetId,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}
