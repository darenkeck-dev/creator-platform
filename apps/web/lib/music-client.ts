type Schema<T> = {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: unknown } };
};

export class MusicClientError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown
  ) {
    super(musicErrorMessage(payload, `Request failed (${status})`));
  }
}

export function musicErrorMessage(payload: unknown, fallback = "Request failed"): string {
  if (typeof payload === "object" && payload && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export async function musicRequest<T>(
  path: string,
  schema: Schema<T>,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api/music/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) throw new MusicClientError(response.status, payload);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("Music response failed validation");
  return parsed.data;
}
