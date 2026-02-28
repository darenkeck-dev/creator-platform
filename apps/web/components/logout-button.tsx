"use client";

import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

export function LogoutButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonVariants({ variant: "ghost", size: "sm" })} onClick={() => setIsOpen(true)}>
        Logout
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Sign out?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You will be signed out from this app and the Cognito Hosted UI session.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => (window.location.href = "/auth/logout")}>Logout</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
