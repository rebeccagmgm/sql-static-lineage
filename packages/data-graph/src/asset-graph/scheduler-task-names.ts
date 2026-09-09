import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolveScheduleEvidenceCacheRoot } from "../../../../scripts/evidence/schedule-evidence-cache.ts";

const taskName = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

interface CachedTaskName {
  expiresAt: number;
  name?: string;
}

/**
 * Provides actual scheduler task names from the locally catalogued Horae
 * SQLite data. Evidence descriptions and raw payload annotation fields are
 * deliberately outside this lookup.
 */
export class SchedulerTaskNameResolver {
  private readonly cache = new Map<string, CachedTaskName>();
  private database: DatabaseSync | undefined;
  private databaseMtime: number | undefined;

  public constructor(
    private readonly evidenceRoot: string,
    private readonly options: { now?: () => number; ttlMs?: number } = {},
  ) {}

  public close(): void {
    this.database?.close();
    this.database = undefined;
    this.databaseMtime = undefined;
  }

  private databasePath(): string {
    return join(
      resolveScheduleEvidenceCacheRoot(this.evidenceRoot),
      "tasks-sqlite",
      "schedule-evidence.sqlite",
    );
  }

  private open(): DatabaseSync | undefined {
    const path = this.databasePath();
    if (!existsSync(path)) {
      this.close();
      this.cache.clear();
      return undefined;
    }
    const mtime = statSync(path).mtimeMs;
    if (this.database && this.databaseMtime === mtime) return this.database;
    this.close();
    this.cache.clear();
    this.database = new DatabaseSync(path, { readOnly: true });
    this.databaseMtime = mtime;
    return this.database;
  }

  public resolve(taskIds: readonly string[]): Record<string, string> {
    const now = (this.options.now ?? Date.now)();
    const expiresAt = now + (this.options.ttlMs ?? 30_000);
    let database: DatabaseSync | undefined;
    try {
      database = this.open();
    } catch {
      this.close();
    }
    const labels: Record<string, string> = {};
    for (const taskId of new Set(taskIds)) {
      const cached = this.cache.get(taskId);
      if (cached && cached.expiresAt > now) {
        if (cached.name) labels[taskId] = cached.name;
        continue;
      }
      let name: string | undefined;
      try {
        const row = database
          ?.prepare(
            "SELECT task_name AS taskName FROM horae_task_catalog WHERE task_id = ?",
          )
          .get(taskId) as { taskName?: unknown } | undefined;
        name = taskName(row?.taskName);
      } catch {
        // Optional local scheduler metadata must not block a graph query.
      }
      this.cache.set(taskId, { expiresAt, name });
      if (name) labels[taskId] = name;
    }
    return labels;
  }
}
