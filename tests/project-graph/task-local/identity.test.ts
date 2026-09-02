import { describe, expect, it } from "vitest";

import type {
  PhysicalTableCatalog,
  PhysicalTableCatalogEntry,
} from "../../../scripts/machine-facts/input-pack-machine-facts.ts";
import { resolveTaskLocalTableIdentity } from "../../../scripts/project-graph/task-local/identity.ts";

function catalogWith(entry: PhysicalTableCatalogEntry): PhysicalTableCatalog {
  return {
    entries: [entry],
    issues: [],
    byPhysicalKey: new Map(),
    byQualifiedName: new Map([[entry.qualifiedName, [entry]]]),
    byNameTail: new Map([[entry.qualifiedName.split(".").at(-1)!, [entry]]]),
  };
}

const ENTRY: PhysicalTableCatalogEntry = {
  platform: "hive",
  dataSource: "gfhive",
  stableTableId: "demo.target__gfhive",
  qualifiedName: "demo.target",
  guid: null,
  partitionFields: [],
  columns: ["id"],
  tablePath: "tables/demo/target/table.json",
  ddlPath: "tables/demo/target/ddl.sql",
  tableContentHash: "table-hash",
  ddlSha256: "ddl-hash",
};

describe("task-local identity", () => {
  it("does not promote task-name-only bare qualification to confirmed", () => {
    const result = resolveTaskLocalTableIdentity({
      catalog: catalogWith(ENTRY),
      rawName: "target",
      defaultSchema: { schema: "demo", evidenceSources: ["TASK_NAME"] },
      fallback: ENTRY,
    });
    expect(result).toMatchObject({
      identityStatus: "CANDIDATE_DATASET",
      qualificationStatus: "ASSUMED(TASK_NAME_ONLY)",
      identityReasonCode: "TABLE_QUALIFICATION_ASSUMED",
      qualifiedName: "demo.target",
    });
  });

  it("confirms bare qualification only with task-target evidence", () => {
    const result = resolveTaskLocalTableIdentity({
      catalog: catalogWith(ENTRY),
      rawName: "target",
      defaultSchema: { schema: "demo", evidenceSources: ["TASK_NAME", "TASK_TARGET"] },
      fallback: ENTRY,
    });
    expect(result).toMatchObject({
      identityStatus: "CONFIRMED",
      qualificationStatus: "CONFIRMED(TASK_TARGET)",
      identityReasonCode: null,
    });
  });
});
