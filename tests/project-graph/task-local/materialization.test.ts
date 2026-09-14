import { describe, expect, it } from "vitest";

import type { PhysicalFieldIdentity } from "../../../scripts/reconcile/shared/physical-field.ts";
import {
  materializationRecordsForField,
  type MaterializationContext,
} from "../../../scripts/project-graph/task-local/project-task-local.ts";

const SOURCE: PhysicalFieldIdentity = {
  platform: "hive",
  dataSource: "gfhive",
  stableTableId: "temp.stage__gfhive",
  qualifiedName: "temp.stage",
  column: "id",
  identityStatus: "SCHEMA_BACKED",
};

const CONTEXT: MaterializationContext = {
  statementId: "task:demo:read:2",
  expressionId: "task:demo:expression:2",
};

describe("task-local materialization context", () => {
  it("does not fold a resolved record from a different read statement", () => {
    const records = new Map([
      [
        "temp.stage\u0000id",
        [
          {
            status: "RESOLVED",
            read_statement_id: "task:demo:read:1",
            read_expression_ids: ["task:demo:expression:1"],
            output_binding_id: "binding:1",
          },
        ],
      ],
    ]);

    expect(materializationRecordsForField(records, SOURCE, CONTEXT)).toEqual([]);
  });

  it("keeps legacy fallback when every record lacks read context", () => {
    const record = {
      status: "RESOLVED",
      output_binding_id: "binding:legacy",
    };
    const records = new Map([["temp.stage\u0000id", [record]]]);

    expect(materializationRecordsForField(records, SOURCE, CONTEXT)).toEqual([record]);
  });

  it("requires exact resolved control and read occurrence instead of statement fallback", () => {
    const bridge = {
      status: "RESOLVED", read_statement_id: CONTEXT.statementId, read_expression_ids: [],
      read_control_refs: [{ relation_id: "filter:left", read_relation_id: "read:left", read_occurrence_id: "occ:left", resolution_status: "RESOLVED" }],
    };
    const records = new Map([["temp.stage\u0000id", [bridge]]]);
    expect(materializationRecordsForField(records, SOURCE, { ...CONTEXT, controlRelationId: "filter:right" })).toEqual([]);
    expect(materializationRecordsForField(records, SOURCE, { ...CONTEXT, controlRelationId: "filter:left", readOccurrenceId: "occ:right" })).toEqual([]);
    expect(materializationRecordsForField(records, SOURCE, { ...CONTEXT, controlRelationId: "filter:left", readOccurrenceId: "occ:left" })).toEqual([bridge]);
  });
});
