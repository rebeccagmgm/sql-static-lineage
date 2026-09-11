import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildRegion, verifySql, redact } from "./model.mjs";

const ref = (table) => ({ table });
const task = (taskId, inputs, outputs) => ({
  taskId,
  category: "hiveTask",
  name: taskId,
  inputs: inputs.map(ref),
  outputs: outputs.map(ref),
});
function fixture() {
  const tasks = [
    task("1", ["source.contract"], ["odata_n_tit.contract"]),
    task("2", ["odata_n_tit.contract"], ["odata_n_tit.contract_pb"]),
    task(
      "3",
      ["odata_n_tit.contract", "odata_n_tit.contract_pb"],
      ["pdata_n.result"],
    ),
    task("4", ["source.unknown"], ["odata_n_tit.unknown"]),
  ];
  const names = [
    ...new Set(
      tasks.flatMap((t) => [...t.inputs, ...t.outputs].map((x) => x.table)),
    ),
  ];
  const network = {
    version: "v1",
    tasks,
    tables: names.map((table) => ({
      table,
      readers: tasks
        .filter((t) => t.inputs.some((x) => x.table === table))
        .map((t) => t.taskId),
      writers: tasks
        .filter((t) => t.outputs.some((x) => x.table === table))
        .map((t) => t.taskId),
    })),
  };
  const analysis = {
    scope: { graphVersion: "v1" },
    taskRoles: {
      ingress: ["1", "4"],
      internal: ["2"],
      externalConsumer: ["3"],
    },
    branches: [
      { id: "source_supply", title: "接入", taskIds: ["1", "4"] },
      { id: "latest_pnl", title: "损益选择", taskIds: ["2"] },
    ],
  };
  return {
    network,
    analysis,
    groups: [{ id: "contracts", title: "合约", families: ["contract"] }],
  };
}
test("all local tables belong to exactly one navigation group, with explicit unclassified remainder", () => {
  const region = buildRegion(fixture());
  assert.equal(
    region.groups.find((g) => g.id === "contracts").tableNames.length,
    2,
  );
  assert.equal(
    region.groups.find((g) => g.id === "unclassified").tableNames.length,
    1,
  );
  assert.equal(region.groups.flatMap((g) => g.tableNames).length, 3);
  assert.equal(
    region.families.find((f) => f.id === "contract").consumerIds.length,
    1,
  );
});
test("a _pb suffix does not override reviewed processing membership", () => {
  const region = buildRegion(fixture());
  assert.deepEqual(
    region.tables.find((t) => t.name === "odata_n_tit.contract_pb").methodIds,
    ["latest_pnl"],
  );
});
test("a table can receive both source and processing outputs", () => {
  const data = fixture();
  data.network.tasks[1].outputs.push(ref("odata_n_tit.contract"));
  data.network.tables
    .find((t) => t.table === "odata_n_tit.contract")
    .writers.push("2");
  assert.deepEqual(
    buildRegion(data).tables.find((t) => t.name === "odata_n_tit.contract")
      .methodIds,
    ["source_supply", "latest_pnl"],
  );
});
test("changed scope, overlapping groups, and incomplete processing membership fail visibly", () => {
  const changed = fixture();
  changed.analysis.taskRoles.internal = [];
  assert.throws(() => buildRegion(changed), /ROLE_MEMBERSHIP_CHANGED/);
  const duplicate = fixture();
  duplicate.groups.push({ id: "another", families: ["contract"] });
  assert.throws(() => buildRegion(duplicate), /DUPLICATE_FAMILY/);
  const omitted = fixture();
  omitted.analysis.branches.pop();
  assert.throws(() => buildRegion(omitted), /METHOD_MEMBERSHIP_INCOMPLETE/);
});
test("reviewed SQL must retain its bound digest", () => {
  const text = "select 1";
  const sha256 = createHash("sha256").update(text).digest("hex");
  assert.equal(verifySql("2", text, sha256), sha256);
  assert.throws(
    () => verifySql("2", "select 2", sha256),
    /REVIEWED_SQL_CHANGED/,
  );
});
test("display text omits connection locations and credentials while preserving SQL line count", () => {
  const input =
    "-- https://example.internal/x\n-- jdbc:oracle:thin:test\n-- password='sample'\nselect '10.0.0.1', 'node.gf.com.cn';";
  const safe = redact(input);
  assert.equal(safe.split("\n").length, input.split("\n").length);
  assert.doesNotMatch(
    safe,
    /example\.internal|sample|10\.0\.0\.1|node\.gf\.com\.cn/,
  );
});
