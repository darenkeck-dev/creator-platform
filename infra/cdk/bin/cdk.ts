#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";

import { AuthStack } from "../lib/auth-stack";
import { ApiStack } from "../lib/api-stack";
import { CoreStack } from "../lib/core-stack";
import { DataStack } from "../lib/data-stack";
import { DarenkeckSiteStack } from "../lib/darenkeck-site-stack";
import { ObservabilityStack } from "../lib/observability-stack";
import { ProcessingStack } from "../lib/processing-stack";
import { StorageStack } from "../lib/storage-stack";
import { StreamingStack } from "../lib/streaming-stack";
import { VectorStack } from "../lib/vector-stack";
import { normalizeStage, withStageSuffix } from "../lib/stage";

const app = new cdk.App();
const stage = normalizeStage(process.env.APP_STAGE);

const stackEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new CoreStack(app, "MediaManagerCoreStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerCoreStack", stage),
});

new AuthStack(app, "MediaManagerAuthStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerAuthStack", stage),
});

new DataStack(app, "MediaManagerDataStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerDataStack", stage),
});

new VectorStack(app, "MediaManagerVectorStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerVectorStack", stage),
});

new StorageStack(app, "MediaManagerStorageStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerStorageStack", stage),
});

new StreamingStack(app, "MediaManagerStreamingStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerStreamingStack", stage),
});

new DarenkeckSiteStack(app, "MediaManagerDarenkeckSiteStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerDarenkeckSiteStack", stage),
});

new ApiStack(app, "MediaManagerApiStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerApiStack", stage),
});

new ProcessingStack(app, "MediaManagerProcessingStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerProcessingStack", stage),
});

new ObservabilityStack(app, "MediaManagerObservabilityStack", {
  env: stackEnv,
  stage,
  stackName: withStageSuffix("MediaManagerObservabilityStack", stage),
});
