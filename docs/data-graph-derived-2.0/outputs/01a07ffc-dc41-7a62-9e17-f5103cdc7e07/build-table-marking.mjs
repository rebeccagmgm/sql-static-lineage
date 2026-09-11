import fs from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";
import { loadRoleLedger } from "../../analysis/table-role-ledger.mjs";

const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, "../..");
const read = async (p) =>
  JSON.parse(await fs.readFile(resolve(root, p), "utf8"));
const raw = gunzipSync(
  await fs.readFile(resolve(root, "analysis/baseline-cache.json.gz")),
);
const graph = JSON.parse(raw),
  run = await read("analysis/baseline-run.json");
assert.equal(
  createHash("sha256").update(raw).digest("hex"),
  run.files["baseline-cache.json.gz"].sha256OfUncompressedJson,
);
const meta = JSON.parse(
  gunzipSync(
    await fs.readFile(resolve(root, "analysis/metadata-annotations.json.gz")),
  ),
);
const labels = loadRoleLedger(resolve(root, "classification"));
const exclusions = await read("classification/exclusion-views.json");
for (const x of [meta, labels, exclusions])
  assert.equal(x.graphVersion, graph.graphVersion);
const metadata = new Map(meta.tables.map((t) => [t.datasetId, t]));
const roles = new Map(labels.rows.map((t) => [t.datasetId, t]));
const decisions = new Map(
  exclusions.rows.map((t) => [t.datasetId, t.exclusionClass]),
);
const degrees = new Map(graph.degrees.map((t) => [t.dataset, t]));
const tables = new Map(graph.tables.map((t) => [t.id, t]));
assert.equal(tables.size, graph.tables.length);
const schema = (name) =>
  name.includes(".") ? name.split(".")[0] : "未限定schema";
const downstream = new Map();
for (const pair of graph.tablePairs) {
  assert(tables.has(pair.source) && tables.has(pair.target));
  if (!downstream.has(pair.source)) downstream.set(pair.source, new Set());
  downstream.get(pair.source).add(schema(tables.get(pair.target).table));
}
const rows = graph.tables.map((t) => ({
  ...t,
  ...(degrees.get(t.id) ?? {
    inDegree: 0,
    outDegree: 0,
    readerTasks: 0,
    writerTasks: 0,
  }),
  schema: schema(t.table),
  io: degrees.has(t.id),
  schemas: [...(downstream.get(t.id) ?? [])].sort(),
}));
const compare = (degree, tasks) => (a, b) =>
  b[degree] - a[degree] ||
  b[tasks] - a[tasks] ||
  a.table.localeCompare(b.table) ||
  a.id.localeCompare(b.id);
const outRank = new Map(
  [...rows]
    .sort(compare("outDegree", "readerTasks"))
    .map((r, i) => [r.id, i + 1]),
);
const inRank = new Map(
  [...rows]
    .sort(compare("inDegree", "writerTasks"))
    .map((r, i) => [r.id, i + 1]),
);
rows.sort(compare("outDegree", "readerTasks"));
assert.equal(
  rows.reduce((n, r) => n + r.inDegree, 0),
  graph.tablePairs.length,
);
assert.equal(
  rows.reduce((n, r) => n + r.outDegree, 0),
  graph.tablePairs.length,
);
for (const r of rows)
  if (r.io) assert.equal(r.schemas.length, degrees.get(r.id).downstreamSchemas);
const roleNames = {
  SYSTEM_LOG: "系统日志",
  ACCESS_MANAGEMENT: "权限管理",
  PUBLIC_DEFINITION: "公共定义",
  PUBLIC_PARAMETER: "公共参数",
  BUSINESS_FOUNDATION: "业务基础",
  BUSINESS_RESULT: "业务结果",
  TRANSFER: "传输分发",
  UNKNOWN: "待确认",
};
const exclusionNames = {
  SYSTEM_OR_ACCESS: "日志与权限视图起排除",
  PUBLIC_REFERENCE: "公共参数视图起排除",
  BUSINESS_FOUNDATION: "仅基础表对照视图排除",
};
const headers = [
  "schema",
  "表名",
  "中文注释",
  "我的分类",
  "是否排除",
  "我的备注",
  "出度",
  "入度",
  "下游schema数",
  "出度排名",
  "入度排名",
  "读任务数",
  "写任务数",
  "下游schema列表",
  "已有分类（参考）",
  "已有证据级别",
  "已有判断理由",
  "已有核验范围",
  "当前排除视图",
  "图中读写状态",
  "注释状态",
  "平台",
  "物理表ID",
];
const safe = (v) => (typeof v === "string" && v.startsWith("=") ? "'" + v : v);
const data = rows.map((r) => {
  const label = roles.get(r.id),
    m = metadata.get(r.id);
  return [
    r.schema,
    r.table,
    label?.tableComment ?? m?.tableComment ?? "未提供中文注释",
    null,
    null,
    null,
    r.outDegree,
    r.inDegree,
    r.schemas.length,
    outRank.get(r.id),
    inRank.get(r.id),
    r.readerTasks,
    r.writerTasks,
    r.schemas.join(";"),
    label ? label.roles.map((x) => roleNames[x]).join(";") : "未研究",
    label?.evidenceLevel === "SQL_VERIFIED"
      ? "已核读所列SQL"
      : label
        ? "仅元数据候选"
        : "未研究",
    label?.rationale ?? "",
    label?.classificationScope ?? "",
    exclusionNames[decisions.get(r.id)] ?? "未排除",
    r.io ? "有任务读写记录" : "仅目录记录，无任务读写边",
    m?.status ?? "缺少元数据",
    r.platform,
    r.id,
  ].map(safe);
});
assert(
  data.every(
    (r) =>
      r.length === headers.length && r.slice(3, 6).every((v) => v === null),
  ),
);
const wb = Workbook.create();
const main = wb.worksheets.add("全量表标记");
const note = wb.worksheets.add("口径与填写说明");
const n = data.length + 1;
main.getRange(`A1:W${n}`).values = [headers, ...data];
main.getRange(`A1:W${n}`).format.font = {
  name: "Arial",
  size: 10,
  color: "#243247",
};
main.getRange(`A1:W${n}`).format.rowHeight = 34;
main.getRange(`A1:W${n}`).format.verticalAlignment = "center";
main.getRange(`A1:W${n}`).format.columnWidth = 16;
const table = main.tables.add(`A1:W${n}`, true, "AllPhysicalTables");
table.showFilterButton = true;
main.getRange("A1:W1").format = {
  fill: "#263D56",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  wrapText: true,
  rowHeight: 36,
};
main.getRange(`D2:F${n}`).format.fill = "#FFF2CC";
main.getRange("D1:F1").format.fill = "#84620C";
for (const [col, width] of [
  ["A", 20],
  ["B", 47],
  ["C", 50],
  ["D", 18],
  ["E", 14],
  ["F", 36],
  ["N", 65],
  ["O", 25],
  ["P", 21],
  ["Q", 65],
  ["R", 60],
  ["S", 30],
  ["T", 30],
  ["U", 22],
  ["V", 12],
  ["W", 78],
])
  main.getRange(`${col}1:${col}${n}`).format.columnWidth = width;
main.getRange(`G2:M${n}`).setNumberFormat("#,##0");
main.getRange(`G2:M${n}`).format.horizontalAlignment = "right";
for (const col of ["C", "D", "E", "F", "N", "O", "P", "Q", "R", "S", "T"])
  main.getRange(`${col}2:${col}${n}`).format.wrapText = true;
// Size description-heavy rows to their contents; keep all source text intact.
for (let i = 0; i < data.length; i++) {
  const lines = Math.max(
    ...[
      [2, 45],
      [5, 32],
      [13, 65],
      [16, 64],
      [17, 58],
    ].map(([col, width]) =>
      Math.ceil(
        String(data[i][col] ?? "").replace(/[^\x00-\xff]/g, "xx").length /
          width,
      ),
    ),
  );
  if (lines > 2)
    main.getRange(`A${i + 2}:W${i + 2}`).format.rowHeight = Math.min(
      300,
      lines * 14 + 8,
    );
}
main.getRange(`D2:D${n}`).dataValidation = {
  rule: {
    type: "list",
    values: [
      "系统日志",
      "权限管理",
      "公共定义",
      "公共参数",
      "业务基础",
      "业务结果",
      "传输分发",
      "其他",
      "待确认",
    ],
  },
};
main.getRange(`E2:E${n}`).dataValidation = {
  rule: { type: "list", values: ["排除", "保留", "待确认"] },
};
main.freezePanes.freezeRows(1);
main.freezePanes.freezeColumns(2);
main.showGridLines = false;
const onlyCatalog = rows.filter((r) => !r.io).length;
const info = [
  ["全量表分类与统计", ""],
  [
    "填写方式",
    "在“全量表标记”黄色列填写：我的分类、是否排除、我的备注。已有判断仅供参考，空白表示尚未标记。",
  ],
  [
    "分类与排除",
    "分类选主要角色，其他角色写备注。基础表不自动排除；“是否排除”是你的意向，回收标记后再形成独立对照统计。",
  ],
  [
    "排序与回收",
    "默认按出度降序；表头可筛选、排序。保留物理表ID，填写后保存这份Excel即可，后续按ID回收，不按行号匹配。",
  ],
  [
    "全量范围",
    `${rows.length} 张实际图目录表，包含 ${graph.degrees.length} 张有任务读写记录的表和 ${onlyCatalog} 张仅目录表。`,
  ],
  [
    "仅目录表",
    "本图中未发现任务读写边，当前度数和任务数为0；不表示实际系统从未使用此表。",
  ],
  [
    "出度 / 入度",
    "出度：直接下游不同物理表数；入度：直接上游不同物理表数。使用已有任务级表对缓存，非调度依赖。",
  ],
  [
    "任务数",
    "读任务数 / 写任务数：原始图中读取 / 写入该物理表的不同任务数，与相邻表数不同。",
  ],
  [
    "排名",
    "按全量表计算连续序号；度数相同时按读/写任务数降序、表名、物理表ID排序。低度数末端排名可能与旧IO表榜不同。",
  ],
  [
    "下游 schema",
    "按直接下游表的schema去重，包含同schema，不递归。跨schema也可能是分层或分发，不能单独认定跨业务。",
  ],
  [
    "已有判断",
    `${labels.rows.length} 张有分类候选，其中 ${labels.rows.filter((r) => r.evidenceLevel === "SQL_VERIFIED").length} 张核读过声明范围的SQL；其余表为未研究。`,
  ],
  [
    "SQL证据边界",
    "核读SQL仅覆盖声明范围，不代表所有写者、消费者或实际运行已验证。",
  ],
  [
    "注释",
    "来自当前版本本地表元数据及分类主账的中文注释；缺失或状态异常保留原样，不推测补齐。",
  ],
  [
    "统计来源",
    "baseline-cache.json.gz；metadata-annotations.json.gz。分类参考：table-roles.csv；排除参考：exclusion-views.json。",
  ],
  ["图版本", graph.graphVersion],
  [
    "目录计数差异",
    "发布摘要曾列6,893张，实际图目录为6,877张；本清单采用实际图目录，差异仍登记为缺口。",
  ],
  ["当前表对数", graph.tablePairs.length],
  [
    "标记用途",
    "只维护这份Excel中的黄色列即可；此次导出没有将已有分类自动当作你的确认。",
  ],
];
note.getRange(`A1:B${info.length}`).values = info;
note.getRange(`A1:B${info.length}`).format = {
  font: { name: "Arial", size: 11, color: "#243247" },
  rowHeight: 46,
  verticalAlignment: "center",
  wrapText: true,
};
note.getRange(`A1:A${info.length}`).format.columnWidth = 25;
note.getRange(`B1:B${info.length}`).format.columnWidth = 105;
note.getRange("A1:B1").format.font = {
  name: "Arial",
  size: 15,
  bold: true,
  color: "#263D56",
};
note.getRange("A2:B4").format.fill = "#FFF2CC";
note.showGridLines = false;
console.log(
  (
    await wb.inspect({
      kind: "table",
      range: "全量表标记!A1:M4",
      tableMaxRows: 4,
      tableMaxCols: 13,
      maxChars: 1800,
    })
  ).ndjson,
);
console.log(
  (
    await wb.inspect({
      kind: "match",
      searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!",
      options: { useRegex: true, maxResults: 10 },
      maxChars: 500,
    })
  ).ndjson,
);
for (const [sheetName, range, name] of [
  ["全量表标记", "A1:M8", "table-marking-preview"],
  ["口径与填写说明", "A1:B18", "table-marking-notes"],
]) {
  const image = await wb.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(
    resolve(out, `${name}.png`),
    new Uint8Array(await image.arrayBuffer()),
  );
}
const target = resolve(out, "全量表统计与人工标记.xlsx");
try {
  await fs.access(target);
  throw new Error("Workbook already exists; do not overwrite user markings.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await (await SpreadsheetFile.exportXlsx(wb)).save(target);
await fs.writeFile(
  resolve(out, "table-marking-validation.json"),
  JSON.stringify(
    {
      graphVersion: graph.graphVersion,
      rows: rows.length,
      io: graph.degrees.length,
      catalogOnly: onlyCatalog,
      classified: labels.rows.length,
      pairs: graph.tablePairs.length,
      columns: headers,
      userMarkingsBlank: true,
      uniquePhysicalIds: tables.size,
      checks: [
        "baseline hash",
        "graph versions",
        "all physical tables",
        "degree sums",
        "downstream schema counts",
        "blank user inputs",
      ],
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    output: target,
    rows: rows.length,
    io: graph.degrees.length,
    catalogOnly: onlyCatalog,
  }),
);
