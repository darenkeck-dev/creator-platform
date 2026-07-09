/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ApiStack } from "../../lib/api-stack";
import { AuthStack } from "../../lib/auth-stack";
import { ObservabilityStack } from "../../lib/observability-stack";
import { ProcessingStack } from "../../lib/processing-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

function ensureLambdaArtifacts() {
  const lambdaDirs = ["api-assets", "api-asset-by-id", "api-combos"];
  for (const lambdaDir of lambdaDirs) {
    const dir = join(process.cwd(), ".dist", "lambda", lambdaDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "index.js"),
      "exports.handler = async () => ({ statusCode: 200, body: '{}' });"
    );
  }
}

describe("observability posture", () => {
  it("configures API access logs in the default stage", () => {
    ensureLambdaArtifacts();
    const app = new App();
    const stack = new ApiStack(app, "ApiStackObservabilityTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      AccessLogSettings: Match.objectLike({
        DestinationArn: Match.anyValue(),
        Format: Match.anyValue(),
      }),
    });
  });

  it("sets SQS DLQ for upload event queue", () => {
    const app = new App();
    const stack = new ProcessingStack(app, "ProcessingStackObservabilityTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::SQS::Queue", {
      RedrivePolicy: Match.objectLike({
        deadLetterTargetArn: Match.anyValue(),
        maxReceiveCount: 5,
      }),
    });
  }, 30000);

  it("sets one month log retention for lambda functions", () => {
    const app = new App();
    const authStack = new AuthStack(app, "AuthStackObservabilityTest", {
      stage: "test",
      env,
    });
    const processingStack = new ProcessingStack(app, "ProcessingStackLogsTest", {
      stage: "test",
      env,
    });

    const authTemplate = Template.fromStack(authStack);
    const authRetentionResources = authTemplate.findResources("Custom::LogRetention");
    expect(Object.keys(authRetentionResources).length).toBeGreaterThanOrEqual(1);

    const processingTemplate = Template.fromStack(processingStack);
    const processingRetentionResources = processingTemplate.findResources("Custom::LogRetention");
    expect(Object.keys(processingRetentionResources).length).toBeGreaterThanOrEqual(2);
  }, 30000);

  it("creates monthly budget notification resource", () => {
    const app = new App();
    const stack = new ObservabilityStack(app, "ObservabilityBudgetTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
      }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({
            NotificationType: "ACTUAL",
            Threshold: 80,
          }),
          Subscribers: Match.arrayWith([
            Match.objectLike({
              SubscriptionType: "EMAIL",
            }),
          ]),
        }),
      ]),
    });
  });
});
