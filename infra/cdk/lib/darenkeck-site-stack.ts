import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

type DarenkeckSiteStackProps = StackProps & {
  stage: string;
};

const CLOUDFRONT_ALIAS_HOSTED_ZONE_ID = "Z2FDTNDATAQYW2";

type DarenkeckSiteCustomDomainConfig = {
  domainName: string;
  certificateArn: string;
  hostedZoneId?: string;
  dnsRecordName: string;
  manageDns: boolean;
};

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readBooleanEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return false;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function resolveCustomDomainConfig(): DarenkeckSiteCustomDomainConfig | undefined {
  const domainName = readOptionalEnv("DARENKECK_SITE_DOMAIN_NAME");
  const certificateArn = readOptionalEnv("DARENKECK_SITE_CERT_ARN");
  const hostedZoneId = readOptionalEnv("DARENKECK_SITE_HOSTED_ZONE_ID");
  const dnsRecordName = readOptionalEnv("DARENKECK_SITE_DNS_RECORD_NAME");
  const manageDns = readBooleanEnv("DARENKECK_SITE_MANAGE_DNS");

  if (!domainName && !certificateArn && !hostedZoneId && !dnsRecordName && !manageDns) {
    return undefined;
  }

  if (!domainName || !certificateArn) {
    throw new Error(
      "DARENKECK_SITE_DOMAIN_NAME and DARENKECK_SITE_CERT_ARN must both be set when configuring a custom site domain."
    );
  }

  if (!certificateArn.includes(":us-east-1:")) {
    throw new Error(
      "DARENKECK_SITE_CERT_ARN must reference an ACM certificate in us-east-1 for CloudFront."
    );
  }

  if (manageDns && !hostedZoneId) {
    throw new Error(
      "DARENKECK_SITE_HOSTED_ZONE_ID is required when DARENKECK_SITE_MANAGE_DNS=true."
    );
  }

  return {
    domainName,
    certificateArn,
    hostedZoneId,
    dnsRecordName: dnsRecordName ?? domainName,
    manageDns,
  };
}

function siteBucketName(stage: string): string {
  return `darenkeck-site-${stage}`;
}

export class DarenkeckSiteStack extends Stack {
  constructor(scope: Construct, id: string, props: DarenkeckSiteStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const customDomain = resolveCustomDomainConfig();

    const siteBucket = new s3.Bucket(this, "DarenkeckSiteBucket", {
      bucketName: siteBucketName(stage),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
    });

    const oac = new cloudfront.CfnOriginAccessControl(this, "DarenkeckSiteOac", {
      originAccessControlConfig: {
        name: withStageSuffix("darenkeck-site-oac", stage),
        description: "CloudFront access control for darenkeck static site bucket",
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "DarenkeckSiteSecurityHeadersPolicy",
      {
        responseHeadersPolicyName: withStageSuffix("darenkeck-site-security-headers", stage),
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' https: blob:; connect-src 'self' https:; font-src 'self' data:; form-action 'self'; upgrade-insecure-requests",
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.days(365),
            includeSubdomains: true,
            override: true,
          },
          contentTypeOptions: {
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "Permissions-Policy",
              value:
                "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
              override: true,
            },
          ],
        },
      }
    );

    const distribution = new cloudfront.CfnDistribution(this, "DarenkeckSiteDistribution", {
      distributionConfig: {
        enabled: true,
        comment: withStageSuffix("darenkeck-site", stage),
        aliases: customDomain ? [customDomain.domainName] : undefined,
        viewerCertificate: customDomain
          ? {
              acmCertificateArn: customDomain.certificateArn,
              sslSupportMethod: "sni-only",
              minimumProtocolVersion: "TLSv1.2_2021",
            }
          : undefined,
        defaultRootObject: "index.html",
        defaultCacheBehavior: {
          targetOriginId: "darenkeck-site-s3-origin",
          viewerProtocolPolicy: "redirect-to-https",
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD"],
          compress: true,
          cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
          responseHeadersPolicyId: responseHeadersPolicy.responseHeadersPolicyId,
        },
        customErrorResponses: [
          {
            errorCode: 403,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
          {
            errorCode: 404,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
        origins: [
          {
            id: "darenkeck-site-s3-origin",
            domainName: siteBucket.bucketRegionalDomainName,
            originAccessControlId: oac.attrId,
            s3OriginConfig: {},
          },
        ],
      },
    });

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontReadDarenkeckSite",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [`${siteBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${distribution.ref}`,
          },
        },
      })
    );

    if (customDomain?.manageDns) {
      new route53.CfnRecordSet(this, "DarenkeckSiteAliasARecord", {
        hostedZoneId: customDomain.hostedZoneId,
        name: customDomain.dnsRecordName,
        type: "A",
        aliasTarget: {
          dnsName: distribution.attrDomainName,
          hostedZoneId: CLOUDFRONT_ALIAS_HOSTED_ZONE_ID,
          evaluateTargetHealth: false,
        },
      });

      new route53.CfnRecordSet(this, "DarenkeckSiteAliasAaaaRecord", {
        hostedZoneId: customDomain.hostedZoneId,
        name: customDomain.dnsRecordName,
        type: "AAAA",
        aliasTarget: {
          dnsName: distribution.attrDomainName,
          hostedZoneId: CLOUDFRONT_ALIAS_HOSTED_ZONE_ID,
          evaluateTargetHealth: false,
        },
      });
    }

    new CfnOutput(this, "DarenkeckSiteBucketNameOutput", {
      value: siteBucket.bucketName,
      exportName: stageExportName("DARENKECK-SITE-BUCKET-NAME", stage),
    });

    new CfnOutput(this, "DarenkeckSiteCloudFrontDomainOutput", {
      value: distribution.attrDomainName,
      exportName: stageExportName("DARENKECK-SITE-CLOUDFRONT-DOMAIN", stage),
    });

    new CfnOutput(this, "DarenkeckSiteCloudFrontDistributionIdOutput", {
      value: distribution.ref,
      exportName: stageExportName("DARENKECK-SITE-CLOUDFRONT-DISTRIBUTION-ID", stage),
    });

    if (customDomain) {
      new CfnOutput(this, "DarenkeckSiteCustomDomainOutput", {
        value: customDomain.domainName,
        exportName: stageExportName("DARENKECK-SITE-DOMAIN", stage),
      });
    }
  }
}
