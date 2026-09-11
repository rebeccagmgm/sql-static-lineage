import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { gunzipSync } from "node:zlib";

const OUT = dirname(
  decodeURIComponent(new URL(import.meta.url).pathname)
    .replace(/^\//, "")
    .replace(/^([A-Za-z]):/, "$1:"),
);
const ROOT = join(OUT, "..", "..", "..", "..");
const DATA = join(ROOT, "..", "sql-static-lineage-data");
const BASE = join(ROOT, "docs", "data-graph-derived-2.0", "analysis");
const TARGET = "pdata_n.t98_sb_otc_swap_comp_info";
const TARGET_ID =
  "dataset:8bfedab27396b1ef2107fed850807e8ed54089c754022acbff7bfb955880ded2";
const GRAPH =
  "44e87de15ca82eb40480569c1db59c87b3636f7194b50576137889162425224e";
const REVIEW = [
  "163672",
  "211623",
  "218601",
  "241773",
  "171179",
  "176610",
  "204172",
  "243650",
  "138186",
  "209894",
  "171450",
  "176941",
];
const WRITERS = new Set(["163672", "211623"]);

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function gzipJson(path) {
  return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8"));
}
function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}
function lower(value) {
  return String(value ?? "").toLowerCase();
}
function flatRefs(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.forEach((x) => flatRefs(x, out));
    return out;
  }
  if (value.table && value.column)
    out.push({ table: lower(value.table), column: lower(value.column) });
  Object.values(value).forEach((x) => flatRefs(x, out));
  return out;
}
function uniqueRefs(value) {
  const seen = new Set();
  return flatRefs(value).filter((x) => {
    const k = `${x.table}.${x.column}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function targetRefs(value) {
  return uniqueRefs(value).filter((x) => x.table === TARGET);
}
function walkAtoms(node, fn) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((x) => walkAtoms(x, fn));
    return;
  }
  if (node.kind === "ATOM") fn(node);
  Object.values(node).forEach((x) => walkAtoms(x, fn));
}
function atomPairs(tree) {
  const pairs = [];
  walkAtoms(tree, (atom) => {
    const cols = (atom.operands ?? []).flatMap((x) => uniqueRefs(x));
    const targets = cols.filter((x) => x.table === TARGET);
    const others = cols.filter((x) => x.table !== TARGET);
    for (const left of targets)
      for (const right of others)
        pairs.push({
          targetField: left.column,
          peerField: `${right.table}.${right.column}`,
          operator: atom.operator ?? "",
          condition: atom,
        });
  });
  return pairs;
}
function factPath(taskId) {
  const dir = join(DATA, "task-projections", "tasks", taskId);
  if (!existsSync(dir)) return null;
  const pointerPath = join(dir, "task-local-projection.json");
  if (!existsSync(pointerPath)) return null;
  const pointer = json(pointerPath);
  const versions = join(dir, "versions");
  const expected = `${pointer.cacheKey}.evidence-v3.json`;
  const names = readdirSync(versions).filter((x) =>
    x.endsWith(".evidence-v3.json"),
  );
  const file = names.includes(expected)
    ? expected
    : names.length === 1
      ? names[0]
      : null;
  return file
    ? {
        pointer,
        path: join(versions, file),
        evidence: json(join(versions, file)),
      }
    : null;
}
function sources(evidence) {
  return (evidence.sqlSources ?? []).map((x) => ({
    slot: x.slot,
    sha256: x.sha256 ?? sha(String(x.content ?? "")),
    bytes: String(x.content ?? "").length,
    containsTarget:
      lower(x.content).includes(TARGET) ||
      lower(x.content).includes("t98_sb_otc_swap_comp_info"),
  }));
}
function material(evidence) {
  const relevant = sources(evidence).filter((x) => x.containsTarget);
  return {
    groupId: `SQLG-${sha(relevant.map((x) => `${x.slot}:${x.sha256}`).join("|")).slice(0, 16)}`,
    relevant,
  };
}
function targetRelations(evidence) {
  return (evidence.relations ?? [])
    .filter((r) => targetRefs(r).length)
    .map((r) => {
      const rel = r.relation ?? {};
      const condition =
        rel.condition_expr ??
        rel.predicate_expr ??
        rel.condition_display ??
        rel.predicate_display ??
        "";
      const pairs = atomPairs(rel.condition_tree ?? rel.predicate_tree);
      const refs = uniqueRefs(rel);
      return {
        id: r.relation_id ?? r.id,
        type: r.relation_type ?? r.type,
        scope: r.scope_id ?? rel.scope_id ?? "",
        joinType: rel.join_type ?? "",
        condition,
        targetFields: [...new Set(targetRefs(r).map((x) => x.column))].sort(),
        peerFields: [
          ...new Set(
            refs
              .filter((x) => x.table !== TARGET)
              .map((x) => `${x.table}.${x.column}`),
          ),
        ].sort(),
        joinPairs: pairs.map((p) => ({
          targetField: p.targetField,
          peerField: p.peerField,
          operator: p.operator,
        })),
        sourceSpan: r.source_span ?? r.span ?? null,
      };
    });
}
function targetExpressions(evidence) {
  return (evidence.expressions ?? [])
    .filter((x) => targetRefs(x).length)
    .map((x) => {
      const text = String(x.expression_text ?? x.display_text ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 500);
      const low = lower(text);
      const usage = /sum\s*\(|count\s*\(|avg\s*\(|group by|over\s*\(/.test(low)
        ? "数值计算/汇总"
        : /case|if\s*\(|coalesce|nvl|ifnull/.test(low)
          ? "分类/回退/条件取值"
          : "投影/属性取值";
      return {
        id: x.expression_id ?? x.id,
        output: x.output_name ?? x.output ?? "",
        expressionText: text,
        targetFields: [...new Set(targetRefs(x).map((r) => r.column))].sort(),
        inputFields: [
          ...new Set(
            (x.input_fields ?? x.input_columns ?? [])
              .map((i) => lower(i.column ?? i.name))
              .filter(Boolean),
          ),
        ].sort(),
        usage,
      };
    });
}
function targetFilters(relations) {
  return relations.filter((r) =>
    /filter|where/i.test(`${r.type} ${r.condition}`),
  );
}
function factsFor(taskId, loaded) {
  const e = loaded.evidence;
  const io = (e.datasetIo ?? []).filter(
    (x) => lower(x.physical_dataset) === TARGET,
  );
  const readOccurrences = io
    .flatMap((x) => x.read_occurrences ?? [])
    .map((x) => ({
      occurrenceId: x.occurrence_id,
      scopeId: x.scope_id,
      relationId: x.relation_id,
      span: x.source_span ?? x.span ?? null,
    }));
  const relations = targetRelations(e);
  const expressions = targetExpressions(e);
  const bindings = (e.bindings ?? []).filter(
    (x) =>
      lower(x.target_dataset) === TARGET ||
      lower(x.target_dataset) === TARGET.replace("pdata_n.", ""),
  );
  return {
    readOccurrences,
    relations,
    filters: targetFilters(relations),
    expressions,
    bindings: bindings.map((x) => ({
      id: x.binding_id,
      targetField: x.target_field,
      expressionId: x.expression_id,
      writeObservationId: x.write_observation_id,
      status: x.binding_status,
    })),
    currentWrites: (e.datasetIo ?? [])
      .filter((x) => x.direction === "WRITE")
      .map((x) => x.physical_dataset),
    issues: e.issues ?? [],
  };
}
function csv(v) {
  const s = Array.isArray(v)
    ? v.join("; ")
    : v == null
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
  return `"${s.replaceAll('"', '""')}"`;
}
function writeCsv(name, headers, rows) {
  writeFileSync(
    join(OUT, name),
    `\uFEFF${headers.map(csv).join(",")}\r\n${rows.map((r) => r.map(csv).join(",")).join("\r\n")}\r\n`,
    "utf8",
  );
}

mkdirSync(OUT, { recursive: true });
const baseline = gzipJson(join(BASE, "baseline-cache.json.gz"));
const annotations = gzipJson(join(BASE, "metadata-annotations.json.gz"));
if (baseline.graphVersion !== GRAPH || annotations.graphVersion !== GRAPH)
  throw new Error("baseline/annotation graph version mismatch");
const tableById = new Map(baseline.tables.map((x) => [x.id, x]));
const annotationById = new Map(annotations.tables.map((x) => [x.datasetId, x]));
const readRows = baseline.readRows.filter((x) => x.datasetId === TARGET_ID);
const taskIds = [...new Set(readRows.map((x) => String(x.taskId)))].sort(
  (a, b) => Number(a) - Number(b),
);
const writeRows = baseline.writeRows.filter((x) => x.datasetId === TARGET_ID);
const writerIds = [...new Set(writeRows.map((x) => String(x.taskId)))].sort(
  (a, b) => Number(a) - Number(b),
);
const loaded = new Map();
for (const id of taskIds) {
  const f = factPath(id);
  if (f) loaded.set(id, f);
}
for (const id of writerIds) {
  const f = factPath(id);
  if (f) loaded.set(id, f);
}
const facts = new Map([...loaded].map(([id, f]) => [id, factsFor(id, f)]));
const taskMaterial = new Map(
  [...loaded].map(([id, f]) => [id, material(f.evidence)]),
);
const groupToTasks = new Map();
for (const [id, m] of taskMaterial) {
  if (!groupToTasks.has(m.groupId)) groupToTasks.set(m.groupId, []);
  groupToTasks.get(m.groupId).push(id);
}
const reviewedGroups = new Set(
  REVIEW.map((id) => taskMaterial.get(id)?.groupId).filter(Boolean),
);
const tablePairs = baseline.tablePairs.filter((x) => x.source === TARGET_ID);
const targetDegree =
  baseline.degrees.find((x) => x.dataset === TARGET_ID) ?? {};
const downstreamIds = [...new Set(tablePairs.map((x) => x.target))];
const reviewedFacts = REVIEW.map((id) => ({
  evidenceId: `E-${id}`,
  taskId: id,
  materialGroupId: taskMaterial.get(id)?.groupId ?? "",
  taskName: loaded.get(id)?.evidence.taskName ?? "",
  facts: facts.get(id) ?? null,
  sources: loaded.get(id) ? sources(loaded.get(id).evidence) : [],
}));

const coverageTaskIds = [...new Set([...writerIds, ...taskIds])].sort(
  (a, b) => Number(a) - Number(b),
);
const coverage = coverageTaskIds.map((id) => {
  const f = loaded.get(id);
  const m = taskMaterial.get(id);
  const writes = baseline.writeRows
    .filter((x) => String(x.taskId) === id)
    .map((x) => {
      const d = jsonFromDetail(x.detail);
      const t = tableById.get(x.datasetId);
      return `${t?.table ?? x.datasetId}|${d.writeObservationId ?? ""}|${x.status}`;
    });
  const status = REVIEW.includes(id)
    ? "已核读（Facts+局部解释）"
    : m && reviewedGroups.has(m.groupId)
      ? "材料复用（同SQL材料组）"
      : f
        ? "仅结构提取"
        : "未核读/材料缺口";
  return {
    taskId: id,
    taskName: f?.evidence.taskName ?? "",
    role: WRITERS.has(id) ? "写入任务" : "消费任务",
    readOccurrences: readRows.filter((x) => String(x.taskId) === id).length,
    candidateWrites: writes,
    materialGroupId: m?.groupId ?? "",
    materialHashes: m?.relevant ?? [],
    status,
    evidencePath: f?.path ?? "",
    gaps: f ? "未核读具体业务规则" : "当前Facts材料缺失",
  };
});
function jsonFromDetail(value) {
  try {
    return JSON.parse(value ?? "{}");
  } catch {
    return {};
  }
}

const patterns = [
  [
    "P01_FORMATION_SOURCE",
    "主数据装载与字段补全",
    ["163672", "211623"],
    "T03_OTC_SWAP_COMP_INFO为主来源，账簿关系、名称、分类、对手方、机构和字典表补齐字段；目标表按Busi_Date分区覆盖写入。",
    "两个写者query哈希相同；当前证据不能证明两任务有不同来源或分区语义。",
  ],
  [
    "P02_CONTRACT_SCOPE",
    "合约范围筛选",
    ["218601", "171179", "176610", "243650", "138186", "209894"],
    "以Busi_Date、Comp_Stat_Cd、Swap_Type_Cd、Swap_Comp_Subdv_Cd、合约/对手方等条件缩小输入集合，部分分支再叠加账簿或状态条件。",
    "条件不是统一模板；OR白名单、UNION分支、日期锚点和状态排除会改变记录范围。",
  ],
  [
    "P03_IDENTITY_RELATION",
    "合约身份与关系连接",
    ["218601", "241773", "171450", "176941"],
    "Swap_Comp_Agt_Id、Comp_Prd_Id、Comp_Src_Prd_Id、Book_Agt_Id等分别连接持仓/估值/事件/账簿或其他合约数据。",
    "同名字段不等于同一键；连接类型、别名、日期条件和附加条件必须按比较式保留。",
  ],
  [
    "P04_CLASSIFICATION",
    "类型与业务标签分支",
    ["241773", "204172", "176610"],
    "Swap_Type_Cd、Cutp_Pty_Shor_Name、币种和日期进入CASE/IF等分支生成业务类型、标签或分类。",
    "分支优先级、旧版日期分支、默认值和字段组合不同，不能归并成同一分类规则。",
  ],
  [
    "P05_AMOUNT_CALCULATION",
    "币种换算与名义本金汇总",
    ["204172", "218601", "171450"],
    "原币/本币/结算币种名义本金与汇率字段参与CASE换算、乘法和SUM/分组，形成统计口径。",
    "汇率选择条件、聚合前粒度、重复匹配和NULL分支会改变数值；GROUP BY只折叠同组结果，不证明没有重复计入。",
  ],
  [
    "P06_MULTI_BRANCH_OUTPUT",
    "多分支、多路径输出",
    ["241773", "171179", "176941", "243650"],
    "同一任务对目标表有多个读取位置或UNION/多输出路径，分别服务不同业务分支。",
    "不能把一个分支规则推广到整项输出；UNION只有投影行完全相同时才可能去重，分支资格差异仍可能保留。",
  ],
];
const patternRows = patterns.map(([id, name, members, use, diff]) => [
  id,
  name,
  members,
  members.length,
  use,
  diff,
  members
    .flatMap((x) => facts.get(x)?.relations?.map((r) => r.id) ?? [])
    .slice(0, 20),
]);

const fieldMap = new Map();
for (const row of reviewedFacts) {
  if (!row.facts) continue;
  for (const r of row.facts.relations) {
    for (const field of r.targetFields) {
      const pairs = r.joinPairs
        .filter((x) => x.targetField === field)
        .map((x) => x.peerField);
      const key = `${field}|${pairs.join(";")}|${r.type}`;
      if (!fieldMap.has(key))
        fieldMap.set(key, {
          field,
          peers: new Set(pairs),
          uses: new Set(),
          tasks: new Set(),
          groups: new Set(),
          evidence: new Set(),
          conditions: new Set(),
        });
      const item = fieldMap.get(key);
      item.tasks.add(row.taskId);
      item.groups.add(row.materialGroupId);
      item.evidence.add(`${row.taskId}:${r.id}`);
      item.uses.add(
        /filter|where/i.test(r.type)
          ? "过滤条件"
          : /join/i.test(r.type)
            ? "JOIN关联"
            : "关系上下文",
      );
      if (r.condition)
        item.conditions.add(r.condition.replace(/\s+/g, " ").slice(0, 260));
    }
  }
  for (const e of row.facts.expressions)
    for (const field of e.targetFields) {
      const key = `${field}|${e.output}|${e.usage}`;
      if (!fieldMap.has(key))
        fieldMap.set(key, {
          field,
          peers: new Set(),
          uses: new Set(),
          tasks: new Set(),
          groups: new Set(),
          evidence: new Set(),
          conditions: new Set(),
        });
      const item = fieldMap.get(key);
      item.tasks.add(row.taskId);
      item.groups.add(row.materialGroupId);
      item.evidence.add(`${row.taskId}:${e.id}`);
      item.uses.add(e.usage);
      item.conditions.add(`${e.output}: ${e.expressionText}`);
    }
}
const comments = annotationById.get(TARGET_ID)?.fieldComments ?? {};
const denominator = `${REVIEW.length}个已核读任务、${reviewedGroups.size}个SQL材料组；全量结构分母为${taskIds.length}个直接消费任务，写入任务另列`;
const fieldRows = [...fieldMap.values()]
  .map((x) => [
    x.field,
    comments[x.field] ?? "未提供中文注释",
    [...x.peers].sort(),
    [...x.uses].sort(),
    x.tasks.size,
    x.groups.size,
    [...x.tasks].sort(),
    [...x.conditions].slice(0, 3),
    [...x.evidence].sort(),
    denominator,
  ])
  .sort((a, b) => b[4] - a[4] || a[0].localeCompare(b[0]));

const evidence = {
  documentType: "swap-comp-consumption-pilot-evidence",
  generatedAt: new Date().toISOString(),
  target: {
    table: TARGET,
    datasetId: TARGET_ID,
    comment: annotationById.get(TARGET_ID)?.tableComment ?? "",
    degree: targetDegree,
  },
  version: {
    graphVersion: GRAPH,
    baselineGeneratedAt: baseline.generatedAt,
    baselinePath: join(BASE, "baseline-cache.json.gz"),
    metadataPath: join(BASE, "metadata-annotations.json.gz"),
  },
  scope: {
    directConsumerTasks: taskIds.length,
    readOccurrences: readRows.length,
    writerTasks: writerIds.length,
    downstreamTables: downstreamIds.length,
    downstreamSchemas: targetDegree.downstreamSchemas ?? null,
    materialGroups: groupToTasks.size,
    reviewedTasks: REVIEW.length,
    reviewedMaterialGroups: reviewedGroups.size,
    reusedMaterialGroups: [...reviewedGroups].filter(
      (g) => (groupToTasks.get(g) ?? []).length > 1,
    ).length,
  },
  coverage,
  reviewedEvidence: reviewedFacts,
  patterns: patternRows.map((x) => ({
    patternId: x[0],
    name: x[1],
    members: x[2],
    evidenceIds: x[6],
  })),
  evidenceBoundary: [
    "候选read×write只表示任务级关联，不证明目标表影响每个输出。",
    "静态Facts不证明主键/唯一性、实际扩行、运行成功、数据到达或业务正确。",
    "未核读任务不能解释为未使用字段。",
    "JOIN对端只按同一比较条件的另一侧记录；附加过滤和表达式其他输入分开保留。",
  ],
  manualQuestions: [
    "两写者虽query哈希相同，实际是否为重复调度、不同分区或不同上游快照？",
    "Swap_Comp_Agt_Id与修饰符/业务日期组合在目标快照中是否唯一？",
    "各消费者的JOIN前后行数、合约状态覆盖和多分支贡献量是多少？",
    "币种换算缺少可用汇率时的业务处置及聚合守恒如何确认？",
  ],
};

writeCsv(
  "coverage.csv",
  [
    "任务ID",
    "任务名",
    "角色",
    "读取观察数",
    "候选写入",
    "SQL材料组",
    "相关材料哈希",
    "状态",
    "证据路径",
    "缺口",
  ],
  coverage.map((x) => [
    x.taskId,
    x.taskName,
    x.role,
    x.readOccurrences,
    x.candidateWrites,
    x.materialGroupId,
    x.materialHashes.map((y) => `${y.slot}:${y.sha256}`),
    x.status,
    x.evidencePath,
    x.gaps,
  ]),
);
writeCsv(
  "usage-patterns.csv",
  [
    "模式ID",
    "使用模式",
    "成员任务",
    "成员任务数",
    "结构共性/业务解释",
    "规则差异与结果影响",
    "证据定位",
  ],
  patternRows,
);
writeCsv(
  "field-usage.csv",
  [
    "字段",
    "中文注释",
    "JOIN直接对端",
    "Facts用途",
    "不同消费任务数",
    "不同SQL材料组数",
    "任务ID",
    "条件/表达式示例",
    "证据定位",
    "统计分母",
  ],
  fieldRows,
);
writeFileSync(
  join(OUT, "evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify(
    {
      graphVersion: GRAPH,
      target: TARGET,
      directConsumerTasks: taskIds.length,
      readOccurrences: readRows.length,
      writerTasks: writerIds,
      downstreamTables: downstreamIds.length,
      downstreamSchemas: targetDegree.downstreamSchemas ?? null,
      materialGroups: groupToTasks.size,
      reviewedTasks: REVIEW.length,
      reviewedMaterialGroups: reviewedGroups.size,
      loadedFacts: loaded.size,
    },
    null,
    2,
  ),
);
