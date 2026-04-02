import {
  MultipartAbortResponseSchema,
  MultipartCompleteInputSchema,
  MultipartInitResponseSchema,
  MultipartSignResponseSchema,
  type VideoUploadMetadata,
} from "@media-manager/contracts";

const DEFAULT_PART_SIZE = 32 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RETRIES = 3;

type MultipartPart = {
  partNumber: number;
  etag: string;
};

type MultipartUploadOptions = {
  partSize?: number;
  concurrency?: number;
  retries?: number;
  onProgress?: (progress: number) => void;
  videoMetadata?: VideoUploadMetadata;
};

function normalizeEtag(etag: string | null): string | null {
  if (!etag) {
    return null;
  }

  const trimmed = etag.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^"|"$/g, "");
}

async function uploadOnePart(
  assetId: string,
  uploadId: string,
  partNumber: number,
  body: Blob,
  retries: number,
  onPartProgress?: (loaded: number) => void
): Promise<MultipartPart> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    attempt += 1;
    try {
      const signResponse = await fetch(
        `/api/assets/${encodeURIComponent(assetId)}/multipart/sign`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ uploadId, partNumber }),
        }
      );

      if (!signResponse.ok) {
        throw new Error(`Failed to sign part ${partNumber}`);
      }

      const signJson = (await signResponse.json()) as unknown;
      const signParsed = MultipartSignResponseSchema.safeParse(signJson);
      if (!signParsed.success) {
        throw new Error(`Invalid multipart sign response for part ${partNumber}`);
      }

      const etag = await new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", signParsed.data.uploadUrl, true);

        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            return;
          }

          onPartProgress?.(event.loaded);
        };

        request.onerror = () => {
          reject(new Error(`Failed to upload part ${partNumber}`));
        };

        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            reject(new Error(`Failed to upload part ${partNumber}`));
            return;
          }

          const headerEtag = normalizeEtag(request.getResponseHeader("etag"));
          if (!headerEtag) {
            reject(new Error(`Missing ETag for part ${partNumber}`));
            return;
          }

          onPartProgress?.(body.size);
          resolve(headerEtag);
        };

        request.send(body);
      });

      if (!etag) {
        throw new Error(`Missing ETag for part ${partNumber}`);
      }

      return { partNumber, etag };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Multipart upload failed for part ${partNumber}`);
}

export async function uploadFileViaMultipart(
  assetId: string,
  file: File,
  options: MultipartUploadOptions = {}
): Promise<void> {
  const requestedPartSize = options.partSize ?? DEFAULT_PART_SIZE;
  const partSize = Math.max(DEFAULT_PART_SIZE, requestedPartSize);
  const concurrency = Math.min(6, Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY));
  const retries = Math.max(1, options.retries ?? DEFAULT_RETRIES);
  const onProgress = options.onProgress;

  onProgress?.(0);

  const initResponse = await fetch(`/api/assets/${encodeURIComponent(assetId)}/multipart/init`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contentType: file.type || "application/octet-stream",
      ...(options.videoMetadata ? { videoMetadata: options.videoMetadata } : {}),
    }),
  });

  if (!initResponse.ok) {
    throw new Error("Failed to initialize multipart upload");
  }

  const initJson = (await initResponse.json()) as unknown;
  const initParsed = MultipartInitResponseSchema.safeParse(initJson);
  if (!initParsed.success) {
    throw new Error("Invalid multipart init response");
  }

  const uploadId = initParsed.data.uploadId;
  const totalParts = Math.ceil(file.size / partSize);
  const completed: MultipartPart[] = [];
  let nextPart = 1;
  let confirmedUploadedBytes = 0;
  const inFlightPartBytes = new Map<number, number>();

  const emitProgress = () => {
    const activeUploadedBytes = Array.from(inFlightPartBytes.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    const denominator = Math.max(file.size, 1);
    const progress = Math.min(1, (confirmedUploadedBytes + activeUploadedBytes) / denominator);
    onProgress?.(progress);
  };

  const worker = async () => {
    while (true) {
      const partNumber = nextPart;
      nextPart += 1;
      if (partNumber > totalParts) {
        return;
      }

      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const body = file.slice(start, end);
      const result = await uploadOnePart(assetId, uploadId, partNumber, body, retries, (loaded) => {
        inFlightPartBytes.set(partNumber, loaded);
        emitProgress();
      });
      inFlightPartBytes.delete(partNumber);
      confirmedUploadedBytes += body.size;
      emitProgress();
      completed.push(result);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, totalParts) }, () => worker()));

    const completePayload = MultipartCompleteInputSchema.parse({
      uploadId,
      parts: completed.sort((a, b) => a.partNumber - b.partNumber),
    });

    const completeResponse = await fetch(
      `/api/assets/${encodeURIComponent(assetId)}/multipart/complete`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(completePayload),
      }
    );

    if (!completeResponse.ok) {
      throw new Error("Failed to complete multipart upload");
    }

    onProgress?.(1);
  } catch (error) {
    try {
      const abortResponse = await fetch(
        `/api/assets/${encodeURIComponent(assetId)}/multipart/abort`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ uploadId }),
        }
      );

      if (abortResponse.ok) {
        const abortJson = (await abortResponse.json()) as unknown;
        MultipartAbortResponseSchema.safeParse(abortJson);
      }
    } catch {
      // best effort cleanup
    }

    throw error instanceof Error ? error : new Error("Multipart upload failed");
  }
}
