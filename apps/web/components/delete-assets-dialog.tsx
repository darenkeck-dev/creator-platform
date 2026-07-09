"use client";

import type { JobPreview, JobRecord } from "@media-manager/contracts";
import { useState } from "react";

import { useJobStatus } from "@/components/job-status-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  assetIds: string[];
  disabled?: boolean;
  label?: string;
  onJobCreated?: (job: JobRecord) => void;
};

function countLabel(preview: JobPreview): string {
  const parts = [
    `${preview.summary.totalItems} total`,
    `${preview.summary.folders} folders`,
    `${preview.summary.audio} audio`,
    `${preview.summary.video} video`,
    `${preview.summary.images} images`,
  ];
  return parts.join(" · ");
}

function previewDepth(path: string): number {
  return Math.max(0, path.split(" / ").length - 2);
}

export function DeleteAssetsDialog({ assetIds, disabled, label = "Delete", onJobCreated }: Props) {
  const { trackJob } = useJobStatus();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPreview() {
    if (assetIds.length === 0 || loadingPreview) {
      return;
    }
    setOpen(true);
    setLoadingPreview(true);
    setMessage(null);
    setPreview(null);

    try {
      const response = await fetch("/api/jobs/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "delete_assets",
          target: { assetIds, includeDescendants: true },
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to load delete preview.");
      }
      const payload = (await response.json()) as { preview: JobPreview };
      setPreview(payload.preview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load delete preview.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function createDeleteJob() {
    if (!preview || creatingJob) {
      return;
    }
    setCreatingJob(true);
    setMessage(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: preview.type,
          target: preview.target,
          confirmationToken: preview.confirmationToken,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to start delete job.");
      }
      const payload = (await response.json()) as { job: JobRecord };
      trackJob(payload.job);
      onJobCreated?.(payload.job);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start delete job.");
    } finally {
      setCreatingJob(false);
    }
  }

  return (
    <>
      <Button
        disabled={disabled || assetIds.length === 0 || loadingPreview}
        onClick={() => void loadPreview()}
        type="button"
        variant="destructive"
      >
        {loadingPreview ? "Preparing..." : label}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected items. Folders include everything inside them.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? <p className="text-sm text-muted-foreground">Loading delete preview...</p> : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          {preview ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{countLabel(preview)}</p>
              <div className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3">
                <ul className="space-y-2 text-sm">
                  {preview.items.map((item) => (
                    <li key={item.id} style={{ paddingLeft: `${previewDepth(item.path) * 1.25}rem` }}>
                      <span className="font-medium">{item.title}</span>{" "}
                      <span className="text-xs uppercase text-muted-foreground">{item.type}</span>
                      {item.type !== "folder" ? (
                        <p className="truncate text-xs text-muted-foreground">{item.path}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button disabled={creatingJob} onClick={() => setOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={!preview || creatingJob}
              onClick={() => void createDeleteJob()}
              type="button"
              variant="destructive"
            >
              {creatingJob ? "Starting..." : "Delete Everything Listed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
