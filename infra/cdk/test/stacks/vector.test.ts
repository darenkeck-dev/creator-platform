/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { VectorStack } from "../../lib/vector-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

describe("vector stack", () => {
  it("creates a retained ten-dimensional Euclidean asset index", () => {
    const app = new App();
    const stack = new VectorStack(app, "VectorStackTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResource("AWS::S3Vectors::VectorBucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: {
        VectorBucketName: "media-manager-asset-tone-test",
      },
    });
    template.hasResource("AWS::S3Vectors::Index", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      DependsOn: ["AssetToneVectorBucket"],
      Properties: {
        DataType: "float32",
        Dimension: 10,
        DistanceMetric: "euclidean",
        IndexName: "asset-tone-v1",
      },
    });
  });

  it("uses stage-aware export names", () => {
    const app = new App();
    const stack = new VectorStack(app, "VectorStackExportsTest", {
      stage: "staging",
      env,
    });

    const outputs = Template.fromStack(stack).toJSON().Outputs as Record<
      string,
      { Export?: { Name?: string } }
    >;
    const exportNames = Object.values(outputs).map((output) => output.Export?.Name);

    expect(exportNames).toContain("ASSET-TONE-VECTOR-BUCKET-ARN-STAGING");
    expect(exportNames).toContain("ASSET-TONE-VECTOR-BUCKET-NAME-STAGING");
    expect(exportNames).toContain("ASSET-TONE-VECTOR-INDEX-ARN-STAGING");
    expect(exportNames).toContain("ASSET-TONE-VECTOR-INDEX-NAME-STAGING");
    expect(exportNames).toContain("VECTOR-SYNC-QUEUE-ARN-STAGING");
    expect(exportNames).toContain("VECTOR-SYNC-QUEUE-URL-STAGING");
  });

  it("owns the vector sync queue, worker, event source, and permissions", () => {
    const app = new App();
    const stack = new VectorStack(app, "VectorStackSyncTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "media-manager-vector-sync-dlq-test",
      MessageRetentionPeriod: 1209600,
    });
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "media-manager-vector-sync-test",
      MessageRetentionPeriod: 345600,
      VisibilityTimeout: 300,
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 3,
      }),
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs22.x",
      MemorySize: 512,
      Timeout: 60,
      Environment: {
        Variables: {
          ASSETS_TABLE_NAME: {
            "Fn::ImportValue": "ASSETS-TABLE-NAME-TEST",
          },
          ASSET_TONE_VECTOR_INDEX_ARN: {
            Ref: "AssetToneIndex",
          },
          ASSET_TONE_VECTOR_INDEX_NAME: "asset-tone-v1",
        },
      },
    });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 10,
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      MaximumBatchingWindowInSeconds: 5,
    });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 10,
      BisectBatchOnFunctionError: true,
      EventSourceArn: {
        "Fn::ImportValue": "ASSETS-TABLE-STREAM-ARN-TEST",
      },
      MaximumRetryAttempts: 10,
      StartingPosition: "TRIM_HORIZON",
      DestinationConfig: {
        OnFailure: {
          Destination: Match.anyValue(),
        },
      },
    });
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
          }),
          Match.objectLike({
            Action: ["s3vectors:PutVectors", "s3vectors:DeleteVectors"],
          }),
          Match.objectLike({
            Action: ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator"],
            Resource: {
              "Fn::ImportValue": "ASSETS-TABLE-STREAM-ARN-TEST",
            },
          }),
        ]),
      },
    });
  });

  it("alarms on stale sync work and DLQ messages", () => {
    const app = new App();
    const stack = new VectorStack(app, "VectorStackAlarmsTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "media-manager-vector-sync-queue-age-test",
      MetricName: "ApproximateAgeOfOldestMessage",
      Namespace: "AWS/SQS",
      Period: 300,
      Statistic: "Maximum",
      Threshold: 300,
      TreatMissingData: "notBreaching",
    });
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      AlarmName: "media-manager-vector-sync-dlq-messages-test",
      MetricName: "ApproximateNumberOfMessagesVisible",
      Namespace: "AWS/SQS",
      Period: 300,
      Statistic: "Maximum",
      Threshold: 1,
      TreatMissingData: "notBreaching",
    });
  });
});
