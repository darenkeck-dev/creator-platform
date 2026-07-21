import {
  AssetToneAnalysisScoresSchema,
  ToneReviewResponseSchema,
  type AssetToneAnalysisScores,
  type AssetToneScoreAdjustment,
} from "@media-manager/contracts";
import { combineModelAndCuratorScores } from "@media-manager/tone-core";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

const AdjustableAssetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["audio", "video"]),
  toneAnalysis: z.object({
    toneTaxonomyVersion: z.enum(["tone-taxonomy/v1", "tone-taxonomy/v2"]),
    scores: AssetToneAnalysisScoresSchema,
    scoreAdjustment: z.object({ computedAt: z.string().datetime() }).optional(),
  }),
});

type MaterializeCuratorToneAdjustmentInput = {
  db: DynamoDBDocumentClient;
  tableName: string;
  assetId: string;
};

export async function materializeCuratorToneAdjustment({
  db,
  tableName,
  assetId,
}: MaterializeCuratorToneAdjustmentInput): Promise<{
  adjustedScores?: AssetToneAnalysisScores;
  scoreAdjustment?: AssetToneScoreAdjustment;
}> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await materializeCuratorToneAdjustmentAttempt({ db, tableName, assetId });
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException) || attempt >= 4) {
        throw error;
      }
    }
  }
}

async function materializeCuratorToneAdjustmentAttempt({
  db,
  tableName,
  assetId,
}: MaterializeCuratorToneAdjustmentInput): Promise<{
  adjustedScores?: AssetToneAnalysisScores;
  scoreAdjustment?: AssetToneScoreAdjustment;
}> {
  const assetResult = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: `ASSET#${assetId}`, sk: "META" },
      ConsistentRead: true,
    })
  );
  const parsedAsset = AdjustableAssetSchema.safeParse(assetResult.Item);
  if (!parsedAsset.success) {
    return {};
  }

  const reviews = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `TONE_REVIEW#${parsedAsset.data.type}#${assetId}`,
        },
        ExclusiveStartKey: lastEvaluatedKey,
        ConsistentRead: true,
      })
    );
    reviews.push(
      ...(result.Items ?? []).flatMap((item) => {
        const parsed = ToneReviewResponseSchema.shape.review.safeParse(item);
        return parsed.success &&
          parsed.data.reviewSource === "curator" &&
          parsed.data.taxonomyVersion === parsedAsset.data.toneAnalysis.toneTaxonomyVersion &&
          parsed.data.scores
          ? [parsed.data]
          : [];
      })
    );
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  const combined = combineModelAndCuratorScores(
    parsedAsset.data.toneAnalysis.scores,
    reviews.map((review) => review.scores ?? {})
  );
  const hasAdjustedScores = Object.keys(combined.adjustedScores).length > 0;
  const now = new Date().toISOString();
  const expectedComputedAt = parsedAsset.data.toneAnalysis.scoreAdjustment?.computedAt;
  const adjustmentCondition = expectedComputedAt
    ? "toneAnalysis.scoreAdjustment.computedAt = :expectedComputedAt"
    : "attribute_not_exists(toneAnalysis.scoreAdjustment)";
  const conditionExpression =
    "attribute_exists(pk) AND attribute_exists(sk) AND toneAnalysis.scores = :modelScores AND toneAnalysis.toneTaxonomyVersion = :taxonomyVersion AND " +
    adjustmentCondition;
  const conditionValues = {
    ":modelScores": parsedAsset.data.toneAnalysis.scores,
    ":taxonomyVersion": parsedAsset.data.toneAnalysis.toneTaxonomyVersion,
    ...(expectedComputedAt ? { ":expectedComputedAt": expectedComputedAt } : {}),
  };

  if (!hasAdjustedScores) {
    await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: `ASSET#${assetId}`, sk: "META" },
        UpdateExpression: "REMOVE toneAnalysis.adjustedScores, toneAnalysis.scoreAdjustment",
        ConditionExpression: conditionExpression,
        ExpressionAttributeValues: conditionValues,
      })
    );
    return {};
  }

  const scoreAdjustment = {
    schemaVersion: "tone-score-adjustment/v1" as const,
    algorithm: "model-prior-mean/v1" as const,
    modelWeight: 1 as const,
    curatorReviewCount: combined.curatorReviewCount,
    dimensions: combined.dimensions,
    computedAt: now,
    latestReviewAt: reviews.reduce(
      (latest, review) => (review.createdAt > latest ? review.createdAt : latest),
      reviews[0]!.createdAt
    ),
  } satisfies AssetToneScoreAdjustment;

  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk: `ASSET#${assetId}`, sk: "META" },
      UpdateExpression:
        "SET toneAnalysis.adjustedScores = :adjustedScores, toneAnalysis.scoreAdjustment = :scoreAdjustment, updatedAt = :updatedAt",
      ConditionExpression: conditionExpression,
      ExpressionAttributeValues: {
        ...conditionValues,
        ":adjustedScores": combined.adjustedScores,
        ":scoreAdjustment": scoreAdjustment,
        ":updatedAt": now,
      },
    })
  );

  return { adjustedScores: combined.adjustedScores, scoreAdjustment };
}
