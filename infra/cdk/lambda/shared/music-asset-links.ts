import { QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export async function getMusicAssetLinks(params: {
  db: DynamoDBDocumentClient;
  tableName: string;
  assetId: string;
}): Promise<Array<{ sk: string; publicationStatus?: string }>> {
  const items: Array<Record<string, unknown>> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await params.db.send(
      new QueryCommand({
        TableName: params.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :music)",
        ExpressionAttributeValues: {
          ":pk": `ASSET#${params.assetId}`,
          ":music": "MUSIC_",
        },
        ProjectionExpression: "sk, publicationStatus",
        ConsistentRead: true,
        Limit: 90 - items.length,
        ExclusiveStartKey: cursor,
      })
    );
    items.push(...(result.Items ?? []));
    if (items.length >= 90 && result.LastEvaluatedKey)
      throw new Error("Music asset link limit exceeded");
    cursor = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  return items.flatMap((item) =>
    typeof item.sk === "string" && item.sk.startsWith("MUSIC_")
      ? [{ sk: item.sk, publicationStatus: item.publicationStatus as string | undefined }]
      : []
  );
}
