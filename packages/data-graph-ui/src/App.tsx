import { UPSTREAM_SCOPE_ENABLED, UpstreamScopePanel, UpstreamScopeStatus, scopedOverview, scopedRegion } from "./experimental-upstream-scope";
import { RegionTopics } from "./region-topics/RegionTopics";
import { GlobalVisibility, useGlobalVisibility } from "./node-visibility/GlobalVisibility";
import { hideTableCards } from "./node-visibility/global";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  getViewportForBounds,
  useReactFlow,
  type NodeMouseHandler,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { edgeTouchesHiddenField } from "./field-viewport";
import { NodeVisibility } from "./node-visibility/NodeVisibility";
import { api } from "./api";
import { TRACE_EDGE_LIMIT } from "./graph-limits";
import { adaptTrace, type FieldSelectionContext } from "./graph-adapter";
import { DetailPanel } from "./components/DetailPanel";
import { ResizableWorkspace } from "./components/ResizableWorkspace";
import { LineageNode } from "./components/LineageNode";
import { TaskNode } from "./components/TaskNode";
import { FieldSelector } from "./components/FieldSelector";
import { ExplorationPanel } from "./components/ExplorationPanel";
import { isSameGraphVersion, normalizeRegionItems } from "./contract";
import {
  assessExplorationAnchor,
  assessExplorationRestore,
  createExplorationEntry,
  deleteExplorationEntry,
  explorationMember,
  readExplorationEntries,
  updateExplorationEntry,
  withoutExplorationMember,
  withExplorationMember,
  writeExplorationEntries,
  type ExplorationEntry,
  type ExplorationState,
} from "./exploration-entries";
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
const OverviewCanvas = lazy(() => import("./overview-canvas/OverviewCanvas").then(module => ({ default: module.OverviewCanvas })));

function Explorer() {
  const [upstreamPatterns, setUpstreamPatterns] = useState<string[]>([]);
  const upstreamRules = useRef(upstreamPatterns);
  upstreamRules.current = upstreamPatterns;
  const globalVisibility = useGlobalVisibility();
  const visibilityRules = useRef(globalVisibility.tables);
  visibilityRules.current = globalVisibility.tables;
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
    [selectedMembers, setSelectedMembers] = useState<GraphNode[]>([]),
    [highlightedFieldId, setHighlightedFieldId] = useState<string[]>(),
    [highlightedTaskId, setHighlightedTaskId] = useState<string>(),
    [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(
      new Set(),
    ),
    [terminal, setTerminal] = useState<TerminalNode>(),
    [details, setDetails] = useState<TaskDetail[]>([]),
    [detailLoading, setDetailLoading] = useState(false),
    [history, setHistory] = useState<Hist[]>([]),
    [status, setStatus] = useState<Record<string, unknown>>();
  const detail = details[0];
  const [explorationEntries, setExplorationEntries] = useState<
      ExplorationEntry[]
    >([]),
    [activeExplorationId, setActiveExplorationId] = useState<string>(),
    [explorationNotice, setExplorationNotice] = useState("");
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
  const loadDetail = useCallback(async (
    node: GraphNode,
    t?: TerminalNode,
    context?: FieldSelectionContext,
  ) => {
    const sequence = ++detailSequence.current;
    const rawMembers = context?.rawMembers?.length
      ? context.rawMembers
      : [node];
    setSelected(node);
    setSelectedMembers(rawMembers);
    setTerminal(t);
    setDetails([]);
    const requests = new Map<
      string,
      { taskId: string; column?: string; writeId?: string }
    >();
    const nodeTaskId = node.taskId ??
      (node.kind === "TASK" ? node.id.replace(/^task:/, "") : undefined);
    if (nodeTaskId)
      requests.set(`${nodeTaskId}|${node.writeId ?? ""}`, {
        taskId: nodeTaskId,
        column: node.column,
        writeId: node.writeId,
      });
    for (const ref of context?.writeRefs ?? [])
      requests.set(`${ref.taskId}|${ref.writeId}`, {
        taskId: ref.taskId,
        column: node.column,
        writeId: ref.writeId,
      });
    if (!requests.size) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const requestList = [...requests.values()].slice(0, 20);
      const settled = await Promise.allSettled(
        requestList.map((request) =>
          api.task(request.taskId, {
            column: request.column,
            writeId: request.writeId,
          }),
        ),
      );
      if (sequence !== detailSequence.current) return;
      const values = settled.flatMap((result, index) => {
        if (result.status !== "fulfilled") return [];
        const request = requestList[index]!;
        return [
          {
            ...result.value,
            requestedColumn: request.column,
            requestedWriteId: request.writeId,
          },
        ];
      });
      const failedCount = settled.length - values.length;
      const omittedCount = Math.max(0, requests.size - requestList.length);
      if (failedCount || omittedCount)
        setError(
          `加工证据仅展示 ${values.length}/${requests.size} 组：${failedCount} 组读取失败${omittedCount ? `，${omittedCount} 组超过 20 组有界上限` : ""}。`,
        );
      if (
        values.some(
          (value) =>
            !isSameGraphVersion(activeVersion.current, value.version),
        )
      ) {
        setDetails([]);
        setError("图谱版本已更新，当前证据与画布版本不一致，请重新展开。");
        return;
      }
      setDetails(values);
    } catch {
      if (sequence === detailSequence.current) setDetails([]);
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false);
    }
  }, []);
  const graph = useMemo(
    () =>
      trace
        ? adaptTrace(
            trace,
            (raw, terminalNode, context) => {
              setHighlightedTaskId(undefined);
              const rawIds = (context?.rawMembers ?? [raw])
                .map(({ id }) => id)
                .sort();
              setHighlightedFieldId((current) =>
                current?.join("|") === rawIds.join("|") ? undefined : rawIds,
              );
              void loadDetail(raw, terminalNode, context);
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
  const [hiddenFieldsByCard, setHiddenFieldsByCard] = useState<Record<string, string[]>>({});
  const onHiddenFieldsChange = useCallback((nodeId: string, ids: string[]) => {
    setHiddenFieldsByCard(current => {
      if ((current[nodeId] ?? []).join("|") === ids.join("|")) return current;
      const next = { ...current };
      if (ids.length) next[nodeId] = ids;
      else delete next[nodeId];
      return next;
    });
  }, []);
  const visibleNodes = useMemo(() => graph.nodes.map(node => ({
    ...node, data: { ...node.data, onHiddenFieldsChange },
  })), [graph.nodes, onHiddenFieldsChange]);
  const visibleEdges = useMemo(() => {
    const hidden = new Set(graph.nodes.flatMap(node => hiddenFieldsByCard[node.id] ?? []));
    return graph.edges.map(edge => ({ ...edge, hidden: edgeTouchesHiddenField(edge, hidden) }));
  }, [graph.nodes, graph.edges, hiddenFieldsByCard]);
  const globalGraph = useMemo(() => hideTableCards(visibleNodes, visibleEdges, globalVisibility.tables), [visibleNodes, visibleEdges, globalVisibility.tables]);
  const foldedEdgeCount = visibleEdges.filter(edge => edge.hidden).length;
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
        expandedCandidateIds?: string[];
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
          setAutoDepthNotice(
            `关系达到 ${TRACE_EDGE_LIMIT} 条上限，已自动改为 1 层。`,
          );
        } else if (nextLayer === "field" && value.truncated) {
          setAutoDepthNotice(
            `字段路径达到 ${value.edgeLimit} 条关系上限；已查询 ${selectedFields.length - (value.unqueriedRootNodeIds?.length ?? 0)}/${selectedFields.length} 个已选字段，保留当前边界。`,
          );
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
        setExpandedCandidates(
          new Set(settings?.expandedCandidateIds ?? []),
        );
        setTrace(value);
        pendingFit.current = fit;
        if (selectedFields.length === 1)
          void loadDetail(
            selectedFields[0]!,
            value.terminalNodes.find((x) => x.nodeId === selectedFields[0]!.id),
          );
        else if (selectedFields.length > 1) {
          setSelected(undefined);
          setSelectedMembers([]);
          setTerminal(undefined);
          setDetails([]);
        }
        return value;
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
    async (
      node: GraphNode,
      push = false,
      restored?: {
        entry: ExplorationEntry;
        anchor: Anchor;
        state: ExplorationState;
      },
    ) => {
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
        restored?.anchor ??
        (node.kind === "TASK"
          ? {
              taskId: node.id.replace(/^task:/, ""),
              label: node.label ?? node.id,
            }
          : {
              table: node.table,
              nodeId: node.id,
              label: node.label ?? node.table ?? node.id,
            });
      const nextLayer = restored?.state.layer ?? "table";
      const nextDirection = restored?.state.direction ?? direction;
      const nextDepth = restored?.state.depth ?? depth;
      const nextCandidates = restored?.state.candidates ?? candidates;
      setAnchor(next);
      setMode("lineage");
      if (restored) setTrace(undefined);
      setLayer(nextLayer);
      setDirection(nextDirection);
      setDepth(nextDepth);
      setCandidates(nextCandidates);
      setSelected(node);
      setSelectedMembers([node]);
      setTerminal(undefined);
      setDetails([]);
      try {
        let listedVersion: string | undefined;
        const page =
          nextLayer === "field"
            ? await loadAllFieldPages({
                readVersion: async () => {
                  const current = await api.status();
                  if (typeof current.version !== "string" || !current.version)
                    throw new Error("图谱版本不可用，请稍后重试。");
                  if (
                    activeVersion.current &&
                    current.version !== activeVersion.current
                  )
                    throw new Error("图谱已换版，请重新打开此专题。");
                  listedVersion = current.version;
                  return current.version;
                },
                isCurrent: () => navigation === navigationSequence.current,
                fetchPage: (offset, limit) => api.fields(next, offset, limit),
              })
            : await api.fields(next);
        if (navigation !== navigationSequence.current) return;
        const fs = nextLayer === "field" ? page : page.slice(0, 100);
        setFieldsMore(nextLayer === "field" ? false : page.length > 100);
        setFields(fs);
        fieldListVersion.current = listedVersion;
        const restoreAssessment = restored
          ? assessExplorationRestore(
              restored.entry,
              activeVersion.current ?? restored.entry.graphVersion,
              fs.map((field) => field.id),
            )
          : undefined;
        const restoredFields = restoreAssessment
          ? fs.filter((field) =>
              restoreAssessment.selectedFieldIds.includes(field.id),
            )
          : [];
        const nextSelectedIds = restored
          ? restoredFields.map((field) => field.id)
          : fs[0]
            ? [fs[0].id]
            : [];
        setSelectedFieldIds(nextSelectedIds);
        if (restored) restore.current = restored.state.viewport;
        let restoredTrace: TraceResult | undefined;
        if (restored?.state.layer === "field" && !restoredFields.length) {
          setLayer("table");
          setExplorationNotice(
            "专题保存的字段在当前图谱中不存在或已变更；已保留原始起点，请从表血缘继续选择字段。",
          );
          restoredTrace = await runTrace(next, "table", false, undefined, {
            direction: nextDirection,
            depth: nextDepth,
            candidates: nextCandidates,
            expandedCandidateIds: restored.state.expandedCandidateIds,
          });
        } else {
          restoredTrace = await runTrace(
            next,
            nextLayer,
            !restored,
            restoredFields,
            {
              direction: nextDirection,
              depth: nextDepth,
              candidates: nextCandidates,
              expandedCandidateIds: restored?.state.expandedCandidateIds,
            },
          );
        }
        if (navigation !== navigationSequence.current) return;
        const anchorAssessment = restored
          ? assessExplorationAnchor(
              next,
              restoredTrace?.nodes.map((item) => item.id) ?? [],
            )
          : undefined;
        if (restored && !anchorAssessment?.present) {
          setTrace(undefined);
          setError(
            `专题起点“${next.label}”在当前图谱中不存在；未按同名对象替换，请从搜索结果选择新的起点。`,
          );
          return;
        }
        if (node.kind === "TASK") void loadDetail(node);
      } catch (e) {
        if (navigation === navigationSequence.current)
          setError(
            restored
              ? `专题起点“${next.label}”无法按原始身份恢复：${e instanceof Error ? e.message : "读取失败"}`
              : e instanceof Error
                ? e.message
                : "读取失败",
          );
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
  }, []);
  useEffect(() => {
    let cancelled = false;
    setOverview(undefined);
    setRegionName("");
    setRegionMore(false);
    setResults([]);
    setError("");
    void (upstreamPatterns.length ? scopedOverview(upstreamPatterns, globalVisibility.tables) : api.overview(globalVisibility.tables))
      .then((value) => {
        if (cancelled) return;
        setOverview(value);
        activeVersion.current = value.version;
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "全貌读取失败"); });
    return () => { cancelled = true; };
  }, [globalVisibility.tables, upstreamPatterns]);
  useEffect(() => {
    const storage = (() => {
      try {
        return window.localStorage;
      } catch {
        return undefined;
      }
    })();
    const loaded = readExplorationEntries(storage);
    setExplorationEntries(loaded.entries);
    if (loaded.warning) setExplorationNotice(loaded.warning);
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
    const rules = visibilityRules.current;
    const scopeRules = upstreamRules.current;
    const page = scopeRules.length ? await scopedRegion(scopeRules, rules, schema, offset) : await api.region(schema, offset, 50, rules);
    if (rules !== visibilityRules.current || scopeRules !== upstreamRules.current) return;
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
  async function continueFromSelected() {
    if (!selected) return;
    const terminalIds = new Set(
      trace?.terminalNodes.map(({ nodeId }) => nodeId) ?? [],
    );
    const continuable = (selectedMembers.length ? selectedMembers : [selected])
      .filter((member) => !terminalIds.has(member.id));
    if (!continuable.length) return;
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
      memberNodeIds: continuable.map(({ id }) => id),
      label: `${selected.table ?? ""}.${selected.column ?? selected.label ?? selected.id}`,
    };
    setAnchor(next);
    setLayer("field");
    setFields(continuable);
    fieldListVersion.current = activeVersion.current;
    setSelectedFieldIds(continuable.map(({ id }) => id));
    setFieldsMore(false);
    await runTrace(next, "field", true, continuable);
  }
  function localExplorationStorage(): Storage | undefined {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }
  function replaceExplorationEntries(next: ExplorationEntry[]) {
    setExplorationEntries(next);
    const result = writeExplorationEntries(localExplorationStorage(), next);
    if (result.warning) setExplorationNotice(result.warning);
  }
  function currentGraphVersion(): string | undefined {
    if (activeVersion.current) return activeVersion.current;
    return typeof status?.version === "string" ? status.version : undefined;
  }
  function snapshotExplorationState(memberId: string): ExplorationState {
    return {
      activeMemberId: memberId,
      layer,
      direction,
      depth,
      candidates,
      selectedFieldIds,
      expandedCandidateIds: [...expandedCandidates],
      viewport: flow.getViewport(),
    };
  }
  function newExplorationId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function createExploration(name: string, description: string) {
    if (!anchor) return;
    const graphVersion = currentGraphVersion();
    if (!graphVersion) {
      setError("图谱版本尚未就绪，暂时不能保存探索入口。");
      return;
    }
    try {
      const member = explorationMember(anchor);
      const entry = createExplorationEntry({
        id: newExplorationId(),
        name,
        description,
        graphVersion,
        member,
        state: snapshotExplorationState(member.id),
        now: new Date().toISOString(),
      });
      replaceExplorationEntries([...explorationEntries, entry]);
      setActiveExplorationId(entry.id);
      setExplorationNotice("已保存到当前浏览器。之后打开会按当前已发布图谱重新查询。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建专题失败");
    }
  }
  function updateExploration(
    entry: ExplorationEntry,
    name: string,
    description: string,
  ) {
    try {
      const updated = updateExplorationEntry(
        entry,
        {
          name,
          description,
          graphVersion: entry.graphVersion,
          state: entry.state,
        },
        new Date().toISOString(),
      );
      replaceExplorationEntries(
        explorationEntries.map((item) => (item.id === entry.id ? updated : item)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "修改专题失败");
    }
  }
  function saveExplorationState(entry: ExplorationEntry) {
    if (!anchor) return;
    const graphVersion = currentGraphVersion();
    const member = explorationMember(anchor);
    if (!graphVersion) {
      setError("图谱版本尚未就绪，暂时不能更新专题。");
      return;
    }
    if (!entry.members.some((item) => item.id === member.id)) {
      setError("当前起点尚未加入此专题，请先加入后再更新状态。");
      return;
    }
    try {
      const updated = updateExplorationEntry(
        entry,
        {
          name: entry.name,
          description: entry.description,
          graphVersion,
          state: snapshotExplorationState(member.id),
        },
        new Date().toISOString(),
      );
      replaceExplorationEntries(
        explorationEntries.map((item) => (item.id === entry.id ? updated : item)),
      );
      setExplorationNotice("已更新此专题的当前查询与展示状态。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新专题失败");
    }
  }
  function addCurrentExplorationMember(entry: ExplorationEntry) {
    if (!anchor) return;
    const graphVersion = currentGraphVersion();
    if (!graphVersion) {
      setError("图谱版本尚未就绪，暂时不能加入起点。");
      return;
    }
    const member = explorationMember(anchor);
    const updated = {
      ...withExplorationMember(
        entry,
        member,
        snapshotExplorationState(member.id),
        new Date().toISOString(),
      ),
      graphVersion,
    };
    replaceExplorationEntries(
      explorationEntries.map((item) => (item.id === entry.id ? updated : item)),
    );
    setActiveExplorationId(entry.id);
    setExplorationNotice("已将当前原始身份的起点加入专题。");
  }
  function removeExplorationMember(
    entry: ExplorationEntry,
    member: ReturnType<typeof explorationMember>,
  ) {
    const updated = withoutExplorationMember(
      entry,
      member.id,
      new Date().toISOString(),
    );
    if (!updated) {
      replaceExplorationEntries(
        deleteExplorationEntry(explorationEntries, entry.id),
      );
      setActiveExplorationId(undefined);
      setExplorationNotice("专题已移除最后一个起点，因此一并删除。 ");
      return;
    }
    replaceExplorationEntries(
      explorationEntries.map((item) => (item.id === entry.id ? updated : item)),
    );
  }
  async function openExplorationMember(
    entry: ExplorationEntry,
    memberId: string,
  ) {
    const member = entry.members.find((item) => item.id === memberId);
    if (!member) return;
    const prepared: ExplorationEntry = {
      ...entry,
      state: { ...entry.state, activeMemberId: member.id },
      updatedAt: new Date().toISOString(),
    };
    replaceExplorationEntries(
      explorationEntries.map((item) => (item.id === entry.id ? prepared : item)),
    );
    setActiveExplorationId(entry.id);
    try {
      const current = await api.status();
      if (typeof current.version !== "string" || !current.version)
        throw new Error("当前已发布图谱版本不可用。");
      const changed = assessExplorationRestore(entry, current.version, [])
        .graphVersionChanged;
      activeVersion.current = current.version;
      setStatus(current);
      setError("");
      setExplorationNotice(
        changed
          ? `专题保存于图谱 ${entry.graphVersion.slice(0, 10)}，当前为 ${current.version.slice(0, 10)}；已丢弃旧画布并按当前版本重新查询。`
          : "已按当前已发布图谱重新查询此专题。",
      );
      const raw: GraphNode = {
        id:
          member.anchor.nodeId ??
          (member.anchor.taskId ? `task:${member.anchor.taskId}` : member.id),
        kind: member.kind,
        table: member.anchor.table,
        taskId: member.anchor.taskId,
        label: member.label,
      };
      await choose(raw, false, {
        entry: prepared,
        anchor: member.anchor,
        state: prepared.state,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法打开保存的探索入口。",
      );
    }
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
      <ResizableWorkspace>
        <aside className="search-panel panel">
          <GlobalVisibility {...globalVisibility} />
          {UPSTREAM_SCOPE_ENABLED && <UpstreamScopePanel patterns={upstreamPatterns} onApply={patterns => { setUpstreamPatterns(patterns); setMode("overview"); void flow.setViewport({ x: 0, y: 0, zoom: 0.65 }); }} onExit={() => { setUpstreamPatterns([]); setMode("overview"); }} />}
          <ExplorationPanel
            entries={explorationEntries}
            activeEntryId={activeExplorationId}
            currentAnchor={anchor}
            onCreate={createExploration}
            onOpen={(entry) =>
              void openExplorationMember(entry, entry.state.activeMemberId)
            }
            onOpenMember={(entry, memberId) =>
              void openExplorationMember(entry, memberId)
            }
            onUpdate={updateExploration}
            onDelete={(entry) => {
              replaceExplorationEntries(
                deleteExplorationEntry(explorationEntries, entry.id),
              );
              if (activeExplorationId === entry.id)
                setActiveExplorationId(undefined);
              setExplorationNotice("已从当前浏览器删除此探索入口。");
            }}
            onAddCurrent={addCurrentExplorationMember}
            onRemoveMember={removeExplorationMember}
            onSaveCurrent={saveExplorationState}
          />
          {explorationNotice && (
            <div className="exploration-notice">{explorationNotice}</div>
          )}
          <button
            className="overview-button"
            onClick={() => {
              setMode("overview");
              setRegionName("");
              setResults([]);
              void flow.setViewport({ x: 0, y: 0, zoom: 0.65 });
            }}
          >
            {upstreamPatterns.length ? "上游范围骨架" : "全域加工骨架"}
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
              placeholder="技术表名、中文表说明、任务名或 ID"
            />
            <button>查找</button>
          </form>
          <div className="results">
            {regionName && <h3>{regionName} · 区域成员</h3>}
            {regionName && <RegionTopics key={regionName} schema={regionName} patterns={upstreamPatterns} hiddenTables={globalVisibility.tables} version={overview?.version} />}
            {results.map((n) => (
              <button key={n.id} onClick={() => void choose(n)}>
                <b>{n.label}</b>
                <small>
                  {n.kind === "TASK"
                    ? `任务 ${n.id.replace(/^task:/, "")}`
                    : n.table}
                </small>
                {n.metadata?.table.description && (
                  <small className="search-description">
                    {n.metadata.table.description}
                  </small>
                )}
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
                onClick={() => void openRegion(regionName, true).catch(e => setError(e instanceof Error ? e.message : "区域读取失败"))}
              >
                加载更多区域成员
              </button>
            )}
          </div>
          <div className="scope-note">
            <b>查询边界</b>
            <p>
              不预加载全图。每次最多读取 {TRACE_EDGE_LIMIT} 条关系；字段列表按每页 100
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
                  ? (upstreamPatterns.length ? "上游范围骨架 · 实验" : "全域加工骨架")
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
          {mode === "overview" && <UpstreamScopeStatus overview={overview} />}
          {mode === "lineage" && upstreamPatterns.length > 0 && (
            <div className="notice neutral">当前为独立血缘探索；实验范围仅约束“上游范围骨架”及其区域成员。</div>
          )}
          {mode === "lineage" && autoDepthNotice && (
            <div className="notice">{autoDepthNotice}</div>
          )}
          {mode === "overview" &&
            overview &&
            (overview.truncated.regions ||
              overview.truncated.flows ||
              overview.excluded.unqualifiedDatasets > 0) && (
              <div className="notice neutral">
                {upstreamPatterns.length ? "范围内聚合返回" : "当前聚合返回"} {overview.regions.length} 个区域、
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
              {!!trace.unqueriedRootNodeIds?.length && ` 另有 ${trace.unqueriedRootNodeIds.length} 个已选字段尚未查询，未画作孤立字段。`}
            </div>
          )}
          {mode === "lineage" && trace?.stoppedBy === "DEPTH_LIMIT" && (
            <div className="notice neutral">
              已到 {trace.depthLimit} 层边界，前沿仍可继续展开。
            </div>
          )}
          {mode === "lineage" && layer === "field" && foldedEdgeCount > 0 && (
            <div className="notice neutral">{foldedEdgeCount} 条连线因端点字段不在卡片可视范围内暂时收起；滚动查看，或点击字段定位关联字段。</div>
          )}
          <div className="flow-wrap" ref={flowWrap}>
            {mode === "overview" && overview ? (
              <Suspense fallback={<div className="welcome">正在加载骨架画布…</div>}><OverviewCanvas overview={overview} patterns={upstreamPatterns} hiddenTables={globalVisibility.tables} onOpenRegion={schema => { void openRegion(schema).catch(e => setError(e instanceof Error ? e.message : "区域读取失败")); }} /></Suspense>
            ) : mode === "overview" ? <div className="welcome">{error ? "范围读取未完成，请重新应用或退出范围。" : "正在读取加工骨架…"}</div> : anchor ? (
              <NodeVisibility nodes={globalGraph.nodes} edges={globalGraph.edges} scope={trace}>
                {(displayGraph) => (
              <ReactFlow
                nodes={displayGraph.nodes}
                edges={displayGraph.edges}
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
                )}
              </NodeVisibility>
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
          key={`${selected?.id ?? "none"}:${details.map((item) => `${item.taskId}:${item.requestedWriteId ?? ""}:${item.version}`).join("|") || "none"}`}
          node={selected}
          terminal={terminal}
          detail={detail}
          details={details}
          loading={detailLoading}
          onContinue={() => void continueFromSelected()}
        />
      </ResizableWorkspace>
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
