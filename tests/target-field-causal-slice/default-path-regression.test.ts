import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseTargetFieldCausalSliceCli } from "../../scripts/reconcile/consumer/target-field-causal-slice/reconcile-target-field-causal-slice.ts";

const GOLDEN_ROOT = resolve(
  "tests/fixtures/target-field-causal-slice/legacy-field-lineage-golden",
);

function fileSha256(name: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(GOLDEN_ROOT, name)))
    .digest("hex");
}

describe("Native default causal-slice path", () => {
  it("keeps representative field-lineage goldens byte-for-byte frozen", () => {
    expect({
      valueFlow: fileSha256("value-flow.json"),
      rowsetControl: fileSha256("rowset-control.json"),
      defaultHive: fileSha256("default-hive-schema.json"),
      selfJoin: fileSha256("self-join-occurrence.json"),
    }).toEqual({
      valueFlow:
        "97207b7ccffdd7363cf6d4c86541c8ab146f4617280e2ec1f1ee9e7ab9ca6f9d",
      rowsetControl:
        "5ec76e33b7cc7777a697cd8ef29516d1833913c0c8baabc2e2b7e96e59ea3623",
      defaultHive:
        "ff37632dab30b9f1e7c7685fe2223eddd9e43d1407ea382a7acb2d72fabe8b9b",
      selfJoin:
        "f09bb9ef8631922655a6407a5a946f71221fe235a1ea343eb0be92784102f122",
    });
  });

  it("does not enable a semantic engine on the default causal-slice CLI path", () => {
    const options = parseTargetFieldCausalSliceCli([
      "--data-root",
      "input",
      "--facts-root",
      "facts",
      "--producer-index",
      "producer.json",
      "--table-multi-hop",
      "multi-hop.json",
      "--task-id",
      "task-1",
      "--target-table",
      "db.target",
      "--output",
      "slice.json",
      "--write-observation-id",
      "write:task-1:0",
    ]);

    expect(options.output).toBe("slice.json");
  });

  it("keeps the Calcite sidecar out of default canonical entrypoints", () => {
    for (const entrypoint of [
      "scripts/reconcile/consumer/field-lineage/reconcile-field-lineage.ts",
      "scripts/reconcile/consumer/target-field-causal-slice/reconcile-target-field-causal-slice.ts",
      "scripts/pipeline/lineage-all.ts",
    ]) {
      expect(readFileSync(resolve(entrypoint), "utf8")).not.toContain(
        "calcite-differential",
      );
    }
  });
});
