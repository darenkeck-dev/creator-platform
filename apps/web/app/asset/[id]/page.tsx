import {
  AssetDetailResponseSchema,
  AssetIdParamSchema,
  type AssetDetailResponse
} from "@media-manager/contracts";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

type AssetPageProps = {
  params: Promise<{ id: string }>;
};

async function fetchAssetById(id: string): Promise<AssetDetailResponse["asset"] | null> {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return null;
  }

  const response = await fetch(`${protocol}://${host}/api/assets/${id}`, {
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load asset ${id}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetDetailResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error("Asset response failed validation");
  }

  const data: AssetDetailResponse = parsed.data;
  return data.asset;
}

export default async function AssetDetailPage({ params }: AssetPageProps) {
  const parsedParams = AssetIdParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }

  const asset = await fetchAssetById(parsedParams.data.id);

  if (!asset) {
    notFound();
  }

  const streamReady = asset.status === "ready" && asset.stream?.hlsMasterUrl;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{asset.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{asset.description}</p>
      </header>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Asset ID</dt>
            <dd className="font-medium">{asset.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-medium capitalize">{asset.type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{asset.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="font-medium">{asset.ownerEmail}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Original</dt>
            <dd className="font-medium">
              s3://{asset.original.bucket}/{asset.original.key}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Tags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {asset.tags.map((tag) => {
            const key = `${tag.facet ?? "free"}:${tag.value}`;
            return (
              <span key={key} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {tag.facet ? `${tag.facet}: ${tag.value}` : tag.value}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Streaming</h2>
        {streamReady ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">HLS Master</dt>
              <dd className="font-medium">{asset.stream?.hlsMasterUrl}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Poster</dt>
              <dd className="font-medium">{asset.stream?.posterUrl ?? "N/A"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Stream outputs are not ready yet. Current asset status is {asset.status}.
          </p>
        )}
      </div>
    </section>
  );
}
