import { CfnOutput, Duration, Fn, Stack, type StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

type ApiStackProps = StackProps & {
  stage: string;
};

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    const userPoolId = Fn.importValue(stageExportName("USER-POOL-ID", stage));
    const userPoolClientId = Fn.importValue(stageExportName("USER-POOL-CLIENT-ID", stage));
    const region = Fn.importValue(stageExportName("REGION", stage));
    const assetsTableName = Fn.importValue(stageExportName("ASSETS-TABLE-NAME", stage));
    const assetsCreatedAtIndex = Fn.importValue(stageExportName("ASSETS-CREATED-AT-GSI", stage));
    const assetsContainerIndex = Fn.importValue(stageExportName("ASSETS-CONTAINER-GSI", stage));
    const assetsOriginalsBucketName = Fn.importValue(
      stageExportName("MEDIA-ORIGINALS-BUCKET-NAME", stage)
    );
    const assetsDerivedBucketName = Fn.importValue(
      stageExportName("MEDIA-DERIVED-BUCKET-NAME", stage)
    );
    const vectorSyncQueue = sqs.Queue.fromQueueArn(
      this,
      "VectorSyncQueue",
      Fn.importValue(stageExportName("VECTOR-SYNC-QUEUE-ARN", stage))
    );

    const assetsFunction = new lambda.Function(this, "AssetsFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/api-assets"),
      timeout: Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_CREATED_AT_INDEX: assetsCreatedAtIndex,
        ASSETS_CONTAINER_INDEX: assetsContainerIndex,
      },
    });

    const assetByIdFunction = new lambda.Function(this, "AssetByIdFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/api-asset-by-id"),
      timeout: Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_CREATED_AT_INDEX: assetsCreatedAtIndex,
        ASSETS_CONTAINER_INDEX: assetsContainerIndex,
        ASSETS_ORIGINALS_BUCKET_NAME: assetsOriginalsBucketName,
        ASSETS_DERIVED_BUCKET_NAME: assetsDerivedBucketName,
        VECTOR_SYNC_QUEUE_URL: vectorSyncQueue.queueUrl,
      },
    });

    const combosFunction = new lambda.Function(this, "CombosFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/api-combos"),
      timeout: Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_CREATED_AT_INDEX: assetsCreatedAtIndex,
        ASSETS_ORIGINALS_BUCKET_NAME: assetsOriginalsBucketName,
        VECTOR_SYNC_QUEUE_URL: vectorSyncQueue.queueUrl,
      },
    });

    const bulkActionsDlq = new sqs.Queue(this, "BulkActionsDlq", {
      queueName: withStageSuffix("media-manager-bulk-actions-dlq", stage),
      retentionPeriod: Duration.days(14),
    });

    const bulkActionsQueue = new sqs.Queue(this, "BulkActionsQueue", {
      queueName: withStageSuffix("media-manager-bulk-actions", stage),
      visibilityTimeout: Duration.minutes(15),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: bulkActionsDlq,
        maxReceiveCount: 3,
      },
    });

    const jobsFunction = new lambda.Function(this, "JobsFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/api-jobs"),
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_CONTAINER_INDEX: assetsContainerIndex,
        BULK_ACTIONS_QUEUE_URL: bulkActionsQueue.queueUrl,
      },
    });

    const assetsFunctionCfn = assetsFunction.node.defaultChild as lambda.CfnFunction;
    assetsFunctionCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const assetByIdFunctionCfn = assetByIdFunction.node.defaultChild as lambda.CfnFunction;
    assetByIdFunctionCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const combosFunctionCfn = combosFunction.node.defaultChild as lambda.CfnFunction;
    combosFunctionCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const jobsFunctionCfn = jobsFunction.node.defaultChild as lambda.CfnFunction;
    jobsFunctionCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const assetsTableArn = Stack.of(this).formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: assetsTableName,
    });

    const tableReadWritePolicy = new iam.PolicyStatement({
      actions: [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:ConditionCheckItem",
      ],
      resources: [assetsTableArn, `${assetsTableArn}/index/*`],
    });

    const tableScanPolicy = new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [assetsTableArn],
    });

    const originalsBucketArn = `arn:aws:s3:::${assetsOriginalsBucketName}`;
    const originalsBucketPutPolicy = new iam.PolicyStatement({
      actions: [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
      ],
      resources: [`${originalsBucketArn}/*`],
    });

    const originalsBucketMultipartListPolicy = new iam.PolicyStatement({
      actions: ["s3:ListBucketMultipartUploads"],
      resources: [originalsBucketArn],
    });

    const derivedBucketArn = `arn:aws:s3:::${assetsDerivedBucketName}`;
    const derivedBucketListPolicy = new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [derivedBucketArn],
    });

    const derivedBucketDeletePolicy = new iam.PolicyStatement({
      actions: ["s3:DeleteObject"],
      resources: [`${derivedBucketArn}/*`],
    });

    assetsFunction.addToRolePolicy(tableReadWritePolicy);
    assetByIdFunction.addToRolePolicy(tableReadWritePolicy);
    combosFunction.addToRolePolicy(tableReadWritePolicy);
    jobsFunction.addToRolePolicy(tableReadWritePolicy);
    bulkActionsQueue.grantSendMessages(jobsFunction);
    vectorSyncQueue.grantSendMessages(assetByIdFunction);
    vectorSyncQueue.grantSendMessages(combosFunction);
    combosFunction.addToRolePolicy(tableScanPolicy);
    combosFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${originalsBucketArn}/*`],
      })
    );
    assetByIdFunction.addToRolePolicy(originalsBucketPutPolicy);
    assetByIdFunction.addToRolePolicy(originalsBucketMultipartListPolicy);
    assetByIdFunction.addToRolePolicy(derivedBucketListPolicy);
    assetByIdFunction.addToRolePolicy(derivedBucketDeletePolicy);

    const configuredCorsOrigins = (process.env.API_CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    const allowOrigins =
      configuredCorsOrigins.length > 0
        ? configuredCorsOrigins
        : [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "https://darenkeck.com",
            "https://www.darenkeck.com",
            "https://staging.darenkeck.com",
            "https://d2fmm3qe2rclf2.cloudfront.net",
          ];

    const api = new apigwv2.CfnApi(this, "AssetsHttpApi", {
      name: withStageSuffix("media-manager-api", stage),
      protocolType: "HTTP",
      corsConfiguration: {
        allowOrigins,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["authorization", "content-type"],
        exposeHeaders: ["etag"],
        maxAge: 86400,
      },
    });

    const authorizer = new apigwv2.CfnAuthorizer(this, "CognitoJwtAuthorizer", {
      apiId: api.ref,
      authorizerType: "JWT",
      identitySource: ["$request.header.Authorization"],
      name: "cognito-jwt-authorizer",
      jwtConfiguration: {
        audience: [userPoolClientId],
        issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      },
    });

    const assetsIntegration = new apigwv2.CfnIntegration(this, "AssetsIntegration", {
      apiId: api.ref,
      integrationType: "AWS_PROXY",
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${assetsFunction.functionArn}/invocations`,
      payloadFormatVersion: "2.0",
    });

    const assetByIdIntegration = new apigwv2.CfnIntegration(this, "AssetByIdIntegration", {
      apiId: api.ref,
      integrationType: "AWS_PROXY",
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${assetByIdFunction.functionArn}/invocations`,
      payloadFormatVersion: "2.0",
    });

    const combosIntegration = new apigwv2.CfnIntegration(this, "CombosIntegration", {
      apiId: api.ref,
      integrationType: "AWS_PROXY",
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${combosFunction.functionArn}/invocations`,
      payloadFormatVersion: "2.0",
    });

    const jobsIntegration = new apigwv2.CfnIntegration(this, "JobsIntegration", {
      apiId: api.ref,
      integrationType: "AWS_PROXY",
      integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${jobsFunction.functionArn}/invocations`,
      payloadFormatVersion: "2.0",
    });

    new apigwv2.CfnRoute(this, "PostAssetsRoute", {
      apiId: api.ref,
      routeKey: "POST /assets",
      target: `integrations/${assetsIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetAssetsRoute", {
      apiId: api.ref,
      routeKey: "GET /assets",
      target: `integrations/${assetsIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetAssetByIdRoute", {
      apiId: api.ref,
      routeKey: "GET /assets/{id}",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetAssetPlaybackUrlRoute", {
      apiId: api.ref,
      routeKey: "GET /assets/{id}/playback-url",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetAssetChildrenRoute", {
      apiId: api.ref,
      routeKey: "GET /assets/{id}/children",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetAssetLineageRoute", {
      apiId: api.ref,
      routeKey: "GET /assets/{id}/lineage",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PatchAssetByIdRoute", {
      apiId: api.ref,
      routeKey: "PATCH /assets/{id}",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetUploadUrlRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/upload-url",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetMoveRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/move",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetUploadCompleteRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/upload-complete",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetMultipartInitRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/multipart/init",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetMultipartSignRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/multipart/sign",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetMultipartCompleteRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/multipart/complete",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostAssetMultipartAbortRoute", {
      apiId: api.ref,
      routeKey: "POST /assets/{id}/multipart/abort",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "DeleteAssetByIdRoute", {
      apiId: api.ref,
      routeKey: "DELETE /assets/{id}",
      target: `integrations/${assetByIdIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostJobPreviewRoute", {
      apiId: api.ref,
      routeKey: "POST /jobs/preview",
      target: `integrations/${jobsIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostJobsRoute", {
      apiId: api.ref,
      routeKey: "POST /jobs",
      target: `integrations/${jobsIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetJobByIdRoute", {
      apiId: api.ref,
      routeKey: "GET /jobs/{id}",
      target: `integrations/${jobsIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetCombosRoute", {
      apiId: api.ref,
      routeKey: "GET /combos",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostCombosRoute", {
      apiId: api.ref,
      routeKey: "POST /combos",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostCombosVoteByAssetsRoute", {
      apiId: api.ref,
      routeKey: "POST /combos/vote",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostToneReviewsRoute", {
      apiId: api.ref,
      routeKey: "POST /tone-reviews",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetToneReviewsRoute", {
      apiId: api.ref,
      routeKey: "GET /tone-reviews",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetComboByIdRoute", {
      apiId: api.ref,
      routeKey: "GET /combos/{id}",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "DeleteComboByIdRoute", {
      apiId: api.ref,
      routeKey: "DELETE /combos/{id}",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "PostComboVoteRoute", {
      apiId: api.ref,
      routeKey: "POST /combos/{id}/vote",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    new apigwv2.CfnRoute(this, "GetPublicRandomComboRoute", {
      apiId: api.ref,
      routeKey: "GET /public/combos/random",
      target: `integrations/${combosIntegration.ref}`,
      authorizationType: "NONE",
    });

    const apiAccessLogGroup = new logs.LogGroup(this, "ApiAccessLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    new apigwv2.CfnStage(this, "DefaultStage", {
      apiId: api.ref,
      stageName: "$default",
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: apiAccessLogGroup.logGroupArn,
        format: JSON.stringify({
          requestId: "$context.requestId",
          ip: "$context.identity.sourceIp",
          requestTime: "$context.requestTime",
          httpMethod: "$context.httpMethod",
          routeKey: "$context.routeKey",
          status: "$context.status",
          responseLength: "$context.responseLength",
          integrationError: "$context.integrationErrorMessage",
        }),
      },
    });

    const executeApiArnPrefix = Stack.of(this).formatArn({
      service: "execute-api",
      resource: api.ref,
      resourceName: "*/*",
    });

    assetsFunction.addPermission("AllowHttpApiInvokeAssets", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: executeApiArnPrefix,
    });

    assetByIdFunction.addPermission("AllowHttpApiInvokeAssetById", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: executeApiArnPrefix,
    });

    jobsFunction.addPermission("AllowHttpApiInvokeJobs", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: executeApiArnPrefix,
    });

    combosFunction.addPermission("AllowHttpApiInvokeCombos", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: executeApiArnPrefix,
    });

    new CfnOutput(this, "ApiUrlOutput", {
      value: api.attrApiEndpoint,
      exportName: stageExportName("API-URL", stage),
    });

    new CfnOutput(this, "BulkActionsQueueArnOutput", {
      value: bulkActionsQueue.queueArn,
      exportName: stageExportName("BULK-ACTIONS-QUEUE-ARN", stage),
    });
  }
}
