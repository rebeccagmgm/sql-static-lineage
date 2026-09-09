import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getViewportForBounds,
  useReactFlow,
  type NodeMouseHandler,
  type Node,
  type Edge,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "./api";
import { adaptTrace } from "./graph-adapter";
import { DetailPanel } from "./components/DetailPanel";
import { LineageNode } from "./components/LineageNode";
import { TaskNode } from "./components/TaskNode";
import { FieldSelector } from "./components/FieldSelector";
import { isSameGraphVersion, normalizeRegionItems } from "./contract";
import {
  collectMultiFieldTrace,
  loadAllFieldPages,
  shouldFallbackToDepthOne,
} from "./multi-field-trace";
import type {
  Anchor,
  Direction,
  GraphLayer,
  GraphNode,
  OverviewResult,
  TaskDetail,
  TerminalNode,
  TraceResult,
} from "./types";
import "./styles.css";
type Hist = {
  anchor: Anchor;
  layer: GraphLayer;
  direction: Direction;
  depth: number;
  candidates: boolean;
  selectedFieldIds: string[];
  fields: GraphNode[];
  fieldsMore: boolean;
  fieldsVersion?: string;
  viewport: Viewport;
};
const stageNames: Record<string, string> = {
  SOURCE: "01 来源",
  ODATA: "02 采集与整理",
  PDATA: "03 模型与主题",
  DM: "04 应用加工",
  DELIVERY: "05 交付",
  UNCLASSIFIED: "未分类",
};
function adaptOverview(overview: OverviewResult): {
  nodes: Node[];
  edges: Edge[];
} {
  const stages = [...overview.stages, "UNCLASSIFIED"].filter(
    (stage, index, all) =>
      overview.regions.some((region) => region.stage === stage) &&
      all.indexOf(stage) === index,
  );
  const positions = new Map<string, { x: number; y: number }>();
  const nodes = overview.regions.map((region) => {
    const column = stages.indexOf(region.stage);
    const row = overview.regions
      .filter((item) => item.stage === region.stage)
      .findIndex((item) => item.schema === region.schema);
    positions.set(region.schema, {
      x: Math.max(0, column) * 290 + 40,
      y: row * 94 + 65,
    });
    return {
      id: `region:${region.schema}`,
      position: positions.get(region.schema)!,
      data: {
        label: `${stageNames[region.stage] ?? region.stage}\n${region.schema}\n${region.datasetCount} 张表`,
        region,
      },
      style: {
        width: 220,
        border: "1px solid #7da19b",
        borderRadius: 7,
        background: "#fff",
        fontSize: 11,
        whiteSpace: "pre-line",
      },
    } satisfies Node;
  });
  const ids = new Set(overview.regions.map((region) => region.schema));
  const edges = overview.flows
    .filter((flow) => ids.has(flow.fromSchema) && ids.has(flow.toSchema))
    .map((flow, index) => ({
      id: `flow:${flow.fromSchema}:${flow.toSchema}:${index}`,
      source: `region:${flow.fromSchema}`,
      target: `region:${flow.toSchema}`,
      type: "smoothstep",
      label: String(flow.taskCount),
      style: { stroke: "#6b928c", strokeWidth: 1.2 },
      data: { evidenceKind: flow.evidenceKind },
    })) satisfies Edge[];
  return { nodes, edges };
}
function Explorer() {
  const flow = useReactFlow();
  const flowWrap = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<GraphNode[]>([]),
    [searchMore, setSearchMore] = useState(false),
    [anchor, setAnchor] = useState<Anchor>(),
    [fields, setFields] = useState<GraphNode[]>([]),
    [fieldsMore, setFieldsMore] = useState(false),
    [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]),
    [layer, setLayer] = useState<GraphLayer>("table"),
    [direction, setDirection] = useState<Direction>("up"),
    [depth, setDepth] = useState(2),
    [candidates, setCandidates] = useState(true),
    [trace, setTrace] = useState<TraceResult>(),
    [loading, setLoading] = useState(false),
    [loadingAllFields, setLoadingAllFields] = useState(false),
    [autoDepthNotice, setAutoDepthNotice] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<GraphNode>(),
    [highlightedFieldId, setHighlightedFieldId] = useState<string>(),
    [highlightedTaskId, setHighlightedTaskId] = useState<string>(),
    [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(
      new Set(),
    ),
    [terminal, setTerminal] = useState<TerminalNode>(),
    [detail, setDetail] = useState<TaskDetail>(),
    [detailLoading, setDetailLoading] = useState(false),
    [history, setHistory] = useState<Hist[]>([]),
    [status, setStatus] = useState<Record<string, unknown>>();
  const [mode, setMode] = useState<"overview" | "lineage">("overview"),
    [overview, setOverview] = useState<OverviewResult>(),
    [regionName, setRegionName] = useState(""),
    [regionMore, setRegionMore] = useState(false);
  const restore = useRef<Viewport | undefined>(undefined),
    requestSequence = useRef(0),
    navigationSequence = useRef(0),
    detailSequence = useRef(0),
    activeVersion = useRef<string | undefined>(undefined),
    fieldListVersion = useRef<string | undefined>(undefined),
    pendingFit = useRef(false),
    nodeTypes = useMemo(
      () => ({ lineage: LineageNode, processingTask: TaskNode }),
      [],
    );
  const loadDetail = useCallback(async (node: GraphNode, t?: TerminalNode) => {
    const sequence = ++detailSequence.current;
    setSelected(node);
    setTerminal(t);
    setDetail(undefined);
    if (!node.taskId && node.kind !== "TASK") {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const id = node.taskId ?? node.id.replace(/^task:/, "");
      const value = await api.task(id, {
        column: node.column,
        writeId: node.writeId,
      });
      if (sequence !== detailSequence.current) return;
      if (!isSameGraphVersion(activeVersion.current, value.version)) {
        setDetail(undefined);
        setError("图谱版本已更新，当前证据与画布版本不一致，请重新展开。");
        return;
      }
      setDetail(value);
    } catch {
      if (sequence === detailSequence.current) setDetail(undefined);
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false);
    }
  }, []);
  const graph = useMemo(
    () =>
      trace
        ? adaptTrace(
            trace,
            (raw, terminalNode) => {
              setHighlightedTaskId(undefined);
              setHighlightedFieldId((current) =>
                current === raw.id ? undefined : raw.id,
              );
              void loadDetail(raw, terminalNode);
            },
            highlightedFieldId,
            {
              expandedCandidates,
              highlightedTaskId,
              onToggleCandidates: (key: string) => {
                pendingFit.current = true;
                setExpandedCandidates((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              },
            },
          )
        : { nodes: [], edges: [] },
    [
      trace,
      loadDetail,
      highlightedFieldId,
      highlightedTaskId,
      expandedCandidates,
    ],
  );
  const overviewGraph = useMemo(
    () => (overview ? adaptOverview(overview) : { nodes: [], edges: [] }),
    [overview],
  );
  const runTrace = useCallback(
    async (
      nextAnchor = anchor,
      nextLayer = layer,
      fit = true,
      fieldOverride?: GraphNode | GraphNode[],
      settings?: {
        direction: Direction;
        depth: number;
        candidates: boolean;
      },
    ) => {
      if (!nextAnchor) return;
      const selectedFields =
        nextLayer === "field"
          ? fieldOverride
            ? Array.isArray(fieldOverride)
              ? fieldOverride
              : [fieldOverride]
            : fields.filter((field) => selectedFieldIds.includes(field.id))
          : [];
      if (nextLayer === "field" && !selectedFields.length) {
        setError("请至少选择一个字段。");
        return;
      }
      setLoading(true);
      setError("");
      const sequence = ++requestSequence.current;
      const expectedFieldsVersion = fieldListVersion.current;
      try {
        const querySettings = {
          layer: nextLayer,
          direction: settings?.direction ?? direction,
          depth: settings?.depth ?? depth,
          includeCandidates: settings?.candidates ?? candidates,
        };
        const collectFieldsAtDepth = (queryDepth: number) =>
          collectMultiFieldTrace({
            roots: selectedFields,
            isCurrent: () => sequence === requestSequence.current,
            fetchTrace: async (field) => {
              const result = await api.trace({
                nodeId: field.id,
                label: `${field.table}.${field.column}`,
                ...querySettings,
                depth: queryDepth,
              });
              if (
                expectedFieldsVersion &&
                result.version !== expectedFieldsVersion
              )
                throw new Error("图谱已换版，请重新进入字段血缘加载全部字段。");
              return result;
            },
          });
        let value =
          nextLayer === "field"
            ? await collectFieldsAtDepth(querySettings.depth)
            : await api.trace({ ...nextAnchor, ...querySettings });
        if (
          nextLayer === "field" &&
          shouldFallbackToDepthOne(value, querySettings.depth)
        ) {
          value = await collectFieldsAtDepth(1);
          if (sequence !== requestSequence.current) return;
          setDepth(1);
          setAutoDepthNotice("关系达到 150 条上限，已自动改为 1 层。");
        } else {
          setAutoDepthNotice("");
        }
        if (sequence !== requestSequence.current) return;
        activeVersion.current = value.version;
        setStatus((current) => ({
          ...(current ?? {}),
          version: value.version,
        }));
        setHighlightedFieldId(undefined);
        setHighlightedTaskId(undefined);
        setExpandedCandidates(new Set());
        setTrace(value);
        pendingFit.current = fit;
        if (selectedFields.length === 1)
          void loadDetail(
            selectedFields[0]!,
            value.terminalNodes.find((x) => x.nodeId === selectedFields[0]!.id),
          );
        else if (selectedFields.length > 1) {
          setSelected(undefined);
          setTerminal(undefined);
          setDetail(undefined);
        }
      } catch (e) {
        if (sequence === requestSequence.current)
          setError(e instanceof Error ? e.message : "查询失败");
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [
      anchor,
      candidates,
      depth,
      direction,
      selectedFieldIds,
      fields,
      flow,
      layer,
      loadDetail,
    ],
  );
  const choose = useCallback(
    async (node: GraphNode, push = false) => {
      const navigation = ++navigationSequence.current;
      if (push && anchor)
        setHistory((items) => [
          ...items,
          {
            anchor,
            layer,
            direction,
            depth,
            candidates,
            selectedFieldIds,
            fields,
            fieldsMore,
            fieldsVersion: fieldListVersion.current,
            viewport: flow.getViewport(),
          },
        ]);
      const next: Anchor =
        node.kind === "TASK"
          ? {
              taskId: node.id.replace(/^task:/, ""),
              label: node.label ?? node.id,
            }
          : {
              table: node.table,
              nodeId: node.id,
              label: node.label ?? node.table ?? node.id,
            };
      setAnchor(next);
      setMode("lineage");
      setLayer("table");
      setSelected(node);
      setTerminal(undefined);
      setDetail(undefined);
      try {
        const page = await api.fields(next);
        if (navigation !== navigationSequence.current) return;
        const fs = page.slice(0, 100);
        setFieldsMore(page.length > 100);
        setFields(fs);
        setSelectedFieldIds(fs[0] ? [fs[0].id] : []);
        await runTrace(next, "table");
        if (navigation !== navigationSequence.current) return;
        if (node.kind === "TASK") void loadDetail(node);
      } catch (e) {
        if (navigation === navigationSequence.current)
          setError(e instanceof Error ? e.message : "读取失败");
      }
    },
    [
      anchor,
      candidates,
      depth,
      direction,
      selectedFieldIds,
      fields,
      fieldsMore,
      flow,
      layer,
      loadDetail,
      runTrace,
    ],
  );
  async function search() {
    try {
      setRegionName("");
      const page = await api.search(query.trim());
      setResults(page.slice(0, 30));
      setSearchMore(page.length > 30);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败");
    }
  }
  const onNodeClick: NodeMouseHandler = (_, v) => {
    const raw = v.data.raw as GraphNode | undefined;
    if (!raw) return;
    const t = trace?.terminalNodes.find((x) => x.nodeId === raw.id);
    void loadDetail(raw, t);
    if (v.type === "processingTask") {
      setHighlightedFieldId(undefined);
      setHighlightedTaskId((current) => (current === v.id ? undefined : v.id));
      return;
    }
    if (!t && (raw.kind === "TASK" || raw.kind === "PHYSICAL_DATASET"))
      void choose(raw, true);
  };
  async function back() {
    const navigation = ++navigationSequence.current;
    const p = history.at(-1);
    if (!p) return;
    setHistory((x) => x.slice(0, -1));
    setAnchor(p.anchor);
    setLayer(p.layer);
    setDirection(p.direction);
    setDepth(p.depth);
    setCandidates(p.candidates);
    setSelectedFieldIds(p.selectedFieldIds);
    restore.current = p.viewport;
    const fs = p.fields;
    fieldListVersion.current = p.fieldsVersion;
    setFieldsMore(p.fieldsMore);
    setFields(fs);
    const restoredFields = fs.filter((field) =>
      p.selectedFieldIds.includes(field.id),
    );
    setTimeout(
      () =>
        void runTrace(p.anchor, p.layer, false, restoredFields, {
          direction: p.direction,
          depth: p.depth,
          candidates: p.candidates,
        }),
      0,
    );
  }
  useEffect(() => {
    void api
      .status()
      .then(setStatus)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "图谱服务未就绪"),
      );
    void api
      .overview()
      .then((value) => {
        setOverview(value);
        activeVersion.current = value.version;
      })
      .catch((e) => setError(e instanceof Error ? e.message : "全貌读取失败"));
  }, []);
  useEffect(() => {
    if (!trace || mode !== "lineage") return;
    const first = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (restore.current) {
          void flow.setViewport(restore.current);
          restore.current = undefined;
          pendingFit.current = false;
        } else if (pendingFit.current) {
          const viewportElement = flowWrap.current;
          if (!viewportElement || !graph.nodes.length) return;
          const boxes = graph.nodes.map((node) => {
            const members = Array.isArray(node.data.members)
              ? node.data.members.length
              : 0;
            return {
              x: node.position.x,
              y: node.position.y,
              width: Number(node.data.displayWidth ?? (members ? 300 : 260)),
              height: Number(
                node.data.displayHeight ??
                  (members ? 92 + Math.min(members * 38, 280) : 96),
              ),
            };
          });
          const minX = Math.min(...boxes.map((box) => box.x));
          const minY = Math.min(...boxes.map((box) => box.y));
          const maxX = Math.max(...boxes.map((box) => box.x + box.width));
          const maxY = Math.max(...boxes.map((box) => box.y + box.height));
          const viewport = getViewportForBounds(
            { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            viewportElement.clientWidth,
            viewportElement.clientHeight,
            0.1,
            1.05,
            0.08,
          );
          void flow.setViewport(viewport, { duration: 300 });
          pendingFit.current = false;
        }
      });
    });
    return () => cancelAnimationFrame(first);
  }, [flow, graph.nodes, mode, trace]);
  async function loadMoreSearch() {
    const page = await api.search(query.trim(), results.length);
    setResults((current) => [...current, ...page.slice(0, 30)]);
    setSearchMore(page.length > 30);
  }
  async function loadMoreFields() {
    if (!anchor) return;
    const page = await api.fields(anchor, fields.length);
    setFields((current) => [...current, ...page.slice(0, 100)]);
    setFieldsMore(page.length > 100);
  }
  async function enterFieldLayer() {
    if (!anchor || loadingAllFields) return;
    const navigation = ++navigationSequence.current;
    ++requestSequence.current;
    setLoadingAllFields(true);
    setError("");
    setLoading(false);
    try {
      let listedVersion: string | undefined;
      const all = await loadAllFieldPages({
        readVersion: async () => {
          const current = await api.status();
          if (typeof current.version !== "string" || !current.version)
            throw new Error("图谱版本不可用，请稍后重试。");
          listedVersion = current.version;
          return current.version;
        },
        isCurrent: () => navigation === navigationSequence.current,
        fetchPage: (offset, limit) => api.fields(anchor, offset, limit),
      });
      if (navigation !== navigationSequence.current) return;
      fieldListVersion.current = listedVersion;
      setFields(all);
      setFieldsMore(false);
      setSelectedFieldIds([]);
      setHighlightedFieldId(undefined);
      setHighlightedTaskId(undefined);
      setExpandedCandidates(new Set());
      setTrace(undefined);
      setLayer("field");
    } catch (cause) {
      if (navigation === navigationSequence.current)
        setError(cause instanceof Error ? cause.message : "全部字段读取失败");
    } finally {
      if (navigation === navigationSequence.current) setLoadingAllFields(false);
    }
  }
  async function openRegion(schema: string, append = false) {
    const offset = append ? results.length : 0;
    const page = await api.region(schema, offset);
    if (!isSameGraphVersion(activeVersion.current, page.version)) {
      setError("图谱版本已更新，请重新载入加工全貌。");
      return;
    }
    setRegionName(schema);
    setSearchMore(false);
    const items = normalizeRegionItems(page.items);
    setResults((current) =>
      append ? [...current, ...items.slice(0, 50)] : items.slice(0, 50),
    );
    setRegionMore(page.pagination.nextOffset !== null);
  }
  const onOverviewNodeClick: NodeMouseHandler = (_, visualNode) => {
    const region = visualNode.data.region as { schema: string } | undefined;
    if (region) void openRegion(region.schema);
  };
  async function continueFromSelected() {
    if (!selected || terminal) return;
    if (anchor)
      setHistory((items) => [
        ...items,
        {
          anchor,
          layer,
          direction,
          depth,
          candidates,
          selectedFieldIds,
          fields,
          fieldsMore,
          fieldsVersion: fieldListVersion.current,
          viewport: flow.getViewport(),
        },
      ]);
    const next: Anchor = {
      nodeId: selected.id,
      label: `${selected.table ?? ""}.${selected.column ?? selected.label ?? selected.id}`,
    };
    setAnchor(next);
    setLayer("field");
    setFields([selected]);
    fieldListVersion.current = activeVersion.current;
    setSelectedFieldIds([selected.id]);
    setFieldsMore(false);
    await runTrace(next, "field", true, selected);
  }
  return (
    <div className="app">
      <header>
        <div>
          <p className="kicker">DATA GRAPH · 按需探索</p>
          <h1>数据加工图谱</h1>
          <p>从任务和表进入，只读取当前需要的局部关系。</p>
        </div>
        <div
          className={`service ${status ? "ready" : ""}`}
          title={status ? String(status.version ?? "") : undefined}
        >
          <i />
          {status
            ? `已连接 · ${String(status.version ?? "").slice(0, 10)}`
            : "等待图谱服务"}
        </div>
      </header>
      <div className="workspace">
        <aside className="search-panel panel">
          <button
            className="overview-button"
            onClick={() => {
              setMode("overview");
              setRegionName("");
              setResults([]);
              void flow.setViewport({ x: 0, y: 0, zoom: 0.65 });
            }}
          >
            全域加工骨架
          </button>
          <h2>定位任务或表</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="表名、任务名或 ID"
            />
            <button>查找</button>
          </form>
          <div className="results">
            {regionName && <h3>{regionName} · 区域成员</h3>}
            {results.map((n) => (
              <button key={n.id} onClick={() => void choose(n)}>
                <b>{n.label}</b>
                <small>
                  {n.kind === "TASK"
                    ? `任务 ${n.id.replace(/^task:/, "")}`
                    : n.table}
                </small>
              </button>
            ))}
            {searchMore && (
              <button
                className="load-more"
                onClick={() => void loadMoreSearch()}
              >
                加载更多结果
              </button>
            )}
            {regionName && regionMore && (
              <button
                className="load-more"
                onClick={() => void openRegion(regionName, true)}
              >
                加载更多区域成员
              </button>
            )}
          </div>
          <div className="scope-note">
            <b>查询边界</b>
            <p>
              不预加载全图。每次最多读取 150 条关系；字段列表按每页 100
              项继续加载。
            </p>
          </div>
        </aside>
        <main className="canvas panel">
          <div className="canvas-head">
            <div>
              <button
                className="back"
                disabled={!history.length}
                onClick={() => void back()}
              >
                ← 返回
              </button>
              <span className="crumb">
                {mode === "overview"
                  ? "全域加工骨架"
                  : (anchor?.label ?? "请选择任务或表")}
              </span>
            </div>
            {mode === "lineage" ? (
              <div className="toolbar">
                <select
                  value={layer}
                  onChange={(e) => {
                    const next = e.target.value as GraphLayer;
                    if (next === "field") void enterFieldLayer();
                    else {
                      setLayer(next);
                      setTimeout(() => void runTrace(anchor, next), 0);
                    }
                  }}
                  disabled={loadingAllFields}
                >
                  <option value="table">表血缘</option>
                  <option value="field">字段血缘</option>
                </select>
                {layer === "field" && (
                  <FieldSelector
                    fields={fields}
                    selectedIds={selectedFieldIds}
                    hasMore={fieldsMore}
                    onChange={setSelectedFieldIds}
                    onLoadMore={() => void loadMoreFields()}
                  />
                )}
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as Direction)}
                >
                  <option value="up">向上追溯</option>
                  <option value="down">向下影响</option>
                </select>
                <select
                  value={depth}
                  aria-label="表间层数"
                  title="1 层表示一次表到表加工，中间调度任务不另计层"
                  onChange={(e) => setDepth(Number(e.target.value))}
                >
                  {[1, 2, 4, 6, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} 层
                    </option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={candidates}
                    onChange={(e) => setCandidates(e.target.checked)}
                  />{" "}
                  包含候选接续
                </label>
                <button
                  className="primary"
                  disabled={!anchor || loading || loadingAllFields}
                  onClick={() => void runTrace()}
                >
                  {loadingAllFields
                    ? "正在加载全部字段"
                    : loading
                      ? "读取中"
                      : "展开"}
                </button>
              </div>
            ) : (
              <div className="toolbar">
                <span className="muted">
                  区域与跨区关系来自 TABLE_IO 聚合；点击区域查看真实物理表。
                </span>
              </div>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          {mode === "lineage" && autoDepthNotice && (
            <div className="notice">{autoDepthNotice}</div>
          )}
          {mode === "overview" &&
            overview &&
            (overview.truncated.regions ||
              overview.truncated.flows ||
              overview.excluded.unqualifiedDatasets > 0) && (
              <div className="notice neutral">
                当前聚合返回 {overview.regions.length} 个区域、
                {overview.flows.length} 条区域关系
                {overview.truncated.regions || overview.truncated.flows
                  ? "，已达到查询上限"
                  : ""}
                ；另有 {overview.excluded.unqualifiedDatasets} 个无完整
                schema.table 身份的数据集未纳入。
              </div>
            )}
          {mode === "lineage" && trace?.truncated && (
            <div className="notice">
              已达到 {trace.edgeLimit} 条关系上限，请缩小范围。
            </div>
          )}
          {mode === "lineage" && trace?.stoppedBy === "DEPTH_LIMIT" && (
            <div className="notice neutral">
              已到 {trace.depthLimit} 层边界，前沿仍可继续展开。
            </div>
          )}
          <div className="flow-wrap" ref={flowWrap}>
            {mode === "overview" && overview ? (
              <ReactFlow
                nodes={overviewGraph.nodes}
                edges={overviewGraph.edges}
                onNodeClick={onOverviewNodeClick}
                minZoom={0.1}
                nodesDraggable={false}
                nodesConnectable={false}
                attributionPosition="bottom-left"
              >
                <Background color="#c8d8d5" gap={24} />
                <MiniMap pannable zoomable />
                <Controls />
              </ReactFlow>
            ) : anchor ? (
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                onPaneClick={() => {
                  setHighlightedFieldId(undefined);
                  setHighlightedTaskId(undefined);
                }}
                minZoom={0.1}
                nodesDraggable={false}
                nodesConnectable={false}
                attributionPosition="bottom-left"
              >
                <Background color="#c8d8d5" gap={24} />
                {layer === "table" && <MiniMap pannable zoomable />}
                <Controls />
              </ReactFlow>
            ) : (
              <div className="welcome">
                <span>01</span>
                <h2>先定位一个任务或表</h2>
                <p>再在同一画布切换表血缘与字段血缘。</p>
              </div>
            )}
          </div>
          <footer>
            {mode === "lineage" && (
              <div className="legend">
                <span>
                  <i className="solid confirmed" />
                  CONFIRMED
                </span>
                <span>
                  <i className="solid" />
                  其他直接关系
                </span>
                <span>
                  <i className="candidate" />
                  CANDIDATE
                </span>
              </div>
            )}
            {mode === "lineage" && trace && (
              <p>
                当前显示 {graph.nodes.length} 个节点 · {graph.edges.length}{" "}
                条连线 · {trace.elapsedMs} ms
              </p>
            )}
          </footer>
        </main>
        <DetailPanel
          key={`${selected?.id ?? "none"}:${detail?.taskId ?? "none"}:${detail?.version ?? "none"}`}
          node={selected}
          terminal={terminal}
          detail={detail}
          loading={detailLoading}
          onContinue={() => void continueFromSelected()}
        />
      </div>
    </div>
  );
}
export default function App() {
  return (
    <ReactFlowProvider>
      <Explorer />
    </ReactFlowProvider>
  );
}
