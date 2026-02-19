"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function formatSegment(segment: string) {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const allCrumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;

    return {
      href,
      label: formatSegment(segment),
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
