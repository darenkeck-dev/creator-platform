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
    >
      <div className="relative" data-resume-content>
        <a
          className="absolute right-0 top-5 inline-flex -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs transition max-[359px]:px-2 max-[359px]:text-[11px] sm:top-6 sm:px-4 sm:text-sm print:hidden"
          data-resume-controls
          download
          href="/daren-keck-resume.pdf"
        >
          Download
        </a>
        <DocumentMarkdown>{resumeMarkdown}</DocumentMarkdown>
      </div>
    </DocumentShell>
  );
}
