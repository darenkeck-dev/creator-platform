"use client";

import {
  PROCESSING_PROFILE_METADATA,
  type JobPreview,
  type JobRecord,
  type JobType,
  type ProcessingProfile,
} from "@media-manager/contracts";
import { RefreshCw } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  assetIds: string[];
  type: Extract<JobType, "reprocess_tone" | "reprocess_conversion">;
  onJobCreated?: (job: JobRecord) => void;
};

function labels(type: Props["type"]) {
  return type === "reprocess_tone"
    ? {
        button: "Reprocess Tone",
        title: "Reprocess Tone",
        description: "Queues tone analysis for selected audio and video assets. Folders are scanned for supported assets.",
        starting: "Starting tone job...",
      }
    : {
        button: "Reprocess Conversion",
        title: "Reprocess Conversion",
        description: "Queues media conversion for selected compatible assets. Folders are scanned for supported assets.",
        starting: "Starting conversion job...",
      };
}

function previewDepth(path: string): number {
  return Math.max(0, path.split(" / ").length - 2);
}

function visiblePreviewItems(preview: JobPreview) {
  return preview.items.filter((item) => item.actionStatus !== "skipped" || item.type === "folder");
}

function queueableCount(preview: JobPreview) {
  return preview.items.filter((item) => item.actionStatus === "processable").length;
}

export function ReprocessAssetsDialog({ assetIds, type, onJobCreated }: Props) {
  const copy = labels(type);
  const { trackJob } = useJobStatus();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [processingProfile, setProcessingProfile] = useState<ProcessingProfile>("video-standard-v1");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const options = type === "reprocess_conversion" ? { processingProfile } : {};

  async function loadPreview() {
    if (assetIds.length === 0 || loadingPreview) return;
    setOpen(true);
    setLoadingPreview(true);
    setPreview(null);
    setMessage(null);
    try {
      const response = await fetch("/api/jobs/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, target: { assetIds, includeDescendants: true }, options }),
      });
      if (!response.ok) throw new Error("Failed to load job preview.");
      const payload = (await response.json()) as { preview: JobPreview };
      setPreview(payload.preview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load job preview.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function createJob() {
    if (!preview || creatingJob) return;
    setCreatingJob(true);
    setMessage(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: preview.type,
          target: preview.target,
          options: preview.options,
          confirmationToken: preview.confirmationToken,
        }),
      });
      if (!response.ok) throw new Error("Failed to start job.");
      const payload = (await response.json()) as { job: JobRecord };
      trackJob(payload.job);
      onJobCreated?.(payload.job);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start job.");
    } finally {
      setCreatingJob(false);
    }
  }

  return (
    <>
      <Button disabled={assetIds.length === 0 || loadingPreview} onClick={() => void loadPreview()} type="button" variant="outline">
        <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
        {loadingPreview ? "Preparing..." : copy.button}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {type === "reprocess_conversion" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="processing-profile">Processing profile</label>
              <Select
                onValueChange={(value) => {
                  setProcessingProfile(value as ProcessingProfile);
                  setPreview(null);
                }}
                value={processingProfile}
              >
                <SelectTrigger id="processing-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCESSING_PROFILE_METADATA.filter((profile) => profile.id !== "folder-meta-v1").map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>{profile.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={loadingPreview} onClick={() => void loadPreview()} type="button" variant="secondary">
                Refresh preview
              </Button>
            </div>
          ) : null}

          {loadingPreview ? <p className="text-sm text-muted-foreground">Loading preview...</p> : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          {preview ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {queueableCount(preview)} assets will be queued
              </p>
              <div className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3">
                <ul className="space-y-2 text-sm">
                  {visiblePreviewItems(preview).map((item) => (
                    <li
                      className={item.actionStatus === "container" ? "text-muted-foreground" : undefined}
                      key={item.id}
                      style={{ paddingLeft: `${previewDepth(item.path) * 1.25}rem` }}
                    >
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
            <Button disabled={creatingJob} onClick={() => setOpen(false)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={!preview || creatingJob || queueableCount(preview) === 0} onClick={() => void createJob()} type="button">
              {creatingJob ? copy.starting : "Start Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
