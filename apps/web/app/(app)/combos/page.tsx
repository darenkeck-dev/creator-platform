import Link from "next/link";

import { fetchAssetByIdFromApi, listToneReviewsFromApi } from "@/lib/assets-api";

async function safeAssetTitle(id: string | undefined, fallback: string) {
  if (!id) {
    return fallback;
  }

  try {
    const asset = await fetchAssetByIdFromApi(id);
    return asset?.title ?? id;
  } catch {
    return id;
  }
}

export default async function CombosPage() {
  const reviewed = await listToneReviewsFromApi({ targetType: "combo", limit: 50 });

  const reviewItems = await Promise.all(
    reviewed.reviews.map(async (review) => {
      const [videoTitle, audioTitle] = await Promise.all([
        safeAssetTitle(review.sourceVideoAssetId, "Video"),
        safeAssetTitle(review.sourceAudioAssetId, "Audio"),
      ]);

      return {
        review,
        label: `${videoTitle} + ${audioTitle}`,
      };
    })
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Combo Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse human tone reviews captured for video and audio combinations.
        </p>
      </header>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="space-y-2">
          {reviewItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No combo reviews yet.</p>
          ) : null}
          {reviewItems.map(({ review, label }) => (
            <Link
              className="block rounded-lg border px-3 py-2 text-sm transition hover:bg-muted"
              href={
                review.sourceVideoAssetId && review.sourceAudioAssetId
                  ? `/review?targetType=combo&comboId=${encodeURIComponent(review.targetId)}&videoAssetId=${encodeURIComponent(review.sourceVideoAssetId)}&audioAssetId=${encodeURIComponent(review.sourceAudioAssetId)}`
                  : `/review?targetType=combo&comboId=${encodeURIComponent(review.targetId)}`
              }
              key={review.id}
            >
              <span className="block font-medium">{label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleString()}
              </span>
              {review.keywords.length > 0 ? (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {review.keywords.map((keyword) => (
                    <span className="rounded-full border px-2 py-0.5 text-xs" key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      <Link className="text-sm underline" href="/review?targetType=combo">
        Review a random combo
      </Link>
    </section>
  );
}
