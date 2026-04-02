import Link from "next/link";

import { ComboCreateForm } from "@/components/combo-create-form";
import { ComboManagementList } from "@/components/combo-management-list";
import { fetchAssetByIdFromApi, listCombosFromApi } from "@/lib/assets-api";

export default async function CombosPage() {
  const [combos] = await Promise.all([listCombosFromApi()]);

  const comboItems = await Promise.all(
    combos.map(async (combo) => {
      const [videoAsset, audioAsset] = await Promise.all([
        fetchAssetByIdFromApi(combo.videoAssetId),
        fetchAssetByIdFromApi(combo.audioAssetId),
      ]);

      return {
        id: combo.id,
        videoAssetId: combo.videoAssetId,
        audioAssetId: combo.audioAssetId,
        videoTitle: videoAsset?.title ?? combo.videoAssetId,
        audioTitle: audioAsset?.title ?? combo.audioAssetId,
        score: combo.score,
        upvotes: combo.upvotes,
        downvotes: combo.downvotes,
        thumbnailUrl: videoAsset?.stream?.posterUrl,
      };
    })
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Combinations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pair video and audio for preview. Saved combos are listed below.
        </p>
      </header>

      <ComboCreateForm />

      <ComboManagementList items={comboItems} />

      <p className="text-xs text-muted-foreground">
        Voting is disabled in the media management UI. Use your client app for combo voting.
      </p>

      <p className="text-xs text-muted-foreground">
        Preview route:{" "}
        <Link className="underline" href="/combos/preview">
          /combos/preview
        </Link>{" "}
        with `videoAssetId` and `audioAssetId` query params.
      </p>
    </section>
  );
}
