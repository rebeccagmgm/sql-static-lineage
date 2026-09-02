import {
  readHoraeRelationCache,
  readHoraeTaskTypeCache,
} from "../../reconcile/consumer/one-hop/schedule-evidence-cache.ts";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function detailField(detail: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const direct = text(detail[key]);
    if (direct) return direct;
    const nested = key.split(".").reduce<unknown>(
      (current, segment) => record(current)?.[segment],
      detail,
    );
    const nestedText = text(nested);
    if (nestedText) return nestedText;
  }
  return null;
}

export interface TaskScheduleContext {
  readonly inSchedule: boolean;
  readonly taskName: string | null;
  readonly topicName: string | null;
  readonly scheduleUpstreamTaskIds: readonly string[];
}

export function readTaskScheduleContext(
  taskId: string,
  scheduleCacheRoot: string | undefined,
): TaskScheduleContext | null {
  if (!scheduleCacheRoot) return null;
  const taskType = readHoraeTaskTypeCache(taskId, scheduleCacheRoot);
  const relation = readHoraeRelationCache(taskId, scheduleCacheRoot, "up");
  const inSchedule = taskType.status === "HIT" || relation.status === "HIT";
  if (!inSchedule) return null;

  const detail = taskType.status === "HIT" ? taskType.detail : {};
  const upstreamIds = new Set<string>();
  if (relation.status === "HIT") {
    for (const row of relation.rows) {
      const upstreamTaskId = text(row.task_id ?? row.taskId);
      if (upstreamTaskId && upstreamTaskId !== taskId) upstreamIds.add(upstreamTaskId);
    }
  }

  return {
    inSchedule: true,
    taskName: detailField(detail, ["taskName", "task_name", "name"]),
    topicName: detailField(detail, ["topicName", "topic_name", "topic"]),
    scheduleUpstreamTaskIds: [...upstreamIds].sort(),
  };
}
