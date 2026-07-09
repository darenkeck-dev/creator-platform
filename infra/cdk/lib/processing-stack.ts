import { Duration, Fn, Size, Stack, type StackProps } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

type ProcessingStackProps = StackProps & {
  stage: string;
};

export class ProcessingStack extends Stack {
  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const assetsTableName = Fn.importValue(stageExportName("ASSETS-TABLE-NAME", stage));
    const assetsContainerIndex = Fn.importValue(stageExportName("ASSETS-CONTAINER-GSI", stage));
    const derivedBucketName = Fn.importValue(stageExportName("MEDIA-DERIVED-BUCKET-NAME", stage));
    const originalsBucketName = Fn.importValue(
      stageExportName("MEDIA-ORIGINALS-BUCKET-NAME", stage)
    );
    const cloudFrontDomain = Fn.importValue(stageExportName("CLOUDFRONT-DOMAIN", stage));

    const mediaConvertRole = new iam.Role(this, "MediaConvertServiceRole", {
      assumedBy: new iam.ServicePrincipal("mediaconvert.amazonaws.com"),
    });

    const originalsBucketArn = `arn:aws:s3:::${originalsBucketName}`;
    const derivedBucketArn = `arn:aws:s3:::${derivedBucketName}`;

    mediaConvertRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket", "s3:GetBucketLocation"],
        resources: [originalsBucketArn, `${originalsBucketArn}/*`],
      })
    );

    mediaConvertRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:AbortMultipartUpload",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ],
        resources: [derivedBucketArn, `${derivedBucketArn}/*`],
      })
    );

    const statusUpdater = new lambda.Function(this, "MediaConvertStatusUpdaterFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/mediaconvert-status"),
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_DERIVED_BUCKET_NAME: derivedBucketName,
        CLOUDFRONT_DOMAIN: cloudFrontDomain,
      },
    });

    const statusUpdaterCfn = statusUpdater.node.defaultChild as lambda.CfnFunction;
    statusUpdaterCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const assetsTableArn = Stack.of(this).formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: assetsTableName,
    });

    statusUpdater.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:UpdateItem"],
        resources: [assetsTableArn],
      })
    );

    const uploadEventsDlq = new sqs.Queue(this, "UploadEventsDlq", {
      queueName: withStageSuffix("media-manager-upload-events-dlq", stage),
      retentionPeriod: Duration.days(14),
    });

    const uploadEventsQueue = new sqs.Queue(this, "UploadEventsQueue", {
      queueName: withStageSuffix("media-manager-upload-events", stage),
      visibilityTimeout: Duration.seconds(120),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: uploadEventsDlq,
        maxReceiveCount: 5,
      },
    });

    const toneAnalysisDlq = new sqs.Queue(this, "ToneAnalysisDlq", {
      queueName: withStageSuffix("media-manager-tone-analysis-dlq", stage),
      retentionPeriod: Duration.days(14),
    });

    const toneAnalysisQueue = new sqs.Queue(this, "ToneAnalysisQueue", {
      queueName: withStageSuffix("media-manager-tone-analysis", stage),
      visibilityTimeout: Duration.minutes(15),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: toneAnalysisDlq,
        maxReceiveCount: 3,
      },
    });

    const bulkActionsQueue = sqs.Queue.fromQueueArn(
      this,
      "BulkActionsQueue",
      Fn.importValue(stageExportName("BULK-ACTIONS-QUEUE-ARN", stage))
    );

    const uploadTrigger = new lambda.Function(this, "UploadTriggerFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/upload-trigger"),
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_ORIGINALS_BUCKET_NAME: originalsBucketName,
        ASSETS_DERIVED_BUCKET_NAME: derivedBucketName,
        MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
      },
    });

    const uploadTriggerCfn = uploadTrigger.node.defaultChild as lambda.CfnFunction;
    uploadTriggerCfn.addPropertyOverride("Runtime", "nodejs22.x");

    uploadTrigger.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [assetsTableArn],
      })
    );

    uploadTrigger.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["mediaconvert:DescribeEndpoints", "mediaconvert:CreateJob"],
        resources: ["*"],
      })
    );

    uploadTrigger.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:HeadObject"],
        resources: [`${originalsBucketArn}/*`],
      })
    );

    uploadTrigger.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [mediaConvertRole.roleArn],
      })
    );

    uploadTrigger.addEventSource(
      new lambdaEventSources.SqsEventSource(uploadEventsQueue, {
        batchSize: 10,
      })
    );

    const openAiApiKeyParameterName =
      process.env.OPENAI_API_KEY_PARAMETER_NAME || `/media-manager/${stage}/openai-api-key`;
    const openAiApiKeyParameterArn = Stack.of(this).formatArn({
      service: "ssm",
      resource: "parameter",
      resourceName: openAiApiKeyParameterName.replace(/^\//, ""),
    });

    const ffmpegLayerArn =
      process.env.FFMPEG_LAYER_ARN ||
      `arn:${Stack.of(this).partition}:lambda:${Stack.of(this).region}:${Stack.of(this).account}:layer:media-manager-ffmpeg:1`;
    const toneAnalysisWorker = new lambda.Function(this, "ToneAnalysisWorkerFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/tone-analysis"),
      timeout: Duration.minutes(15),
      memorySize: 2048,
      ephemeralStorageSize: Size.mebibytes(2048),
      logRetention: logs.RetentionDays.ONE_MONTH,
      layers: ffmpegLayerArn
        ? [lambda.LayerVersion.fromLayerVersionArn(this, "ToneAnalysisFfmpegLayer", ffmpegLayerArn)]
        : [],
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_ORIGINALS_BUCKET_NAME: originalsBucketName,
        ASSETS_DERIVED_BUCKET_NAME: derivedBucketName,
        OPENAI_API_KEY_PARAMETER_NAME: openAiApiKeyParameterName,
        FFMPEG_PATH: process.env.FFMPEG_PATH || "/opt/bin/ffmpeg",
      },
    });

    const jobsWorker = new lambda.Function(this, "JobsWorkerFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/jobs-worker"),
      timeout: Duration.minutes(15),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_CONTAINER_INDEX: assetsContainerIndex,
        ASSETS_ORIGINALS_BUCKET_NAME: originalsBucketName,
        ASSETS_DERIVED_BUCKET_NAME: derivedBucketName,
        TONE_ANALYSIS_QUEUE_URL: toneAnalysisQueue.queueUrl,
        UPLOAD_EVENTS_QUEUE_URL: uploadEventsQueue.queueUrl,
      },
    });

    const toneAnalysisWorkerCfn = toneAnalysisWorker.node.defaultChild as lambda.CfnFunction;
    toneAnalysisWorkerCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const jobsWorkerCfn = jobsWorker.node.defaultChild as lambda.CfnFunction;
    jobsWorkerCfn.addPropertyOverride("Runtime", "nodejs22.x");

    toneAnalysisWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
        resources: [assetsTableArn],
      })
    );

    jobsWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
        ],
        resources: [assetsTableArn, `${assetsTableArn}/index/*`],
      })
    );

    jobsWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:DeleteObject"],
        resources: [`${originalsBucketArn}/*`, `${derivedBucketArn}/*`],
      })
    );

    jobsWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [derivedBucketArn],
      })
    );
    bulkActionsQueue.grantConsumeMessages(jobsWorker);
    toneAnalysisQueue.grantSendMessages(jobsWorker);
    uploadEventsQueue.grantSendMessages(jobsWorker);

    toneAnalysisWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${originalsBucketArn}/*`],
      })
    );

    toneAnalysisWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [`${derivedBucketArn}/derived/*/tone/*`],
      })
    );

    toneAnalysisWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [openAiApiKeyParameterArn],
      })
    );

    toneAnalysisWorker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "kms:ViaService": `ssm.${Stack.of(this).region}.amazonaws.com`,
          },
        },
      })
    );

    toneAnalysisWorker.addEventSource(
      new lambdaEventSources.SqsEventSource(toneAnalysisQueue, {
        batchSize: 1,
      })
    );

    jobsWorker.addEventSource(
      new lambdaEventSources.SqsEventSource(bulkActionsQueue, {
        batchSize: 1,
      })
    );

    new events.Rule(this, "OriginalsObjectCreatedRule", {
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: {
            name: [originalsBucketName],
          },
        },
      },
      targets: [new targets.SqsQueue(uploadEventsQueue), new targets.SqsQueue(toneAnalysisQueue)],
      ruleName: withStageSuffix("media-manager-originals-object-created", stage),
    });

    new events.Rule(this, "MediaConvertStatusRule", {
      eventPattern: {
        source: ["aws.mediaconvert"],
        detailType: ["MediaConvert Job State Change"],
        detail: {
          status: [
            "SUBMITTED",
            "PROGRESSING",
            "STATUS_UPDATE",
            "INPUT_INFORMATION",
            "COMPLETE",
            "ERROR",
            "CANCELED",
          ],
        },
      },
      targets: [new targets.LambdaFunction(statusUpdater)],
      ruleName: withStageSuffix("media-manager-mediaconvert-status", stage),
    });
  }
}
