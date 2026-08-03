/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { DataStack } from "../../lib/data-stack";

describe("data stack", () => {
  it("exports the Assets stream with new and old images using a stage-aware name", () => {
    const app = new App();
    const stack = new DataStack(app, "DataStackTest", {
      stage: "staging",
      env: { account: "123456789012", region: "us-west-2" },
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "Assets-staging",
      StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
    });

    const outputs = template.toJSON().Outputs as Record<
      string,
      { Value?: unknown; Export?: { Name?: string } }
    >;
    expect(outputs.AssetsTableStreamArnOutput).toEqual({
      Value: { "Fn::GetAtt": [expect.stringContaining("AssetsTable"), "StreamArn"] },
      Export: { Name: "ASSETS-TABLE-STREAM-ARN-STAGING" },
    });
  });
});
