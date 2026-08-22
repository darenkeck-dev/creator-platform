"use client";

import type { JobRecord } from "@media-manager/contracts";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type JobStatusContextValue = {
  trackJob: (job: JobRecord) => void;
};

const JobStatusContext = createContext<JobStatusContextValue | null>(null);
const STORAGE_KEY = "media-manager-active-jobs";

function isActive(status: JobRecord["status"]): boolean {
  return status === "queued" || status === "running";
}

function jobLabel(type: JobRecord["type"]): string {
  if (type === "delete_assets") {
    return "Deleting";
  }
  if (type === "reprocess_tone") {
    return "Queueing tone";
  }
  if (type === "reprocess_conversion") {
    return "Queueing conversion";
  }
  return "Processing";
}

export function useJobStatus() {
  const value = useContext(JobStatusContext);
  if (!value) {
    throw new Error("useJobStatus must be used inside JobStatusProvider");
  }
  return value;
}

export function JobStatusProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const activeJobs = jobs.filter((job) => isActive(job.status));
  const latestJob = jobs[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const ids = JSON.parse(raw) as unknown;
        if (Array.isArray(ids)) {
          setJobs(
            ids
              .filter((id): id is string => typeof id === "string" && id.length > 0)
              .map((id) => ({
                id,
                schemaVersion: 1,
                ownerEmail: "pending@example.com",
                type: "delete_assets",
                status: "queued",
                target: { assetIds: [id], includeDescendants: true },
                options: {},
                totalItems: 0,
                completedItems: 0,
                failedItems: 0,
                skippedItems: 0,
                message: "Restoring job status",
                failures: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }))
          );
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const ids = jobs.filter((job) => isActive(job.status)).map((job) => job.id);
    if (ids.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [jobs]);

  useEffect(() => {
    if (activeJobs.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      for (const job of activeJobs) {
        void fetch(`/api/jobs/${encodeURIComponent(job.id)}`, { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok) {
              return;
            }
            const nextJob = ((await response.json()) as { job?: JobRecord }).job;
            if (!nextJob) {
              return;
            }
            setJobs((previous) => {
              const next = previous.filter((item) => item.id !== nextJob.id);
              return [nextJob, ...next];
            });
            if (!isActive(nextJob.status)) {
              router.refresh();
            }
          })
          .catch(() => undefined);
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [activeJobs, router]);

  const value = useMemo<JobStatusContextValue>(
    () => ({
      trackJob(job) {
        setJobs((previous) => {
          const next = previous.filter((item) => item.id !== job.id);
          return [job, ...next];
        });
      },
    }),
    []
  );

  const visibleJob = latestJob && (isActive(latestJob.status) || latestJob.status !== "completed") ? latestJob : null;
  const percent = visibleJob?.totalItems
    ? Math.min(100, Math.round((visibleJob.completedItems / visibleJob.totalItems) * 100))
    : 0;

  return (
    <JobStatusContext.Provider value={value}>
      {children}
      {visibleJob ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {jobLabel(visibleJob.type)} {visibleJob.completedItems}/{visibleJob.totalItems || "..."} items
              </p>
              <p className="truncate text-xs text-muted-foreground">{visibleJob.message}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:w-64">
              <div
                className={`h-full transition-all ${
                  visibleJob.status === "failed" || visibleJob.status === "completed_with_errors"
                    ? "bg-destructive"
                    : "bg-green-500"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </JobStatusContext.Provider>
  );
}
