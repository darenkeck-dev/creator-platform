import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const stage = (process.env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
const defaultTableName = stage === "prod" ? "Assets" : `Assets-${stage}`;
const tableName = process.env.ASSETS_TABLE_NAME ?? defaultTableName;
const apply = process.argv.includes("--apply");
const confirmProduction = process.argv.includes("--confirm-production");
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type ReviewKey = {
  pk: string;
  sk: string;
  targetType?: string;
  targetId?: string;
  reviewSource?: string;
};

async function listReviewKeys(): Promise<ReviewKey[]> {
  const reviews: ReviewKey[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":prefix": "TONE_REVIEW#" },
        ProjectionExpression: "pk, sk, targetType, targetId, reviewSource",
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    reviews.push(
      ...(result.Items ?? []).flatMap((item) =>
        typeof item.pk === "string" && typeof item.sk === "string" ? [item as ReviewKey] : []
      )
    );
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return reviews;
}

async function deleteReviews(reviews: ReviewKey[]): Promise<void> {
  for (let index = 0; index < reviews.length; index += 25) {
    let requests = reviews.slice(index, index + 25).map((review) => ({
      DeleteRequest: { Key: { pk: review.pk, sk: review.sk } },
    }));

    do {
      const result = await db.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: requests },
        })
      );
      requests = (result.UnprocessedItems?.[tableName] ?? []).flatMap((request) => {
        const key = request.DeleteRequest?.Key;
        return typeof key?.pk === "string" && typeof key.sk === "string"
          ? [{ DeleteRequest: { Key: { pk: key.pk, sk: key.sk } } }]
          : [];
      });
    } while (requests.length > 0);
  }
}

async function clearMaterializedAdjustments(reviews: ReviewKey[]): Promise<void> {
  const assetIds = [
    ...new Set(
      reviews.flatMap((review) =>
        (review.targetType === "audio" || review.targetType === "video") && review.targetId
          ? [review.targetId]
          : []
      )
    ),
  ];

  for (const assetId of assetIds) {
    try {
      await db.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { pk: `ASSET#${assetId}`, sk: "META" },
          UpdateExpression: "REMOVE toneAnalysis.adjustedScores, toneAnalysis.scoreAdjustment",
          ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
        })
      );
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        continue;
      }
      throw error;
    }
  }
}

function summarize(reviews: ReviewKey[], key: "targetType" | "reviewSource") {
  return Object.fromEntries(
    [...new Set(reviews.map((review) => review[key] ?? "unknown"))]
      .sort()
      .map((value) => [
        value,
        reviews.filter((review) => (review[key] ?? "unknown") === value).length,
      ])
  );
}

async function main() {
  const reviews = await listReviewKeys();
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        stage,
        tableName,
        reviewCount: reviews.length,
        byTargetType: summarize(reviews, "targetType"),
        byReviewSource: summarize(reviews, "reviewSource"),
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log("Dry run only. Pass --apply to permanently delete these review records.");
    return;
  }

  if ((stage === "prod" || tableName === "Assets") && !confirmProduction) {
    throw new Error("Production deletion requires --confirm-production in addition to --apply.");
  }

  await clearMaterializedAdjustments(reviews);
  await deleteReviews(reviews);
  console.log(`Deleted ${reviews.length} tone review records from ${tableName}.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
