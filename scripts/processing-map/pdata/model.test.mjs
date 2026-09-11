import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { snapshotVersion } from "./content.mjs";
import { parsePlacement } from "./placement.mjs";
import { buildRegion } from "./model.mjs";

const network = JSON.parse(
  readFileSync(
    new URL(
      "../../../tmp/processing-skeleton/table-network.json",
      import.meta.url,
    ),
  ),
);
const markdown = readFileSync(
  new URL(
    "../../../docs/processing-map/pdata-output-placement.md",
    import.meta.url,
  ),
  "utf8",
);
const placement = parsePlacement(markdown, network);
const { branches } = placement;
test("the fixed batch retains every output, writer and boundary object", () => {
  const region = buildRegion(network, branches);
  assert.equal(region.tables.length, 284);
  assert.equal(region.counts.outputs, 132);
  assert.equal(region.counts.writers, 263);
  assert.equal(region.counts.readOnly, 151);
  assert.equal(region.counts.unlinked, 1);
  assert.equal(region.counts.ingress, 212);
  assert.equal(region.counts.internal, 136);
  assert.equal(new Set(region.branches.flatMap((b) => b.tables)).size, 132);
  assert.equal(new Set(region.branches.flatMap((b) => b.taskIds)).size, 263);
  assert.deepEqual(region.unassigned, []);
});
test("downstream counts keep producers outside the batch separate", () => {
  const region = buildRegion(network, branches);
  const index = region.downstream.find((x) => x.schema === "dm_index_n");
  assert.equal(index.taskIds.length, 80);
  assert.equal(index.fromOutputs.length, 32);
  assert.equal(index.boundaryOnly.length, 48);
  const map = region.tables.find((t) => t.name === "pdata_n.ref_cd_cvt_map");
  assert.equal(map.scope, "read-only");
  assert.equal(map.branchId, null);
});
test("membership rejects duplicate assignments and a different graph batch", () => {
  assert.throws(
    () => buildRegion({ ...network, version: "other" }, branches),
    /SNAPSHOT/,
  );
  const duplicate = [...branches, branches[0]];
  assert.throws(() => buildRegion(network, duplicate), /DUPLICATE/);
  assert.equal(network.version, snapshotVersion);
});
test("reviewed placement preserves shared identity and separates location from write coverage", () => {
  const region = buildRegion(network, branches);
  const name = "pdata_n.t03_agt_rela_h";
  const item = region.tables.find((t) => t.name === name);
  assert.equal(item.memberships.length, 2);
  assert.deepEqual(placement.records[name].routes, ["B", "L"]);
  assert.deepEqual(placement.counts, {
    已有依据: 42,
    暂定: 90,
    仍待解释: 0,
    explainedWrites: 26,
  });
  assert.equal(placement.records["pdata_n.t01_pty"].status, "已有依据");
  assert.deepEqual(placement.records["pdata_n.t01_pty"].explainedWrites, []);
  assert.equal(
    placement.records["pdata_n.t98_otc_opt_comp_sub_trd_base_info"].status,
    "暂定",
  );
});
test("placement changes fail closed on omitted outputs, writer drift or inconsistent group index", () => {
  assert.throws(
    () =>
      parsePlacement(markdown.replace(/^.*id="out-001".*\r?\n/m, ""), network),
    /SET_MISMATCH/,
  );
  assert.throws(
    () =>
      parsePlacement(
        markdown.replace("[142305][ev-142305]", "[142306][ev-142306]"),
        network,
      ),
    /WRITERS_MISMATCH/,
  );
  assert.throws(
    () =>
      parsePlacement(markdown.replace("| 16 | [006]", "| 17 | [006]"), network),
    /INDEX_MISMATCH/,
  );
});
