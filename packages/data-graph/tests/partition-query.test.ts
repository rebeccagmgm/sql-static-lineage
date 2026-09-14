import {beforeEach, describe, expect, it, vi} from "vitest";
import {PartitionQueries} from "../src/asset-graph/partition-query.ts";
import {partitionOptions, type PartitionWrite} from "../src/asset-graph/partition-selection.ts";

const fixture = vi.hoisted(() => ({files: new Map<string, unknown>(), index: {index: {entries: [] as any[]}, policyTerminals: [] as any[], boundarySnapshot: null}}));
vi.mock("../src/asset-graph/evidence-json.ts", () => ({readJson: (path: string) => fixture.files.get(path)}));
vi.mock("../src/asset-graph/continuation-metrics-query.ts", () => ({loadPublishedContinuationIndex: () => fixture.index}));
vi.mock("../src/continuation/task-local-projection.ts", () => ({unpackTaskLocalProjectionEnvelope: () => ({})}));

const write = (taskId: string, writeId: string, datasetId: string, group: string): PartitionWrite => ({taskId, writeId, datasetId, targetId: `target:${writeId}`, partition: [{column: "grp_id", values: [group]}]});
const a1 = write("1", "a1", "dataset:a", "01"), a2 = write("1", "a2", "dataset:a", "02"), b = write("2", "b", "dataset:b", "OTHER"), bad = write("3", "bad", "dataset:b", "WRONG");
const datasets = ["a", "b", "c"].map(id => ({id: `dataset:${id}`, kind: "PHYSICAL_DATASET", table: `dm.${id}`, detail: {}}));
const taskNodes = ["1", "2", "3"].map(taskId => ({id: `task:${taskId}`, kind: "TASK", taskId, detail: {}}));
const candidate = (w: PartitionWrite, status: string) => ({taskId: w.taskId, writeObservationId: w.writeId, targetWriteNodeId: w.targetId, datasetNodeId: w.datasetId, partition: w.partition, partitionMatchStatus: status, l1Eligible: status === "CONFIRMED"});
function setup() {
  const writes = [a1, a2, b, bad];
  const projection = (taskId: string) => {
    const own = writes.filter(w => w.taskId === taskId);
    const reads = own.map(w => ({readOccurrenceId: `read:${w.writeId}`, readOccurrenceNodeId: `occ:${w.writeId}`, datasetNodeId: w === a1 ? b.datasetId : "dataset:c", qualifiedName: "dm.input"}));
    return {taskId, nodes: reads.map((read, i) => ({nodeId: read.readOccurrenceNodeId, nodeType: "READ_OCCURRENCE", properties: {statementId: `stmt:${own[i]!.writeId}`, partitionPredicates: [{column: "src_id", values: ["TIT"]}], partitionPredicateStatus: "LITERAL"}})), edges: [], localClosure: {externalReads: reads, finalWrites: own.map(w => ({datasetNodeId: w.datasetId, targetWriteNodeId: w.targetId, writeObservationId: w.writeId}))}};
  };
  fixture.files.set("manifest", {tasks: ["1", "2", "3"].map(taskId => ({taskId, path: taskId, evidencePath: `e:${taskId}`, contentHash: taskId}))});
  for (const taskId of ["1", "2", "3"]) {
    fixture.files.set(taskId, {projection: projection(taskId)});
    fixture.files.set(`e:${taskId}`, {datasetIo: writes.filter(w => w.taskId === taskId).map(w => ({write_observation_id: w.writeId, write_statement_id: `stmt:${w.writeId}`}))});
  }
  fixture.index.index.entries = [{consumerTaskId: "1", readOccurrenceId: "read:a1", datasetNodeId: b.datasetId, candidates: [candidate(b, "CONFIRMED"), candidate(bad, "DISJOINT")]}, {consumerTaskId: "1", readOccurrenceId: "read:a2", datasetNodeId: "dataset:c", candidates: []}, {consumerTaskId: "2", readOccurrenceId: "read:b", datasetNodeId: "dataset:c", candidates: []}];
  const store = {ready: async () => ({version: "v", manifestPath: "manifest"}), run: vi.fn(async (_query: string, params: any) => {
    const ns = params.id ? writes.filter(w => w.datasetId === params.id).map(w => ({id: w.targetId, kind: "TARGET_WRITE", taskId: w.taskId, writeId: w.writeId, detail: {partition: w.partition}})) : [...datasets, ...taskNodes].filter(n => params.ids.includes(n.id));
    return {records: ns.map(n => ({get: () => n}))};
  })};
  const query = new PartitionQueries(store as any, "fixture");
  const options = partitionOptions([a1, a2]);
  const selection = {datasetId: a1.datasetId, version: "v", optionIds: [options[0]!.id]};
  return {query, selection, options};
}
beforeEach(() => fixture.files.clear());
describe("partition-scoped table traversal", () => {
  it("isolates same-task multiple writes and follows upstream's own range", async () => {
    const {query, selection} = setup();
    const result = await query.trace(selection, {direction: "up", depth: 2, limit: 50, includeCandidates: true});
    expect(result.edges.filter((e: any) => e.kind === "WRITES_TABLE").map((e: any) => e.detail.writeObservationId)).toEqual(["a1", "b"]);
    expect(result.edges.some((e: any) => e.detail.writeObservationId === "a2" || e.owner === "3")).toBe(false);
    // b's OTHER partition is valid even though a's chosen partition is 01.
    expect(result.nodes.map((n: any) => n.id)).toContain("task:2");
    const read = result.edges.find((e: any) => e.kind === "READS_TABLE" && e.owner === "1")!;
    expect(read.detail.partition).toBeUndefined();
    expect(read.detail.partitionPredicates).toEqual([{column: "src_id", values: ["TIT"]}]);
  });
  it("accepts cluster catalog task IDs and keeps the anchor when nothing matches", async () => {
    const {query, selection} = setup();
    const result = await query.trace(selection, {direction: "up", depth: 2, limit: 50, includeCandidates: true, clusterTaskIds: ["task:1"]});
    expect(result.nodes.filter((n: any) => n.kind === "TASK").map((n: any) => n.taskId)).toEqual(["1"]);
    expect((await query.trace(selection, {direction: "up", depth: 2, limit: 50, includeCandidates: true, clusterTaskIds: []})).edges).toHaveLength(0);
  });
  it("unions selected partitions without assigning all task reads to each write", async () => {
    const {query, selection, options} = setup();
    const result = await query.trace({...selection, optionIds: options.map(o => o.id)}, {direction: "up", depth: 1, limit: 50, includeCandidates: true});
    expect(result.edges.filter((e: any) => e.kind === "WRITES_TABLE")).toHaveLength(2);
    expect(result.edges.filter((e: any) => e.kind === "READS_TABLE")).toHaveLength(2);
  });
  it("continues a branch in either direction using its derived write scope", async () => {
    const {query, selection} = setup();
    for (const direction of ["up", "down"] as const) {
      const r = await query.trace(selection, {direction, depth: 1, scopeDirection: "up", scopeDepth: 1, focusNodeId: b.datasetId, limit: 50, includeCandidates: true});
      expect(r.edges.length).toBeGreaterThan(0);
      expect(r.edges.some((e: any) => e.owner === "3" || e.detail.writeObservationId === "a2")).toBe(false);
    }
  });
  it("reports limits and fails closed on an unselected focus or stale version", async () => {
    const {query, selection} = setup();
    expect((await query.trace(selection, {direction: "up", depth: 2, limit: 1, includeCandidates: true})).truncated).toBe(true);
    await expect(query.trace(selection, {direction: "up", depth: 1, focusNodeId: "dataset:missing", limit: 50, includeCandidates: true})).rejects.toThrow("OUTSIDE_SCOPE");
    await expect(query.trace({...selection, version: "old"}, {direction: "up", depth: 1, limit: 50, includeCandidates: true})).rejects.toThrow("VERSION_CHANGED");
  });
});
