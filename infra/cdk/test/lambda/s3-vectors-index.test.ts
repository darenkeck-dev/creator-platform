/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  DeleteVectorsCommand,
  GetVectorsCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  type S3VectorsClient,
} from "@aws-sdk/client-s3vectors";
import type { AssetToneVectorRecord } from "@media-manager/tone-core";

import { S3VectorsIndex } from "../../lambda/shared/s3-vectors-index";

const record: AssetToneVectorRecord = {
  assetId: "audio-1",
  assetType: "audio",
  effectiveTone: [-0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9],
  vectorSchemaVersion: "asset-tone-vector/v1",
  taxonomyVersion: "tone-taxonomy/v2",
  adjustmentAlgorithm: "model-prior-mean/v1",
  visibility: "public",
  assetStatus: "ready",
  toneStatus: "ready",
  updatedAt: "2026-08-02T12:00:00.000Z",
};

describe("S3 Vectors index", () => {
  it("puts vector data and provider-neutral metadata under the asset id", async () => {
    let command: PutVectorsCommand | undefined;
    const index = new S3VectorsIndex({
      indexArn: "arn:aws:s3vectors:us-west-2:123:index/test/asset-tone-v1",
      client: mockClient(async (input) => {
        expect(input).toBeInstanceOf(PutVectorsCommand);
        command = input as PutVectorsCommand;
        return {};
      }),
    });

    await index.upsert(record);

    expect(command?.input).toEqual({
      indexArn: "arn:aws:s3vectors:us-west-2:123:index/test/asset-tone-v1",
      vectors: [
        {
          key: "audio-1",
          data: { float32: record.effectiveTone },
          metadata: {
            assetType: "audio",
            vectorSchemaVersion: "asset-tone-vector/v1",
            taxonomyVersion: "tone-taxonomy/v2",
            adjustmentAlgorithm: "model-prior-mean/v1",
            visibility: "public",
            assetStatus: "ready",
            toneStatus: "ready",
            updatedAt: "2026-08-02T12:00:00.000Z",
          },
        },
      ],
    });
  });

  it("deletes by stable asset id", async () => {
    let command: DeleteVectorsCommand | undefined;
    const index = new S3VectorsIndex({
      indexArn: "index-arn",
      client: mockClient(async (input) => {
        expect(input).toBeInstanceOf(DeleteVectorsCommand);
        command = input as DeleteVectorsCommand;
        return {};
      }),
    });

    await index.delete("video-2");

    expect(command?.input).toEqual({ indexArn: "index-arn", keys: ["video-2"] });
  });

  it("queries nearest records and maps SDK distance, data, and metadata", async () => {
    const commands: unknown[] = [];
    const metadata = { ...record };
    delete (metadata as Partial<AssetToneVectorRecord>).assetId;
    delete (metadata as Partial<AssetToneVectorRecord>).effectiveTone;
    const index = new S3VectorsIndex({
      indexArn: "index-arn",
      client: mockClient(async (input) => {
        commands.push(input);
        if (input instanceof QueryVectorsCommand) {
          return {
            vectors: [{ key: "audio-1", distance: 0.125 }],
            distanceMetric: "euclidean",
          };
        }
        if (input instanceof GetVectorsCommand) {
          return {
            vectors: [{ key: "audio-1", data: { float32: record.effectiveTone }, metadata }],
          };
        }
        throw new Error("Unexpected command");
      }),
    });

    const results = await index.queryNearest({
      vector: record.effectiveTone,
      limit: 5,
    });

    expect((commands[0] as QueryVectorsCommand).input).toEqual({
      indexArn: "index-arn",
      queryVector: { float32: record.effectiveTone },
      topK: 5,
      returnDistance: true,
    });
    expect((commands[1] as GetVectorsCommand).input).toEqual({
      indexArn: "index-arn",
      keys: ["audio-1"],
      returnData: true,
      returnMetadata: true,
    });
    expect(results).toEqual([{ record, distance: 0.125 }]);
  });
});

function mockClient(send: (command: unknown) => Promise<unknown>): S3VectorsClient {
  return { send } as unknown as S3VectorsClient;
}
