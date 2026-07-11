"use client";

import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";

export function ReviewNavLink() {
  const router = useRouter();

  return (
    <button
      className={buttonVariants({ variant: "ghost", size: "sm" })}
      onClick={() => {
        window.dispatchEvent(new Event("review:next-loading"));
        router.push(`/review?next=${Date.now()}`);
        router.refresh();
      }}
      type="button"
    >
      Review
    </button>
  );
}
