import { CfnParameter, Stack, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import type { Construct } from "constructs";

import { withStageSuffix } from "./stage";

type ObservabilityStackProps = StackProps & {
  stage: string;
};

export class ObservabilityStack extends Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const stage = props.stage;

    const budgetAlertEmail = new CfnParameter(this, "BudgetAlertEmail", {
      type: "String",
      description: "Email address to receive monthly AWS budget alerts",
    });

    const monthlyBudgetUsd = new CfnParameter(this, "MonthlyBudgetUsd", {
      type: "Number",
      default: 25,
      description: "Monthly cost budget threshold in USD",
    });

    new budgets.CfnBudget(this, "MonthlyCostBudget", {
      budget: {
        budgetType: "COST",
        budgetName: withStageSuffix("media-manager-monthly-budget", stage),
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: monthlyBudgetUsd.valueAsNumber,
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: "GREATER_THAN",
            notificationType: "ACTUAL",
            threshold: 80,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "EMAIL",
              address: budgetAlertEmail.valueAsString,
            },
          ],
        },
      ],
    });
  }
}
