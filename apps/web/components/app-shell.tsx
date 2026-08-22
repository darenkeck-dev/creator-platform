import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JobStatusProvider } from "@/components/job-status-provider";
import { LogoutButton } from "@/components/logout-button";
import { ReviewNavLink } from "@/components/review-nav-link";
import { buttonVariants } from "@/components/ui/button";

const navItems = [
  { href: "/review", label: "Review" },
  { href: "/combos", label: "Combos" },
  { href: "/releases", label: "Releases" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <JobStatusProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/library" className="text-base font-semibold tracking-tight">
            Media Manager
          </Link>
          <nav className="flex items-center gap-2">
            <ReviewNavLink />
            {navItems
              .filter((item) => item.href !== "/review")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  {item.label}
                </Link>
              ))}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <Suspense fallback={null}>
        <Breadcrumbs />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </JobStatusProvider>
  );
}
