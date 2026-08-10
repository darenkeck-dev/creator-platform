import { useEffect } from "react";

import resumeMarkdown from "../../.generated-content/content/resume.md?raw";
import { setPageMetadata } from "../lib/page-metadata";
import { DocumentMarkdown } from "./DocumentMarkdown";
import { DocumentShell } from "./DocumentShell";

export function DevPage() {
  useEffect(() => {
    setPageMetadata({
      title: "Daren Keck / Resume",
      description: "Resume for Daren Keck, senior software engineer.",
      url: "https://darenkeck.com/dev",
    });
  }, []);

  return (
    <DocumentShell
      breadcrumbs={[{ label: "darenkeck", to: "/" }, { label: "resume" }]}
      className="resume-document"
      trailingAction={
        <a
          className="inline-flex rounded-full border px-4 py-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
          data-resume-controls
          download
          href="/daren-keck-resume.pdf"
        >
          Download
        </a>
      }
    >
      <DocumentMarkdown>{resumeMarkdown}</DocumentMarkdown>
    </DocumentShell>
  );
}
