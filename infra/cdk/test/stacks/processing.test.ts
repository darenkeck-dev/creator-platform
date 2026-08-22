/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { ProcessingStack } from "../../lib/processing-stack";

const env = {
  account: "123456789012",
  region: "us-west-2",
};

describe("processing stack tone analysis", () => {
  it("adds a separate tone analysis queue, worker, and originals event target", () => {
    const app = new App();
    const stack = new ProcessingStack(app, "ProcessingStackToneAnalysisTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "media-manager-tone-analysis-test",
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 3,
      }),
    });

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs22.x",
      Timeout: 900,
      MemorySize: 2048,
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          OPENAI_API_KEY_PARAMETER_NAME: "/media-manager/test/openai-api-key",
          FFMPEG_PATH: "/opt/bin/ffmpeg",
        }),
      }),
    });

    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: Match.objectLike({
        source: ["aws.s3"],
        "detail-type": ["Object Created"],
      }),
      Targets: Match.arrayWith([
        Match.objectLike({ Arn: Match.anyValue() }),
        Match.objectLike({ Arn: Match.anyValue() }),
      ]),
    });

    const resources = template.toJSON().Resources as Record<
      string,
      {
        Type?: string;
        Properties?: {
          Environment?: { Variables?: Record<string, unknown> };
          PolicyDocument?: { Statement?: Array<{ Action?: string }> };
        };
      }
    >;
    const tonePolicy = Object.entries(resources).find(
      ([id, resource]) =>
        id.startsWith("ToneAnalysisWorkerFunction") && resource.Type === "AWS::IAM::Policy"
    )?.[1];
    const actions = tonePolicy?.Properties?.PolicyDocument?.Statement?.map(
      (statement) => statement.Action
    );

    expect(actions).toContain("ssm:GetParameter");
    expect(actions).toContain("s3:PutObject");
    expect(actions?.flat()).toContain("dynamodb:Query");
    expect(actions?.flat()).toContain("sqs:SendMessage");

    const toneFunction = Object.entries(resources).find(
      ([id, resource]) =>
        id.startsWith("ToneAnalysisWorkerFunction") && resource.Type === "AWS::Lambda::Function"
    )?.[1];
    expect(
      JSON.stringify(toneFunction?.Properties?.Environment?.Variables?.VECTOR_SYNC_QUEUE_URL)
    ).toContain("VECTOR-SYNC-QUEUE-ARN-TEST");
  });

  it("adds a bulk actions worker fed by the API-owned queue", () => {
    const app = new App();
    const stack = new ProcessingStack(app, "ProcessingStackBulkActionsTest", {
      stage: "test",
      env,
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs22.x",
      Timeout: 900,
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          ASSETS_CONTAINER_INDEX: Match.anyValue(),
          TONE_ANALYSIS_QUEUE_URL: Match.anyValue(),
          UPLOAD_EVENTS_QUEUE_URL: Match.anyValue(),
        }),
      }),
    });

    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 1,
    });

    const resources = template.toJSON().Resources as Record<
      string,
      {
        Type?: string;
        Properties?: {
          Environment?: { Variables?: Record<string, unknown> };
          PolicyDocument?: { Statement?: Array<{ Action?: string | string[] }> };
        };
      }
    >;
    const jobsFunction = Object.entries(resources).find(
      ([id, resource]) =>
        id.startsWith("JobsWorkerFunction") && resource.Type === "AWS::Lambda::Function"
    )?.[1];
    const jobsPolicy = Object.entries(resources).find(
      ([id, resource]) =>
        id.startsWith("JobsWorkerFunction") && resource.Type === "AWS::IAM::Policy"
    )?.[1];

    expect(
      JSON.stringify(jobsFunction?.Properties?.Environment?.Variables?.VECTOR_SYNC_QUEUE_URL)
    ).toContain("VECTOR-SYNC-QUEUE-ARN-TEST");
    expect(
      jobsPolicy?.Properties?.PolicyDocument?.Statement?.flatMap(
        (statement) => statement.Action ?? []
      )
    ).toContain("sqs:SendMessage");
    expect(
      jobsPolicy?.Properties?.PolicyDocument?.Statement?.flatMap(
        (statement) => statement.Action ?? []
      )
    ).toContain("dynamodb:TransactWriteItems");
  });

  it("grants status mutation lambdas access to the vector sync queue", () => {
    const app = new App();
    const stack = new ProcessingStack(app, "ProcessingStackStatusVectorSyncTest", {
      stage: "test",
      env,
    });
    const resources = Template.fromStack(stack).toJSON().Resources as Record<
      string,
      {
        Type?: string;
        Properties?: {
          Environment?: { Variables?: Record<string, unknown> };
          PolicyDocument?: { Statement?: Array<{ Action?: string | string[] }> };
        };
      }
    >;

    for (const functionPrefix of ["MediaConvertStatusUpdaterFunction", "UploadTriggerFunction"]) {
      const lambdaFunction = Object.entries(resources).find(
        ([id, resource]) =>
          id.startsWith(functionPrefix) && resource.Type === "AWS::Lambda::Function"
      )?.[1];
      const policy = Object.entries(resources).find(
        ([id, resource]) => id.startsWith(functionPrefix) && resource.Type === "AWS::IAM::Policy"
      )?.[1];

      expect(
        JSON.stringify(lambdaFunction?.Properties?.Environment?.Variables?.VECTOR_SYNC_QUEUE_URL)
      ).toContain("VECTOR-SYNC-QUEUE-ARN-TEST");
      expect(
        policy?.Properties?.PolicyDocument?.Statement?.flatMap(
          (statement) => statement.Action ?? []
        )
      ).toContain("sqs:SendMessage");
    }
  });

  it("allows the MediaConvert status updater to read before appending audit logs", () => {
    const app = new App();
    const stack = new ProcessingStack(app, "ProcessingStackStatusAuditTest", {
      stage: "test",
      env,
    });
    const resources = Template.fromStack(stack).toJSON().Resources as Record<
      string,
      {
        Type?: string;
        Properties?: { PolicyDocument?: { Statement?: Array<{ Action?: string | string[] }> } };
      }
    >;
    const policy = Object.entries(resources).find(
      ([id, resource]) =>
        id.startsWith("MediaConvertStatusUpdaterFunction") &&
        resource.Type === "AWS::IAM::Policy"
    )?.[1];
    const actions = policy?.Properties?.PolicyDocument?.Statement?.flatMap(
      (statement) => statement.Action ?? []
    );

    expect(actions).toContain("dynamodb:GetItem");
    expect(actions).toContain("dynamodb:UpdateItem");
  });
});
