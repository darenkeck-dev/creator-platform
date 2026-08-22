/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ApiStack } from "../../lib/api-stack";

function artifacts() {
  for (const name of [
    "api-assets",
    "api-asset-by-id",
    "api-combos",
    "api-public-combo-selection",
    "api-jobs",
    "api-music",
    "api-public-music",
  ]) {
    const directory = join(process.cwd(), ".dist", "lambda", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "index.js"), "exports.handler = async () => ({});");
  }
}

describe("music API CDK", () => {
  it("creates authenticated admin routes and a least-privilege public route", () => {
    artifacts();
    const stack = new ApiStack(new App(), "MusicApiTest", {
      stage: "test",
      env: { account: "123456789012", region: "us-west-2" },
    });
    const template = Template.fromStack(stack);
    const routes = Object.values(template.findResources("AWS::ApiGatewayV2::Route")) as Array<{
      Properties: { RouteKey: string; AuthorizationType: string };
    }>;
    expect(
      routes.find((route) => route.Properties.RouteKey === "POST /music/releases/{id}/publish")
        ?.Properties.AuthorizationType
    ).toBe("JWT");
    expect(
      routes.find((route) => route.Properties.RouteKey === "GET /public/music")?.Properties
        .AuthorizationType
    ).toBe("NONE");

    const resources = template.toJSON().Resources as Record<
      string,
      {
        Type?: string;
        Properties?: {
          PolicyDocument?: {
            Statement?: Array<{ Action?: string | string[]; Resource?: unknown }>;
          };
        };
      }
    >;
    const publicPolicy = Object.entries(resources).find(
      ([id, resource]) =>
        id.startsWith("PublicMusicFunction") && resource.Type === "AWS::IAM::Policy"
    )?.[1];
    const publicActions = publicPolicy?.Properties?.PolicyDocument?.Statement?.flatMap(
      (statement) => statement.Action ?? []
    );
    expect(publicActions).toContain("dynamodb:BatchGetItem");
    expect(publicActions).toContain("dynamodb:Query");
    expect(publicActions).toContain("s3:GetObject");
    expect(publicActions).not.toContain("dynamodb:PutItem");
    expect(publicActions).not.toContain("s3:PutObject");

    const adminPolicy = Object.entries(resources).find(
      ([id, resource]) => id.startsWith("MusicFunction") && resource.Type === "AWS::IAM::Policy"
    )?.[1];
    expect(
      adminPolicy?.Properties?.PolicyDocument?.Statement?.flatMap(
        (statement) => statement.Action ?? []
      )
    ).toContain("dynamodb:TransactWriteItems");

    const stage = Object.values(resources).find(
      (resource) => resource.Type === "AWS::ApiGatewayV2::Stage"
    ) as {
      DependsOn?: string[];
      Properties?: { RouteSettings?: Record<string, unknown> };
    };
    expect(stage.Properties?.RouteSettings?.["GET /public/music"]).toEqual({
      ThrottlingBurstLimit: 20,
      ThrottlingRateLimit: 10,
    });
    expect(stage.DependsOn?.some((id) => id.includes("GetPublicMusicRoute"))).toBe(true);
  });
});
