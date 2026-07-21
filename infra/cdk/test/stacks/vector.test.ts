/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { VectorStack } from "../../lib/vector-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

describe("vector stack", () => {
  it("creates a retained ten-dimensional Euclidean asset index", () => {
    const app = new App();
    const stack = new VectorStack(app, "VectorStackTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);
    template.hasResource("AWS::S3Vectors::VectorBucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: {
        VectorBucketName: "media-manager-asset-tone-test",
      },
    });
    template.hasResource("AWS::S3Vectors::Index", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      DependsOn: ["AssetToneVectorBucket"],
      Properties: {
        DataType: "float32",
        Dimension: 10,
        DistanceMetric: "euclidean",
        IndexName: "asset-tone-v1",
      },
    });
  });

  it("uses stage-aware export names", () => {
    const app = new App();
    const stack = new VectorStack(app, "VectorStackExportsTest", {
      stage: "staging",
      env,
    });

    const outputs = Template.fromStack(stack).toJSON().Outputs as Record<
      string,
      { Export?: { Name?: string } }
    >;
    const exportNames = Object.values(outputs).map((output) => output.Export?.Name);

    expect(exportNames).toContain("ASSET-TONE-VECTOR-BUCKET-ARN-STAGING");
    expect(exportNames).toContain("ASSET-TONE-VECTOR-INDEX-ARN-STAGING");
    expect(exportNames).toContain("ASSET-TONE-VECTOR-INDEX-NAME-STAGING");
  });
});
