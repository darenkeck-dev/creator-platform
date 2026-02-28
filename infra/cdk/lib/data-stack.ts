import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

const ASSET_CREATED_AT_INDEX_NAME = "AssetByCreatedAt";

type DataStackProps = StackProps & {
  stage: string;
};

export class DataStack extends Stack {
  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    const assetsTable = new dynamodb.Table(this, "AssetsTable", {
      tableName: withStageSuffix("Assets", stage),
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    assetsTable.addGlobalSecondaryIndex({
      indexName: ASSET_CREATED_AT_INDEX_NAME,
      partitionKey: {
        name: "gsi1pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "gsi1sk",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new CfnOutput(this, "AssetsTableNameOutput", {
      value: assetsTable.tableName,
      exportName: stageExportName("ASSETS-TABLE-NAME", stage),
    });

    new CfnOutput(this, "AssetsCreatedAtIndexOutput", {
      value: ASSET_CREATED_AT_INDEX_NAME,
      exportName: stageExportName("ASSETS-CREATED-AT-GSI", stage),
    });
  }
}
