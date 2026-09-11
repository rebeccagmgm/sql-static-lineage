import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, "../../../../sql-static-lineage-data/tables");
const c = JSON.parse(
  gunzipSync(readFileSync(resolve(out, "baseline-cache.json.gz"))),
);
const hash = (b) => createHash("sha256").update(b).digest("hex");
const clean = (s) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
const missing = "未提供中文注释";
const chinese = (s) => (/[\u3400-\u9fff]/u.test(s) ? s : missing);
const annotations = [];
for (const t of c.tables) {
  const path = resolve(
    root,
    t.platform,
    `${t.table}__${t.dataSource}`,
    "table.json",
  );
  const row = {
    datasetId: t.id,
    table: t.table,
    tableComment: missing,
    fieldComments: {},
    status: "METADATA_MISSING",
  };
  if (existsSync(path)) {
    const bytes = readFileSync(path),
      m = JSON.parse(bytes);
    if (
      String(m.platform).toLowerCase() !== t.platform ||
      String(m.dataSource).toLowerCase() !== t.dataSource ||
      String(m.qualifiedName).toLowerCase() !== t.table
    ) {
      row.status = "IDENTITY_MISMATCH";
      annotations.push(row);
      continue;
    }
    row.metadataPath = path;
    row.metadataSha256 = hash(bytes);
    row.collectedAt = m.collectedAt;
    row.tableComment = chinese(clean(m.description));
    row.status = "MATCHED_LOCAL_METADATA";
    const ddlPath = resolve(dirname(path), m.ddlFile?.path ?? "ddl.sql");
    if (existsSync(ddlPath)) {
      const ddlBytes = readFileSync(ddlPath),
        ddl = ddlBytes.toString("utf8");
      row.ddlSha256 = hash(ddlBytes);
      row.declaredDdlHashMatches =
        !m.ddlFile?.sha256 || m.ddlFile.sha256 === row.ddlSha256;
      if (row.declaredDdlHashMatches) {
        const put = (col, comment) => {
          const value = chinese(clean(comment.replaceAll("''", "'")));
          if (value !== missing) row.fieldComments[col.toLowerCase()] = value;
        };
        for (const match of ddl.matchAll(
          /[`"]?([a-z_][\w$]*)[`"]?\s+(?:string|varchar2?|nvarchar|char|text|bigint|int|integer|smallint|tinyint|double|float|decimal|numeric|number|boolean|date|timestamp)(?:\s*\([^)]*\))?(?:\s+precision)?\s+(?:not\s+null\s+)?comment\s+'((?:''|[^'])*)'/gi,
        ))
          put(match[1], match[2]);
        for (const match of ddl.matchAll(
          /comment\s+on\s+column\s+[^;\s]+\.([`"\w$]+)\s+is\s+'((?:''|[^'])*)'/gi,
        ))
          put(match[1].replaceAll('"', "").replaceAll("`", ""), match[2]);
        const tableComment = ddl.match(
          /comment\s+on\s+table\s+[^;\s]+\s+is\s+'((?:''|[^'])*)'/i,
        );
        if (row.tableComment === missing && tableComment)
          row.tableComment = chinese(clean(tableComment[1]));
      } else row.status = "DDL_HASH_MISMATCH";
    }
  }
  annotations.push(row);
}
const byId = new Map(annotations.map((a) => [a.datasetId, a]));
const annotatedDegrees = c.degrees.map((d) => ({
  ...d,
  tableComment: byId.get(d.dataset).tableComment,
}));
const fieldRows = c.fieldHotspots.map((f) => ({
  ...f,
  table: byId.get(f.dataset).table,
  tableComment: byId.get(f.dataset).tableComment,
  fieldComment: byId.get(f.dataset).fieldComments[f.column] ?? missing,
  consumerTasks: f.tasks.length,
  targetTables: f.targets.length,
  targetFields: f.targetColumns.length,
  readWriteOccurrences: f.occurrences.length,
}));
const controlRows = c.controlHotspots.map((f) => ({
  ...f,
  table: byId.get(f.dataset).table,
  tableComment: byId.get(f.dataset).tableComment,
  fieldComment: byId.get(f.dataset).fieldComments[f.column] ?? missing,
  consumerTasks: f.tasks.length,
  targetTables: f.targets.length,
  relationCount: f.relations.length,
}));
const csv = (rows) =>
  "\uFEFF" +
  rows
    .map((r) =>
      r.map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"').join(","),
    )
    .join("\n") +
  "\n";
writeFileSync(
  resolve(out, "table-degrees-with-comments.csv"),
  csv([
    [
      "物理表身份",
      "表名",
      "中文注释",
      "入度",
      "出度",
      "消费任务数",
      "写者数",
      "下游schema数",
    ],
    ...annotatedDegrees.map((d) => [
      d.dataset,
      d.table,
      d.tableComment,
      d.inDegree,
      d.outDegree,
      d.readerTasks,
      d.writerTasks,
      d.downstreamSchemas,
    ]),
  ]),
);
writeFileSync(
  resolve(out, "field-hotspots-with-comments.csv"),
  csv([
    [
      "通道",
      "物理表身份",
      "表名",
      "表中文注释",
      "字段",
      "字段中文注释",
      "消费任务数",
      "目标表数",
      "目标列数",
      "读写发生组合数",
      "控制关系数",
      "边数",
    ],
    ...[
      ...fieldRows,
      ...controlRows.map((r) => ({ ...r, kind: "DATASET_CONTROL" })),
    ].map((f) => [
      f.kind,
      f.dataset,
      f.table,
      f.tableComment,
      f.column,
      f.fieldComment,
      f.consumerTasks,
      f.targetTables,
      f.targetFields,
      f.readWriteOccurrences,
      f.relationCount,
      f.edges,
    ]),
  ]),
);
const metadata = {
  graphVersion: c.graphVersion,
  annotatedAt: new Date().toISOString(),
  sourceBoundary:
    "Current local table.json and hash-verified ddl.sql, matched on platform/dataSource/qualifiedName. Annotation metadata is not guaranteed contemporaneous with the graph publication. Missing Chinese comments are not guessed.",
  tables: annotations,
};
writeFileSync(
  resolve(out, "metadata-annotations.json.gz"),
  gzipSync(JSON.stringify(metadata)),
);
const escape = (s) => String(s).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
const md = (head, rows) =>
  "| " +
  head.join(" | ") +
  " |\n| " +
  head.map(() => "---").join(" | ") +
  " |\n" +
  rows.map((r) => "| " + r.map(escape).join(" | ") + " |").join("\n");
let report =
  "# 出入度与字段热点（含中文注释）\n\n统计已完成；注释来自当前本地元数据，按物理身份匹配，未必与图发布同日。缺少中文注释的项明确标记，不按英文名推测。完整明细：[表级 CSV](table-degrees-with-comments.csv)、[字段与控制 CSV](field-hotspots-with-comments.csv)。版本 `" +
  c.graphVersion +
  "`。\n";
for (const [title, key] of [
  ["出度热点", "outDegree"],
  ["入度热点", "inDegree"],
])
  report +=
    "\n## " +
    title +
    "（前100）\n\n" +
    md(
      ["表名", "中文注释", "入度", "出度", "消费任务数"],
      [...annotatedDegrees]
        .sort((a, b) => b[key] - a[key] || a.table.localeCompare(b.table))
        .slice(0, 100)
        .map((d) => [
          d.table,
          d.tableComment,
          d.inDegree,
          d.outDegree,
          d.readerTasks,
        ]),
    ) +
    "\n";
for (const kind of ["VALUE", "CONDITION", "DATASET_CONTROL"]) {
  const list =
    kind === "DATASET_CONTROL"
      ? controlRows
      : fieldRows.filter((f) => f.kind === kind);
  report +=
    "\n## " +
    kind +
    " 字段热点（前100）\n\n" +
    md(
      [
        "表名",
        "表中文注释",
        "字段",
        "字段中文注释",
        "消费任务",
        "目标表",
        "边数",
      ],
      [...list]
        .sort(
          (a, b) =>
            b.consumerTasks - a.consumerTasks ||
            b.targetTables - a.targetTables ||
            a.column.localeCompare(b.column),
        )
        .slice(0, 100)
        .map((f) => [
          f.table,
          f.tableComment,
          f.column,
          f.fieldComment,
          f.consumerTasks,
          f.targetTables,
          f.edges,
        ]),
    ) +
    "\n";
}
report +=
  "\n## 最长线性链（前20）\n\n" +
  c.linearChains.chains
    .slice(0, 20)
    .map(
      (chain, i) =>
        `${i + 1}. ` +
        chain
          .map((id) => {
            const a = byId.get(id);
            return `${a.table}（${a.tableComment}）`;
          })
          .join(" → "),
    )
    .join("\n") +
  "\n";
writeFileSync(resolve(out, "06-hotspots-with-comments.md"), report);
const degreeMap = new Map(
  annotatedDegrees.map((d) => [d.table, d.tableComment]),
);
const label = (text) => {
  if (degreeMap.has(text)) return text + "（" + degreeMap.get(text) + "）";
  const i = text.lastIndexOf(".");
  const table = text.slice(0, i),
    column = text.slice(i + 1);
  if (degreeMap.has(table)) {
    const matches = annotations.filter((a) => a.table === table);
    const comments = [
      ...new Set(matches.map((a) => a.fieldComments[column] ?? missing)),
    ];
    return (
      text +
      "（" +
      degreeMap.get(table) +
      "；" +
      (comments.length === 1 ? comments[0] : "中文注释存在物理身份差异") +
      "）"
    );
  }
  return text;
};
const path = resolve(out, "05-baseline-and-candidates.md");
let base = readFileSync(path, "utf8");
base = base
  .split("\n")
  .map((line) => {
    if (!line.startsWith("| ")) return line;
    const cells = line.split(" | ");
    cells[0] = "| " + label(cells[0].slice(2));
    return cells.join(" | ");
  })
  .join("\n");
if (!base.includes("06-hotspots-with-comments.md"))
  base +=
    "\n完整中英文热点与明细见 [出入度与字段热点](06-hotspots-with-comments.md)。中文注释来自当前本地元数据，不代表已验证与发布时完全一致。\n";
writeFileSync(path, base);
assert.equal(annotatedDegrees.length, c.degrees.length);
assert.equal(fieldRows.length, c.fieldHotspots.length);
const checks = {
  tables: c.tables.length,
  metadataMatched: annotations.filter(
    (a) => a.status === "MATCHED_LOCAL_METADATA",
  ).length,
  tablesWithChineseComments: annotations.filter(
    (a) => a.tableComment !== missing,
  ).length,
  ioTableRows: annotatedDegrees.length,
  fieldRows: fieldRows.length,
  controlRows: controlRows.length,
  fieldsWithChineseComments: fieldRows.filter((f) => f.fieldComment !== missing)
    .length,
  controlsWithChineseComments: controlRows.filter(
    (f) => f.fieldComment !== missing,
  ).length,
  graphCountsUnchanged: true,
};
writeFileSync(
  resolve(out, "annotation-summary.json"),
  JSON.stringify(checks, null, 2) + "\n",
);
console.log(JSON.stringify(checks));
