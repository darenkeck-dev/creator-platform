import { DynamoDBClient, GetItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { z } from "zod";

const PreTokenEventSchema = z.object({
  request: z.object({
    userAttributes: z.object({
      email: z.string().optional(),
    }),
  }),
});

type PreTokenEvent = z.infer<typeof PreTokenEventSchema>;

const db = new DynamoDBClient({});

function getTableName(): string {
  const parsed = z
    .string()
    .min(1)
    .safeParse(process.env.ASSETS_TABLE_NAME ?? "");
  return parsed.success ? parsed.data : "";
}

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isEnabled(item?: Record<string, AttributeValue>): boolean {
  const enabled = item?.enabled?.BOOL;
  return enabled !== false;
}

async function getAllowlistRecord(
  tableName: string,
  skValue: string
): Promise<Record<string, AttributeValue> | undefined> {
  const result = await db.send(
    new GetItemCommand({
      TableName: tableName,
      Key: {
        pk: { S: "AUTH#ALLOWLIST" },
        sk: { S: skValue },
      },
      ConsistentRead: true,
    })
  );

  return result.Item;
}

async function isAllowlisted(tableName: string, email: string, domain: string): Promise<boolean> {
  const emailRecord = await getAllowlistRecord(tableName, `EMAIL#${email}`);
  if (emailRecord && isEnabled(emailRecord)) {
    return true;
  }

  const domainRecord = await getAllowlistRecord(tableName, `DOMAIN#${domain}`);
  return Boolean(domainRecord) && isEnabled(domainRecord);
}

export async function handler(event: PreTokenEvent): Promise<PreTokenEvent> {
  const tableName = getTableName();

  if (!tableName) {
    throw new Error("Unauthorized: allowlist table is not configured");
  }

  const parsedEvent = PreTokenEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    throw new Error("Unauthorized: missing or invalid email claim");
  }

  const email = normalizeEmail(parsedEvent.data.request.userAttributes.email);
  const parsedEmail = z.string().email().safeParse(email);

  if (!parsedEmail.success || !isValidEmail(email)) {
    throw new Error("Unauthorized: missing or invalid email claim");
  }

  const domain = email.split("@")[1] ?? "";
  const allowed = await isAllowlisted(tableName, email, domain);
  if (!allowed) {
    throw new Error(`Unauthorized: ${email} is not allowlisted`);
  }

  return event;
}
