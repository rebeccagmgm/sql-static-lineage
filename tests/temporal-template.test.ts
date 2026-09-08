import { describe, expect, it } from "vitest";

import { sqlHasStructuralTemplateVars } from "../scripts/input/mainline/hive-task-sql-cache.ts";
import {
  canonicalTemporalTemplate,
  temporalTemplateGranularity,
} from "../scripts/input/shared/temporal-template.ts";
import {
  partitionCanonicalValuesOverlap,
} from "../scripts/project-graph/task-local/partition-canonical.ts";

describe("temporal templates", () => {
  it("recognizes scheduler date, month, and quarter tokens but not structural tokens", () => {
    expect(temporalTemplateGranularity("${start_day}")).toBe("DAY");
    expect(temporalTemplateGranularity("${2026-08}")).toBe("MONTH");
    expect(temporalTemplateGranularity("${Q}")).toBe("QUARTER");
    expect(temporalTemplateGranularity("${DB_TEMP}")).toBeUndefined();
    expect(
      sqlHasStructuralTemplateVars(
        "SELECT '${yyyy-MM-dd}', '${2026-08}', '${start_day}', '${end_day}', '${Q}', '${QQ}'",
      ),
    ).toBe(false);
    expect(sqlHasStructuralTemplateVars("SELECT * FROM ${DB_TEMP}.t")).toBe(true);
  });

  it("uses the same canonical tokens for cross-task partition matching", () => {
    expect(canonicalTemporalTemplate("${data_day_str}")).toBe("${YYYY-MM-DD}");
    expect(canonicalTemporalTemplate("${2026-08}")).toBe("${YYYYMM}");
    expect(canonicalTemporalTemplate("${QQ}")).toBe("${QQ}");
    expect(
      partitionCanonicalValuesOverlap(
        "busi_month",
        ["${2026-08}"],
        ["${yyyy-MM}"],
      ),
    ).toBe(true);
    expect(
      partitionCanonicalValuesOverlap("busi_quarter", ["${Q}"], ["${QQ}"]),
    ).toBe(true);
  });
});
