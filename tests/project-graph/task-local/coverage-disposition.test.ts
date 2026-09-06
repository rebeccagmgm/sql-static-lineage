import { describe, expect, it } from "vitest";

import {
  resolveCoverageDisposition,
  summarizeCoverageDispositions,
} from "../../../scripts/project-graph/task-local/coverage-disposition.ts";
import { isNoSqlTaskCategory } from "../../../scripts/reconcile/shared/lineage-scope.ts";

describe("coverage-disposition", () => {
  it("treats no-sql task categories as expected schedule reference", () => {
    for (const category of [
      "qualityTask",
      "checkAlert",
      "exeSql",
      "hiveEmail",
      "hive2file",
    ]) {
      expect(isNoSqlTaskCategory(category)).toBe(true);
      expect(
        resolveCoverageDisposition({
          taskCategory: category,
          coverageStatus: "SCHEDULE_ONLY",
        }),
      ).toBe("EXPECTED_SCHEDULE_REFERENCE");
      expect(
        resolveCoverageDisposition({
          taskCategory: category,
          coverageStatus: "COLLECTION_FAILED",
        }),
      ).toBe("EXPECTED_SCHEDULE_REFERENCE");
    }
  });

  it("treats projected tasks as data lineage regardless of category", () => {
    expect(
      resolveCoverageDisposition({
        taskCategory: "qualityTask",
        coverageStatus: "PROJECTED",
      }),
    ).toBe("DATA_LINEAGE");
  });

  it("treats missing materials on sql tasks as material gaps", () => {
    expect(
      resolveCoverageDisposition({
        taskCategory: "sparkIndex",
        coverageStatus: "SCHEDULE_ONLY",
      }),
    ).toBe("MATERIAL_GAP");
    expect(
      resolveCoverageDisposition({
        taskCategory: "hive2starrocks",
        coverageStatus: "COLLECTION_FAILED",
      }),
    ).toBe("MATERIAL_GAP");
  });

  it("summarizes expected vs gap schedule-only counts", () => {
    const summary = summarizeCoverageDispositions([
      {
        coverageStatus: "PROJECTED",
        coverageDisposition: "DATA_LINEAGE",
      },
      {
        coverageStatus: "SCHEDULE_ONLY",
        coverageDisposition: "EXPECTED_SCHEDULE_REFERENCE",
      },
      {
        coverageStatus: "SCHEDULE_ONLY",
        coverageDisposition: "EXPECTED_SCHEDULE_REFERENCE",
      },
      {
        coverageStatus: "SCHEDULE_ONLY",
        coverageDisposition: "MATERIAL_GAP",
      },
      {
        coverageStatus: "COLLECTION_FAILED",
        coverageDisposition: "MATERIAL_GAP",
      },
    ]);
    expect(summary).toEqual({
      dataLineage: 1,
      expectedScheduleReference: 2,
      materialGap: 2,
      scheduleOnlyExpected: 2,
      scheduleOnlyGap: 1,
      collectionFailedExpected: 0,
      collectionFailedGap: 1,
    });
  });
});
