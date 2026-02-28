/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

import { handler } from "../../lambda/pre-token-allowlist";

type Event = {
  request?: {
    userAttributes?: {
      email?: string;
    };
  };
};

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalSend = DynamoDBClient.prototype.send;

function eventWithEmail(email: string): Event {
  return {
    request: {
      userAttributes: {
        email,
      },
    },
  };
}

function stubSend(
  impl: (command: GetItemCommand) => Promise<{ Item?: Record<string, unknown> | undefined }>
): { calls: GetItemCommand[] } {
  const calls: GetItemCommand[] = [];

  DynamoDBClient.prototype.send = async function (command: unknown) {
    if (!(command instanceof GetItemCommand)) {
      throw new Error("Unexpected command");
    }

    calls.push(command);
    return impl(command);
  } as typeof DynamoDBClient.prototype.send;

  return { calls };
}

describe("pre-token allowlist lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
  });

  afterEach(() => {
    DynamoDBClient.prototype.send = originalSend;

    if (originalTableName === undefined) {
      delete process.env.ASSETS_TABLE_NAME;
      return;
    }

    process.env.ASSETS_TABLE_NAME = originalTableName;
  });

  it("rejects when table name is not configured", async () => {
    delete process.env.ASSETS_TABLE_NAME;

    await expect(handler(eventWithEmail("darenkeck@gmail.com"))).rejects.toThrow(
      "Unauthorized: allowlist table is not configured"
    );
  });

  it("rejects when email is missing or invalid", async () => {
    await expect(handler({})).rejects.toThrow("Unauthorized: missing or invalid email claim");
    await expect(handler(eventWithEmail("not-an-email"))).rejects.toThrow(
      "Unauthorized: missing or invalid email claim"
    );
  });

  it("allows when normalized email exists in allowlist", async () => {
    const { calls } = stubSend(async (command) => {
      const sk = command.input.Key?.sk?.S;
      if (sk === "EMAIL#darenkeck@gmail.com") {
        return { Item: { enabled: { BOOL: true } } };
      }

      return { Item: undefined };
    });

    await expect(handler(eventWithEmail("  DarenKeck@Gmail.com  "))).resolves.toEqual(
      eventWithEmail("  DarenKeck@Gmail.com  ")
    );
    expect(calls).toHaveLength(1);
  });

  it("allows when domain is allowlisted", async () => {
    const { calls } = stubSend(async (command) => {
      const sk = command.input.Key?.sk?.S;
      if (sk === "DOMAIN#example.com") {
        return { Item: { enabled: { BOOL: true } } };
      }

      return { Item: undefined };
    });

    await expect(handler(eventWithEmail("person@example.com"))).resolves.toEqual(
      eventWithEmail("person@example.com")
    );
    expect(calls).toHaveLength(2);
  });

  it("rejects when neither email nor domain is allowlisted", async () => {
    const { calls } = stubSend(async () => ({ Item: undefined }));

    await expect(handler(eventWithEmail("blocked@example.com"))).rejects.toThrow(
      "Unauthorized: blocked@example.com is not allowlisted"
    );
    expect(calls).toHaveLength(2);
  });

  it("treats enabled=false as denied", async () => {
    const { calls } = stubSend(async (command) => {
      const sk = command.input.Key?.sk?.S;
      if (sk === "EMAIL#disabled@example.com") {
        return { Item: { enabled: { BOOL: false } } };
      }

      return { Item: undefined };
    });

    await expect(handler(eventWithEmail("disabled@example.com"))).rejects.toThrow(
      "Unauthorized: disabled@example.com is not allowlisted"
    );
    expect(calls).toHaveLength(2);
  });
});
