"use client";

import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";

export function ReleaseListActions() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Link
        aria-label="Create release"
        className={buttonVariants()}
        href="/releases/new"
        title="Create release"
      >
        <Plus className="h-5 w-5" />
        <span className="sr-only">Create release</span>
      </Link>
      <Button
        onClick={() => router.refresh()}
        title="Refresh releases"
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Refresh releases</span>
      </Button>
    </div>
  );
}
