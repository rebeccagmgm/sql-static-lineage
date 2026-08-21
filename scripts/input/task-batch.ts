export type TaskCollector = (dataRoot: string, taskId: string) => unknown;

export type TaskFailureReporter = (taskId: string, error: unknown) => void;

export function exitCodeForTaskBatch(hadFailure: boolean): number {
  return hadFailure ? 1 : 0;
}

/**
 * Runs task IDs independently. The caller owns the rate limiter used by the
 * collector; this function deliberately remains sequential and only controls
 * failure isolation and the aggregate exit signal.
 */
export function runTaskBatch(
  dataRoot: string,
  taskIds: readonly string[],
  collectTask: TaskCollector,
  reportFailure: TaskFailureReporter,
): boolean {
  let hadFailure = false;
  for (const taskId of taskIds) {
    try {
      collectTask(dataRoot, taskId);
    } catch (error) {
      hadFailure = true;
      reportFailure(taskId, error);
    }
  }
  return hadFailure;
}
