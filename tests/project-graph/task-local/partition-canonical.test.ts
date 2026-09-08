import { describe, expect, it } from "vitest";

import {
  canonicalPartitionValue,
  partitionCanonicalValuesOverlap,
} from "../../../scripts/project-graph/task-local/partition-canonical.ts";

describe("partition-canonical", () => {
  it("maps Horae business-date templates to ${YYYY-MM-DD}", () => {
    expect(canonicalPartitionValue("busi_date", "${data_day_str}")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "${yyyy-MM-dd}")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "${YYYY-MM-DD}")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "${start_day}")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "${end_day}")).toBe(
      "${YYYY-MM-DD}",
    );
  });

  it("normalizes month and quarter time templates across spellings", () => {
    expect(canonicalPartitionValue("busi_month", "${2026-08}")).toBe(
      "${YYYYMM}",
    );
    expect(canonicalPartitionValue("busi_month", "${yyyy-MM}")).toBe(
      "${YYYYMM}",
    );
    expect(canonicalPartitionValue("busi_quarter", "${Q}")).toBe("${QQ}");
    expect(canonicalPartitionValue("busi_quarter", "${QQ}")).toBe("${QQ}");
  });

  it("canonicalizes ISO literals on temporal columns", () => {
    expect(canonicalPartitionValue("busi_date", "2026-09-03")).toBe(
      "${YYYY-MM-DD}",
    );
    expect(canonicalPartitionValue("busi_date", "'2026-09-03'")).toBe(
      "${YYYY-MM-DD}",
    );
  });

  it("keeps static partition keys unchanged", () => {
    expect(canonicalPartitionValue("grp_id", "01")).toBe("01");
    expect(canonicalPartitionValue("src_tbl", "ODATA_N_TIT.D_TRD_OTC_TRADE")).toBe(
      "ODATA_N_TIT.D_TRD_OTC_TRADE",
    );
  });

  it("detects overlap across template families", () => {
    expect(
      partitionCanonicalValuesOverlap(
        "busi_date",
        ["${data_day_str}"],
        ["${YYYY-MM-DD}"],
      ),
    ).toBe(true);
    expect(
      partitionCanonicalValuesOverlap(
        "busi_date",
        ["2026-09-03"],
        ["${YYYY-MM-DD}"],
      ),
    ).toBe(true);
    expect(
      partitionCanonicalValuesOverlap("grp_id", ["01"], ["02"]),
    ).toBe(false);
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
