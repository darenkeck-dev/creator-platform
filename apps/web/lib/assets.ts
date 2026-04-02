import { AssetRecordSchema, type AssetRecord } from "@media-manager/contracts";

const mockAssets: AssetRecord[] = [
  {
    id: "asset-001",
    schemaVersion: 1,
    ownerEmail: "producer@example.com",
    type: "video",
    title: "Volcanic Coast Drone Reel",
    description: "Aerial footage for campaign launch trailer.",
    status: "processing",
    visibility: "private",
    original: {
      bucket: "media-originals-dev",
      key: "originals/asset-001/source.mov",
      size: 245182309,
      contentType: "video/quicktime",
    },
    tags: [
      { facet: "mood", value: "dramatic", source: "user", weight: "strong" },
      { facet: "location", value: "coast", source: "user" },
    ],
    createdAt: "2026-02-18T18:00:00.000Z",
    updatedAt: "2026-02-18T18:20:00.000Z",
    searchText: "volcanic coast drone reel dramatic coast",
  },
  {
    id: "asset-002",
    schemaVersion: 1,
    ownerEmail: "audio@example.com",
    type: "audio",
    title: "Night Market Ambience",
    description: "Stereo ambience loop for background layer.",
    status: "ready",
    visibility: "public",
    original: {
      bucket: "media-originals-dev",
      key: "originals/asset-002/source.wav",
      size: 48210352,
      contentType: "audio/wav",
    },
    tags: [
      { facet: "mood", value: "urban", source: "user" },
      { value: "field-recording", source: "user" },
    ],
    createdAt: "2026-02-18T17:00:00.000Z",
    updatedAt: "2026-02-18T17:35:00.000Z",
    searchText: "night market ambience urban field-recording",
    stream: {
      hlsMasterUrl: "https://d111111abcdef8.cloudfront.net/derived/asset-002/hls/master.m3u8",
      posterUrl: "https://d111111abcdef8.cloudfront.net/derived/asset-002/thumbs/poster.jpg",
      renditions: [
        { type: "audio", label: "aac-128", bitrateKbps: 128 },
        { type: "audio", label: "aac-256", bitrateKbps: 256 },
      ],
    },
  },
  {
    id: "asset-003",
    schemaVersion: 1,
    ownerEmail: "studio@example.com",
    type: "image",
    title: "Product Hero Frame",
    description: "Studio still used as product hero image.",
    status: "uploaded",
    visibility: "private",
    original: {
      bucket: "media-originals-dev",
      key: "originals/asset-003/source.png",
      size: 6829032,
      contentType: "image/png",
    },
    tags: [
      { facet: "collection", value: "spring-launch", source: "user" },
      { value: "hero", source: "user" },
    ],
    createdAt: "2026-02-18T16:00:00.000Z",
    updatedAt: "2026-02-18T16:05:00.000Z",
    searchText: "product hero frame spring-launch hero",
  },
];

export async function getAssetById(id: string): Promise<AssetRecord | null> {
  const asset = mockAssets.find((item) => item.id === id);
  if (!asset) {
    return null;
  }

  return AssetRecordSchema.parse(asset);
}

export async function getAssets(): Promise<AssetRecord[]> {
  return mockAssets.map((asset) => AssetRecordSchema.parse(asset));
}
