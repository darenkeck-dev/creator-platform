import { DeleteItemCommand, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const stage = (process.env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
const defaultTableName = stage === "prod" ? "Assets" : `Assets-${stage}`;
const TABLE_NAME = process.env.ALLOWLIST_TABLE_NAME ?? defaultTableName;
const PK = "AUTH#ALLOWLIST";

type AllowlistKind = "email" | "domain";
type AllowlistAction = "add" | "remove";

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  bun run --cwd infra/cdk allowlist:add-email -- user@example.com",
      "  bun run --cwd infra/cdk allowlist:remove-email -- user@example.com",
      "  bun run --cwd infra/cdk allowlist:add-domain -- example.com",
      "  bun run --cwd infra/cdk allowlist:remove-domain -- example.com",
      "",
      "Advanced:",
      "  bunx ts-node src/allowlist-cli.ts <add|remove> <email|domain> <value>",
      "",
      "Optional env vars:",
      "  ALLOWLIST_TABLE_NAME (default: Assets)",
      "  ALLOWLIST_UPDATED_BY (default: allowlist-cli)",
      "  ALLOWLIST_NOTE (default: none)",
    ].join("\n")
  );
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDomain(domain: string): boolean {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}

function buildSk(kind: AllowlistKind, normalizedValue: string): string {
  return kind === "email" ? `EMAIL#${normalizedValue}` : `DOMAIN#${normalizedValue}`;
}

function parseArgs(argv: string[]): {
  action: AllowlistAction;
  kind: AllowlistKind;
  value: string;
} {
  const [action, kind, value] = argv;

  if (!action || !kind || !value) {
    usage();
  }

  if (action !== "add" && action !== "remove") {
    usage();
  }

  if (kind !== "email" && kind !== "domain") {
    usage();
  }

  return { action, kind, value };
}

function normalizeAndValidate(kind: AllowlistKind, rawValue: string): string {
  const normalized = kind === "email" ? normalizeEmail(rawValue) : normalizeDomain(rawValue);

  const valid = kind === "email" ? isValidEmail(normalized) : isValidDomain(normalized);
  if (!valid) {
    throw new Error(`Invalid ${kind}: ${rawValue}`);
  }

  return normalized;
}

async function run(): Promise<void> {
  const { action, kind, value } = parseArgs(process.argv.slice(2));
  const normalizedValue = normalizeAndValidate(kind, value);
  const sk = buildSk(kind, normalizedValue);

  const client = new DynamoDBClient({});

  if (action === "add") {
    const updatedBy = process.env.ALLOWLIST_UPDATED_BY ?? "allowlist-cli";
    const note = process.env.ALLOWLIST_NOTE;
    const now = new Date().toISOString();

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: { S: PK },
          sk: { S: sk },
          enabled: { BOOL: true },
          updatedAt: { S: now },
          updatedBy: { S: updatedBy },
          ...(note ? { note: { S: note } } : {}),
        },
      })
    );

    console.log(`Added allowlist ${kind}: ${normalizedValue}`);
    console.log(`Table: ${TABLE_NAME}`);
    console.log(`Key: PK=${PK} SK=${sk}`);
    return;
  }

  await client.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: { S: PK },
        sk: { S: sk },
      },
    })
  );

  console.log(`Removed allowlist ${kind}: ${normalizedValue}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Key: PK=${PK} SK=${sk}`);
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Allowlist CLI failed: ${message}`);
  process.exit(1);
});
