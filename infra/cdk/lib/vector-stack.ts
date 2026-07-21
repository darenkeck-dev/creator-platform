import { CfnOutput, CfnResource, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

const ASSET_TONE_INDEX_NAME = "asset-tone-v1";

type VectorStackProps = StackProps & {
  stage: string;
};

export class VectorStack extends Stack {
  constructor(scope: Construct, id: string, props: VectorStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const vectorBucket = new CfnResource(this, "AssetToneVectorBucket", {
      type: "AWS::S3Vectors::VectorBucket",
      properties: {
        VectorBucketName: withStageSuffix("media-manager-asset-tone", stage),
      },
    });
    vectorBucket.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const assetToneIndex = new CfnResource(this, "AssetToneIndex", {
      type: "AWS::S3Vectors::Index",
      properties: {
        VectorBucketArn: vectorBucket.ref,
        IndexName: ASSET_TONE_INDEX_NAME,
        DataType: "float32",
        Dimension: 10,
        DistanceMetric: "euclidean",
      },
    });
    assetToneIndex.addDependency(vectorBucket);
    assetToneIndex.applyRemovalPolicy(RemovalPolicy.RETAIN);

    new CfnOutput(this, "AssetToneVectorBucketArnOutput", {
      value: vectorBucket.ref,
      exportName: stageExportName("ASSET-TONE-VECTOR-BUCKET-ARN", stage),
    });

    new CfnOutput(this, "AssetToneVectorIndexArnOutput", {
      value: assetToneIndex.ref,
      exportName: stageExportName("ASSET-TONE-VECTOR-INDEX-ARN", stage),
    });

    new CfnOutput(this, "AssetToneVectorIndexNameOutput", {
      value: ASSET_TONE_INDEX_NAME,
      exportName: stageExportName("ASSET-TONE-VECTOR-INDEX-NAME", stage),
    });
  }
}
