import {
  CfnOutput,
  CfnResource,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

const ASSET_TONE_INDEX_NAME = "asset-tone-v1";

type VectorStackProps = StackProps & {
  stage: string;
};

export class VectorStack extends Stack {
  constructor(scope: Construct, id: string, props: VectorStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const vectorBucketName = withStageSuffix("media-manager-asset-tone", stage);
    const assetsTableName = Fn.importValue(stageExportName("ASSETS-TABLE-NAME", stage));
    const assetsTableStreamArn = Fn.importValue(stageExportName("ASSETS-TABLE-STREAM-ARN", stage));
    const assetsTable = dynamodb.Table.fromTableAttributes(this, "AssetsTable", {
      tableName: assetsTableName,
      tableStreamArn: assetsTableStreamArn,
    });
    const vectorBucket = new CfnResource(this, "AssetToneVectorBucket", {
      type: "AWS::S3Vectors::VectorBucket",
      properties: {
        VectorBucketName: vectorBucketName,
      },
    });
    vectorBucket.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const assetToneIndex = new CfnResource(this, "AssetToneIndex", {
      type: "AWS::S3Vectors::Index",
      properties: {
        VectorBucketArn: vectorBucket.ref,
        IndexName: ASSET_TONE_INDEX_NAME,
        DataType: "float32",
        Dimension: 10,
        DistanceMetric: "euclidean",
      },
    });
    assetToneIndex.addDependency(vectorBucket);
    assetToneIndex.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const vectorSyncDlq = new sqs.Queue(this, "VectorSyncDlq", {
      queueName: withStageSuffix("media-manager-vector-sync-dlq", stage),
      retentionPeriod: Duration.days(14),
    });

    const vectorSyncQueue = new sqs.Queue(this, "VectorSyncQueue", {
      queueName: withStageSuffix("media-manager-vector-sync", stage),
      visibilityTimeout: Duration.minutes(5),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: vectorSyncDlq,
        maxReceiveCount: 3,
      },
    });

    const vectorSyncWorker = new lambda.Function(this, "VectorSyncWorkerFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/vector-sync"),
      timeout: Duration.minutes(1),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSET_TONE_VECTOR_INDEX_ARN: assetToneIndex.ref,
        ASSET_TONE_VECTOR_INDEX_NAME: ASSET_TONE_INDEX_NAME,
      },
    });

    const vectorSyncWorkerCfn = vectorSyncWorker.node.defaultChild as lambda.CfnFunction;
    vectorSyncWorkerCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const assetsTableArn = Stack.of(this).formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: assetsTableName,
    });
    vectorSyncWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [assetsTableArn],
      })
    );
    vectorSyncWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:PutVectors", "s3vectors:DeleteVectors"],
        resources: [assetToneIndex.ref],
      })
    );

    vectorSyncWorker.addEventSource(
      new lambdaEventSources.SqsEventSource(vectorSyncQueue, {
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(5),
        reportBatchItemFailures: true,
      })
    );
    vectorSyncWorker.addEventSource(
      new lambdaEventSources.DynamoEventSource(assetsTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 10,
        bisectBatchOnError: true,
        retryAttempts: 10,
        onFailure: new lambdaEventSources.SqsDlq(vectorSyncDlq),
      })
    );

    new cloudwatch.Alarm(this, "VectorSyncQueueAgeAlarm", {
      alarmName: withStageSuffix("media-manager-vector-sync-queue-age", stage),
      metric: vectorSyncQueue.metricApproximateAgeOfOldestMessage({
        period: Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 300,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, "VectorSyncDlqMessagesAlarm", {
      alarmName: withStageSuffix("media-manager-vector-sync-dlq-messages", stage),
      metric: vectorSyncDlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new CfnOutput(this, "AssetToneVectorBucketArnOutput", {
      value: vectorBucket.ref,
      exportName: stageExportName("ASSET-TONE-VECTOR-BUCKET-ARN", stage),
    });

    new CfnOutput(this, "AssetToneVectorBucketNameOutput", {
      value: vectorBucketName,
      exportName: stageExportName("ASSET-TONE-VECTOR-BUCKET-NAME", stage),
    });

    new CfnOutput(this, "AssetToneVectorIndexArnOutput", {
      value: assetToneIndex.ref,
      exportName: stageExportName("ASSET-TONE-VECTOR-INDEX-ARN", stage),
    });

    new CfnOutput(this, "AssetToneVectorIndexNameOutput", {
      value: ASSET_TONE_INDEX_NAME,
      exportName: stageExportName("ASSET-TONE-VECTOR-INDEX-NAME", stage),
    });

    new CfnOutput(this, "VectorSyncQueueArnOutput", {
      value: vectorSyncQueue.queueArn,
      exportName: stageExportName("VECTOR-SYNC-QUEUE-ARN", stage),
    });

    new CfnOutput(this, "VectorSyncQueueUrlOutput", {
      value: vectorSyncQueue.queueUrl,
      exportName: stageExportName("VECTOR-SYNC-QUEUE-URL", stage),
    });
  }
}
