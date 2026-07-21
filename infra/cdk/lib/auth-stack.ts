import {
  Aws,
  CfnOutput,
  CfnParameter,
  Duration,
  Fn,
  SecretValue,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

type AuthStackProps = StackProps & {
  stage: string;
};

export class AuthStack extends Stack {
  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const stage = props.stage;
    const assetsTableName = Fn.importValue(stageExportName("ASSETS-TABLE-NAME", stage));

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: withStageSuffix("media-manager-user-pool", stage),
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const preTokenAllowlistFunction = new lambda.Function(this, "PreTokenAllowlistFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(".dist/lambda/pre-token-allowlist"),
      timeout: Duration.seconds(10),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        ASSETS_TABLE_NAME: assetsTableName,
      },
    });

    const preTokenAllowlistCfn = preTokenAllowlistFunction.node.defaultChild as lambda.CfnFunction;
    preTokenAllowlistCfn.addPropertyOverride("Runtime", "nodejs22.x");

    const assetsTableArn = Stack.of(this).formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: assetsTableName,
    });

    preTokenAllowlistFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [assetsTableArn],
        conditions: {
          "ForAllValues:StringLike": {
            "dynamodb:LeadingKeys": ["AUTH#ALLOWLIST"],
          },
        },
      })
    );

    userPool.addTrigger(cognito.UserPoolOperation.PRE_TOKEN_GENERATION, preTokenAllowlistFunction);

    const googleOAuthClientId = new CfnParameter(this, "GoogleOAuthClientId", {
      type: "String",
      noEcho: true,
      description: "Google OAuth client ID for Cognito federation",
    });

    const googleOAuthClientSecret = new CfnParameter(this, "GoogleOAuthClientSecret", {
      type: "String",
      noEcho: true,
      description: "Google OAuth client secret for Cognito federation",
    });

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "GoogleIdentityProvider",
      {
        userPool,
        clientId: googleOAuthClientId.valueAsString,
        clientSecretValue: SecretValue.unsafePlainText(googleOAuthClientSecret.valueAsString),
        scopes: ["openid", "email", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        },
      }
    );

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      userPoolClientName: withStageSuffix("media-manager-web-client", stage),
      generateSecret: false,
      accessTokenValidity: Duration.hours(12),
      idTokenValidity: Duration.hours(12),
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        callbackUrls: ["http://localhost:3000/auth/callback"],
        logoutUrls: ["http://localhost:3000/login"],
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
    });

    userPoolClient.node.addDependency(googleProvider);

    const domainPrefix = `media-manager-${Aws.ACCOUNT_ID}-${Aws.REGION}`;
    const userPoolDomain = userPool.addDomain("HostedDomain", {
      cognitoDomain: {
        domainPrefix,
      },
    });

    const cognitoBaseUrl = `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`;

    new CfnOutput(this, "GoogleRedirectUriOutput", {
      value: `${cognitoBaseUrl}/oauth2/idpresponse`,
    });

    new CfnOutput(this, "GoogleProviderConfiguredOutput", {
      value: "true",
    });

    new CfnOutput(this, "UserPoolIdOutput", {
      value: userPool.userPoolId,
      exportName: stageExportName("USER-POOL-ID", stage),
    });

    new CfnOutput(this, "UserPoolClientIdOutput", {
      value: userPoolClient.userPoolClientId,
      exportName: stageExportName("USER-POOL-CLIENT-ID", stage),
    });

    new CfnOutput(this, "CognitoDomainOutput", {
      value: userPoolDomain.domainName,
      exportName: stageExportName("COGNITO-DOMAIN", stage),
    });

    new CfnOutput(this, "RegionOutput", {
      value: this.region,
      exportName: stageExportName("REGION", stage),
    });
  }
}
