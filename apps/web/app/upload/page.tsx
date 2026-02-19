import { Button } from "@/components/ui/button";

export default function UploadPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placeholder for direct S3 upload URL + multipart upload flow.
        </p>
      </header>

      <form className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <label className="block text-sm font-medium" htmlFor="asset-title">
          Asset title
        </label>
        <input
          id="asset-title"
          type="text"
          placeholder="Summer campaign b-roll"
          className="w-full rounded-md border bg-card px-3 py-2 text-sm"
        />
        <label className="block text-sm font-medium" htmlFor="asset-file">
          Media file
        </label>
        <input
          id="asset-file"
          type="file"
          className="w-full rounded-md border bg-card px-3 py-2 text-sm"
        />
        <Button type="button">Generate upload URL</Button>
      </form>
    </section>
  );
}
