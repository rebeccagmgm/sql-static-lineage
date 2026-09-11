import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { loadRoleLedger } from "./table-role-ledger.mjs";

const out = dirname(fileURLToPath(import.meta.url));
const read = (n) => JSON.parse(readFileSync(resolve(out, n), "utf8"));
const bytes = gunzipSync(readFileSync(resolve(out, "baseline-cache.json.gz")));
const c = JSON.parse(bytes),
  run = read("baseline-run.json");
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  sha(bytes),
  run.files["baseline-cache.json.gz"].sha256OfUncompressedJson,
);
const labels = loadRoleLedger(resolve(out, "../classification")),
  approval = read("../classification/exclusion-views.json");
assert.equal(labels.graphVersion, c.graphVersion);
assert.equal(approval.graphVersion, c.graphVersion);
const metadata = JSON.parse(
  gunzipSync(readFileSync(resolve(out, "metadata-annotations.json.gz"))),
);
assert.equal(metadata.graphVersion, c.graphVersion);
const meta = new Map(metadata.tables.map((r) => [r.datasetId, r]));
const byId = new Map(labels.rows.map((r) => [r.datasetId, r]));
assert.equal(byId.size, labels.rows.length);
const allIds = new Set(c.degrees.map((d) => d.dataset));
const schemaById = new Map(c.degrees.map((d) => [d.dataset, d.schema]));
const physical = new Map(c.tables.map((t) => [t.id, t]));
for (const r of labels.rows) {
  assert(allIds.has(r.datasetId));
  assert.equal(r.table, physical.get(r.datasetId).table);
  if (r.identity) {
    assert.equal(r.identity.platform, physical.get(r.datasetId).platform);
    assert.equal(r.identity.dataSource, physical.get(r.datasetId).dataSource);
    assert.equal(r.identity.qualifiedName, physical.get(r.datasetId).table);
  }
}
const exclusions = approval.rows;
assert.equal(
  new Set(exclusions.map((r) => r.datasetId)).size,
  exclusions.length,
);
const allowedClasses = new Set([
  "SYSTEM_OR_ACCESS",
  "PUBLIC_REFERENCE",
  "BUSINESS_FOUNDATION",
]);
for (const e of exclusions) {
  assert(allIds.has(e.datasetId));
  assert(byId.has(e.datasetId));
  assert(e.reason && e.evidence);
  assert(allowedClasses.has(e.exclusionClass));
  assert.equal(byId.get(e.datasetId).evidenceLevel, "SQL_VERIFIED");
}
const cmp = (key, tie) => (a, b) =>
  b[key] - a[key] ||
  b[tie] - a[tie] ||
  a.table.localeCompare(b.table) ||
  a.dataset.localeCompare(b.dataset);
const ranks = (rows, key, tie) =>
  new Map([...rows].sort(cmp(key, tie)).map((d, i) => [d.dataset, i + 1]));
const originalIn = ranks(c.degrees, "inDegree", "writerTasks"),
  originalOut = ranks(c.degrees, "outDegree", "readerTasks");
const defs = approval.views;
assert.deepEqual(
  defs.map((v) => ({ id: v.id, classes: v.classes })),
  [
    { id: "full", classes: [] },
    { id: "without_system_access", classes: ["SYSTEM_OR_ACCESS"] },
    {
      id: "without_public_reference",
      classes: ["SYSTEM_OR_ACCESS", "PUBLIC_REFERENCE"],
    },
    {
      id: "without_foundations",
      classes: ["SYSTEM_OR_ACCESS", "PUBLIC_REFERENCE", "BUSINESS_FOUNDATION"],
    },
  ],
);
assert.equal(defs[0].id, "full");
assert.equal(defs[0].classes.length, 0);
assert.equal(new Set(defs.map((v) => v.id)).size, defs.length);
for (const v of defs) {
  assert(/^[a-z_]+$/.test(v.id));
  assert(v.classes.every((k) => allowedClasses.has(k)));
}
for (let i = 1; i < defs.length; i++)
  assert(defs[i - 1].classes.every((k) => defs[i].classes.includes(k)));
assert([...allowedClasses].every((k) => defs.at(-1).classes.includes(k)));
function compute(def) {
  const excluded = new Set(
    exclusions
      .filter((e) => def.classes.includes(e.exclusionClass))
      .map((e) => e.datasetId),
  );
  const remaining = c.degrees.filter((d) => !excluded.has(d.dataset));
  const pairs = c.tablePairs.filter(
    (p) => !excluded.has(p.source) && !excluded.has(p.target),
  );
  const incoming = new Map(),
    outgoing = new Map(),
    readers = new Map(),
    writers = new Map(),
    adj = new Map();
  const add = (m, a, b) => {
    if (!m.has(a)) m.set(a, new Set());
    m.get(a).add(b);
  };
  for (const p of pairs) {
    add(incoming, p.target, p.source);
    add(outgoing, p.source, p.target);
    add(adj, p.source, p.target);
    add(adj, p.target, p.source);
    for (const t of p.tasks) {
      add(readers, p.source, t);
      add(writers, p.target, t);
    }
  }
  const degrees = remaining.map((d) => ({
    ...d,
    tableComment:
      byId.get(d.dataset)?.tableComment ??
      meta.get(d.dataset)?.tableComment ??
      "未提供中文注释",
    roles: byId.get(d.dataset)?.roles ?? ["NOT_REVIEWED"],
    evidenceLevel: byId.get(d.dataset)?.evidenceLevel ?? "NOT_REVIEWED",
    originalInDegree: d.inDegree,
    originalOutDegree: d.outDegree,
    originalInRank: originalIn.get(d.dataset),
    originalOutRank: originalOut.get(d.dataset),
    inDegree: incoming.get(d.dataset)?.size ?? 0,
    outDegree: outgoing.get(d.dataset)?.size ?? 0,
    retainedConsumerTasks: readers.get(d.dataset)?.size ?? 0,
    retainedWriterTasks: writers.get(d.dataset)?.size ?? 0,
  }));
  const inRank = ranks(degrees, "inDegree", "writerTasks"),
    outRank = ranks(degrees, "outDegree", "readerTasks");
  for (const d of degrees) {
    d.inRank = inRank.get(d.dataset);
    d.outRank = outRank.get(d.dataset);
    d.inRankRise = d.originalInRank - d.inRank;
    d.outRankRise = d.originalOutRank - d.outRank;
    d.originalDownstreamSchemas = d.downstreamSchemas;
    d.downstreamSchemaList = [
      ...new Set(
        [...(outgoing.get(d.dataset) ?? [])].map((id) => schemaById.get(id)),
      ),
    ].sort();
    d.downstreamSchemas = d.downstreamSchemaList.length;
    assert(d.downstreamSchemas <= d.originalDownstreamSchemas);
    assert(d.retainedConsumerTasks <= d.readerTasks);
    assert(d.retainedWriterTasks <= d.writerTasks);
  }
  const seen = new Set(),
    sizes = [];
  for (const d of remaining) {
    if (seen.has(d.dataset)) continue;
    const q = [d.dataset];
    seen.add(d.dataset);
    for (let i = 0; i < q.length; i++)
      for (const n of adj.get(q[i]) ?? [])
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    sizes.push(q.length);
  }
  sizes.sort((a, b) => b - a);
  assert.equal(
    degrees.reduce((n, d) => n + d.inDegree, 0),
    pairs.length,
  );
  assert.equal(
    degrees.reduce((n, d) => n + d.outDegree, 0),
    pairs.length,
  );
  assert.equal(degrees.length + excluded.size, c.degrees.length);
  assert.equal(
    sizes.reduce((n, s) => n + s, 0),
    degrees.length,
  );
  assert(
    degrees.every(
      (d) =>
        d.inDegree <= d.originalInDegree && d.outDegree <= d.originalOutDegree,
    ),
  );
  return {
    id: def.id,
    name: def.name,
    excluded: [...excluded],
    nodeCount: degrees.length,
    pairCount: pairs.length,
    removedPairs: c.tablePairs.length - pairs.length,
    isolated: degrees.filter((d) => !d.inDegree && !d.outDegree).length,
    weakComponents: sizes.length,
    largestComponent: sizes[0] ?? 0,
    topIn: [...degrees].sort(cmp("inDegree", "writerTasks")).slice(0, 30),
    topOut: [...degrees].sort(cmp("outDegree", "readerTasks")).slice(0, 30),
    degrees,
  };
}
const views = defs.map(compute);
assert.equal(views.at(-1).excluded.length, exclusions.length);
assert.equal(views[0].pairCount, c.tablePairs.length);
assert.equal(views[0].nodeCount, c.degrees.length);
assert(
  views[0].degrees.every(
    (d) =>
      d.inDegree === d.originalInDegree && d.outDegree === d.originalOutDegree,
  ),
);
assert(
  views[0].degrees.every(
    (d) => d.downstreamSchemas === d.originalDownstreamSchemas,
  ),
);
for (let i = 1; i < views.length; i++) {
  assert(views[i].pairCount <= views[i - 1].pairCount);
  const previous = new Map(views[i - 1].degrees.map((d) => [d.dataset, d]));
  for (const d of views[i].degrees) {
    assert(
      d.retainedConsumerTasks <= previous.get(d.dataset).retainedConsumerTasks,
    );
    assert(
      d.retainedWriterTasks <= previous.get(d.dataset).retainedWriterTasks,
    );
    assert(
      d.downstreamSchemaList.every((s) =>
        previous.get(d.dataset).downstreamSchemaList.includes(s),
      ),
    );
  }
}
const csv = (rows) =>
  "\uFEFF" +
  rows
    .map((r) =>
      r
        .map((v) => {
          const value =
            typeof v === "string" && /^[\s]*[=+@-]/.test(v)
              ? "'" + v
              : String(v ?? "");
          return '"' + value.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\n") +
  "\n";
for (const v of views)
  writeFileSync(
    resolve(out, `rankings-${v.id}.csv`),
    csv([
      [
        "物理表身份",
        "表名",
        "中文注释",
        "角色",
        "标记证据级别",
        "原入度",
        "现入度",
        "原入度排名",
        "现入度排名",
        "原出度",
        "现出度",
        "原出度排名",
        "现出度排名",
        "原下游schema数",
        "现下游schema数",
        "现下游schema列表",
        "原始消费任务数",
        "保留表对支持消费任务数",
        "原始写者数",
        "保留表对支持写者数",
      ],
      ...v.degrees
        .sort((a, b) => a.inRank - b.inRank)
        .map((d) => [
          d.dataset,
          d.table,
          d.tableComment,
          d.roles.join(";"),
          d.evidenceLevel,
          d.originalInDegree,
          d.inDegree,
          d.originalInRank,
          d.inRank,
          d.originalOutDegree,
          d.outDegree,
          d.originalOutRank,
          d.outRank,
          d.originalDownstreamSchemas,
          d.downstreamSchemas,
          d.downstreamSchemaList.join(";"),
          d.readerTasks,
          d.retainedConsumerTasks,
          d.writerTasks,
          d.retainedWriterTasks,
        ]),
    ]),
  );
const output = {
  graphVersion: c.graphVersion,
  createdAt: new Date().toISOString(),
  baselineCatalogTables: c.tables.length,
  baselineIoNodes: c.degrees.length,
  baselineSha256: sha(bytes),
  classificationSha256: sha(
    readFileSync(resolve(out, "../classification/table-roles.csv")),
  ),
  classificationEvidenceSha256: sha(
    readFileSync(resolve(out, "../classification/table-role-evidence.json")),
  ),
  exclusionDecisionSha256: sha(
    readFileSync(resolve(out, "../classification/exclusion-views.json")),
  ),
  definition:
    "Distinct task-level table pairs; remove only approved dataset identities and incident pairs; retain newly isolated IO nodes. Rank ties use original reader/writer task counts, then table name and physical identity. Rank rise alone is not increased connectivity.",
  views,
};
writeFileSync(
  resolve(out, "role-view-cache.json.gz"),
  gzipSync(JSON.stringify(output)),
);
writeFileSync(
  resolve(out, "role-view-summary.json"),
  JSON.stringify(
    { ...output, views: views.map(({ degrees, ...v }) => v) },
    null,
    2,
  ) + "\n",
);
const cell = (s) => String(s).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
const md = (h, r) =>
  "| " +
  h.join(" | ") +
  " |\n| " +
  h.map(() => "---").join(" | ") +
  " |\n" +
  r.map((row) => "| " + row.map(cell).join(" | ") + " |").join("\n");
let report =
  "# 角色排除后的热点与出入度\n\n基于固定版本 `" +
  c.graphVersion +
  "` 的完整统计缓存计算。原图与原统计保留，排除只是本轮结构对照。角色标记限入度前30、出度前30并集，未经核验项不自动排除；这不是全域日志/权限/公共基础的完整名单。\n\n" +
  md(
    [
      "视图",
      "排除表数",
      "保留IO节点数（含孤点）",
      "表对",
      "孤点",
      "弱连通分量",
      "最大分量",
    ],
    views.map((v) => [
      v.name,
      v.excluded.length,
      v.nodeCount,
      v.pairCount,
      v.isolated,
      v.weakComponents,
      v.largestComponent,
    ]),
  ) +
  "\n\n## 排除依据\n\n" +
  md(
    ["表名", "中文注释", "排除类", "决定理由"],
    exclusions.map((e) => [
      byId.get(e.datasetId).table,
      byId.get(e.datasetId).tableComment ??
        meta.get(e.datasetId)?.tableComment ??
        "未提供中文注释",
      e.exclusionClass,
      e.reason,
    ]),
  ) +
  "\n\n精确物理身份、证据及主执行者决定见 [排除视图底账](../classification/exclusion-views.json)；候选与未核验项见 [分类主账](../classification/table-roles.csv)。\n";
for (const v of views.slice(1)) {
  report +=
    "\n## " +
    v.name +
    "\n\n[完整排名 CSV](rankings-" +
    v.id +
    ".csv)。同度数时沿用原始消费/写者任务数、表名和物理身份排序，不把移除对象后的名次自然前移当成连接变强。\n";
  for (const [title, list, degree, rank, old] of [
    ["入度", v.topIn, "inDegree", "inRank", "originalInRank"],
    ["出度", v.topOut, "outDegree", "outRank", "originalOutRank"],
  ])
    report +=
      "\n### " +
      title +
      "前20\n\n" +
      md(
        [
          "现排名",
          "原排名",
          "表名",
          "中文注释",
          "原度数",
          "现度数",
          "原下游schema数",
          "现下游schema数",
        ],
        list
          .slice(0, 20)
          .map((d) => [
            d[rank],
            d[old],
            d.table,
            d.tableComment,
            d[degree === "inDegree" ? "originalInDegree" : "originalOutDegree"],
            d[degree],
            d.originalDownstreamSchemas,
            d.downstreamSchemas,
          ]),
      ) +
      "\n";
}
report +=
  "\n## 如何解释变化\n\n日志和权限结果的排除让业务结果显现；再排除公共定义/参数可以观察对共享映射的依赖；业务基础表排除是更强的敏感性对照，不表示账簿、证券在语义上可以删除。三种视图分别保留，不合成唯一“正确业务图”。\n\n同一个表的入出度只会减少或不变，名次却可能上升。新孤点照样保留，避免分母悄悄缩小。原始消费任务数保留全范围口径；保留表对支持任务数只统计该视图尚存表对，不等于任务本身被删除。\n\n本批重算表级热点与出入度。字段值、CONDITION、DATASET_CONTROL 使用原版分通道缓存辅助用途核验，未把缓存中源字段的全局消费任务数冒充排除后的字段精确任务数。\n";
report +=
  "\n下游schema数按保留的直接出邻表限定名首段去重，计入同schema、不递归，不按平台或数据源细分同名schema。CSV列出具体schema列表。它描述直接复用分布：跨schema可能是同一业务的分层落地或分发，不能单独证明跨业务。每个排除视图独立重算。\n";
writeFileSync(resolve(out, "09-role-filtered-rankings.md"), report);
writeFileSync(
  resolve(out, "role-view-validation.json"),
  JSON.stringify(
    {
      graphVersion: c.graphVersion,
      checks: [
        "baseline hash verified",
        "baseline degrees reproduced",
        "unique approved physical identities",
        "in/out degree sums equal pair count",
        "retained nodes include isolates",
        "component counts conserve nodes",
        "degrees never increase after removal",
        "cumulative views only remove pairs",
      ],
      views: views.map((v) => ({
        name: v.name,
        nodes: v.nodeCount,
        pairs: v.pairCount,
        excluded: v.excluded.length,
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    views.map((v) => ({
      name: v.name,
      nodes: v.nodeCount,
      pairs: v.pairCount,
      excluded: v.excluded.length,
      isolated: v.isolated,
    })),
    null,
    2,
  ),
);

const roleReport =
  "# 排名表角色底账\n\n唯一分类主账：[table-roles.csv](table-roles.csv)。本页由重算脚本生成，请勿直接维护。详细证据：[table-role-evidence.json](table-role-evidence.json)。\n\n" +
  md(
    [
      "表名",
      "中文注释",
      "角色",
      "证据级别",
      "入度",
      "出度",
      "下游schema数",
      "下游schema列表",
      "判断理由",
    ],
    labels.rows.map((r) => {
      const d = views[0].degrees.find((d) => d.dataset === r.datasetId);
      return [
        r.table,
        r.tableComment,
        r.roles.join(";"),
        r.evidenceLevel,
        d.inDegree,
        d.outDegree,
        d.downstreamSchemas,
        d.downstreamSchemaList.join(";"),
        r.rationale,
      ];
    }),
  ) +
  "\n";
writeFileSync(resolve(out, "../classification/table-roles.md"), roleReport);
