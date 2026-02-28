import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

import { stageExportName } from "./stage";

type StorageStackProps = StackProps & {
  stage: string;
};

function withBucketStageSuffix(baseName: string, stage: string): string {
  return `${baseName}-${stage}`;
}

export class StorageStack extends Stack {
  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    const originalsBucket = new s3.Bucket(this, "OriginalsBucket", {
      bucketName: withBucketStageSuffix("media-originals", stage),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
      eventBridgeEnabled: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
    });

    const derivedBucket = new s3.Bucket(this, "DerivedBucket", {
      bucketName: withBucketStageSuffix("media-derived", stage),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
    });

    derivedBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontServiceReadDerived",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [`${derivedBucket.bucketArn}/*`],
        conditions: {
          StringLike: {
            "AWS:SourceArn": `arn:aws:cloudfront::${Stack.of(this).account}:distribution/*`,
          },
        },
      })
    );

    new CfnOutput(this, "OriginalsBucketNameOutput", {
      value: originalsBucket.bucketName,
      exportName: stageExportName("MEDIA-ORIGINALS-BUCKET-NAME", stage),
    });

    new CfnOutput(this, "DerivedBucketNameOutput", {
      value: derivedBucket.bucketName,
      exportName: stageExportName("MEDIA-DERIVED-BUCKET-NAME", stage),
    });
  }
}
