import { CfnOutput, Duration, Fn, Stack, type StackProps } from "aws-cdk-lib";
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

    const corsResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "DerivedMediaCorsResponseHeadersPolicy",
      {
        responseHeadersPolicyName: withStageSuffix("media-manager-derived-cors", stage),
        comment: "CORS headers for derived media HLS playback",
        corsBehavior: {
          accessControlAllowOrigins: ["*"],
          accessControlAllowMethods: ["GET", "HEAD", "OPTIONS"],
          accessControlAllowHeaders: ["*"],
          accessControlAllowCredentials: false,
          accessControlExposeHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
          accessControlMaxAge: Duration.seconds(3600),
          originOverride: true,
        },
      }
    );

    const corsOriginRequestPolicy = new cloudfront.CfnOriginRequestPolicy(
      this,
      "DerivedMediaCorsOriginRequestPolicy",
      {
        originRequestPolicyConfig: {
          name: withStageSuffix("media-manager-derived-cors-origin", stage),
          comment: "Forward CORS preflight headers to S3 origin",
          cookiesConfig: {
            cookieBehavior: "none",
          },
          queryStringsConfig: {
            queryStringBehavior: "none",
          },
          headersConfig: {
            headerBehavior: "whitelist",
            headers: ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"],
          },
        },
      }
    );

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
          originRequestPolicyId: corsOriginRequestPolicy.ref,
          responseHeadersPolicyId: corsResponseHeadersPolicy.responseHeadersPolicyId,
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
