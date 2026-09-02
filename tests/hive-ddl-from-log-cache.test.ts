import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractHiveDdlFromHoraeLog,
  parseHiveDdlFromLogCache,
  writeHiveDdlFromLogCache,
} from "../scripts/input/mainline/hive-ddl-from-log-cache.ts";
import { fillHiveDdlFromLogCache } from "../scripts/input/mainline/fill-hive-ddl-from-log-cache.ts";
import {
  bucketCollectSummary,
  inventoryPartialGapsFromSummaries,
  parseCollectSummaryLine,
} from "../scripts/input/shared/partial-gap-from-summaries.ts";
import { assembleCacheTaskEvidence } from "../scripts/input/shared/cache-task-evidence.ts";
import { writeHoraeTaskTypeCache } from "../scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts";

const SAMPLE_LOG = `[2026-08-27 23:26:28]-[INFO] [t1, main, HiveAssistant] Process hive ddl:
"USE odata_ygt;
 CREATE EXTERNAL TABLE IF NOT EXISTS odata_ygt.nygt_t_coverstockjour
(
\`busi_date\` string, 
\`init_date\` double, 
\`serial_no\` double, 
\`data_time\` string
); 
"
[INFO] [08-27 23:26:30] [t1, main, HiveAssistant] Hive DDL finished in 2224ms, exit value=0
`;

describe("hive-ddl-from-log-cache", () => {
  it("extracts CREATE EXTERNAL TABLE from AnyLoader Process hive ddl block", () => {
    const extracted = extractHiveDdlFromHoraeLog(SAMPLE_LOG);
    expect(extracted.qualifiedName).toBe("odata_ygt.nygt_t_coverstockjour");
    expect(extracted.hiveDb).toBe("odata_ygt");
    expect(extracted.createSql).toMatch(
      /CREATE\s+EXTERNAL\s+TABLE\s+IF\s+NOT\s+EXISTS\s+odata_ygt\.nygt_t_coverstockjour/i,
    );
    expect(extracted.createSql).toMatch(/`busi_date`\s+string/i);
    expect(extracted.createSql?.trim().endsWith(";")).toBe(true);
  });

  it("round-trips AVAILABLE cache and feeds assembleToHive create slot", () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-ddl-log-"));
    writeHiveDdlFromLogCache(
      "68",
      "2026-09-02T00:00:00.000Z",
      {
        source: "HORAE_LOG",
        ddlStatus: "AVAILABLE",
        dataDate: "2026-08-27",
        createSql: extractHiveDdlFromHoraeLog(SAMPLE_LOG).createSql,
        qualifiedName: "odata_ygt.nygt_t_coverstockjour",
        hiveDb: "odata_ygt",
        hiveTable: "nygt_t_coverstockjour",
      },
      cacheRoot,
    );
    const parsed = parseHiveDdlFromLogCache("68", cacheRoot);
    expect(parsed.status).toBe("HIT");
    if (parsed.status !== "HIT") return;
    expect(parsed.evidence.ddlStatus).toBe("AVAILABLE");
    expect(parsed.evidence.createSql).toContain("nygt_t_coverstockjour");

    writeHoraeTaskTypeCache(
      "68",
      "2026-09-02T00:00:00.000Z",
      {
        id: "68",
        taskType: "oracle2hive",
        name: "odata_ygt.nygt_t_coverstockjour",
        source: "oracle_rbjygl_85.236",
        querySql:
          "SELECT BUSI_DATE, INIT_DATE FROM HS_OPT.COVERSTOCKJOUR",
        syncInfo: {
          hiveDb: "odata_ygt",
          hiveTable: "nygt_t_coverstockjour",
          targetTable: "odata_ygt.nygt_t_coverstockjour",
          sourceServer: "oracle_rbjygl_85.236",
          querySql:
            "SELECT BUSI_DATE, INIT_DATE FROM HS_OPT.COVERSTOCKJOUR",
        },
      },
      cacheRoot,
    );
    const assembled = assembleCacheTaskEvidence("68", cacheRoot);
    expect(assembled.kind).toBe("EVIDENCE");
    if (assembled.kind !== "EVIDENCE") return;
    expect(assembled.cacheArtifacts).toContain("hive-target-ddl.sql");
    expect(assembled.evidence.sql?.create?.content).toMatch(
      /CREATE\s+EXTERNAL\s+TABLE/i,
    );
    expect(assembled.evidence.sql?.create?.evidenceProvider).toContain(
      "hive-target-ddl",
    );
  });

  it("fillHiveDdlFromLogCache writes from logRunner without OpenCLI", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "hive-ddl-fill-"));
    const summary = await fillHiveDdlFromLogCache({
      cacheRoot,
      taskIds: ["68"],
      dataDate: "2026-08-27",
      minIntervalMs: 0,
      logRunner: async () => SAMPLE_LOG,
    });
    expect(summary).toMatchObject({
      total: 1,
      cached: 1,
      empty: 0,
      errors: 0,
    });
    const parsed = parseHiveDdlFromLogCache("68", cacheRoot);
    expect(parsed.status).toBe("HIT");
    if (parsed.status !== "HIT") return;
    expect(parsed.evidence.createSql).toContain("busi_date");
  });
});

describe("partial-gap-from-summaries", () => {
  it("buckets ONLY_HIVE_TARGET_GAP from summaries.jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "partial-gap-"));
    const path = join(dir, "summaries.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          taskId: "68",
          collectionStatus: "PARTIAL",
          warnings: ["odata_ygt.nygt_t_coverstockjour:TABLE_JSONL_MISS"],
        }),
        JSON.stringify({
          taskId: "124",
          collectionStatus: "PARTIAL",
          warnings: [
            "CRMII.TAPP_CHANNELTYPE:RDBMS_CORE_AMBIGUOUS",
            "odata_jgj.jgj_c_tapp_channeltype:TABLE_JSONL_MISS",
          ],
        }),
        JSON.stringify({
          taskId: "1",
          collectionStatus: "SUCCESS",
          warnings: [],
        }),
      ].join("\n"),
      "utf8",
    );
    const inventory = inventoryPartialGapsFromSummaries(path);
    expect(inventory.byBucket.get("ONLY_HIVE_TARGET_GAP")).toEqual(["68"]);
    expect(inventory.byBucket.get("HAS_AMBIGUOUS")).toEqual(["124"]);
    expect(inventory.byBucket.get("SUCCESS")).toEqual(["1"]);
    expect(
      bucketCollectSummary(parseCollectSummaryLine(readFileSync(path, "utf8").split("\n")[0]!)!),
    ).toBe("ONLY_HIVE_TARGET_GAP");
  });
});
