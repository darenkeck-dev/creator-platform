import { CfnOutput, Fn, Stack, type StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

type StreamingStackProps = StackProps & {
  stage: string;
};

export class StreamingStack extends Stack {
  constructor(scope: Construct, id: string, props: StreamingStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const derivedBucketName = Fn.importValue(stageExportName("MEDIA-DERIVED-BUCKET-NAME", stage));
    const derivedBucket = s3.Bucket.fromBucketName(this, "DerivedBucket", derivedBucketName);

    const oac = new cloudfront.CfnOriginAccessControl(this, "DerivedBucketOac", {
      originAccessControlConfig: {
        name: withStageSuffix("media-manager-derived-oac", stage),
        description: "CloudFront access control for derived media bucket",
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });

    const distribution = new cloudfront.CfnDistribution(this, "DerivedMediaDistribution", {
      distributionConfig: {
        enabled: true,
        comment: withStageSuffix("media-manager-streaming", stage),
        defaultCacheBehavior: {
          targetOriginId: "derived-s3-origin",
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD"],
          compress: true,
          cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
        },
        origins: [
          {
            id: "derived-s3-origin",
            domainName: derivedBucket.bucketRegionalDomainName,
            originAccessControlId: oac.attrId,
            s3OriginConfig: {},
          },
        ],
      },
    });

    new CfnOutput(this, "CloudFrontDomainOutput", {
      value: distribution.attrDomainName,
      exportName: stageExportName("CLOUDFRONT-DOMAIN", stage),
    });
  }
}
