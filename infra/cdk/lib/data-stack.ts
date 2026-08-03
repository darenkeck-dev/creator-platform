import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

import { stageExportName, withStageSuffix } from "./stage";

const ASSET_CREATED_AT_INDEX_NAME = "AssetByCreatedAt";
const ASSET_CONTAINER_INDEX_NAME = "AssetByContainer";

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
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
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

    assetsTable.addGlobalSecondaryIndex({
      indexName: ASSET_CONTAINER_INDEX_NAME,
      partitionKey: {
        name: "gsi2pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "gsi2sk",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new CfnOutput(this, "AssetsTableNameOutput", {
      value: assetsTable.tableName,
      exportName: stageExportName("ASSETS-TABLE-NAME", stage),
    });

    new CfnOutput(this, "AssetsTableStreamArnOutput", {
      value: assetsTable.tableStreamArn!,
      exportName: stageExportName("ASSETS-TABLE-STREAM-ARN", stage),
    });

    new CfnOutput(this, "AssetsCreatedAtIndexOutput", {
      value: ASSET_CREATED_AT_INDEX_NAME,
      exportName: stageExportName("ASSETS-CREATED-AT-GSI", stage),
    });

    new CfnOutput(this, "AssetsContainerIndexOutput", {
      value: ASSET_CONTAINER_INDEX_NAME,
      exportName: stageExportName("ASSETS-CONTAINER-GSI", stage),
    });
  }
}
