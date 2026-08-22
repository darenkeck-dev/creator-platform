/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { handler } from "../../lambda/api-music";

const trackId = "00000000-0000-4000-8000-000000000001";
const releaseId = "00000000-0000-4000-8000-000000000002";
const now = "2026-08-20T12:00:00.000Z";
const originalSend = DynamoDBDocumentClient.prototype.send;
const originalTable = process.env.ASSETS_TABLE_NAME;

function event(routeKey: string, options: { id?: string; body?: unknown; email?: string } = {}) {
  return {
    requestContext: {
      routeKey,
      authorizer: { jwt: { claims: { email: options.email ?? "owner@example.com" } } },
    },
    pathParameters: options.id ? { id: options.id } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
}

function audioAsset(ownerEmail = "owner@example.com", ready = true) {
  return {
    id: "audio-1",
    schemaVersion: 1,
    ownerEmail,
    type: "audio",
    title: "Audio",
    description: "",
    status: ready ? "ready" : "processing",
    visibility: "private",
    original: { bucket: "originals", key: "incoming/audio-1", size: 1, contentType: "audio/mpeg" },
    tags: [],
    stream: ready ? { hlsMasterUrl: "https://cdn.example.com/audio.m3u8" } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function track(overrides: Record<string, unknown> = {}) {
  return {
    pk: "MUSIC",
    sk: `TRACK#${trackId}`,
    schemaVersion: "music-track/v1",
    id: trackId,
    revision: 1,
    ownerEmail: "owner@example.com",
    title: "Track",
    assetId: "audio-1",
    purchaseLinks: [{ label: "Buy", url: "https://example.com/buy" }],
    publicationStatus: "draft",
    standalonePublished: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function release(overrides: Record<string, unknown> = {}) {
  return {
    pk: "MUSIC",
    sk: `RELEASE#${releaseId}`,
    schemaVersion: "music-release/v1",
    id: releaseId,
    revision: 1,
    ownerEmail: "owner@example.com",
    title: "Release",
    releaseDate: "2026-08-20",
    type: "single",
    coverAssetId: "cover-1",
    coverAlt: "Cover art",
    trackIds: [trackId],
    purchaseLinks: [{ label: "Buy", url: "https://example.com/release" }],
    publicationStatus: "draft",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function aggregate(totalReferenceCount = 0, publishedReferenceCount = 0, id = trackId) {
  return {
    pk: `MUSIC_TRACK#${id}`,
    sk: "REFERENCE_AGGREGATE",
    trackId: id,
    ownerEmail: "owner@example.com",
    totalReferenceCount,
    publishedReferenceCount,
  };
}

function stubSend(impl: (command: unknown) => Promise<Record<string, unknown>>) {
  const calls: unknown[] = [];
  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    calls.push(command);
    return impl(command);
  } as typeof DynamoDBDocumentClient.prototype.send;
  return calls;
}

describe("api-music lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;
    if (originalTable === undefined) delete process.env.ASSETS_TABLE_NAME;
    else process.env.ASSETS_TABLE_NAME = originalTable;
  });

  it("creates a draft track with server id and exclusive asset reverse record", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: audioAsset() };
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/tracks", {
        body: { schemaVersion: "music-track-create/v1", title: "New", assetId: "audio-1" },
      })
    );
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.track.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.track.publicationStatus).toBe("draft");
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(transaction.input.TransactItems?.[1]?.Put?.Item?.sk).toBe("MUSIC_TRACK");
    expect(transaction.input.TransactItems?.[1]?.Put?.ConditionExpression).toContain(
      "attribute_not_exists"
    );
    expect(transaction.input.TransactItems?.[3]?.Put?.Item).toMatchObject({
      sk: "REFERENCE_AGGREGATE",
      totalReferenceCount: 0,
      publishedReferenceCount: 0,
    });
    expect(transaction.input.TransactItems?.[4]?.Update?.Key?.pk).toBe("MUSIC_CATALOG");
    expect(transaction.input.TransactItems?.[4]?.Update?.ConditionExpression).toContain(
      "totalRecordCount < :maxRecords"
    );
  });

  it("returns 403 for a foreign asset and 409 for reverse-record contention", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: audioAsset("other@example.com") };
      return {};
    });
    const foreign = await handler(
      event("POST /music/tracks", {
        body: { schemaVersion: "music-track-create/v1", title: "New", assetId: "audio-1" },
      })
    );
    expect(foreign.statusCode).toBe(403);

    stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: audioAsset() };
      const error = new Error("cancelled");
      error.name = "TransactionCanceledException";
      throw error;
    });
    const conflict = await handler(
      event("POST /music/tracks", {
        body: { schemaVersion: "music-track-create/v1", title: "New", assetId: "audio-1" },
      })
    );
    expect(conflict.statusCode).toBe(409);
  });

  it("preserves release track order and rejects duplicate track ids", async () => {
    const invalid = await handler(
      event("POST /music/releases", {
        body: {
          schemaVersion: "music-release-create/v1",
          title: "Release",
          trackIds: [trackId, trackId],
        },
      })
    );
    expect(invalid.statusCode).toBe(400);

    let getCount = 0;
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.sk === "REFERENCE_AGGREGATE")
          return { Item: aggregate(0, 0, key.pk.replace("MUSIC_TRACK#", "")) };
        getCount += 1;
        return {
          Item: track({
            id: getCount === 1 ? trackId : "00000000-0000-4000-8000-000000000003",
            sk: `TRACK#${getCount === 1 ? trackId : "00000000-0000-4000-8000-000000000003"}`,
          }),
        };
      }
      return {};
    });
    const secondId = "00000000-0000-4000-8000-000000000003";
    const valid = await handler(
      event("POST /music/releases", {
        body: {
          schemaVersion: "music-release-create/v1",
          title: "Release",
          trackIds: [trackId, secondId],
        },
      })
    );
    expect(valid.statusCode).toBe(201);
    expect(JSON.parse(valid.body).release.trackIds).toEqual([trackId, secondId]);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    const aggregateUpdates = transaction.input.TransactItems?.filter(
      (item) => item.Update?.Key?.sk === "REFERENCE_AGGREGATE"
    );
    expect(aggregateUpdates).toHaveLength(2);
    expect(aggregateUpdates?.[0]?.Update?.ConditionExpression).toContain(
      "totalReferenceCount < :maxReferences"
    );
    expect(
      transaction.input.TransactItems?.some((item) => item.Update?.Key?.pk === "MUSIC_CATALOG")
    ).toBe(true);
  });

  it("keeps a 20-track release create below 100 items with atomic write caps", async () => {
    const trackIds = Array.from(
      { length: 20 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`
    );
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.pk === "ASSET#cover-1") {
          return {
            Item: {
              ...audioAsset(),
              id: "cover-1",
              type: "image",
              original: { bucket: "originals", key: "cover", size: 1, contentType: "image/jpeg" },
              stream: undefined,
            },
          };
        }
        if (key.sk === "REFERENCE_AGGREGATE") {
          const id = key.pk.replace("MUSIC_TRACK#", "");
          return { Item: aggregate(99, 0, id) };
        }
        const id = key.sk.replace("TRACK#", "");
        return { Item: track({ id, sk: key.sk }) };
      }
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/releases", {
        body: {
          schemaVersion: "music-release-create/v1",
          title: "Large release",
          coverAssetId: "cover-1",
          trackIds,
        },
      })
    );
    expect(result.statusCode).toBe(201);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(transaction.input.TransactItems).toHaveLength(44);
    expect(transaction.input.TransactItems!.length).toBeLessThanOrEqual(100);
    expect(
      transaction.input.TransactItems?.find((item) => item.Update?.Key?.pk === "ASSET#cover-1")
        ?.Update?.ConditionExpression
    ).toContain("officialMusicLinkCount < :maxReferences");
    expect(
      transaction.input.TransactItems?.filter(
        (item) => item.Update?.Key?.sk === "REFERENCE_AGGREGATE"
      ).every((item) => item.Update?.ExpressionAttributeValues?.[":maxReferences"] === 100)
    ).toBe(true);
  });

  it("reports readiness issues without mutating data", async () => {
    const deleteCalls = stubSend(async (command) => {
      if (command instanceof GetCommand && String(command.input.Key?.pk).startsWith("MUSIC"))
        return { Item: track({ purchaseLinks: [] }) };
      if (command instanceof GetCommand) return { Item: audioAsset("owner@example.com", false) };
      throw new Error("Mutation should not run");
    });
    const result = await handler(event("GET /music/tracks/{id}/readiness", { id: trackId }));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.ready).toBe(false);
    expect(body.issues.map((issue: { code: string }) => issue.code)).toEqual(
      expect.arrayContaining(["track_purchase_links_empty", "asset_not_ready", "audio_hls_missing"])
    );
  });

  it("publishes a ready track and its audio asset atomically", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand && command.input.Key?.sk === "REFERENCE_AGGREGATE")
        return { Item: aggregate() };
      if (command instanceof GetCommand && String(command.input.Key?.pk) === "MUSIC")
        return { Item: track() };
      if (command instanceof GetCommand) return { Item: audioAsset() };
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/tracks/{id}/publish", {
        id: trackId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 1 },
      })
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).track.publicationStatus).toBe("published");
    expect(JSON.parse(result.body).track.standalonePublished).toBe(true);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(transaction.input.TransactItems).toHaveLength(4);
    expect(
      transaction.input.TransactItems?.[2]?.Update?.ExpressionAttributeValues?.[":public"]
    ).toBe("public");
    expect(transaction.input.TransactItems?.[0]?.Put?.ConditionExpression).toContain("revision");
    expect(transaction.input.TransactItems?.[2]?.Update?.ConditionExpression).toContain(
      "#status = :ready"
    );
    expect(transaction.input.TransactItems?.[2]?.Update?.ConditionExpression).toContain(
      "attribute_exists(#stream.#hls)"
    );
  });

  it("returns 409 before writing a stale PATCH revision", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: track({ revision: 2 }) };
      throw new Error("Stale updates must not write");
    });
    const result = await handler(
      event("PATCH /music/tracks/{id}", {
        id: trackId,
        body: {
          schemaVersion: "music-track-update/v1",
          expectedRevision: 1,
          title: "Stale",
        },
      })
    );
    expect(result.statusCode).toBe(409);
    expect(calls).toHaveLength(1);
  });

  it("publishes a release, ordered tracks, audio, and cover in one transaction", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const pk = String(command.input.Key?.pk);
        if (command.input.Key?.sk === "REFERENCE_AGGREGATE") return { Item: aggregate(1, 0) };
        if (pk === "MUSIC") {
          return String(command.input.Key?.sk).startsWith("RELEASE")
            ? { Item: release() }
            : { Item: track() };
        }
        if (pk === "ASSET#cover-1") {
          return {
            Item: {
              ...audioAsset(),
              id: "cover-1",
              type: "image",
              original: {
                bucket: "originals",
                key: "incoming/cover-1",
                size: 1,
                contentType: "image/jpeg",
              },
              stream: undefined,
            },
          };
        }
        return { Item: audioAsset() };
      }
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/releases/{id}/publish", {
        id: releaseId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 1 },
      })
    );
    expect(result.statusCode).toBe(200);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(transaction.input.TransactItems).toHaveLength(5);
    expect(transaction.input.TransactItems?.[1]?.Update?.Key?.pk).toBe("ASSET#cover-1");
    expect(transaction.input.TransactItems?.[3]?.Update?.Key?.pk).toBe("ASSET#audio-1");
  });

  it("blocks track deletion and unpublish while release references require it", async () => {
    stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: track({ publicationStatus: "published" }) };
      return {};
    });
    const unpublish = await handler(
      event("POST /music/tracks/{id}/unpublish", {
        id: trackId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 1 },
      })
    );
    expect(unpublish.statusCode).toBe(409);

    const deleteCalls = stubSend(async (command) => {
      if (command instanceof GetCommand)
        return String(command.input.Key?.pk) === "MUSIC"
          ? { Item: track() }
          : { Item: audioAsset() };
      if (command instanceof TransactWriteCommand) {
        const error = new Error("reference added concurrently");
        error.name = "TransactionCanceledException";
        throw error;
      }
      throw new Error("Unexpected command");
    });
    const deleted = await handler(
      event("DELETE /music/tracks/{id}", {
        id: trackId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 1 },
      })
    );
    expect(deleted.statusCode).toBe(409);
    const deleteTransaction = deleteCalls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(
      deleteTransaction.input.TransactItems?.some(
        (item) =>
          item.Delete?.Key?.sk === "REFERENCE_AGGREGATE" &&
          item.Delete.ConditionExpression?.includes("totalReferenceCount = :zero")
      )
    ).toBe(true);
    expect(deleteCalls.some((call) => call instanceof QueryCommand)).toBe(false);
  });

  it("returns 409 for a stale track DELETE before reading references", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: track({ revision: 2 }) };
      throw new Error("Stale delete must not continue");
    });
    const result = await handler(
      event("DELETE /music/tracks/{id}", {
        id: trackId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 1 },
      })
    );
    expect(result.statusCode).toBe(409);
    expect(calls).toHaveLength(1);
  });

  it("enforces the caller revision in the track DELETE transaction", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const pk = String(command.input.Key?.pk);
        return pk === "MUSIC" ? { Item: track({ revision: 3 }) } : { Item: audioAsset() };
      }
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("DELETE /music/tracks/{id}", {
        id: trackId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 3 },
      })
    );
    expect(result.statusCode).toBe(200);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(
      transaction.input.TransactItems?.[0]?.Delete?.ExpressionAttributeValues?.[":revision"]
    ).toBe(3);
    expect(transaction.input.TransactItems?.[0]?.Delete?.ConditionExpression).toContain(
      "revision = :revision"
    );
  });

  it("returns 409 for a stale release DELETE", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) return { Item: release({ revision: 4 }) };
      throw new Error("Stale delete must not continue");
    });
    const result = await handler(
      event("DELETE /music/releases/{id}", {
        id: releaseId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 3 },
      })
    );
    expect(result.statusCode).toBe(409);
    expect(calls).toHaveLength(1);
  });

  it("drafts a release-only track when its release is unpublished", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.pk === "MUSIC" && key.sk.startsWith("RELEASE"))
          return { Item: release({ revision: 2, publicationStatus: "published" }) };
        if (key.pk === "MUSIC")
          return { Item: track({ revision: 2, publicationStatus: "published" }) };
        if (key.sk === "REFERENCE_AGGREGATE") return { Item: aggregate(1, 1) };
        if (key.pk === "ASSET#cover-1") {
          return {
            Item: {
              ...audioAsset(),
              id: "cover-1",
              type: "image",
              original: { bucket: "originals", key: "cover", size: 1, contentType: "image/jpeg" },
              stream: undefined,
            },
          };
        }
        return { Item: audioAsset() };
      }
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/releases/{id}/unpublish", {
        id: releaseId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 2 },
      })
    );
    expect(result.statusCode).toBe(200);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    const trackWrite = transaction.input.TransactItems?.find(
      (item) => item.Put?.Item?.sk === `TRACK#${trackId}`
    );
    expect(trackWrite?.Put?.Item?.publicationStatus).toBe("draft");
    expect(trackWrite?.Put?.Item?.revision).toBe(3);
    const aggregateUpdate = transaction.input.TransactItems?.find(
      (item) => item.Update?.Key?.sk === "REFERENCE_AGGREGATE"
    );
    expect(aggregateUpdate?.Update?.ExpressionAttributeValues?.[":expectedPublished"]).toBe(1);
    expect(aggregateUpdate?.Update?.ConditionExpression).toContain(
      "publishedReferenceCount = :expectedPublished"
    );
  });

  it("returns 409 when the final-release aggregate changes during unpublish", async () => {
    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.pk === "MUSIC" && key.sk.startsWith("RELEASE"))
          return { Item: release({ revision: 2, publicationStatus: "published" }) };
        if (key.pk === "MUSIC")
          return { Item: track({ revision: 2, publicationStatus: "published" }) };
        if (key.sk === "REFERENCE_AGGREGATE") return { Item: aggregate(1, 1) };
        if (key.pk === "ASSET#cover-1") {
          return {
            Item: {
              ...audioAsset(),
              id: "cover-1",
              type: "image",
              original: { bucket: "originals", key: "cover", size: 1, contentType: "image/jpeg" },
              stream: undefined,
            },
          };
        }
        return { Item: audioAsset() };
      }
      if (command instanceof TransactWriteCommand) {
        const error = new Error("aggregate changed");
        error.name = "TransactionCanceledException";
        throw error;
      }
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/releases/{id}/unpublish", {
        id: releaseId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 2 },
      })
    );
    expect(result.statusCode).toBe(409);
  });

  it("keeps a track published when another published release references it", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.pk === "MUSIC" && key.sk.startsWith("RELEASE"))
          return { Item: release({ revision: 2, publicationStatus: "published" }) };
        if (key.pk === "MUSIC")
          return { Item: track({ revision: 2, publicationStatus: "published" }) };
        if (key.sk === "REFERENCE_AGGREGATE") return { Item: aggregate(2, 2) };
        return {
          Item: {
            ...audioAsset(),
            id: "cover-1",
            type: "image",
            original: { bucket: "originals", key: "cover", size: 1, contentType: "image/jpeg" },
            stream: undefined,
          },
        };
      }
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/releases/{id}/unpublish", {
        id: releaseId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 2 },
      })
    );
    expect(result.statusCode).toBe(200);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(
      transaction.input.TransactItems?.some((item) => item.Put?.Item?.sk === `TRACK#${trackId}`)
    ).toBe(false);
    expect(
      transaction.input.TransactItems?.some(
        (item) => item.ConditionCheck?.Key?.sk === `TRACK#${trackId}`
      )
    ).toBe(true);
    expect(
      transaction.input.TransactItems?.find(
        (item) => item.Update?.Key?.sk === "REFERENCE_AGGREGATE"
      )?.Update?.ExpressionAttributeValues?.[":expectedPublished"]
    ).toBe(2);
  });

  it("keeps an explicitly standalone-published track when its release is unpublished", async () => {
    const calls = stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.pk === "MUSIC" && key.sk.startsWith("RELEASE"))
          return { Item: release({ revision: 2, publicationStatus: "published" }) };
        if (key.pk === "MUSIC")
          return {
            Item: track({
              revision: 2,
              publicationStatus: "published",
              standalonePublished: true,
            }),
          };
        if (key.sk === "REFERENCE_AGGREGATE") return { Item: aggregate(1, 1) };
        return {
          Item: {
            ...audioAsset(),
            id: "cover-1",
            type: "image",
            original: { bucket: "originals", key: "cover", size: 1, contentType: "image/jpeg" },
            stream: undefined,
          },
        };
      }
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const result = await handler(
      event("POST /music/releases/{id}/unpublish", {
        id: releaseId,
        body: { schemaVersion: "music-publication-action/v1", expectedRevision: 2 },
      })
    );
    expect(result.statusCode).toBe(200);
    const transaction = calls.find(
      (call) => call instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(
      transaction.input.TransactItems?.some((item) => item.Put?.Item?.sk === `TRACK#${trackId}`)
    ).toBe(false);
  });

  it("filters admin lists by JWT owner", async () => {
    stubSend(async () => ({
      Items: [
        track(),
        track({
          id: "00000000-0000-4000-8000-000000000004",
          sk: "TRACK#00000000-0000-4000-8000-000000000004",
          ownerEmail: "other@example.com",
        }),
      ],
    }));
    const result = await handler(event("GET /music/tracks"));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).tracks).toHaveLength(1);
  });
});
