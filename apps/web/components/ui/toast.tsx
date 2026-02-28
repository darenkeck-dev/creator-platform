import { cn } from "@/lib/utils";

type ToastProps = {
  open: boolean;
  title: string;
  description?: string;
  variant?: "success" | "error";
};

export function Toast({ open, title, description, variant = "success" }: ToastProps) {
  if (!open) {
    return null;
  }

  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-50 w-[min(92vw,24rem)] rounded-lg border px-4 py-3 shadow-lg",
        isError
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
    </div>
  );
}
