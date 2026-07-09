"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type BreadcrumbAsset = {
  id: string;
  title: string;
  containerId?: string;
};

type ResolvedBreadcrumbs = {
  folders: BreadcrumbAsset[];
  assetTitle?: string;
};

function formatSegment(segment: string) {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [resolved, setResolved] = useState<ResolvedBreadcrumbs>({ folders: [] });
  const segments = pathname.split("/").filter(Boolean);

  const assetId = segments[0] === "asset" && segments[1] ? segments[1] : undefined;
  const containerId = searchParams.get("containerId")?.trim() || undefined;

  useEffect(() => {
    let cancelled = false;

    async function fetchAsset(id: string): Promise<BreadcrumbAsset | null> {
      try {
        const response = await fetch(`/api/assets/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return null;
        }
        const json = (await response.json()) as {
          asset?: { id?: unknown; title?: unknown; containerId?: unknown };
        };
        if (typeof json.asset?.id !== "string" || typeof json.asset.title !== "string") {
          return null;
        }
        return {
          id: json.asset.id,
          title: json.asset.title,
          containerId:
            typeof json.asset.containerId === "string" ? json.asset.containerId : undefined,
        };
      } catch {
        return null;
      }
    }

    async function resolveFolderChain(id: string | undefined): Promise<BreadcrumbAsset[]> {
      const chain: BreadcrumbAsset[] = [];
      const seen = new Set<string>();
      let currentId = id;

      while (currentId && !seen.has(currentId) && chain.length < 20) {
        seen.add(currentId);
        const asset = await fetchAsset(currentId);
        if (!asset) {
          break;
        }
        chain.unshift(asset);
        currentId = asset.containerId;
      }

      return chain;
    }

    async function loadBreadcrumbs() {
      if (assetId) {
        const asset = await fetchAsset(assetId);
        const folders = await resolveFolderChain(asset?.containerId);
        if (!cancelled) {
          setResolved({ folders, assetTitle: asset?.title });
        }
        return;
      }

      const folders = await resolveFolderChain(containerId);
      if (cancelled) {
        return;
      }
      setResolved({ folders });
    }

    void loadBreadcrumbs();

    return () => {
      cancelled = true;
    };
  }, [assetId, containerId]);

  if (segments.length === 0) {
    return null;
  }

  const allCrumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;
    const isAssetId = segments[index - 1] === "asset";

    return {
      href,
      label: isAssetId ? resolved.assetTitle ?? formatSegment(segment) : formatSegment(segment),
      isLast,
    };
  });

  const crumbs = allCrumbs.filter((crumb) => {
    return crumb.href !== "/library" && crumb.href !== "/asset";
  });

  return (
    <nav aria-label="Breadcrumb" className="border-b bg-muted/40">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2 text-sm text-muted-foreground sm:px-6">
        <Link href="/library" className="font-medium text-foreground hover:text-foreground/80">
          Library
        </Link>
        {resolved.folders.map((folder, index) => {
          const isLastFolder = !assetId && segments[0] === "library" && index === resolved.folders.length - 1;
          return (
            <span key={folder.id} className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              {isLastFolder ? (
                <span className="font-medium text-foreground">{folder.title}</span>
              ) : (
                <Link
                  className="hover:text-foreground"
                  href={`/library?containerId=${encodeURIComponent(folder.id)}`}
                >
                  {folder.title}
                </Link>
              )}
            </span>
          );
        })}
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            {crumb.isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
