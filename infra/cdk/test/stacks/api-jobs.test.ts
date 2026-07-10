/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { ApiStack } from "../../lib/api-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

describe("api stack jobs", () => {
  it("adds generic job routes and bulk action queue", () => {
    const app = new App();
    const stack = new ApiStack(app, "ApiStackJobsTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "media-manager-bulk-actions-test",
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 3,
      }),
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs22.x",
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          BULK_ACTIONS_QUEUE_URL: Match.anyValue(),
        }),
      }),
    });

    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /jobs/preview",
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /jobs",
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "GET /jobs/{id}",
    });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      RouteKey: "POST /tone-reviews",
      AuthorizationType: "JWT",
    });
  });
});
