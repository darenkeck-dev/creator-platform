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

const env = {
  account: "123456789012",
  region: "us-west-2",
};

function ensureLambdaArtifacts() {
  const lambdaDirs = [
    "api-assets",
    "api-asset-by-id",
    "api-combos",
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
    ]);

    let foundPublicRandomRoute = false;

    for (const route of routeEntries) {
      const routeKey = route.Properties?.RouteKey;
      if (!routeKey) {
        continue;
      }

      if (routeKey === "GET /public/combos/random") {
        foundPublicRandomRoute = true;
        expect(route.Properties?.AuthorizationType).toBe("NONE");
        continue;
      }

      if (requiredRouteKeys.has(routeKey)) {
        expect(route.Properties?.AuthorizationType).toBe("JWT");
        expect(route.Properties?.AuthorizerId).toBeDefined();
        requiredRouteKeys.delete(routeKey);
      }
    }

    expect(requiredRouteKeys.size).toBe(0);
    expect(foundPublicRandomRoute).toBeTrue();
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
