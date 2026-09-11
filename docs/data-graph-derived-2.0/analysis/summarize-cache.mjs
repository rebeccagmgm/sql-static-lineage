import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const out = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(out, name), "utf8"));
const s = read("baseline-summary.json"),
  run = read("baseline-run.json");
const raw = gunzipSync(readFileSync(resolve(out, "baseline-cache.json.gz")));
const c = JSON.parse(raw),
  hash = (x) => createHash("sha256").update(x).digest("hex");
assert.equal(
  hash(raw),
  run.files["baseline-cache.json.gz"].sha256OfUncompressedJson,
);
assert.equal(
  hash(readFileSync(resolve(out, "baseline-summary.json"))),
  run.files["baseline-summary.json"].sha256,
);
assert.equal(c.graphVersion, s.graph.version);
assert.equal(c.tables.length, s.tableBaseline.catalogPhysicalDatasets);
assert.equal(c.degrees.length, s.tableBaseline.participatingIoTables);
const ids = new Set(c.tables.map((t) => t.id));
for (const pair of c.tablePairs) {
  assert(ids.has(pair.source) && ids.has(pair.target));
  assert.notEqual(pair.source, pair.target);
}
assert.equal(
  new Set(c.tablePairs.map((p) => p.source + "|" + p.target)).size,
  c.tablePairs.length,
);
assert.equal(
  c.degrees.reduce((n, d) => n + d.inDegree, 0),
  c.tablePairs.length,
);
assert.equal(
  c.degrees.reduce((n, d) => n + d.outDegree, 0),
  c.tablePairs.length,
);
assert.equal(
  c.components.reduce((n, group) => n + group.length, 0),
  c.degrees.length,
);
const inner = new Set(
  c.linearChains.chains.flatMap((chain) => chain.slice(1, -1)),
);
const cycles = new Set(c.linearChains.cycles.flat());
assert.equal(inner.size + cycles.size, s.tableBaseline.roles.oneInOneOut);
const reconstructed = new Set();
for (const [task, reads] of Object.entries(c.taskReads))
  for (const a of reads)
    for (const b of c.taskWrites[task] ?? [])
      if (a !== b) reconstructed.add(a + "|" + b);
assert.equal(reconstructed.size, c.tablePairs.length);
for (const p of c.tablePairs)
  assert(reconstructed.has(p.source + "|" + p.target));
for (const p of c.fieldPairs) {
  assert.equal(p.kinds.length, 1);
  assert.equal(p.targetFieldDenominator, c.outputColumns[p.target].length);
  assert(
    p.targetColumns.every((col) => c.outputColumns[p.target].includes(col)),
  );
  assert(p.targetCoverage >= 0 && p.targetCoverage <= 1);
}
for (const m of Object.values(s.fieldBaseline.edgeMappingByKind))
  assert.equal(
    m.total,
    Object.entries(m)
      .filter(([k]) => k !== "total")
      .reduce((n, [, v]) => n + v, 0),
  );
const name = new Map(c.tables.map((t) => [t.id, t.table]));
const rows = (heads, data) =>
  "| " +
  heads.join(" | ") +
  " |\n| " +
  heads.map(() => "---").join(" | ") +
  " |\n" +
  data.map((r) => "| " + r.join(" | ") + " |").join("\n");
const pct = (x) => (x * 100).toFixed(2) + "%";
const b = s.tableBaseline,
  f = s.fieldBaseline,
  k = s.controlBaseline;
const report = `# 新版基础统计与候选依据\n\n本批已完成全局结构和字段统计，尚未完成全网语义解释。固定版本：\`${s.graph.version}\`；查询前后 READY 且版本一致，时间 ${s.generatedAt}。大明细复用 [baseline-cache.json.gz](baseline-cache.json.gz)，机器摘要见 [baseline-summary.json](baseline-summary.json)。\n\n## 范围与口径\n\n${rows(
  ["项目", "本批结果"],
  [
    ["发布任务", s.graph.taskCount],
    ["发布覆盖", "5,489 投影；1,005 预期调度参考；740 材料缺口"],
    ["实际物理表目录", b.catalogPhysicalDatasets],
    ["参与 IO 的表", b.participatingIoTables],
    ["去重有向表对", b.distinctDirectedTablePairs],
    ["有多输出任务支持的表对", b.pairsWithAnyMultiOutputSupport],
    ["弱连通分量", b.weakComponents],
    ["最大分量", b.largestWeakComponentSizes[0]],
    ["含内部节点的最大链", b.linearChains.maximalChainsWithInternalNodes],
    ["链内不同节点", b.linearChains.internalNodeCount],
    ["纯环", b.linearChains.pureCycles],
    ["过滤自连后 IO 孤点", b.roles.isolatedIoNode],
  ],
)}\n\n表对是每任务不同外部读表 × 最终写表，去自连后全局去重。多输出支持不等于每个输出都有逐字段确认因果。所有 IO 节点保留；结构源端只表示本视图入度为零。角色标签有重叠，不可加总。连接回分叉端点的路径保留闭合端点，纯环单列。全部链与分量在缓存中，不仅是摘要前 100 条。\n\n**发布计数差异：** status 的发布摘要为 6,893 个物理表节点，本次实时 COUNT 与取数均为 6,877；WRITE_FIELD 发布 163,446、实查 162,320。其他节点差异见机器摘要 observedNodeCounts。本批采用实查集合，不据发布摘要补造节点，也未修图；差异原因未调查。\n\n## 表级候选\n\n复用位置前 12：\n\n${rows(
  ["表", "入度", "出度", "消费任务", "下游 schema 数"],
  b.topReuse
    .slice(0, 12)
    .map((x) => [
      x.table,
      x.inDegree,
      x.outDegree,
      x.readerTasks,
      x.downstreamSchemas,
    ]),
)}\n\n汇聚位置前 12：\n\n${rows(
  ["表", "入度", "出度", "写者数"],
  b.topConvergence
    .slice(0, 12)
    .map((x) => [x.table, x.inDegree, x.outDegree, x.writerTasks]),
)}\n\n这些指标支持选题，不能把推送日志的高汇聚解释成业务计算复杂，也不能把跨系统账号汇总当成同一笔交易链。公共候选既包括代码映射、组合定义、员工机构，也包括被广泛消费的账簿和证券业务对象；不默认排除。\n\n## 字段与控制覆盖\n\n${rows(
  [
    "通道",
    "总边",
    "已对齐表对",
    "源未映射",
    "目标未映射",
    "自连",
    "表对基线外",
  ],
  Object.entries(f.edgeMappingByKind)
    .map(([kind, m]) => [
      kind,
      m.total,
      m.aligned,
      m.sourceUnmapped,
      m.targetUnmapped,
      m.self,
      m.outsideTablePairBaseline,
    ])
    .concat([
      [
        "DATASET_CONTROL",
        k.edgeMapping.total,
        k.edgeMapping.aligned,
        k.edgeMapping.sourceUnmapped,
        k.edgeMapping.targetUnmapped,
        k.edgeMapping.self,
        k.edgeMapping.outsideTablePairBaseline,
      ],
    ]),
)}\n\n映射失败计数按源→目标→自连→表对范围的顺序互斥归类；本次歧义计数均为零，不等于业务身份已证明唯一。${f.writeFields.total} 个 WRITE_FIELD 中 ${f.writeFields.mappedToFinalWrite} 个绑定到最终写入，${f.writeFields.unmappedToFinalWrite} 个未绑定；分母覆盖 ${f.writeFields.targetTablesWithMappedOutputColumns} 张目标表。VALUE 覆盖 ${f.alignedValuePairs} 个表对，占全部表对 ${pct(f.tablePairCoverageByValue)}；其余不能自动视为无值加工。\n\n目标覆盖率 = 指定源表通过 VALUE 触达的目标不同列 / 目标全部已识别最终写入的不同输出列。CONDITION 独立存储，不进入 VALUE 分子。该比例不是 DDL 覆盖、金额贡献或某次写入的覆盖率。控制按任务、语句、关系三元组计数，共 ${k.alignedRelationIdentities} 个已入图关系；缺关系身份 ${k.edgeMapping.missingRelationIdentity} 项。\n\n值字段热点：\n\n${rows(
  ["源表.字段", "消费任务", "目标表", "目标物理列"],
  f.topFieldHotspots
    .filter((x) => x.kind === "VALUE")
    .slice(0, 12)
    .map((x) => [
      x.source + "." + x.column,
      x.consumerTasks,
      x.targetTables,
      x.targetFields,
    ]),
)}\n\n控制热点：\n\n${rows(
  ["源表.字段", "消费任务", "目标表", "关系数"],
  k.topControlHotspots
    .slice(0, 10)
    .map((x) => [
      x.source + "." + x.column,
      x.consumerTasks,
      x.targetTables,
      x.relationCount,
    ]),
)}\n\n例如代码转换表的目标字段/表名选择列，控制消费比普通值列更广；它们可能决定命中哪条映射，不能因列数少被忽略。组合类型同样控制组合解释域。这里只确认图中作用位置，具体匹配规则仍按 SQL 核验。\n\n## 字段候选与阈值敏感性\n\n${rows(
  ["视图", "最少源列", "最低目标覆盖", "表对", "成员表", "组数", "最大组"],
  s.candidateViews.map((v) => [
    v.name,
    v.definition.minDistinctSourceColumns,
    pct(v.definition.minTargetCoverage),
    v.retainedPairs,
    v.participatingTables,
    v.componentCount,
    v.componentSizes[0],
  ]),
)}\n\nVALUE 表对目标覆盖的四分位数为 ${pct(f.targetCoverageDistribution.quantiles.p25)}、${pct(f.targetCoverageDistribution.quantiles.p50)}、${pct(f.targetCoverageDistribution.quantiles.p75)}。宽口径仍成大团，严格口径拆为小组，表明边界对阈值敏感；本批停止继续调参，不宣称稳定业务簇。完整成员在 [candidate-groups.json](candidate-groups.json)。未入组表仍在全局底账，重要单列与公共控制另列候选。\n\n旧四表排除仅作对照：去除四表及其边后，保留原 IO 节点中的其他身份（含新孤点），见 candidate-groups 的 legacyExclusion；旧摘要中仅按剩余边端点计数的 ${s.legacyComparisons.withoutOldFourTables.participatingTables} 不是完整保留节点分母。\n\n## 优先学习问题\n\n1. 公共定义为何决定结果能否出表：组合定义与代码转换的值、控制热点；先核交叉销售末端组合连接，再扩展其他指标。\n2. 核心合约模型为何仍有不同规模：销售基础入度 34、出度 44，以四个写入分支核对编号、本金与聚合单位。\n3. 一张合约快照怎样成为月日均：按日展开、事件恢复、管理归属、分配和自然日分母必须分开解释。\n4. 高汇聚的跨系统权限为何不是一个人一行：账号域、操作分支选择和最终去重；先核导出规则，主汇总分支列待核。\n5. 参数同名为何不可合并：内部基础收益与交叉奖励的实际源列不同，映射后的计算用途需分开。\n6. 扩容后的待研究重点：推送日志、员工客户汇总、企微标签、机构/个人客户、证券整合和期权子交易；进入 [candidate-queue.json](candidate-queue.json)，不只延续销售路线。\n\n## 可重用产物与缺口\n\n[material-reuse.json](material-reuse.json) 已尝试按旧引用逐份比较实际 SQL 与写入上下文：旧文件缺失的 1,133 项均登记材料缺口，2 项可做局部一致复用。旧 manifest 缺失使全版本新增/退出/变化任务集无法精确比较，不阻塞本次结构统计。已有旧文只用作知识线索；新版正文依赖新固定证据重新核读。\n\n[cache-verification.json](cache-verification.json) 保存缓存哈希、表对重建、度数守恒、链内部覆盖、分量总数、VALUE/CONDITION 分离和覆盖率分母检查。原图、Facts、SQL 与配置均只读。\n`;
writeFileSync(resolve(out, "05-baseline-and-candidates.md"), report);
const groups = [];
for (const v of s.candidateViews) {
  const pairs = c.fieldPairs.filter(
    (p) =>
      p.kinds[0] === "VALUE" &&
      p.sourceColumns.length >= v.definition.minDistinctSourceColumns &&
      p.targetCoverage >= v.definition.minTargetCoverage,
  );
  const adjacent = new Map();
  for (const p of pairs) {
    for (const [a, b] of [
      [p.source, p.target],
      [p.target, p.source],
    ]) {
      if (!adjacent.has(a)) adjacent.set(a, new Set());
      adjacent.get(a).add(b);
    }
  }
  const seen = new Set(),
    components = [];
  for (const id of adjacent.keys()) {
    if (seen.has(id)) continue;
    const q = [id];
    seen.add(id);
    for (let i = 0; i < q.length; i++)
      for (const n of adjacent.get(q[i]))
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    components.push(q.sort());
  }
  components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  assert.equal(components.length, v.componentCount);
  groups.push({
    name: v.name,
    definition: v.definition,
    components,
    pairs: pairs.map((p) => ({
      source: p.source,
      target: p.target,
      tasks: p.tasks,
      sourceColumns: p.sourceColumns,
      targetCoverage: p.targetCoverage,
    })),
  });
}
const legacyNames = new Set([
  "pdata_n.t98_org_emp_base_info",
  "pdata_n.t98_org_brch_div_info",
  "pdata_news_n.t02_tit_scr_base_info",
  "pdata_news_n.t02_scr_base_info",
]);
const retained = c.degrees
  .filter((d) => !legacyNames.has(d.table))
  .map((d) => d.dataset);
writeFileSync(
  resolve(out, "candidate-groups.json"),
  JSON.stringify(
    {
      graphVersion: c.graphVersion,
      groups,
      legacyExclusion: {
        retainedIoNodes: retained.length,
        retainedDatasetIds: retained,
        pairCount: s.legacyComparisons.withoutOldFourTables.directedTablePairs,
      },
    },
    null,
    2,
  ) + "\n",
);
const selected = new Set(
  [...b.topReuse.slice(0, 20), ...b.topConvergence.slice(0, 20)].map(
    (d) => d.dataset,
  ),
);
const schemaGroups = Map.groupBy(c.degrees, (d) => d.schema);
for (const list of schemaGroups.values())
  for (const d of list
    .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
    .slice(0, 2))
    selected.add(d.dataset);
const queue = c.degrees
  .filter((d) => selected.has(d.dataset))
  .map((d) => ({
    ...d,
    reasons: [
      ...(b.topReuse.slice(0, 20).some((x) => x.dataset === d.dataset)
        ? ["TOP_REUSE"]
        : []),
      ...(b.topConvergence.slice(0, 20).some((x) => x.dataset === d.dataset)
        ? ["TOP_CONVERGENCE"]
        : []),
      "SCHEMA_SCOPE_CANDIDATE",
    ],
    writerTaskIds: Object.entries(c.taskWrites)
      .filter(([, ts]) => ts.includes(d.dataset))
      .map(([id]) => id),
    readerTaskIds: Object.entries(c.taskReads)
      .filter(([, ts]) => ts.includes(d.dataset))
      .map(([id]) => id),
    status: "LOCATED_NOT_EXPLAINED",
  }));
writeFileSync(
  resolve(out, "candidate-queue.json"),
  JSON.stringify(
    {
      graphVersion: c.graphVersion,
      definition:
        "Top 20 reuse/convergence plus top two total-degree tables per schema; schema is not a business process.",
      candidates: queue,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  resolve(out, "cache-verification.json"),
  JSON.stringify(
    {
      graphVersion: c.graphVersion,
      checkedAt: new Date().toISOString(),
      checksPassed: [
        "summary-and-cache-sha256",
        "table-pairs-reconstructed-from-task-io",
        "unique-physical-table-pairs",
        "sum-in-and-out-degrees",
        "components-cover-io-nodes",
        "all-degree-one-internals-covered-by-chains-or-pure-cycles",
        "separate-value-condition-pairs",
        "output-denominator-column-membership",
        "mapping-count-conservation",
        "candidate-component-recomputation",
      ],
      scriptSha256: hash(readFileSync(resolve(out, "build-baseline.ts"))),
      candidateQueueSize: queue.length,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    verified: true,
    queue: queue.length,
    chains: b.linearChains.maximalChainsWithInternalNodes,
    internalNodes: inner.size,
  }),
);
