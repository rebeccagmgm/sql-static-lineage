import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openAssetGraph } from "./config.ts";
import { AssetGraphStore } from "./store.ts";
import {
  getAssetGraphOverview,
  listAssetGraphRegionDatasets,
} from "./overview.ts";
import { readJson, type PreparedManifest, type Evidence } from "./publish.ts";
import type { FactRecord } from "./compile.ts";
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
): Promise<{ server: Server; close: () => Promise<void> }> {
  const connection = await openAssetGraph(configPath);
  const store = new AssetGraphStore(
    connection.driver,
    connection.database,
    connection.graphId,
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
      if (url.pathname === "/api/status") {
        const s = await store.ready();
        value = { state: s.state, version: s.version, ...JSON.parse(s.report) };
      } else if (url.pathname === "/api/search")
        value = await store.search(
          q.get("q") ?? "",
          num("limit", 30),
          num("offset", 0),
        );
      else if (url.pathname === "/api/fields")
        value = await store.fields({
          taskId: q.get("taskId") ?? undefined,
          table: q.get("table") ?? undefined,
          nodeId: q.get("nodeId") ?? undefined,
          limit: num("limit", 300),
          offset: num("offset", 0),
        });
      else if (url.pathname === "/api/overview")
        value = await getAssetGraphOverview(store, {
          regionLimit: num("regionLimit", 100),
          flowLimit: num("flowLimit", 150),
        });
      else if (url.pathname === "/api/regions")
        value = await listAssetGraphRegionDatasets(store, {
          schema: q.get("schema") ?? "",
          limit: num("limit", 50),
          offset: num("offset", 0),
        });
      else if (url.pathname === "/api/task")
        value = await taskDetail(
          store,
          q.get("taskId") ?? "",
          q.get("column") ?? undefined,
          q.get("writeId") ?? undefined,
          q.get("sql") === "1",
        );
      else if (url.pathname === "/api/trace") {
        const layer = q.get("layer") ?? "table";
        if (!["table", "field", "schedule"].includes(layer))
          throw new Error("INVALID_GRAPH_LAYER");
        const direction = q.get("direction") ?? "up";
        if (!["up", "down"].includes(direction))
          throw new Error("INVALID_GRAPH_DIRECTION");
        const depthUnit = q.get("depthUnit") ?? "edge";
        if (!["edge", "table-hop"].includes(depthUnit))
          throw new Error("INVALID_DEPTH_UNIT");
        value = await store.traverse({
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
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      await connection.driver.close();
    },
  };
}
