export class UpstreamApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
    fallback: string
  ) {
    super(
      typeof payload === "object" && payload && "message" in payload &&
        typeof payload.message === "string"
        ? payload.message
        : fallback
    );
  }
}

export async function throwUpstreamApiError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => ({ message: fallback }));
  throw new UpstreamApiError(response.status, payload, fallback);
}
