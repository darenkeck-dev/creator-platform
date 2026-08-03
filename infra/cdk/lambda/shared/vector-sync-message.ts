import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export async function enqueueVectorSyncMessage(assetId: string, source: string): Promise<void> {
  try {
    const queueUrl = process.env.VECTOR_SYNC_QUEUE_URL;
    if (!queueUrl) {
      throw new Error("Missing environment variable: VECTOR_SYNC_QUEUE_URL");
    }

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ assetId }),
      })
    );
  } catch (error) {
    console.error("Vector sync enqueue failed after asset mutation", { assetId, source, error });
  }
}
