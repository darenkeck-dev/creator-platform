/// <reference types="bun-types" />

import { afterEach, describe, expect, it } from "bun:test";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { enqueueVectorSyncMessage } from "../../lambda/shared/vector-sync-message";

const originalQueueUrl = process.env.VECTOR_SYNC_QUEUE_URL;
const originalSend = SQSClient.prototype.send;
const originalConsoleError = console.error;

describe("vector sync message producer", () => {
  afterEach(() => {
    SQSClient.prototype.send = originalSend;
    console.error = originalConsoleError;
    if (originalQueueUrl === undefined) {
      delete process.env.VECTOR_SYNC_QUEUE_URL;
    } else {
      process.env.VECTOR_SYNC_QUEUE_URL = originalQueueUrl;
    }
  });

  it("enqueues exactly the asset id", async () => {
    process.env.VECTOR_SYNC_QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/123/vector-sync";
    const calls: SendMessageCommand[] = [];
    SQSClient.prototype.send = async function (command: unknown) {
      expect(command).toBeInstanceOf(SendMessageCommand);
      calls.push(command as SendMessageCommand);
      return {};
    } as typeof SQSClient.prototype.send;

    await enqueueVectorSyncMessage("asset-1", "test");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toEqual({
      QueueUrl: "https://sqs.us-west-2.amazonaws.com/123/vector-sync",
      MessageBody: '{"assetId":"asset-1"}',
    });
  });

  it("logs delivery failure without changing the committed mutation outcome", async () => {
    process.env.VECTOR_SYNC_QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/123/vector-sync";
    const errors: unknown[][] = [];
    SQSClient.prototype.send = async function () {
      throw new Error("queue unavailable");
    } as typeof SQSClient.prototype.send;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    await expect(enqueueVectorSyncMessage("asset-2", "test")).resolves.toBeUndefined();
    expect(errors[0]?.[0]).toBe("Vector sync enqueue failed after asset mutation");
    expect(errors[0]?.[1]).toMatchObject({ assetId: "asset-2", source: "test" });
  });
});
