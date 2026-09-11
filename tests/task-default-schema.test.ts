import { describe, expect, it } from "vitest";

import {
  isBareHiveTableIdentifier,
  isSqlTemplateTableReference,
  qualifyBareTableName,
} from "../scripts/reconcile/shared/task-default-schema.ts";

const pdata = { schema: "pdata_n", evidenceSources: ["TASK_NAME"] as const };

describe("task-default-schema", () => {
  it("does not schema-qualify SQL template table tokens", () => {
    expect(isSqlTemplateTableReference("${src_table}")).toBe(true);
    expect(qualifyBareTableName("${src_table}", pdata)).toBe("${src_table}");
    expect(qualifyBareTableName("${DB_TEMP}.t04_user", pdata)).toBe(
      "${db_temp}.t04_user",
    );
  });

  it("qualifies lexical bare Hive identifiers", () => {
    expect(isBareHiveTableIdentifier("t01_pty_cutp")).toBe(true);
    expect(qualifyBareTableName("t01_pty_cutp", pdata)).toBe(
      "pdata_n.t01_pty_cutp",
    );
  });

  it("leaves already-qualified names unchanged", () => {
    expect(qualifyBareTableName("odata_n_tit.d_ref_trs", pdata)).toBe(
      "odata_n_tit.d_ref_trs",
    );
  });
});
