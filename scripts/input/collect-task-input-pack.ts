import { resolve } from "node:path";
import {
  assertExistingTableLayout,
  quarantineMalformedTableDirectories,
} from "./input-pack.ts";
import {
  collectOneTask,
  taskCategory,
  type TaskCollectionSummary,
} from "./collect-one-task-input-pack.ts";
import { exitCodeForTaskBatch, runTaskBatch } from "./task-batch.ts";
import {
  assertStatusFileOutsideDataRoot,
  canSkipSuccessfulTask,
  defaultTaskStatusFile,
  loadTaskStatus,
  saveTaskStatus,
  updateTaskStatus,
} from "./task-status.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return value;
}

const BATCH_SIZE_WARNING_THRESHOLD = 100;

function isReusableSuccess(
  record: ReturnType<typeof loadTaskStatus>["tasks"][string] | undefined,
  dataRoot: string,
): boolean {
  if (!canSkipSuccessfulTask(record, dataRoot)) return false;
  if (record?.taskType === undefined || record.taskCategory === undefined)
    return true;
  return taskCategory(record.taskType, undefined) === record.taskCategory;
}

const dataRoot = requiredOption("--data-root");
const force = process.argv.includes("--force");
const statusFile = resolve(
  option("--status-file") ?? defaultTaskStatusFile(dataRoot),
);
assertStatusFileOutsideDataRoot(statusFile, dataRoot);
if (process.argv.includes("--repair-malformed-tables")) {
  const repair = quarantineMalformedTableDirectories(dataRoot);
  if (repair)
    console.error(
      JSON.stringify({
        malformedTablesQuarantined: repair.moved.length,
        quarantineRoot: repair.quarantineRoot,
        moved: repair.moved,
      }),
    );
}
const taskIds = [
  ...new Set(
    requiredOption("--task-ids")
      .split(",")
      .map((taskId) => taskId.trim())
      .filter(Boolean),
  ),
];
if (taskIds.length === 0)
  throw new Error("--task-ids must contain at least one task id");
const batchSizeWarning = taskIds.length > BATCH_SIZE_WARNING_THRESHOLD;
if (batchSizeWarning)
  console.error(
    JSON.stringify({
      collectionStatus: "BATCH_SIZE_WARNING",
      taskCount: taskIds.length,
      threshold: BATCH_SIZE_WARNING_THRESHOLD,
      message:
        "Large batches rewrite the operational status checkpoint once per task; split the task IDs if this is unexpected",
    }),
  );
assertExistingTableLayout(dataRoot);

const status = loadTaskStatus(statusFile, dataRoot);
let statusPersistenceError: string | undefined;
function persistStatus(record: Parameters<typeof updateTaskStatus>[1]): void {
  updateTaskStatus(status, record);
  try {
    saveTaskStatus(statusFile, status);
  } catch (error) {
    statusPersistenceError ??=
      error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        collectionStatus: "STATUS_PERSISTENCE_FAILED",
        statusFile,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
const skippedTaskIds: string[] = [];
const runnableTaskIds = taskIds.filter((taskId) => {
  const reusable = !force && isReusableSuccess(status.tasks[taskId], dataRoot);
  if (reusable) {
    skippedTaskIds.push(taskId);
    console.log(
      JSON.stringify({
        taskId,
        collectionStatus: "SKIPPED",
        reason: "PREVIOUS_SUCCESS",
        directory: status.tasks[taskId]!.directory,
      }),
    );
  }
  return !reusable;
});

const hadFailure = runTaskBatch(
  dataRoot,
  runnableTaskIds,
  (root, taskId) => {
    const summary = collectOneTask(root, taskId);
    const persisted: TaskCollectionSummary = summary;
    persistStatus({
      taskId,
      status: persisted.collectionStatus,
      taskCategory: persisted.taskCategory,
      taskType: persisted.taskType,
      directory: resolve(persisted.directory),
      changed: persisted.changed,
      contentHash: persisted.contentHash,
      tablesWritten: persisted.tablesWritten,
      tableAssets: persisted.tableAssets,
      tablesUnavailable: persisted.tablesUnavailable,
      tableReferencesUnavailable: persisted.tableReferencesUnavailable,
      warnings: persisted.warnings,
      staleLegacyTaskDirectories: persisted.staleLegacyTaskDirectories,
    });
    return summary;
  },
  (taskId, error) => {
    const details =
      error && typeof error === "object"
        ? (error as {
            writePhase?: string;
            taskDirectory?: string;
            taskChanged?: boolean;
          })
        : {};
    persistStatus({
      taskId,
      status: "FAILED",
      directory:
        details.taskDirectory === undefined
          ? undefined
          : resolve(details.taskDirectory),
      changed: details.taskChanged,
      warnings: [],
      staleLegacyTaskDirectories: [],
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(
      JSON.stringify({
        taskId,
        collectionStatus: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        writePhase: details.writePhase,
        taskCommitted: details.writePhase === "TABLE_AFTER_TASK_COMMITTED",
        taskDirectory: details.taskDirectory,
        taskChanged: details.taskChanged,
      }),
    );
  },
);

const currentRecords = taskIds.map((taskId) => status.tasks[taskId]);
const statusSummary = {
  statusFile,
  total: taskIds.length,
  batchSizeWarning,
  success: taskIds.filter(
    (taskId) => status.tasks[taskId]?.status === "SUCCESS",
  ),
  partial: taskIds.filter(
    (taskId) => status.tasks[taskId]?.status === "PARTIAL",
  ),
  cleanSuccess: taskIds.filter((taskId) => {
    const record = status.tasks[taskId];
    return record?.status === "SUCCESS" && isReusableSuccess(record, dataRoot);
  }),
  successWithWarnings: taskIds.filter((taskId) => {
    const record = status.tasks[taskId];
    return (
      record?.status === "SUCCESS" &&
      ((record.warnings?.length ?? 0) > 0 ||
        (record.staleLegacyTaskDirectories?.length ?? 0) > 0)
    );
  }),
  successNeedingRefresh: taskIds.filter((taskId) => {
    const record = status.tasks[taskId];
    return (
      record?.status === "SUCCESS" &&
      (record.warnings?.length ?? 0) === 0 &&
      (record.staleLegacyTaskDirectories?.length ?? 0) === 0 &&
      !isReusableSuccess(record, dataRoot)
    );
  }),
  failed: taskIds.filter((taskId) => status.tasks[taskId]?.status === "FAILED"),
  skipped: skippedTaskIds,
  statusPersistenceFailed: statusPersistenceError !== undefined,
  statusPersistenceError,
  statusRecords: currentRecords.filter(
    (record): record is NonNullable<typeof record> => record !== undefined,
  ).length,
};
console.log(JSON.stringify({ collectionStatusSummary: statusSummary }));

const exitCode = exitCodeForTaskBatch(
  hadFailure || statusPersistenceError !== undefined,
);
if (exitCode !== 0) process.exitCode = exitCode;
