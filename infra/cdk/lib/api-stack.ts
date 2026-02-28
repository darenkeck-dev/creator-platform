import { CfnOutput, Duration, Fn, Stack, type StackProps } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
    const assetsOriginalsBucketName = Fn.importValue(
      stageExportName("MEDIA-ORIGINALS-BUCKET-NAME", stage)
    );
    const assetsDerivedBucketName = Fn.importValue(
      stageExportName("MEDIA-DERIVED-BUCKET-NAME", stage)
    );

    const assetsFunction = new lambda.Function(this, "AssetsFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/api-assets"),
      timeout: Duration.seconds(10),
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_CREATED_AT_INDEX: assetsCreatedAtIndex,
      },
    });

    const assetByIdFunction = new lambda.Function(this, "AssetByIdFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/api-asset-by-id"),
      timeout: Duration.seconds(10),
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
        ASSETS_ORIGINALS_BUCKET_NAME: assetsOriginalsBucketName,
        ASSETS_DERIVED_BUCKET_NAME: assetsDerivedBucketName,
      },
    });

    const assetsFunctionCfn = assetsFunction.node.defaultChild as lambda.CfnFunction;
    assetsFunctionCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const assetByIdFunctionCfn = assetByIdFunction.node.defaultChild as lambda.CfnFunction;
    assetByIdFunctionCfn.addPropertyOverride("Runtime", "nodejs22.x");

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
      ],
      resources: [assetsTableArn, `${assetsTableArn}/index/*`],
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
    assetByIdFunction.addToRolePolicy(originalsBucketPutPolicy);
    assetByIdFunction.addToRolePolicy(originalsBucketMultipartListPolicy);
    assetByIdFunction.addToRolePolicy(derivedBucketListPolicy);
    assetByIdFunction.addToRolePolicy(derivedBucketDeletePolicy);

    const api = new apigwv2.CfnApi(this, "AssetsHttpApi", {
      name: withStageSuffix("media-manager-api", stage),
      protocolType: "HTTP",
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

    new apigwv2.CfnStage(this, "DefaultStage", {
      apiId: api.ref,
      stageName: "$default",
      autoDeploy: true,
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

    new CfnOutput(this, "ApiUrlOutput", {
      value: api.attrApiEndpoint,
      exportName: stageExportName("API-URL", stage),
    });
  }
}
