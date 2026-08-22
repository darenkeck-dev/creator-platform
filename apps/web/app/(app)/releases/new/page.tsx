import { ReleaseCreateForm } from "@/components/release-create-form";

export default function NewReleasePage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">New release</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Start with the record</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Create the draft metadata first. Cover art, audio, ordering, links, and publishing live in the release workspace.
        </p>
      </header>
      <ReleaseCreateForm />
    </section>
  );
}
