import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { sanitizeNextPath } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  config: "Auth provider is not configured yet.",
  oauth: "Sign-in was canceled or failed.",
  token: "We could not complete sign-in. Please try again."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const errorMessage = params.error ? errorMessages[params.error] : undefined;

  return (
    <section className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in with Cognito Hosted UI using your Google account.
      </p>

      {errorMessage ? (
        <p className="mt-4 rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className={buttonVariants({ variant: "default" })}>
          Continue with Google
        </Link>
        <Link href="/auth/logout" className={buttonVariants({ variant: "outline" })}>
          Sign out
        </Link>
      </div>
    </section>
  );
}
