import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Phase 2 will wire this page to Cognito Hosted UI and Google SSO.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/library" className={buttonVariants({ variant: "default" })}>
          Continue to Library
        </Link>
        <Link href="/upload" className={buttonVariants({ variant: "outline" })}>
          Go to Upload
        </Link>
      </div>
    </section>
  );
}
