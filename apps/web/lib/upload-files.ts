export type UploadAssetType = "video" | "audio" | "image";

export type ConcurrentResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export type UploadProgressRow = {
  file: { size: number };
  progress: number;
};

const EXTENSION_TYPES: Record<string, UploadAssetType> = {
  mp4: "video",
  m4v: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  mpeg: "video",
  mpg: "video",
  ogv: "video",
  ts: "video",
  m2ts: "video",
  "3gp": "video",
  "3g2": "video",
  mp3: "audio",
  wav: "audio",
  aac: "audio",
  m4a: "audio",
  flac: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
  aif: "audio",
  aiff: "audio",
  wma: "audio",
  alac: "audio",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  heic: "image",
  heif: "image",
  svg: "image",
  bmp: "image",
  tif: "image",
  tiff: "image",
};

export function inferAssetTypeFromFile(file: {
  name: string;
  type: string;
}): UploadAssetType | null {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";

  const extension = file.name.trim().toLowerCase().split(".").pop();
  return extension ? (EXTENSION_TYPES[extension] ?? null) : null;
}

export function titleFromFileName(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf(".");
  return dot > 0 ? trimmed.slice(0, dot) : trimmed;
}

export async function runWithConcurrency<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  operation: (item: T, index: number) => R | Promise<R>
): Promise<ConcurrentResult<R>[]> {
  if (!Number.isFinite(maxConcurrency) || maxConcurrency < 1) {
    throw new RangeError("maxConcurrency must be at least 1");
  }

  const results = new Array<ConcurrentResult<R>>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { ok: true, value: await operation(items[index], index) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  };

  const workerCount = Math.min(items.length, Math.floor(maxConcurrency));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function aggregateUploadProgress(rows: readonly UploadProgressRow[]): number {
  const totalBytes = rows.reduce((sum, row) => sum + Math.max(0, row.file.size), 0);
  if (totalBytes === 0) return 0;

  const uploadedBytes = rows.reduce(
    (sum, row) => sum + Math.max(0, row.file.size) * Math.min(1, Math.max(0, row.progress)),
    0
  );
  return uploadedBytes / totalBytes;
}
