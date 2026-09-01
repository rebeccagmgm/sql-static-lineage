import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractRunScriptSqlFromLog } from "../scripts/input/mainline/run-script-sql-cache.ts";
import {
  fillRunScriptSqlCache,
  horaeLogCommandArguments,
  runScriptIdsFromHoraeTypeCache,
} from "../scripts/input/mainline/fill-run-script-sql-cache.ts";
import {
  resolveScheduleEvidenceCacheRoot,
  writeHoraeTaskTypeCache,
} from "../scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const SAMPLE_LOG = `[2026-08-27 17:03:55]-[INFO] DX Command:[/bin/su, gf_pcavs, -c, /opt/schedule/BigData-pdata_pcav_n/main.sh -q ods/pre/ods_acs_ses_connect_relation_all.sql 2026-08-27]
[2026-08-27 17:03:58]-[INFO] 2026-08-27 17:03:58.063-[INFO]-执行sql结束：常量定义语句[declare @init_date string]结束，结果为[{"@init_date":"' '"}]
[2026-08-27 17:03:59]-[INFO] 2026-08-27 17:03:59.069-[INFO]- [DUBBO] 待执行sql为[insert overwrite table ods_acs_connect_relation_all partition(part_date)
[2026-08-27 17:03:59]-[INFO]     select
[2026-08-27 17:03:59]-[INFO]         a.stock_code
[2026-08-27 17:03:59]-[INFO]     from odata_n_rcc.u_authority a
[2026-08-27 17:03:59]-[INFO]     where a.busi_date between '2026-08-27' and '2026-08-27'], dubbo version: 2.6.12, current host: 10.80.185.82
[2026-08-27 17:04:01]-[INFO] INFO  : Compiling command: insert overwrite table ods_acs_connect_relation_all partition(part_date)
`;

function tasksRoot(cacheRoot: string): string {
  return join(resolveScheduleEvidenceCacheRoot(cacheRoot), "tasks");
}

function writeType(
  cacheRoot: string,
  taskId: string,
  detail: Record<string, unknown>,
): void {
  mkdirSync(join(tasksRoot(cacheRoot), taskId), { recursive: true });
  writeHoraeTaskTypeCache(
    taskId,
    "2026-08-27T00:00:00.000Z",
    { id: taskId, ...detail },
    cacheRoot,
  );
}

describe("runScript-2.0 SQL from horae log", () => {
  it("strips log prefixes and keeps the executed insert SQL", () => {
    expect(extractRunScriptSqlFromLog(SAMPLE_LOG)).toEqual({
      querySql:
        "insert overwrite table ods_acs_connect_relation_all partition(part_date)\n    select\n        a.stock_code\n    from odata_n_rcc.u_authority a\n    where a.busi_date between '2026-08-27' and '2026-08-27'",
      sqlFile: "ods/pre/ods_acs_ses_connect_relation_all.sql",
      scriptPath: "BigData-pdata_pcav_n/main.sh",
    });
  });

  it("selects only runScript-2.0 ids", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "run-script-ids-"));
    try {
      writeType(cacheRoot, "100036", { taskType: "hiveTask" });
      writeType(cacheRoot, "101499", {
        taskType: "runScript-2.0",
        scriptPath: "BigData-pdata_pcav_n/main.sh",
        hiveDb: "pdata_pcav_n",
      });
      expect(runScriptIdsFromHoraeTypeCache(cacheRoot)).toEqual(["101499"]);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("writes readable SQL from a 2026-08-27 log snapshot without calling horae when a runner is injected", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "run-script-fill-"));
    try {
      writeType(cacheRoot, "101499", {
        taskType: "runScript-2.0",
        scriptPath: "BigData-pdata_pcav_n/main.sh",
        hiveDb: "pdata_pcav_n",
      });
      const logCalls: string[] = [];
      const summary = await fillRunScriptSqlCache({
        cacheRoot,
        dataDate: "2026-08-27",
        logRunner: (taskId, dataDate) => {
          logCalls.push(`${taskId}:${dataDate}`);
          return SAMPLE_LOG;
        },
      });
      expect(summary).toMatchObject({
        total: 1,
        cached: 1,
        errors: 0,
        dataDate: "2026-08-27",
      });
      expect(logCalls).toEqual(["101499:2026-08-27"]);
      const raw = readFileSync(
        join(tasksRoot(cacheRoot), "101499", "run-script.sql"),
        "utf8",
      );
      expect(raw.startsWith("{")).toBe(false);
      expect(raw).toContain("-- dataDate: 2026-08-27");
      expect(raw).toContain("insert overwrite table ods_acs_connect_relation_all");
      expect(raw).not.toMatch(/\[2026-08-27 /);
      expect(
        readFileSync(
          join(
            resolveScheduleEvidenceCacheRoot(cacheRoot),
            "script-log",
            "101499_20260827.log",
          ),
          "utf8",
        ),
      ).toContain("待执行sql为[");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("reads a cached script-log instead of calling horae again", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "run-script-log-hit-"));
    try {
      writeType(cacheRoot, "101499", {
        taskType: "runScript-2.0",
        scriptPath: "BigData-pdata_pcav_n/main.sh",
        hiveDb: "pdata_pcav_n",
      });
      const logDir = join(resolveScheduleEvidenceCacheRoot(cacheRoot), "script-log");
      mkdirSync(logDir, { recursive: true });
      writeFileSync(join(logDir, "101499_20260827.log"), SAMPLE_LOG);
      const logCalls: string[] = [];
      const summary = await fillRunScriptSqlCache({
        cacheRoot,
        dataDate: "2026-08-27",
        logRunner: (taskId) => {
          logCalls.push(taskId);
          throw new Error(`unexpected horae ${taskId}`);
        },
      });
      expect(summary).toMatchObject({ total: 1, cached: 1, errors: 0 });
      expect(logCalls).toEqual([]);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("calls opencli horae log, not the standalone horae CLI", () => {
    expect(
      horaeLogCommandArguments("101499", "2026-08-27", "E:/cache/script-log"),
    ).toEqual([
      "horae",
      "log",
      "101499",
      "--data-date",
      "2026-08-27",
      "--save-to",
      "E:/cache/script-log",
      "-f",
      "json",
    ]);
  });
});
