import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";

import { stageExportName } from "./stage";

type CoreStackProps = StackProps & {
  stage: string;
};

export class CoreStack extends Stack {
  constructor(scope: Construct, id: string, props: CoreStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    new CfnOutput(this, "SupportedAssetTypes", {
      value: ["video", "audio", "image"].join(","),
      exportName: stageExportName("SUPPORTED-ASSET-TYPES", stage),
    });
  }
}
