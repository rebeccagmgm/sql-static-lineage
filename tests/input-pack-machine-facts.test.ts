import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  prepareInputPackTask,
  runInputPackMachineFacts,
} from "../scripts/machine-facts/input-pack-machine-facts.ts";
import { writeTaskInput } from "../scripts/input/shared/input-pack.ts";
import { createSyntheticFieldLineageInputPack } from "./fixtures/field-lineage/cases.ts";

function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "input-pack-machine-facts-"));
  const dataRoot = join(parent, "data");
  const factsRoot = join(parent, "facts");
  createSyntheticFieldLineageInputPack(dataRoot);
  return { parent, dataRoot, factsRoot };
}

function jsonl(path: string): Record<string, unknown>[] {
  const text = readFileSync(path, "utf8").trim();
  return text ? text.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

describe("Input Pack-driven Machine Facts", () => {
  it("keeps a repeated platform SQL response raw while parsing a derived deduplicated view", () => {
    const f = fixture();
    const repeated =
      "SELECT m.mid_a AS out_a, m.filter_key AS out_b FROM demo.mid m\n\n" +
      "SELECT m.mid_a AS out_a, m.filter_key AS out_b FROM demo.mid m";
    writeTaskInput(f.dataRoot, {
      taskId: "1100",
      taskCategory: "sparkIndex",
      taskName: "demo.repeated-response.task",
      target: {
        platform: "hive",
        dataSource: "warehouse",
        qualifiedName: "demo.root",
      },
      targetEvidenceKind: "DIRECT_PLATFORM_TARGET",
      partition: null,
      sql: { query: { content: repeated, evidenceProvider: "synthetic:test" } },
      evidenceProvider: "synthetic:test",
      collectedAt: "2026-01-01T00:00:00.000Z",
    });

    const prepared = prepareInputPackTask({ dataRoot: f.dataRoot, taskId: "1100" });
    expect(prepared.sqlSources[0]?.content).toBe(repeated);
    expect(prepared.sql.content).not.toContain("\n\nSELECT");
    expect(prepared.sql.analysisContent).not.toContain("\n\nSELECT");

    const result = runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["1100"],
      outputRoot: f.factsRoot,
    });
    expect(result.tasks[0]?.state).toBe("SUCCESS");
    const bindings = jsonl(
      join(f.factsRoot, "registry", "tasks", "1100", "bundle", "output-field-bindings.jsonl"),
    );
    expect(bindings).toHaveLength(2);
    expect(
      jsonl(join(f.factsRoot, "registry", "tasks", "1100", "bundle", "unknowns.jsonl")),
    ).toHaveLength(0);
  });

  it("selects query, preserves provenance, and binds platform query output", () => {
    const f = fixture();
    const prepared = prepareInputPackTask({
      dataRoot: f.dataRoot,
      taskId: "100",
    });
    expect(prepared.sql.slot).toBe("query");
    expect(prepared.sql.content).toContain("SELECT m.mid_a");
    const result = runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["100"],
      outputRoot: f.factsRoot,
    });
    expect(result.tasks[0]?.state).toBe("SUCCESS");
    const bundle = join(f.factsRoot, "registry", "tasks", "100", "bundle");
    const manifest = JSON.parse(
      readFileSync(join(bundle, "manifest.json"), "utf8"),
    );
    expect(manifest.inputs.input_pack).toMatchObject({
      sql_slot: "query",
      task_content_hash: prepared.task.contentHash,
    });
    const statements = jsonl(join(bundle, "statements.jsonl"));
    expect(String(statements[0]?.statement_id)).toContain(":slot:query:");
    const bindings = jsonl(join(bundle, "output-field-bindings.jsonl"));
    expect(bindings).toHaveLength(2);
    expect(
      bindings.every(
        (binding) => binding.evidence_kind === "PLATFORM_TARGET_QUERY_OUTPUT",
      ),
    ).toBe(true);
  });

  it("keeps explicit SQL writes distinct", () => {
    const f = fixture();
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["200"],
      outputRoot: f.factsRoot,
    });
    const bindings = jsonl(
      join(
        f.factsRoot,
        "registry",
        "tasks",
        "200",
        "bundle",
        "output-field-bindings.jsonl",
      ),
    );
    expect(bindings).toHaveLength(2);
    expect(
      bindings.every(
        (binding) => binding.evidence_kind === "SQL_EXPLICIT_WRITE",
      ),
    ).toBe(true);
  });

  it("fails closed when an Input Pack file changes during preparation", () => {
    const f = fixture();
    const taskPath = join(
      f.dataRoot,
      "tasks",
      "sparkIndex",
      "100",
      "task.json",
    );
    expect(() =>
      prepareInputPackTask({
        dataRoot: f.dataRoot,
        taskId: "100",
        beforeFinalVerification: () =>
          writeFileSync(taskPath, `${readFileSync(taskPath, "utf8")} `, "utf8"),
      }),
    ).toThrow(/INPUT_CHANGED_DURING_PREPARATION/);
  });

  it("rejects ambiguous fallback slots and missing Task Packs", () => {
    const f = fixture();
    expect(() =>
      prepareInputPackTask({ dataRoot: f.dataRoot, taskId: "600" }),
    ).toThrow(/SQL_SLOT_SELECTION_AMBIGUOUS/);
    expect(() =>
      prepareInputPackTask({ dataRoot: f.dataRoot, taskId: "999" }),
    ).toThrow(/TASK_INPUT_PACK_MISSING/);
  });

  it("replays deterministically from the same Input Pack snapshot", () => {
    const f = fixture();
    const first = runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["100"],
      outputRoot: f.factsRoot,
    });
    const second = runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["100"],
      outputRoot: f.factsRoot,
    });
    expect(first.tasks[0]?.manifest_sha256).toBe(
      second.tasks[0]?.manifest_sha256,
    );
    expect(second.tasks[0]?.status).toBe("REUSED");
  });

  it("binds UNION output through a dynamic partition only when Input Pack proves it", () => {
    const f = fixture();
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["800"],
      outputRoot: f.factsRoot,
    });
    const bindings = jsonl(
      join(
        f.factsRoot,
        "registry",
        "tasks",
        "800",
        "bundle",
        "output-field-bindings.jsonl",
      ),
    );
    expect(bindings).toHaveLength(2);
    expect(
      bindings.find((binding) => binding.target_field === "value_col"),
    ).toMatchObject({ evidence_kind: "SQL_EXPLICIT_WRITE" });
    expect(
      bindings.find((binding) => binding.target_field === "p")
        ?.static_partition_columns,
    ).toEqual(["p"]);
  });

  it("freezes every canonical SQL slot while analyzing Task-local CTAS in one derived snapshot", () => {
    const f = fixture();
    const prepared = prepareInputPackTask({
      dataRoot: f.dataRoot,
      taskId: "1000",
    });
    expect(prepared.sql.slot).toBe("multi");
    expect(prepared.sqlSources.map((source) => source.slot)).toEqual([
      "create",
      "query",
    ]);
    runInputPackMachineFacts({
      dataRoot: f.dataRoot,
      taskIds: ["1000"],
      outputRoot: f.factsRoot,
    });
    for (const source of prepared.sqlSources)
      expect(
        existsSync(
          join(
            f.factsRoot,
            "input-pack-sources",
            "1000",
            `${source.slot}-${source.sha256}.sql`,
          ),
        ),
      ).toBe(true);
    const bundle = join(f.factsRoot, "registry", "tasks", "1000", "bundle");
    const manifest = JSON.parse(
      readFileSync(join(bundle, "manifest.json"), "utf8"),
    );
    expect(manifest.inputs.input_pack.sql_sources).toHaveLength(2);
    const statements = jsonl(join(bundle, "statements.jsonl"));
    expect(
      statements.some((statement) =>
        String(statement.statement_id).includes(":slot:create:"),
      ),
    ).toBe(true);
    expect(
      statements.some((statement) =>
        String(statement.statement_id).includes(":slot:query:"),
      ),
    ).toBe(true);
    const targets = new Set(
      jsonl(join(bundle, "output-field-bindings.jsonl")).map(
        (binding) => binding.target_dataset,
      ),
    );
    expect(targets).toEqual(
      new Set(["demo.root", "temp.local_stage", "temp.mid_stage"]),
    );
  });
});
