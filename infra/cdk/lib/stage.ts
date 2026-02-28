export const DEFAULT_STAGE = "prod";

export function normalizeStage(stage: string | undefined): string {
  const value = (stage ?? DEFAULT_STAGE).trim().toLowerCase();
  return value || DEFAULT_STAGE;
}

export function withStageSuffix(baseName: string, stage: string): string {
  return stage === DEFAULT_STAGE ? baseName : `${baseName}-${stage}`;
}

export function stageExportName(baseExportName: string, stage: string): string {
  return stage === DEFAULT_STAGE ? baseExportName : `${baseExportName}-${stage.toUpperCase()}`;
}
