import {
  summarizeTaskLocalBatch,
  type TaskLocalBatchSummary,
  type TaskLocalProjection,
} from "./contract.ts";
import { projectTaskLocal, type ProjectTaskLocalOptions } from "./project-task-local.ts";

export interface ProjectTaskLocalBatchOptions {
  readonly factsRoot: string;
  readonly dataRoot: string;
  readonly taskIds: readonly string[];
  readonly scheduleCacheRoot?: string;
  readonly generatedAt?: string;
}

export interface ProjectTaskLocalBatchResult {
  readonly projections: readonly TaskLocalProjection[];
  readonly summary: TaskLocalBatchSummary;
}

export function projectTaskLocalBatch(
  options: ProjectTaskLocalBatchOptions,
): ProjectTaskLocalBatchResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const projections = options.taskIds.map((taskId) =>
    projectTaskLocal({
      factsRoot: options.factsRoot,
      dataRoot: options.dataRoot,
      taskId,
      scheduleCacheRoot: options.scheduleCacheRoot,
      generatedAt,
    } satisfies ProjectTaskLocalOptions),
  );
  return {
    projections,
    summary: summarizeTaskLocalBatch(projections),
  };
}
