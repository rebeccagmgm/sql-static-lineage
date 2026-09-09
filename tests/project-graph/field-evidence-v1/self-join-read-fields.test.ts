import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  writeTableInput,
  writeTaskInput,
} from "../../../scripts/input/shared/input-pack.ts";
import { runInputPackMachineFacts } from "../../../scripts/machine-facts/input-pack-machine-facts.ts";
import { projectTaskLocal } from "../../../scripts/project-graph/task-local/project-task-local.ts";
import { compileTask } from "../../../packages/data-graph/src/asset-graph/compile.ts";

describe("self-join SQL to compiled read fields", () => {
  it.each([
    ["a.amount + b.amount", 2, 2],
    ["a.amount + a.amount", 2, 1],
    ["sum(a.amount + b.amount)", 2, 2],
  ])(
    "preserves read roles for %s",
    (expression, edgeCount, occurrenceCount) => {
      const parent = mkdtempSync(join(tmpdir(), "self-join-read-fields-"));
      const dataRoot = join(parent, "data");
      const factsRoot = join(parent, "facts");

      for (const [qualifiedName, columns] of [
        ["demo.trade", "id INT, parent_id INT, amount DOUBLE"],
        ["demo.result", "total DOUBLE"],
      ]) {
        writeTableInput(dataRoot, {
          platform: "hive",
          dataSource: "warehouse",
          qualifiedName,
          objectType: "hive_table",
          partitionFields: [],
          ddl: `CREATE TABLE ${qualifiedName} (${columns});`,
          evidenceProvider: "synthetic:test",
          collectedAt: "2026-01-01T00:00:00.000Z",
        });
      }
      writeTaskInput(dataRoot, {
        taskId: "self-join",
        taskCategory: "hive2hive",
        taskName: "self-join",
        target: {
          platform: "hive",
          dataSource: "warehouse",
          qualifiedName: "demo.result",
        },
        targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
        partition: null,
        sql: {
          query: {
            content: `INSERT OVERWRITE TABLE demo.result SELECT ${expression} AS total FROM demo.trade a JOIN demo.trade b ON a.parent_id = b.id`,
            evidenceProvider: "synthetic:test",
          },
        },
        evidenceProvider: "synthetic:test",
        collectedAt: "2026-01-01T00:00:00.000Z",
      });
      runInputPackMachineFacts({
        dataRoot,
        taskIds: ["self-join"],
        outputRoot: factsRoot,
      });
      const projection = projectTaskLocal({
        taskId: "self-join",
        dataRoot,
        factsRoot,
      });
      const direct = projection.edges.filter(
        (edge) =>
          edge.edgeType === "FIELD_DIRECT" &&
          edge.properties.outputColumn === "total",
      );
      expect(
        direct.map((edge) => edge.properties.sourceReadOccurrenceStatus),
      ).toEqual(Array(edgeCount).fill("RESOLVED"));
      expect(
        new Set(direct.map((edge) => edge.properties.sourceReadOccurrenceId))
          .size,
      ).toBe(occurrenceCount);
      if (edgeCount > occurrenceCount) {
        expect(new Set(direct.map((edge) =>
          JSON.stringify(edge.properties.logicalInputPath),
        )).size).toBe(edgeCount);
      }
      const graph = compileTask(projection);
      const reads = graph.nodes.filter(
        (node) => node.kind === "READ_FIELD" && node.column === "amount",
      );
      expect(reads).toHaveLength(occurrenceCount);
      const values = graph.edges.filter((edge) => edge.kind === "VALUE");
      expect(values).toHaveLength(edgeCount);
      expect(new Set(values.map((edge) => edge.from))).toEqual(
        new Set(reads.map((node) => node.id)),
      );
      expect(new Set(values.map((edge) => edge.to)).size).toBe(1);
    },
    60_000,
  );
});
