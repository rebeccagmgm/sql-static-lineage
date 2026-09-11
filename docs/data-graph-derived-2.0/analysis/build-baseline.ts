import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { openAssetGraph } from "../../../packages/data-graph/src/asset-graph/config.ts";
import { AssetGraphStore } from "../../../packages/data-graph/src/asset-graph/store.ts";

const EXPECTED_VERSION =
  "44e87de15ca82eb40480569c1db59c87b3636f7194b50576137889162425224e";
const OUTPUT_DIR = dirname(fileURLToPath(import.meta.url));
const LEGACY_TEMP_EXCLUSIONS = new Set([
  "pdata_n.t98_org_emp_base_info",
  "pdata_n.t98_org_brch_div_info",
  "pdata_news_n.t02_tit_scr_base_info",
  "pdata_news_n.t02_scr_base_info",
]);
const PAGE_SIZE = 10_000;

type Row = Record<string, unknown>;
type TableNode = {
  id: string;
  table: string;
  platform: string;
  dataSource: string;
  identityStatus: string;
};
type TablePair = {
  source: string;
  target: string;
  tasks: Set<string>;
  multiOutputTasks: Set<string>;
};
type FieldPair = {
  source: string;
  target: string;
  kinds: Set<string>;
  tasks: Set<string>;
  sourceColumns: Set<string>;
  targetColumns: Set<string>;
  edges: number;
};

const graph = await openAssetGraph();
const store = new AssetGraphStore(graph.driver, graph.database, graph.graphId);

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function detail(value: unknown): Row {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    return JSON.parse(value) as Row;
  } catch {
    return {};
  }
}

function setAdd<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const values = map.get(key) ?? new Set<V>();
  values.add(value);
  map.set(key, values);
}

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(q * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

function histogram(
  values: number[],
  buckets: number[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const upper of buckets)
    result[`<=${upper}`] = values.filter((value) => value <= upper).length;
  result[`>${buckets.at(-1)}`] = values.filter(
    (value) => value > (buckets.at(-1) ?? 0),
  ).length;
  return result;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function rows(query: string, params: Row = {}): Promise<Row[]> {
  const result = await store.run(query, params);
  return result.records.map((record) => record.toObject());
}

async function paged(query: string, params: Row = {}): Promise<Row[]> {
  const output: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await rows(
      `${query}\nORDER BY ${query.includes("[r:") ? "elementId(r)" : "elementId(n)"}\nSKIP $offset LIMIT $limit`,
      {
        ...params,
        offset,
        limit: PAGE_SIZE,
      },
    );
    output.push(...page);
    if (page.length < PAGE_SIZE) return output;
  }
}

function identityKey(properties: Row): string {
  const parsed = detail(properties.detail);
  return [
    text(parsed.platform).toLowerCase(),
    text(parsed.dataSource).toLowerCase(),
    text(parsed.qualifiedName ?? properties.table).toLowerCase(),
  ].join("|");
}

function schemaOf(table: string): string {
  const index = table.indexOf(".");
  return index === -1 ? "(unqualified)" : table.slice(0, index);
}

function displayTable(node: TableNode): Row {
  return {
    id: node.id,
    table: node.table,
    platform: node.platform,
    dataSource: node.dataSource,
    identityStatus: node.identityStatus,
  };
}

function connectedComponents(
  nodes: Iterable<string>,
  edges: Iterable<[string, string]>,
) {
  const parent = new Map<string, string>();
  const find = (node: string): string => {
    if (!parent.has(node)) parent.set(node, node);
    let root = parent.get(node)!;
    while (root !== parent.get(root)) root = parent.get(root)!;
    let cursor = node;
    while (cursor !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (left: string, right: string) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  };
  for (const node of nodes) find(node);
  for (const [source, target] of edges) union(source, target);
  const groups = new Map<string, string[]>();
  for (const node of parent.keys()) {
    const root = find(node);
    const group = groups.get(root) ?? [];
    group.push(node);
    groups.set(root, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!),
  );
}

function maximalLinearChains(
  nodes: Iterable<string>,
  outgoing: Map<string, Set<string>>,
  incoming: Map<string, Set<string>>,
) {
  const degreeOne = (node: string) =>
    (incoming.get(node)?.size ?? 0) === 1 &&
    (outgoing.get(node)?.size ?? 0) === 1;
  const chains: string[][] = [];
  const coveredEdges = new Set<string>();
  for (const source of nodes) {
    if (degreeOne(source)) continue;
    for (const first of outgoing.get(source) ?? []) {
      const path = [source, first];
      let cursor = first;
      while (degreeOne(cursor)) {
        const next = [...(outgoing.get(cursor) ?? [])][0]!;
        if (path.includes(next)) {
          path.push(next);
          break;
        }
        path.push(next);
        cursor = next;
      }
      for (let index = 0; index + 1 < path.length; index += 1)
        coveredEdges.add(`${path[index]}|${path[index + 1]}`);
      if (path.length >= 3) chains.push(path);
    }
  }
  const cycles: string[][] = [];
  const visited = new Set<string>();
  for (const start of nodes) {
    if (!degreeOne(start) || visited.has(start)) continue;
    const path: string[] = [];
    let cursor = start;
    while (!visited.has(cursor) && degreeOne(cursor)) {
      visited.add(cursor);
      path.push(cursor);
      cursor = [...(outgoing.get(cursor) ?? [])][0]!;
    }
    if (cursor === start) cycles.push(path);
  }
  chains.sort(
    (a, b) => b.length - a.length || a.join("|").localeCompare(b.join("|")),
  );
  cycles.sort(
    (a, b) => b.length - a.length || a.join("|").localeCompare(b.join("|")),
  );
  return { chains, cycles, coveredEdgeCount: coveredEdges.size };
}

function listMarkdownFiles(root: string): string[] {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return [];
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...listMarkdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) result.push(path);
  }
  return result;
}

function priorEvidenceReferences(root: string) {
  const references = new Map<string, Set<string>>();
  const pattern =
    /task-projections[\\/]tasks[\\/](\d+)[\\/]versions[\\/]([a-f0-9]{32,})\.evidence-v3\.json/giu;
  for (const file of listMarkdownFiles(root)) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(pattern)) {
      const taskId = match[1]!;
      const versions = references.get(taskId) ?? new Set<string>();
      versions.add(match[2]!);
      references.set(taskId, versions);
    }
  }
  return references;
}

function candidateView(
  name: string,
  fieldPairs: Array<FieldPair & { targetCoverage: number | null }>,
  sourceThreshold: number,
  coverageThreshold: number,
  tables: Map<string, TableNode>,
) {
  const retained = fieldPairs.filter(
    (pair) =>
      pair.kinds.has("VALUE") &&
      pair.sourceColumns.size >= sourceThreshold &&
      pair.targetCoverage !== null &&
      pair.targetCoverage >= coverageThreshold,
  );
  const componentNodes = new Set(
    retained.flatMap((pair) => [pair.source, pair.target]),
  );
  const components = connectedComponents(
    componentNodes,
    retained.map((pair) => [pair.source, pair.target] as [string, string]),
  );
  const degree = new Map<string, number>();
  for (const pair of retained) {
    degree.set(pair.source, (degree.get(pair.source) ?? 0) + 1);
    degree.set(pair.target, (degree.get(pair.target) ?? 0) + 1);
  }
  return {
    name,
    definition: {
      minDistinctSourceColumns: sourceThreshold,
      minTargetCoverage: coverageThreshold,
    },
    retainedPairs: retained.length,
    participatingTables: componentNodes.size,
    componentCount: components.length,
    componentSizes: components
      .slice(0, 30)
      .map((component) => component.length),
    largestComponents: components.slice(0, 20).map((component) => ({
      size: component.length,
      schemas: [
        ...new Set(
          component.map((id) => schemaOf(tables.get(id)?.table ?? "")),
        ),
      ].sort(),
      representatives: [...component]
        .sort(
          (a, b) =>
            (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b),
        )
        .slice(0, 12)
        .map((id) => tables.get(id)?.table ?? id),
    })),
  };
}

try {
  const initialState = (await store.ready()) as Row;
  if (text(initialState.version) !== EXPECTED_VERSION)
    throw new Error(`GRAPH_VERSION_CHANGED:${text(initialState.version)}`);
  const observedCounts = await rows(
    `MATCH (n:SLAssetNode {graphId:$graphId}) RETURN n.kind AS kind, count(n) AS count`,
  );

  const datasetRows = await paged(`
    MATCH (n:SLAssetNode {graphId:$graphId, kind:'PHYSICAL_DATASET'})
    RETURN n.id AS id, n.table AS table, n.detail AS detail
  `);
  const tables = new Map<string, TableNode>();
  const datasetsByIdentity = new Map<string, Set<string>>();
  for (const row of datasetRows) {
    const parsed = detail(row.detail);
    const node: TableNode = {
      id: text(row.id),
      table: text(row.table).toLowerCase(),
      platform: text(parsed.platform).toLowerCase(),
      dataSource: text(parsed.dataSource).toLowerCase(),
      identityStatus: text(parsed.identityStatus),
    };
    tables.set(node.id, node);
    setAdd(datasetsByIdentity, identityKey(row), node.id);
  }
  if (tables.size !== datasetRows.length)
    throw new Error("DUPLICATE_DATASET_ROWS");
  const actualDatasetCount = Number(
    observedCounts.find((row) => row.kind === "PHYSICAL_DATASET")?.count,
  );
  if (tables.size !== actualDatasetCount)
    throw new Error("DATASET_COUNT_MISMATCH");

  const readRows = await paged(`
    MATCH (source:SLAssetNode {graphId:$graphId, kind:'PHYSICAL_DATASET'})
          -[r:SL_ASSET_EDGE {graphId:$graphId, kind:'READS_TABLE'}]->
          (task:SLAssetNode {graphId:$graphId, kind:'TASK'})
    RETURN source.id AS datasetId, task.taskId AS taskId, r.detail AS detail
  `);
  const writeRows = await paged(`
    MATCH (task:SLAssetNode {graphId:$graphId, kind:'TASK'})
          -[r:SL_ASSET_EDGE {graphId:$graphId, kind:'WRITES_TABLE'}]->
          (target:SLAssetNode {graphId:$graphId, kind:'PHYSICAL_DATASET'})
    RETURN task.taskId AS taskId, target.id AS datasetId, r.detail AS detail, r.status AS status
  `);

  const taskReads = new Map<string, Set<string>>();
  const taskWrites = new Map<string, Set<string>>();
  const occurrenceTargets = new Map<string, Set<string>>();
  const writeTargets = new Map<string, Set<string>>();
  for (const row of readRows) {
    const taskId = text(row.taskId);
    const datasetId = text(row.datasetId);
    setAdd(taskReads, taskId, datasetId);
    const occurrenceId = text(detail(row.detail).readOccurrenceId);
    if (occurrenceId)
      setAdd(occurrenceTargets, `${taskId}|${occurrenceId}`, datasetId);
  }
  for (const row of writeRows) {
    const taskId = text(row.taskId);
    const datasetId = text(row.datasetId);
    setAdd(taskWrites, taskId, datasetId);
    const writeId = text(detail(row.detail).writeObservationId);
    if (writeId) setAdd(writeTargets, `${taskId}|${writeId}`, datasetId);
  }

  const tablePairs = new Map<string, TablePair>();
  const ioTables = new Set<string>();
  const tableReaders = new Map<string, Set<string>>();
  const tableWriters = new Map<string, Set<string>>();
  for (const [taskId, readsForTask] of taskReads) {
    const writesForTask = taskWrites.get(taskId) ?? new Set<string>();
    for (const source of readsForTask) {
      ioTables.add(source);
      setAdd(tableReaders, source, taskId);
      for (const target of writesForTask) {
        ioTables.add(target);
        if (source === target) continue;
        const key = `${source}|${target}`;
        const pair = tablePairs.get(key) ?? {
          source,
          target,
          tasks: new Set<string>(),
          multiOutputTasks: new Set<string>(),
        };
        pair.tasks.add(taskId);
        if (writesForTask.size > 1) pair.multiOutputTasks.add(taskId);
        tablePairs.set(key, pair);
      }
    }
  }
  for (const [taskId, writesForTask] of taskWrites)
    for (const target of writesForTask) {
      ioTables.add(target);
      setAdd(tableWriters, target, taskId);
    }

  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  for (const pair of tablePairs.values()) {
    setAdd(outgoing, pair.source, pair.target);
    setAdd(incoming, pair.target, pair.source);
  }
  const components = connectedComponents(
    ioTables,
    [...tablePairs.values()].map((pair) => [pair.source, pair.target]),
  );
  const linear = maximalLinearChains(ioTables, outgoing, incoming);

  const writeFieldRows = await paged(`
    MATCH (n:SLAssetNode {graphId:$graphId, kind:'WRITE_FIELD'})
    RETURN n.taskId AS taskId, n.table AS table, n.column AS column, n.writeId AS writeId
  `);
  const outputColumns = new Map<string, Set<string>>();
  let mappedWriteFields = 0;
  let unmappedWriteFields = 0;
  let ambiguousWriteFields = 0;
  for (const row of writeFieldRows) {
    const targets = writeTargets.get(
      `${text(row.taskId)}|${text(row.writeId)}`,
    );
    if (!targets || targets.size === 0) {
      unmappedWriteFields += 1;
      continue;
    }
    if (targets.size > 1) {
      ambiguousWriteFields += 1;
      continue;
    }
    const target = [...targets][0]!;
    setAdd(outputColumns, target, text(row.column).toLowerCase());
    mappedWriteFields += 1;
  }

  const fieldPairs = new Map<string, FieldPair>();
  const fieldHotspots = new Map<
    string,
    {
      dataset: string;
      column: string;
      kind: string;
      tasks: Set<string>;
      targets: Set<string>;
      targetColumns: Set<string>;
      occurrences: Set<string>;
      edges: number;
    }
  >();
  const fieldMapping = {
    total: 0,
    sourceUnmapped: 0,
    sourceAmbiguous: 0,
    targetUnmapped: 0,
    targetAmbiguous: 0,
    self: 0,
    outsideTablePairBaseline: 0,
    aligned: 0,
  };
  const fieldMappingByKind: Record<string, typeof fieldMapping> = {};

  for (const kind of ["VALUE", "CONDITION"]) {
    const mappingBefore = { ...fieldMapping };
    const edgeRows = await paged(
      `
      MATCH (source:SLAssetNode)-[r:SL_ASSET_EDGE {graphId:$graphId, kind:$kind}]->
            (target:SLAssetNode {graphId:$graphId, kind:'WRITE_FIELD'})
      RETURN source.kind AS sourceKind, source.taskId AS sourceTaskId,
             source.table AS sourceTable, source.column AS sourceColumn,
             source.detail AS sourceDetail, target.taskId AS targetTaskId,
             target.table AS targetTable, target.column AS targetColumn,
             target.writeId AS targetWriteId, r.owner AS owner, r.detail AS edgeDetail
    `,
      { kind },
    );
    for (const row of edgeRows) {
      fieldMapping.total += 1;
      let sources: Set<string> | undefined;
      const sourceProperties = {
        table: row.sourceTable,
        detail: row.sourceDetail,
      };
      if (text(row.sourceKind) === "READ_FIELD") {
        const occurrenceId = text(detail(row.sourceDetail).occurrenceId);
        sources = occurrenceTargets.get(
          `${text(row.sourceTaskId)}|${occurrenceId}`,
        );
      } else {
        sources = datasetsByIdentity.get(identityKey(sourceProperties));
      }
      if (!sources || sources.size === 0) {
        fieldMapping.sourceUnmapped += 1;
        continue;
      }
      if (sources.size > 1) {
        fieldMapping.sourceAmbiguous += 1;
        continue;
      }
      const targets = writeTargets.get(
        `${text(row.targetTaskId)}|${text(row.targetWriteId)}`,
      );
      if (!targets || targets.size === 0) {
        fieldMapping.targetUnmapped += 1;
        continue;
      }
      if (targets.size > 1) {
        fieldMapping.targetAmbiguous += 1;
        continue;
      }
      const source = [...sources][0]!;
      const target = [...targets][0]!;
      if (source === target) {
        fieldMapping.self += 1;
        continue;
      }
      const pairKey = `${source}|${target}`;
      if (!tablePairs.has(pairKey)) {
        fieldMapping.outsideTablePairBaseline += 1;
        continue;
      }
      fieldMapping.aligned += 1;
      const typedPairKey = `${kind}|${pairKey}`;
      const pair = fieldPairs.get(typedPairKey) ?? {
        source,
        target,
        kinds: new Set<string>(),
        tasks: new Set<string>(),
        sourceColumns: new Set<string>(),
        targetColumns: new Set<string>(),
        edges: 0,
      };
      pair.kinds.add(kind);
      pair.tasks.add(text(row.owner || row.targetTaskId));
      pair.sourceColumns.add(text(row.sourceColumn).toLowerCase());
      pair.targetColumns.add(text(row.targetColumn).toLowerCase());
      pair.edges += 1;
      fieldPairs.set(typedPairKey, pair);

      const hotspotKey = `${kind}|${source}|${text(row.sourceColumn).toLowerCase()}`;
      const hotspot = fieldHotspots.get(hotspotKey) ?? {
        dataset: source,
        column: text(row.sourceColumn).toLowerCase(),
        kind,
        tasks: new Set<string>(),
        targets: new Set<string>(),
        targetColumns: new Set<string>(),
        occurrences: new Set<string>(),
        edges: 0,
      };
      hotspot.tasks.add(text(row.owner || row.targetTaskId));
      hotspot.targets.add(target);
      hotspot.targetColumns.add(
        `${target}|${text(row.targetColumn).toLowerCase()}`,
      );
      hotspot.occurrences.add(
        `${text(row.targetTaskId)}|${text(detail(row.sourceDetail).occurrenceId)}|${text(row.targetWriteId)}`,
      );
      hotspot.edges += 1;
      fieldHotspots.set(hotspotKey, hotspot);
    }
    fieldMappingByKind[kind] = Object.fromEntries(
      Object.entries(fieldMapping).map(([key, value]) => [
        key,
        value - mappingBefore[key as keyof typeof fieldMapping],
      ]),
    ) as typeof fieldMapping;
  }

  const controlRows = await paged(`
    MATCH (source:SLAssetNode {graphId:$graphId, kind:'PHYSICAL_FIELD'})
          -[r:SL_ASSET_EDGE {graphId:$graphId, kind:'DATASET_CONTROL'}]->
          (target:SLAssetNode {graphId:$graphId, kind:'TARGET_WRITE'})
    RETURN source.table AS sourceTable, source.column AS sourceColumn,
           source.detail AS sourceDetail, target.taskId AS targetTaskId,
           target.table AS targetTable, target.writeId AS targetWriteId,
           r.owner AS owner, r.detail AS edgeDetail
  `);
  const controlMapping = {
    total: controlRows.length,
    sourceUnmapped: 0,
    sourceAmbiguous: 0,
    targetUnmapped: 0,
    targetAmbiguous: 0,
    self: 0,
    outsideTablePairBaseline: 0,
    aligned: 0,
    missingRelationIdentity: 0,
  };
  const controlHotspots = new Map<
    string,
    {
      dataset: string;
      column: string;
      tasks: Set<string>;
      targets: Set<string>;
      subtypes: Map<string, Set<string>>;
      relations: Set<string>;
      edges: number;
    }
  >();
  const controlSubtypes = new Map<string, number>();
  const controlGrains = new Map<string, number>();
  const controlRelations = new Set<string>();
  for (const row of controlRows) {
    const sources = datasetsByIdentity.get(
      identityKey({ table: row.sourceTable, detail: row.sourceDetail }),
    );
    if (!sources || sources.size === 0) {
      controlMapping.sourceUnmapped += 1;
      continue;
    }
    if (sources.size > 1) {
      controlMapping.sourceAmbiguous += 1;
      continue;
    }
    const targets = writeTargets.get(
      `${text(row.targetTaskId)}|${text(row.targetWriteId)}`,
    );
    if (!targets || targets.size === 0) {
      controlMapping.targetUnmapped += 1;
      continue;
    }
    if (targets.size > 1) {
      controlMapping.targetAmbiguous += 1;
      continue;
    }
    const source = [...sources][0]!;
    const target = [...targets][0]!;
    if (source === target) {
      controlMapping.self += 1;
      continue;
    }
    if (!tablePairs.has(`${source}|${target}`)) {
      controlMapping.outsideTablePairBaseline += 1;
      continue;
    }
    controlMapping.aligned += 1;
    const parsed = detail(row.edgeDetail);
    const subtype = text(parsed.subtype || "UNKNOWN");
    const grain = text(parsed.grain || "UNKNOWN");
    const relationId = text(parsed.relationId);
    controlSubtypes.set(subtype, (controlSubtypes.get(subtype) ?? 0) + 1);
    controlGrains.set(grain, (controlGrains.get(grain) ?? 0) + 1);
    const statementId = text(parsed.statementId);
    if (relationId && statementId)
      controlRelations.add(
        `${text(row.owner || row.targetTaskId)}|${statementId}|${relationId}`,
      );
    else controlMapping.missingRelationIdentity += 1;
    const key = `${source}|${text(row.sourceColumn).toLowerCase()}`;
    const hotspot = controlHotspots.get(key) ?? {
      dataset: source,
      column: text(row.sourceColumn).toLowerCase(),
      tasks: new Set<string>(),
      targets: new Set<string>(),
      subtypes: new Map<string, Set<string>>(),
      relations: new Set<string>(),
      edges: 0,
    };
    const taskId = text(row.owner || row.targetTaskId);
    hotspot.tasks.add(taskId);
    hotspot.targets.add(target);
    setAdd(hotspot.subtypes, subtype, taskId);
    if (relationId && statementId)
      hotspot.relations.add(`${taskId}|${statementId}|${relationId}`);
    hotspot.edges += 1;
    controlHotspots.set(key, hotspot);
  }

  const fieldPairValues = [...fieldPairs.values()].map((pair) => {
    const denominator = outputColumns.get(pair.target)?.size ?? 0;
    return {
      ...pair,
      targetCoverage:
        denominator === 0 ? null : pair.targetColumns.size / denominator,
      targetFieldDenominator: denominator,
    };
  });
  const valuePairs = fieldPairValues.filter((pair) => pair.kinds.has("VALUE"));
  const sourceColumnCounts = valuePairs.map((pair) => pair.sourceColumns.size);
  const coverages = valuePairs
    .map((pair) => pair.targetCoverage)
    .filter((value): value is number => value !== null);
  const empirical = {
    sourceColumns: {
      p25: quantile(sourceColumnCounts, 0.25),
      p50: quantile(sourceColumnCounts, 0.5),
      p75: quantile(sourceColumnCounts, 0.75),
      p90: quantile(sourceColumnCounts, 0.9),
    },
    targetCoverage: {
      p25: quantile(coverages, 0.25),
      p50: quantile(coverages, 0.5),
      p75: quantile(coverages, 0.75),
      p90: quantile(coverages, 0.9),
    },
  };
  const p25Source = Math.max(2, empirical.sourceColumns.p25 ?? 2);
  const p50Source = Math.max(2, empirical.sourceColumns.p50 ?? 2);
  const p75Source = Math.max(3, empirical.sourceColumns.p75 ?? 3);
  const p25Coverage = empirical.targetCoverage.p25 ?? 0;
  const p50Coverage = empirical.targetCoverage.p50 ?? 0;
  const p75Coverage = empirical.targetCoverage.p75 ?? 0;
  const candidateViews = [
    candidateView(
      "empirical-broad",
      valuePairs,
      p25Source,
      p25Coverage,
      tables,
    ),
    candidateView(
      "empirical-middle",
      valuePairs,
      p50Source,
      p50Coverage,
      tables,
    ),
    candidateView(
      "empirical-strict",
      valuePairs,
      p75Source,
      p75Coverage,
      tables,
    ),
    candidateView(
      "legacy-3-columns-50-percent-comparison",
      valuePairs,
      3,
      0.5,
      tables,
    ),
  ];

  const degrees = [...ioTables].map((id) => ({
    dataset: id,
    table: tables.get(id)?.table ?? id,
    schema: schemaOf(tables.get(id)?.table ?? ""),
    inDegree: incoming.get(id)?.size ?? 0,
    outDegree: outgoing.get(id)?.size ?? 0,
    readerTasks: tableReaders.get(id)?.size ?? 0,
    writerTasks: tableWriters.get(id)?.size ?? 0,
    downstreamSchemas: new Set(
      [...(outgoing.get(id) ?? [])].map((target) =>
        schemaOf(tables.get(target)?.table ?? ""),
      ),
    ).size,
  }));
  const topReuse = [...degrees]
    .sort(
      (a, b) =>
        b.outDegree - a.outDegree ||
        b.readerTasks - a.readerTasks ||
        a.table.localeCompare(b.table),
    )
    .slice(0, 100);
  const topConvergence = [...degrees]
    .sort(
      (a, b) =>
        b.inDegree - a.inDegree ||
        b.writerTasks - a.writerTasks ||
        a.table.localeCompare(b.table),
    )
    .slice(0, 100);
  const topFieldHotspots = [...fieldHotspots.values()]
    .sort(
      (a, b) =>
        b.tasks.size - a.tasks.size ||
        b.targets.size - a.targets.size ||
        a.column.localeCompare(b.column),
    )
    .slice(0, 150)
    .map((item) => ({
      kind: item.kind,
      source: tables.get(item.dataset)?.table ?? item.dataset,
      sourceDatasetId: item.dataset,
      column: item.column,
      consumerTasks: item.tasks.size,
      targetTables: item.targets.size,
      targetFields: item.targetColumns.size,
      edges: item.edges,
    }));
  const topControlHotspots = [...controlHotspots.values()]
    .sort(
      (a, b) =>
        b.tasks.size - a.tasks.size ||
        b.targets.size - a.targets.size ||
        a.column.localeCompare(b.column),
    )
    .slice(0, 150)
    .map((item) => ({
      source: tables.get(item.dataset)?.table ?? item.dataset,
      sourceDatasetId: item.dataset,
      column: item.column,
      consumerTasks: item.tasks.size,
      targetTables: item.targets.size,
      relationCount: item.relations.size,
      subtypes: Object.fromEntries(
        [...item.subtypes].map(([kind, tasks]) => [kind, tasks.size]).sort(),
      ),
      edges: item.edges,
    }));

  const legacyExcludedDatasetIds = new Set(
    [...tables.values()]
      .filter((node) => LEGACY_TEMP_EXCLUSIONS.has(node.table))
      .map((node) => node.id),
  );
  const legacyComparisonPairs = [...tablePairs.values()].filter(
    (pair) =>
      !legacyExcludedDatasetIds.has(pair.source) &&
      !legacyExcludedDatasetIds.has(pair.target),
  );

  const manifest = JSON.parse(
    readFileSync(text(initialState.manifestPath), "utf8"),
  ) as {
    tasks: Array<{
      taskId: string;
      evidencePath?: string;
      contentHash?: string;
      coverageStatus?: string;
    }>;
  };
  const currentManifest = new Map(
    manifest.tasks.map((task) => [String(task.taskId), task]),
  );
  const knowledgeRoot = resolve(OUTPUT_DIR, "..", "..", "data-graph-knowledge");
  const networkRoot = resolve(OUTPUT_DIR, "..", "..", "network-understanding");
  const oldGraphRefs = priorEvidenceReferences(knowledgeRoot);
  const oldNetworkRefs = priorEvidenceReferences(networkRoot);
  const reuseRows = [
    ...new Set([...oldGraphRefs.keys(), ...oldNetworkRefs.keys()]),
  ]
    .sort((a, b) => Number(a) - Number(b))
    .map((taskId) => {
      const current = currentManifest.get(taskId);
      const currentPath = text(current?.evidencePath)
        .replaceAll("\\", "/")
        .toLowerCase();
      const currentVersion =
        currentPath.match(
          /\/versions\/([a-f0-9]{32,})\.evidence-v3\.json$/u,
        )?.[1] ?? null;
      const priorVersions = [
        ...new Set([
          ...(oldGraphRefs.get(taskId) ?? []),
          ...(oldNetworkRefs.get(taskId) ?? []),
        ]),
      ].sort();
      return {
        taskId,
        referencedBy: [
          ...(oldGraphRefs.has(taskId) ? ["data-graph-knowledge"] : []),
          ...(oldNetworkRefs.has(taskId) ? ["network-understanding"] : []),
        ],
        priorEvidenceVersions: priorVersions,
        currentEvidenceVersion: currentVersion,
        currentCoverage: current?.coverageStatus ?? null,
        reuseDisposition: !current
          ? "NOT_IN_CURRENT_MANIFEST"
          : currentVersion && priorVersions.includes(currentVersion)
            ? "LOCAL_EVIDENCE_PATH_UNCHANGED"
            : "RECHECK_EVIDENCE_CHANGED_OR_UNMATCHED",
      };
    });

  const finalState = (await store.ready()) as Row;
  if (text(finalState.version) !== EXPECTED_VERSION)
    throw new Error(
      `GRAPH_VERSION_CHANGED_DURING_ANALYSIS:${text(finalState.version)}`,
    );

  const generatedAt = new Date().toISOString();
  const summary = {
    documentType: "data-graph-derived-2.0-baseline",
    generatedAt,
    graph: {
      id: graph.graphId,
      version: EXPECTED_VERSION,
      state: text(finalState.state),
      manifestPath: text(finalState.manifestPath),
      observedNodeCounts: Object.fromEntries(
        observedCounts.map((row) => [text(row.kind), Number(row.count)]),
      ),
      taskCount: manifest.tasks.length,
      manifestSha256: sha256(readFileSync(text(initialState.manifestPath))),
    },
    queryDefinitions: {
      tablePair:
        "distinct PHYSICAL_DATASET -READS_TABLE-> TASK -WRITES_TABLE-> PHYSICAL_DATASET pairs; self pairs removed; supporting tasks retained",
      fieldPair:
        "VALUE and CONDITION edges mapped to exact read occurrence or physical identity and final write identity, then aligned to the table-pair baseline",
      control:
        "PHYSICAL_FIELD -DATASET_CONTROL-> TARGET_WRITE mapped to exact physical source and final write, then aligned to the table-pair baseline",
      linearChain:
        "maximal directed paths whose internal table nodes have in-degree=1 and out-degree=1 in the full unfiltered IO table graph",
    },
    tableBaseline: {
      catalogPhysicalDatasets: tables.size,
      readEdges: readRows.length,
      writeEdges: writeRows.length,
      tasksWithReads: taskReads.size,
      tasksWithWrites: taskWrites.size,
      participatingIoTables: ioTables.size,
      distinctDirectedTablePairs: tablePairs.size,
      pairsWithAnyMultiOutputSupport: [...tablePairs.values()].filter(
        (pair) => pair.multiOutputTasks.size > 0,
      ).length,
      weakComponents: components.length,
      largestWeakComponentSizes: components
        .slice(0, 30)
        .map((component) => component.length),
      roles: {
        sourceOnly: degrees.filter(
          (item) => item.inDegree === 0 && item.outDegree > 0,
        ).length,
        terminalOnly: degrees.filter(
          (item) => item.inDegree > 0 && item.outDegree === 0,
        ).length,
        oneInOneOut: degrees.filter(
          (item) => item.inDegree === 1 && item.outDegree === 1,
        ).length,
        fanOut: degrees.filter(
          (item) => item.outDegree > 1 && item.inDegree <= 1,
        ).length,
        convergence: degrees.filter(
          (item) => item.inDegree > 1 && item.outDegree <= 1,
        ).length,
        multiInMultiOut: degrees.filter(
          (item) => item.inDegree > 1 && item.outDegree > 1,
        ).length,
        isolatedIoNode: degrees.filter(
          (item) => item.inDegree === 0 && item.outDegree === 0,
        ).length,
      },
      linearChains: {
        maximalChainsWithInternalNodes: linear.chains.length,
        internalNodeCount: new Set(
          linear.chains.flatMap((chain) => chain.slice(1, -1)),
        ).size,
        pureCycles: linear.cycles.length,
        longest: linear.chains.slice(0, 100).map((chain) => ({
          tableCount: chain.length,
          tables: chain.map((id) => tables.get(id)?.table ?? id),
          datasetIds: chain,
        })),
      },
      topReuse,
      topConvergence,
    },
    fieldBaseline: {
      writeFields: {
        total: writeFieldRows.length,
        mappedToFinalWrite: mappedWriteFields,
        unmappedToFinalWrite: unmappedWriteFields,
        ambiguousFinalWrite: ambiguousWriteFields,
        targetTablesWithMappedOutputColumns: outputColumns.size,
      },
      edgeMapping: fieldMapping,
      edgeMappingByKind: fieldMappingByKind,
      alignedTablePairsWithAnyFieldFootprint: new Set(
        fieldPairValues.map((pair) => `${pair.source}|${pair.target}`),
      ).size,
      alignedValuePairs: valuePairs.length,
      alignedConditionPairs: fieldPairValues.filter((pair) =>
        pair.kinds.has("CONDITION"),
      ).length,
      alignedPairsWithBothValueAndCondition: valuePairs.filter((pair) =>
        fieldPairs.has(`CONDITION|${pair.source}|${pair.target}`),
      ).length,
      tablePairCoverageByValue:
        tablePairs.size === 0 ? null : valuePairs.length / tablePairs.size,
      distinctSourceColumnDistribution: {
        quantiles: empirical.sourceColumns,
        cumulativeCounts: histogram(
          sourceColumnCounts,
          [1, 2, 3, 5, 10, 20, 50, 100],
        ),
      },
      targetCoverageDistribution: {
        quantiles: empirical.targetCoverage,
        cumulativeCounts: histogram(
          coverages,
          [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1],
        ),
        unknownDenominatorPairs: valuePairs.filter(
          (pair) => pair.targetCoverage === null,
        ).length,
      },
      topFieldHotspots,
    },
    controlBaseline: {
      edgeMapping: controlMapping,
      alignedRelationIdentities: controlRelations.size,
      subtypeEdgeCounts: Object.fromEntries([...controlSubtypes].sort()),
      grainEdgeCounts: Object.fromEntries([...controlGrains].sort()),
      topControlHotspots,
    },
    candidateViews,
    legacyComparisons: {
      note: "comparison only; not inherited as the new baseline or exclusion policy",
      oldFourTablesPresentAsPhysicalIdentities: legacyExcludedDatasetIds.size,
      withoutOldFourTables: {
        participatingTables: new Set(
          legacyComparisonPairs.flatMap((pair) => [pair.source, pair.target]),
        ).size,
        directedTablePairs: legacyComparisonPairs.length,
      },
      legacyFieldThresholdView: candidateViews.at(-1),
    },
    reuseLedger: {
      referencedTasks: reuseRows.length,
      localEvidencePathUnchanged: reuseRows.filter(
        (row) => row.reuseDisposition === "LOCAL_EVIDENCE_PATH_UNCHANGED",
      ).length,
      recheckEvidenceChangedOrUnmatched: reuseRows.filter(
        (row) =>
          row.reuseDisposition === "RECHECK_EVIDENCE_CHANGED_OR_UNMATCHED",
      ).length,
      notInCurrentManifest: reuseRows.filter(
        (row) => row.reuseDisposition === "NOT_IN_CURRENT_MANIFEST",
      ).length,
    },
    boundaries: [
      "This is static graph structure, not runtime success, data arrival, business correctness, or actual report usage.",
      "Task-level read x final-write table pairs can include Cartesian associations for multi-output tasks.",
      "VALUE, CONDITION, and DATASET_CONTROL are separate evidence channels and do not count business rules.",
      "Candidate components are reading candidates, not validated, stable, or mutually exclusive business clusters.",
      "Unchanged local evidence permits bounded rule reuse but does not preserve old hotspot rank, downstream scope, or first-application claims.",
    ],
  };

  const cache = {
    generatedAt,
    graphVersion: EXPECTED_VERSION,
    tables: [...tables.values()].map(displayTable),
    tablePairs: [...tablePairs.values()].map((pair) => ({
      source: pair.source,
      target: pair.target,
      tasks: [...pair.tasks].sort(),
      multiOutputTasks: [...pair.multiOutputTasks].sort(),
    })),
    degrees,
    readRows,
    writeRows,
    components,
    linearChains: linear,
    fieldHotspots: [...fieldHotspots.values()].map((item) => ({
      ...item,
      tasks: [...item.tasks],
      targets: [...item.targets],
      targetColumns: [...item.targetColumns],
      occurrences: [...item.occurrences],
    })),
    controlHotspots: [...controlHotspots.values()].map((item) => ({
      ...item,
      tasks: [...item.tasks],
      targets: [...item.targets],
      relations: [...item.relations],
      subtypes: Object.fromEntries(
        [...item.subtypes].map(([kind, tasks]) => [kind, [...tasks]]),
      ),
    })),
    outputColumns: Object.fromEntries(
      [...outputColumns].map(([id, columns]) => [id, [...columns].sort()]),
    ),
    taskReads: Object.fromEntries(
      [...taskReads].map(([id, tables]) => [id, [...tables].sort()]),
    ),
    taskWrites: Object.fromEntries(
      [...taskWrites].map(([id, tables]) => [id, [...tables].sort()]),
    ),
    fieldPairs: fieldPairValues.map((pair) => ({
      source: pair.source,
      target: pair.target,
      kinds: [...pair.kinds].sort(),
      tasks: [...pair.tasks].sort(),
      sourceColumns: [...pair.sourceColumns].sort(),
      targetColumns: [...pair.targetColumns].sort(),
      edges: pair.edges,
      targetFieldDenominator: pair.targetFieldDenominator,
      targetCoverage: pair.targetCoverage,
    })),
    reuseRows,
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const summaryText = `${JSON.stringify(summary, null, 2)}\n`;
  const cacheText = JSON.stringify(cache);
  writeFileSync(join(OUTPUT_DIR, "baseline-summary.json"), summaryText);
  writeFileSync(
    join(OUTPUT_DIR, "baseline-cache.json.gz"),
    gzipSync(cacheText, { level: 9 }),
  );
  writeFileSync(
    join(OUTPUT_DIR, "reuse-ledger.json"),
    `${JSON.stringify(reuseRows, null, 2)}\n`,
  );
  writeFileSync(
    join(OUTPUT_DIR, "baseline-run.json"),
    `${JSON.stringify(
      {
        generatedAt,
        graphVersion: EXPECTED_VERSION,
        files: {
          "baseline-summary.json": {
            bytes: Buffer.byteLength(summaryText),
            sha256: sha256(summaryText),
          },
          "baseline-cache.json.gz": {
            uncompressedBytes: Buffer.byteLength(cacheText),
            sha256OfUncompressedJson: sha256(cacheText),
          },
          "reuse-ledger.json": { rows: reuseRows.length },
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        graphVersion: EXPECTED_VERSION,
        participatingIoTables: ioTables.size,
        tablePairs: tablePairs.size,
        alignedValuePairs: valuePairs.length,
        alignedControlEdges: controlMapping.aligned,
        linearChains: linear.chains.length,
        candidateViews: candidateViews.map((view) => ({
          name: view.name,
          pairs: view.retainedPairs,
          tables: view.participatingTables,
          components: view.componentCount,
          largest: view.componentSizes[0] ?? 0,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await graph.driver.close();
}
