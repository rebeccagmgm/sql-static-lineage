import { createServer, type Server } from "node:http";
import { regionTopics } from "./region-topics.ts";
import { queryExperimentalUpstreamScope } from "./experimental-upstream-scope/endpoint.ts";
import { readFileSync } from "node:fs";
import { PublishedFieldOrigins, evidenceOrigins, bindingKey } from "./field-value-origin.ts";
import { fileURLToPath } from "node:url";
import { openAssetGraph } from "./config.ts";
import { AssetGraphStore } from "./store.ts";
import {
  getAssetGraphOverview,
  listAssetGraphRegionDatasets,
} from "./overview.ts";
import { readJson, type PreparedManifest, type Evidence } from "./publish.ts";
import type { FactRecord } from "./compile.ts";
import {
  defaultTableMetadataCatalogRoot,
  TableMetadataResolver,
  type MetadataIdentity,
} from "./table-metadata.ts";
import { SchedulerTaskNameResolver } from "./scheduler-task-names.ts";
import { SchemaAnnotationResolver } from "./schema-annotation.ts";
import { buildTraceConsumptionFromRecords } from "./trace-consumption.ts";

type GraphNode = Record<string, unknown>;

const traceTaskIds = (nodes: readonly GraphNode[]) =>
  nodes
    .map((node) => node.taskId)
    .filter((taskId): taskId is string => typeof taskId === "string");

export function metadataIdentity(
  node: GraphNode,
  linkedIdentity?: MetadataIdentity,
): MetadataIdentity | undefined {
  const candidate =
    node.metadataIdentity && typeof node.metadataIdentity === "object"
      ? node.metadataIdentity
      : node.detail;
  const own = candidate && typeof candidate === "object"
    ? candidate as MetadataIdentity
    : undefined;
  const normalized = (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const complete = (identity?: MetadataIdentity) =>
    !!identity && ["platform", "dataSource", "qualifiedName"].every(
      (field) => normalized(identity[field as keyof MetadataIdentity]),
    );
  // Only use the physical dataset linked by the write occurrence. Explicit
  // uncertainty or conflicting identity evidence must retain the missing state.
  if (complete(own) || (own?.identityStatus && own.identityStatus !== "CONFIRMED"))
    return own;
  if (!complete(linkedIdentity) ||
      (linkedIdentity?.identityStatus && linkedIdentity.identityStatus !== "CONFIRMED"))
    return own;
  for (const field of ["platform", "dataSource", "qualifiedName", "stableTableId"] as const) {
    if (normalized(own?.[field]) &&
        normalized(own?.[field]) !== normalized(linkedIdentity?.[field]))
      return own;
  }
  return linkedIdentity;
}

async function annotateNodes(
  resolver: TableMetadataResolver,
  schemaResolver: SchemaAnnotationResolver,
  nodes: readonly GraphNode[],
  identities = new Map<string, Record<string, unknown>>(),
): Promise<GraphNode[]> {
  const selected = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) =>
      [
        "PHYSICAL_DATASET",
        "PHYSICAL_FIELD",
        "READ_FIELD",
        "WRITE_FIELD",
      ].includes(String(node.kind)),
    );
  const requests = selected.map(({ node }) => ({
    identity: metadataIdentity(node, identities.get(String(node.id))),
    column: typeof node.column === "string" ? node.column : undefined,
  }));
  const values = await resolver.resolveMany(requests);
  const schemaValues = schemaResolver.resolveMany(
    requests.map(({ identity }) => identity),
  );
  const result = [...nodes];
  selected.forEach(({ node, index }, valueIndex) => {
    const schema = schemaValues[valueIndex];
    result[index] = {
      ...node,
      metadata: {
        ...values[valueIndex],
        ...(schema ? { schema } : {}),
      },
    };
  });
  return result;
}
export async function taskDetail(
  store: AssetGraphStore,
  taskId: string,
  column?: string,
  writeId?: string,
  sql = false,
) {
  const state = await store.ready(),
    manifest = readJson<PreparedManifest>(String(state.manifestPath));
  const task = manifest.tasks.find((t) => t.taskId === taskId);
  if (!task) throw new Error("TASK_NOT_IN_PUBLISHED_GRAPH");
  const e = readJson<Evidence>(task.evidencePath),
    expressions = new Map(e.expressions.map((x) => [x.expression_id, x]));
  const origins = evidenceOrigins(e);
  const bindings = e.bindings.filter(
    (b) =>
      (!column ||
        String(b.target_field).toLowerCase() === column.toLowerCase()) &&
      (!writeId || b.write_observation_id === writeId),
  );
  const statementIds = new Set(
    bindings.map((b) => b.write_statement_id ?? b.statement_id),
  );
  const controls = e.relations
    .filter(
      (r) =>
        (!column || statementIds.has(r.statement_id)) &&
        ["filter", "join", "aggregate", "window", "setop"].includes(
          String(r.relation_type),
        ),
    )
    .map((r) => {
      const body = (r.relation ?? {}) as FactRecord;
      return {
        kind: r.relation_type,
        relationId: r.relation_id,
        joinType: body.join_type ?? null,
        condition:
          body.condition_display ??
          body.condition_expr ??
          body.predicate ??
          null,
        groupBy: body.group_by ?? body.group_columns ?? null,
        window: body.window ?? body.window_spec ?? null,
        sourceText: r.source_text ?? null,
      };
    });
  const value = {
    taskId,
    taskName: task.taskName,
    taskCategory: task.taskCategory,
    coverage: task.coverageStatus,
    failureReason: task.failureReasonCode,
    bindings: bindings.map((b) => ({
      column: b.target_field,
      writeId: b.write_observation_id,
      expression:
        expressions.get(b.expression_id)?.expression_text ??
        expressions.get(b.expression_id)?.display_text ??
        null,
      sourceSpan: expressions.get(b.expression_id)?.source_span ?? null,
      inputFields: expressions.get(b.expression_id)?.input_fields ?? [],
      valueOrigin: origins.get(bindingKey(b.write_observation_id, b.target_field)),
    })),
    controls,
    sqlSources: sql ? e.sqlSources : undefined,
    version: state.version,
  };
  return value;
}
export async function startAssetGraphServer(
  configPath?: string,
  port = 8791,
  options: {
    readonly metadataCatalogRoot?: string;
    readonly datasourceCatalogPath?: string;
  } = {},
): Promise<{ server: Server; close: () => Promise<void> }> {
  const connection = await openAssetGraph(configPath);
  const store = new AssetGraphStore(
    connection.driver,
    connection.database,
    connection.graphId,
  );
  const metadata = new TableMetadataResolver(
    options.metadataCatalogRoot ??
      defaultTableMetadataCatalogRoot(connection.paths?.evidenceRoot ?? "."),
  );
  const fieldOrigins = new PublishedFieldOrigins();
  const schedulerTaskNames = new SchedulerTaskNameResolver(
    connection.paths?.evidenceRoot ?? ".",
  );
  const schemaAnnotations = new SchemaAnnotationResolver(
    options.datasourceCatalogPath,
  );
  const html = readFileSync(
    fileURLToPath(new URL("./viewer.html", import.meta.url)),
    "utf8",
  );
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const q = url.searchParams;
    const num = (key: string, defaultValue: number) => {
      const raw = q.get(key);
      const n = raw === null ? defaultValue : Number(raw);
      if (!Number.isSafeInteger(n) || n < 0)
        throw new Error(
          key === "offset" ? "INVALID_QUERY_OFFSET" : "INVALID_QUERY_LIMIT",
        );
      return n;
    };
    try {
      if (url.pathname === "/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return;
      }
      let value: unknown;
      if (url.pathname === "/api/region-topics") {
        value = await regionTopics(store, schedulerTaskNames, q);
      } else if (url.pathname === "/api/experimental/upstream-scope") {
        value = await queryExperimentalUpstreamScope(store, q);
      } else if (url.pathname === "/api/status") {
        const s = await store.ready();
        value = {
          state: s.state,
          version: s.version,
          metadataCatalog: metadata.status(),
          ...JSON.parse(s.report),
        };
      } else if (url.pathname === "/api/search") {
        const text = q.get("q") ?? "";
        const limit = Math.max(1, Math.min(100, num("limit", 30)));
        const offset = num("offset", 0);
        value = await annotateNodes(
          metadata,
          schemaAnnotations,
          await store.search(
            text,
            limit,
            offset,
            await metadata.searchDescription(text, {
              // The graph store applies the final offset across technical-name and
              // description matches. Supply the bounded prefix it needs;
              // applying the offset here as well would skip description hits
              // twice.
              limit: Math.min(100, limit + offset),
            }),
          ),
        );
      } else if (url.pathname === "/api/fields")
        value = await annotateNodes(
          metadata,
          schemaAnnotations,
          await store.fields({
            taskId: q.get("taskId") ?? undefined,
            table: q.get("table") ?? undefined,
            nodeId: q.get("nodeId") ?? undefined,
            limit: num("limit", 300),
            offset: num("offset", 0),
          }),
        );
      else if (url.pathname === "/api/overview")
        value = await getAssetGraphOverview(store, {
          hiddenTables: JSON.parse(q.get("hiddenTables") ?? "[]"),
          regionLimit: num("regionLimit", 100),
          flowLimit: num("flowLimit", 150),
        });
      else if (url.pathname === "/api/regions") {
        const region = await listAssetGraphRegionDatasets(store, {
          schema: q.get("schema") ?? "",
          hiddenTables: JSON.parse(q.get("hiddenTables") ?? "[]"),
          limit: num("limit", 50),
          offset: num("offset", 0),
        });
        value = {
          ...region,
          items: await annotateNodes(metadata, schemaAnnotations, region.items),
        };
      } else if (url.pathname === "/api/task") {
        const taskId = q.get("taskId") ?? "";
        const detail = await taskDetail(
          store,
          taskId,
          q.get("column") ?? undefined,
          q.get("writeId") ?? undefined,
          q.get("sql") === "1",
        );
        value = {
          ...detail,
          taskName: schedulerTaskNames.resolve([taskId])[taskId],
          owner: schedulerTaskNames.resolveOwners([taskId])[taskId],
        };
      } else if (url.pathname === "/api/trace") {
        const layer = q.get("layer") ?? "table";
        if (!["table", "field", "schedule"].includes(layer))
          throw new Error("INVALID_GRAPH_LAYER");
        const direction = q.get("direction") ?? "up";
        if (!["up", "down"].includes(direction))
          throw new Error("INVALID_GRAPH_DIRECTION");
        const depthUnit = q.get("depthUnit") ?? "edge";
        if (!["edge", "table-hop"].includes(depthUnit))
          throw new Error("INVALID_DEPTH_UNIT");
        const trace = await store.traverse({
          taskId: q.get("taskId") ?? undefined,
          nodeId: q.get("nodeId") ?? undefined,
          column: q.get("column") ?? undefined,
          table: q.get("table") ?? undefined,
          writeId: q.get("writeId") ?? undefined,
          layer: layer as "table" | "field" | "schedule",
          direction: direction as "up" | "down",
          depthUnit: depthUnit as "edge" | "table-hop",
          depth: num("depth", 4),
          limit: num("limit", 150),
          includeCandidates: q.get("candidates") !== "0",
        });
        const identities = await store.metadataIdentities(
          trace.nodes.map((node) => String(node.id)),
        );
        let annotatedTraceNodes = trace.nodes;
        if (layer === "field" && trace.nodes.some(node => node.kind === "WRITE_FIELD")) {
          const state = await store.ready();
          if (String(state.version) !== trace.version) throw new Error("ASSET_GRAPH_CHANGED_DURING_QUERY");
          const incoming = new Set(trace.edges.map(edge => edge.to));
          const frontier = new Set(trace.frontierNodeIds);
          const stopped = new Set(trace.direction === "up" ? trace.nodes
            .filter(node => node.kind === "WRITE_FIELD" && !incoming.has(String(node.id)) && !frontier.has(String(node.id)))
            .map(node => String(node.id)) : []);
          annotatedTraceNodes = fieldOrigins.annotate(trace.nodes, String(state.manifestPath), stopped);
        }
        // A trace can synthesize task cards from VALUE edges. Read task names
        // from the local scheduler catalog, not evidence descriptions.
        const taskLabels = schedulerTaskNames.resolve(
          traceTaskIds(trace.nodes),
        );
        const consumption = buildTraceConsumptionFromRecords({
          direction: trace.direction,
          nodes: trace.nodes.map((node) => ({
            ...node,
            metadataIdentity: identities.get(String(node.id)),
          })),
          edges: trace.edges,
        });
        value = {
          ...trace,
          taskLabels,
          taskTopics: schedulerTaskNames.resolveTopics(traceTaskIds(trace.nodes)),
          taskTopicDescriptions: schedulerTaskNames.resolveTopicDescriptions(traceTaskIds(trace.nodes)),
          consumption,
          nodes: await annotateNodes(
            metadata,
            schemaAnnotations,
            annotatedTraceNodes,
            identities,
          ),
        };
      } else {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(value));
    } catch (error) {
      const message = error instanceof Error ? error.message : "QUERY_FAILED";
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: /^[A-Z0-9_: -]+$/.test(message)
            ? message
            : "ASSET_GRAPH_QUERY_FAILED",
        }),
      );
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    server,
    close: async () => {
      metadata.close();
      schemaAnnotations.close();
      schedulerTaskNames.close();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      await connection.driver.close();
    },
  };
}
