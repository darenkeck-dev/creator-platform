import {
  AssetListResponseSchema,
  type AssetListResponse,
} from "@media-manager/contracts";
import Link from "next/link";
import { headers } from "next/headers";

async function fetchAssets(): Promise<AssetListResponse["assets"]> {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return [];
  }

  const response = await fetch(`${protocol}://${host}/api/assets`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load assets");
  }

  const json = (await response.json()) as unknown;
  const parsed = AssetListResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error("Asset list response failed validation");
  }

  const data: AssetListResponse = parsed.data;
  return data.assets;
}

export default async function LibraryPage() {
  const assets = await fetchAssets();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placeholder media list for metadata, tags, and stream readiness.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <Link key={asset.id} href={`/asset/${asset.id}`}>
            <article className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{asset.type}</p>
              <h2 className="mt-2 text-base font-medium">{asset.title}</h2>
              <p className="mt-3 text-xs text-muted-foreground">ID: {asset.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status: {asset.status}</p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
