/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ApiStack } from "../../lib/api-stack";
import { AuthStack } from "../../lib/auth-stack";
import { DarenkeckSiteStack } from "../../lib/darenkeck-site-stack";
import { StorageStack } from "../../lib/storage-stack";
import { StreamingStack } from "../../lib/streaming-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

function ensureLambdaArtifacts() {
  const lambdaDirs = [
    "api-assets",
    "api-asset-by-id",
    "api-combos",
    "api-public-combo-selection",
    "api-music",
    "api-public-music",
    "api-jobs",
    "pre-token-allowlist",
    "upload-trigger",
    "mediaconvert-status",
  ];

  for (const lambdaDir of lambdaDirs) {
    const dir = join(process.cwd(), ".dist", "lambda", lambdaDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "index.js"),
      "exports.handler = async () => ({ statusCode: 200, body: '{}' });"
    );
  }
}

describe("security posture", () => {
  it("keeps originals and derived buckets private", () => {
    const app = new App();
    const stack = new StorageStack(app, "StorageStackTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs("AWS::S3::Bucket", 2);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("allows derived reads only for CloudFront service principal", () => {
    const app = new App();
    const stack = new StorageStack(app, "StorageStackPolicyTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "AllowCloudFrontServiceReadDerived",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com",
            },
            Action: "s3:GetObject",
            Condition: Match.objectLike({
              StringLike: Match.objectLike({
                "AWS:SourceArn": Match.anyValue(),
              }),
            }),
          }),
        ]),
      },
    });
  });

  it("keeps darenkeck site bucket private and scoped to its CloudFront distribution", () => {
    const app = new App();
    const stack = new DarenkeckSiteStack(app, "DarenkeckSiteStackSecurityTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "AllowCloudFrontReadDarenkeckSite",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com",
            },
            Action: "s3:GetObject",
            Condition: Match.objectLike({
              StringEquals: Match.objectLike({
                "AWS:SourceArn": Match.anyValue(),
              }),
            }),
          }),
        ]),
      },
    });

    template.hasResourceProperties("AWS::CloudFront::Function", {
      AutoPublish: true,
      FunctionCode: Match.stringLikeRegexp("request\\.uri = '/index\\.html'"),
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.absent(),
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: Match.arrayWith([
            Match.objectLike({ EventType: "viewer-request", FunctionARN: Match.anyValue() }),
          ]),
        }),
      }),
    });
  });

  it("adds CORS response headers on derived media CloudFront responses", () => {
    const app = new App();
    const stack = new StreamingStack(app, "StreamingStackCorsTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        CorsConfig: Match.objectLike({
          OriginOverride: true,
          AccessControlAllowOrigins: {
            Items: ["*"],
          },
        }),
      }),
    });

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          OriginRequestPolicyId: Match.anyValue(),
          ResponseHeadersPolicyId: Match.anyValue(),
        }),
      }),
    });

    template.hasResourceProperties("AWS::CloudFront::OriginRequestPolicy", {
      OriginRequestPolicyConfig: Match.objectLike({
        HeadersConfig: Match.objectLike({
          HeaderBehavior: "whitelist",
        }),
      }),
    });
  });

  it("requires JWT auth on protected API routes and leaves public route open", () => {
    ensureLambdaArtifacts();
    const app = new App();
    const stack = new ApiStack(app, "ApiStackSecurityTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    const routes = template.findResources("AWS::ApiGatewayV2::Route");
    const routeEntries = Object.values(routes) as Array<{
      Properties?: {
        RouteKey?: string;
        AuthorizationType?: string;
        AuthorizerId?: unknown;
      };
    }>;

    const requiredRouteKeys = new Set([
      "GET /assets",
      "POST /assets",
      "GET /assets/{id}",
      "PATCH /assets/{id}",
      "DELETE /assets/{id}",
      "POST /assets/{id}/upload-url",
      "POST /assets/{id}/move",
      "POST /assets/{id}/upload-complete",
      "POST /assets/{id}/multipart/init",
      "POST /assets/{id}/multipart/sign",
      "POST /assets/{id}/multipart/complete",
      "POST /assets/{id}/multipart/abort",
      "GET /assets/{id}/playback-url",
      "GET /assets/{id}/children",
      "GET /assets/{id}/lineage",
      "GET /combos",
      "POST /combos",
      "POST /combos/vote",
      "GET /combos/{id}",
      "DELETE /combos/{id}",
      "POST /combos/{id}/vote",
      "GET /music/tracks",
      "POST /music/tracks",
      "GET /music/tracks/{id}",
      "PATCH /music/tracks/{id}",
      "DELETE /music/tracks/{id}",
      "GET /music/tracks/{id}/readiness",
      "POST /music/tracks/{id}/publish",
      "POST /music/tracks/{id}/unpublish",
      "GET /music/releases",
      "POST /music/releases",
      "GET /music/releases/{id}",
      "PATCH /music/releases/{id}",
      "DELETE /music/releases/{id}",
      "GET /music/releases/{id}/readiness",
      "POST /music/releases/{id}/publish",
      "POST /music/releases/{id}/unpublish",
    ]);

    const requiredPublicRouteKeys = new Set([
      "GET /public/combos/random",
      "POST /public/combos/select",
      "GET /public/music",
    ]);

    for (const route of routeEntries) {
      const routeKey = route.Properties?.RouteKey;
      if (!routeKey) {
        continue;
      }

      if (requiredPublicRouteKeys.has(routeKey)) {
        expect(route.Properties?.AuthorizationType).toBe("NONE");
        requiredPublicRouteKeys.delete(routeKey);
        continue;
      }

      if (requiredRouteKeys.has(routeKey)) {
        expect(route.Properties?.AuthorizationType).toBe("JWT");
        expect(route.Properties?.AuthorizerId).toBeDefined();
        requiredRouteKeys.delete(routeKey);
      }
    }

    expect(requiredRouteKeys.size).toBe(0);
    expect(requiredPublicRouteKeys.size).toBe(0);
  });

  it("enforces email allowlist through pre-token lambda trigger", () => {
    const app = new App();
    const stack = new AuthStack(app, "AuthStackSecurityTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      LambdaConfig: Match.objectLike({
        PreTokenGeneration: Match.anyValue(),
      }),
    });

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Allow",
            Action: "dynamodb:GetItem",
            Condition: Match.objectLike({
              "ForAllValues:StringLike": Match.objectLike({
                "dynamodb:LeadingKeys": ["AUTH#ALLOWLIST"],
              }),
            }),
          }),
        ]),
      },
    });
  });
});
