import { openAssetGraph } from "../../../packages/data-graph/src/asset-graph/config.ts";
import { AssetGraphStore } from "../../../packages/data-graph/src/asset-graph/store.ts";

const graph = await openAssetGraph();
const store = new AssetGraphStore(graph.driver, graph.database, graph.graphId);

try {
  const nodes = [];
  for (const kind of [
    "TASK",
    "PHYSICAL_DATASET",
    "READ_FIELD",
    "WRITE_FIELD",
    "PHYSICAL_FIELD",
    "TARGET_WRITE",
  ]) {
    const result = await store.run(
      `
      MATCH (n:SLAssetNode {graphId:$graphId, kind:$kind})
      RETURN n.kind AS kind, properties(n) AS sample
      LIMIT 1
    `,
      { kind },
    );
    nodes.push(...result.records.map((record) => record.toObject()));
  }
  const edges = [];
  for (const kind of [
    "READS_TABLE",
    "WRITES_TABLE",
    "VALUE",
    "CONDITION",
    "DATASET_CONTROL",
  ]) {
    const result = await store.run(
      `
      MATCH (a:SLAssetNode)-[r:SL_ASSET_EDGE {graphId:$graphId, kind:$kind}]->(b:SLAssetNode)
      RETURN r.kind AS kind, properties(a) AS source,
             properties(r) AS edge, properties(b) AS target
      LIMIT 1
    `,
      { kind },
    );
    edges.push(...result.records.map((record) => record.toObject()));
  }
  console.log(
    JSON.stringify(
      {
        nodes,
        edges,
      },
      null,
      2,
    ),
  );
} finally {
  await graph.driver.close();
}
