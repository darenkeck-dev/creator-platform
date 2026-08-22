/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { S3Client } from "@aws-sdk/client-s3";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { handler } from "../../lambda/jobs-worker";

const originalDdbSend = DynamoDBDocumentClient.prototype.send;
const originalS3Send = S3Client.prototype.send;
const savedEnv = { ...process.env };
const now = "2026-08-20T12:00:00.000Z";

describe("jobs-worker music guard", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_CONTAINER_INDEX = "AssetByContainer";
    process.env.ASSETS_ORIGINALS_BUCKET_NAME = "originals";
    process.env.ASSETS_DERIVED_BUCKET_NAME = "derived";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalDdbSend;
    S3Client.prototype.send = originalS3Send;
    for (const name of [
      "ASSETS_TABLE_NAME",
      "ASSETS_CONTAINER_INDEX",
      "ASSETS_ORIGINALS_BUCKET_NAME",
      "ASSETS_DERIVED_BUCKET_NAME",
    ]) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  it("fails a linked item deterministically before deleting storage", async () => {
    const updates: UpdateCommand[] = [];
    const job = {
      id: "job-1",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "delete_assets",
      status: "queued",
      target: { assetIds: ["audio-1"], includeDescendants: true },
      options: {},
      totalItems: 1,
      completedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      message: "Queued",
      failures: [],
      createdAt: now,
      updatedAt: now,
    };
    const asset = {
      id: "audio-1",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "audio",
      title: "Official track",
      description: "",
      status: "ready",
      visibility: "public",
      original: {
        bucket: "originals",
        key: "incoming/audio-1",
        size: 1,
        contentType: "audio/mpeg",
      },
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      if (command instanceof GetCommand) {
        return String(command.input.Key?.pk).startsWith("JOB#") ? { Item: job } : { Item: asset };
      }
      if (command instanceof QueryCommand) {
        return { Items: [{ sk: "MUSIC_TRACK", publicationStatus: "published" }] };
      }
      if (command instanceof UpdateCommand) {
        updates.push(command);
        return {};
      }
      throw new Error("Unexpected command");
    } as typeof DynamoDBDocumentClient.prototype.send;
    let s3Calls = 0;
    S3Client.prototype.send = async function () {
      s3Calls += 1;
      return {};
    } as typeof S3Client.prototype.send;

    await handler({ Records: [{ body: JSON.stringify({ jobId: "job-1" }) }] });
    expect(s3Calls).toBe(0);
    const finalValues = updates.at(-1)?.input.ExpressionAttributeValues as Record<string, unknown>;
    expect(finalValues[":status"]).toBe("completed_with_errors");
    expect(JSON.stringify(finalValues[":failures"])).toContain("official music catalog");
  });

  it("retains a folder ancestor when its linked child cannot be deleted", async () => {
    const updates: UpdateCommand[] = [];
    const job = {
      id: "job-folder",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "delete_assets",
      status: "queued",
      target: { assetIds: ["folder-1"], includeDescendants: true },
      options: {},
      totalItems: 2,
      completedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      message: "Queued",
      failures: [],
      createdAt: now,
      updatedAt: now,
    };
    const folder = {
      id: "folder-1",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "folder",
      title: "Folder",
      description: "",
      status: "ready",
      visibility: "private",
      original: {
        bucket: "pending",
        key: "folders/folder-1",
        size: 0,
        contentType: "application/x-directory",
      },
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    const child = {
      ...folder,
      id: "audio-child",
      type: "audio",
      title: "Linked child",
      containerId: "folder-1",
      original: {
        bucket: "originals",
        key: "incoming/audio-child",
        size: 1,
        contentType: "audio/mpeg",
      },
    };
    let folderDeleteRead = false;
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      if (command instanceof GetCommand) {
        const pk = String(command.input.Key?.pk);
        if (pk.startsWith("JOB#")) return { Item: job };
        if (pk === "ASSET#folder-1") {
          if (folderDeleteRead) throw new Error("Folder deletion should be skipped");
          folderDeleteRead = true;
          return { Item: folder };
        }
        return { Item: child };
      }
      if (command instanceof QueryCommand && command.input.IndexName) return { Items: [child] };
      if (command instanceof QueryCommand)
        return { Items: [{ sk: "MUSIC_TRACK", publicationStatus: "published" }] };
      if (command instanceof UpdateCommand) {
        updates.push(command);
        return {};
      }
      throw new Error("No delete transaction should run");
    } as typeof DynamoDBDocumentClient.prototype.send;
    let s3Calls = 0;
    S3Client.prototype.send = async function () {
      s3Calls += 1;
      return {};
    } as typeof S3Client.prototype.send;

    await handler({ Records: [{ body: JSON.stringify({ jobId: "job-folder" }) }] });
    expect(s3Calls).toBe(0);
    expect(
      updates.some(
        (update) =>
          update.input.ExpressionAttributeValues?.[":message"] ===
          "Retaining Folder because a descendant could not be deleted"
      )
    ).toBe(true);
    expect(updates.at(-1)?.input.ExpressionAttributeValues?.[":skippedItems"]).toBe(1);
  });
});
