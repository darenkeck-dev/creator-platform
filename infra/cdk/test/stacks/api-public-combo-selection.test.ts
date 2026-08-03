/// <reference types="bun-types" />

import { describe, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ApiStack } from "../../lib/api-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

function ensureLambdaArtifacts() {
  for (const lambdaDir of [
    "api-assets",
    "api-asset-by-id",
    "api-combos",
    "api-public-combo-selection",
    "api-jobs",
  ]) {
    const dir = join(process.cwd(), ".dist", "lambda", lambdaDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "index.js"),
      "exports.handler = async () => ({ statusCode: 200, body: '{}' });"
    );
  }
}

describe("public combo selection stack", () => {
  it("creates an isolated read-only vector-backed public endpoint", () => {
    ensureLambdaArtifacts();
    const app = new App();
    const stack = new ApiStack(app, "ApiPublicComboSelectionTest", {
      stage: "test",
      env,
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Timeout: 15,
      Environment: {
        Variables: Match.objectLike({
          ASSETS_TABLE_NAME: Match.anyValue(),
          ASSETS_ORIGINALS_BUCKET_NAME: Match.anyValue(),
          ASSET_TONE_VECTOR_INDEX_ARN: Match.anyValue(),
        }),
      },
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /public/combos/select",
      AuthorizationType: "NONE",
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      RouteSettings: {
        "POST /public/combos/select": {
          ThrottlingBurstLimit: 20,
          ThrottlingRateLimit: 10,
        },
      },
    });
    template.hasResource("AWS::ApiGatewayV2::Stage", {
      DependsOn: Match.arrayWith([Match.stringLikeRegexp("PostPublicComboSelectionRoute")]),
    });

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ["dynamodb:GetItem", "dynamodb:Scan"],
            Effect: "Allow",
          }),
          Match.objectLike({
            Action: "s3:GetObject",
            Effect: "Allow",
          }),
          Match.objectLike({
            Action: ["s3vectors:QueryVectors", "s3vectors:GetVectors"],
            Effect: "Allow",
          }),
        ]),
      },
    });
  });
});
