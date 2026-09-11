import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const out = dirname(fileURLToPath(import.meta.url)),
  dest = resolve(out, "../classification");
for (const name of [
  "table-roles.csv",
  "table-role-evidence.json",
  "table-roles.json",
  "consumer-uses.json",
  "exclusion-views.json",
]) {
  if (existsSync(resolve(dest, name)))
    throw new Error(
      "CLASSIFICATION_ALREADY_INITIALIZED: update the existing registry; do not overwrite it from an earlier analysis snapshot.",
    );
}
const read = (n) =>
  JSON.parse(readFileSync(resolve(out, n), "utf8").replace(/^\uFEFF/, ""));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const c = JSON.parse(
  gunzipSync(readFileSync(resolve(out, "baseline-cache.json.gz"))),
);
const annotations = JSON.parse(
  gunzipSync(readFileSync(resolve(out, "metadata-annotations.json.gz"))),
);
const meta = new Map(annotations.tables.map((t) => [t.datasetId, t]));
const physical = new Map(c.tables.map((t) => [t.id, t]));
const s = read("baseline-summary.json"),
  labels = read("role-labels.json"),
  usage = read("foundation-uses.json");
assert.equal(labels.graphVersion, c.graphVersion);
assert.equal(usage.reviewedGraphVersion, c.graphVersion);
assert.equal(annotations.graphVersion, c.graphVersion);
const manifest = JSON.parse(readFileSync(s.graph.manifestPath, "utf8"));
const tasks = new Map(manifest.tasks.map((t) => [t.taskId, t])),
  memo = new Map();
function fixed(taskId) {
  if (!memo.has(taskId)) {
    const t = tasks.get(taskId);
    assert(t?.evidencePath);
    const bytes = readFileSync(t.evidencePath);
    memo.set(taskId, {
      path: t.evidencePath,
      sha256: sha(bytes),
      data: JSON.parse(bytes),
    });
  }
  return memo.get(taskId);
}
function verify(taskId, evidence) {
  const f = fixed(taskId),
    sql = f.data.sqlSources.find((s) => s.slot === evidence.slot);
  assert(sql);
  assert.equal(sha(sql.content), sql.sha256);
  assert.equal(sha(sql.content), evidence.sha256 ?? evidence.sqlSha256);
  assert(
    evidence.lineStart >= 1 &&
      evidence.lineStart <= evidence.lineEnd &&
      evidence.lineEnd <= sql.content.split("\n").length,
  );
  return {
    ...evidence,
    taskId,
    sqlSha256: sql.sha256,
    fixedEvidencePath: f.path,
    fixedEvidenceSha256: f.sha256,
  };
}
const uses = usage.uses.map((u) => {
  assert.equal(physical.get(u.sourceDatasetId)?.table, u.sourceTable);
  const e = verify(u.taskId, u.sqlEvidence);
  const f = fixed(u.taskId).data;
  assert(
    (f.datasetIo ?? []).some(
      (io) => io.write_observation_id === u.writeObservationId,
    ),
  );
  return { ...u, sqlEvidence: e };
});
const revenue = uses.find((u) => u.taskId === "230202");
revenue.additionalSqlEvidence = [95, 143].map((line) =>
  verify("230202", {
    slot: "query",
    sha256: revenue.sqlEvidence.sqlSha256,
    lineStart: line,
    lineEnd: line,
  }),
);
const code = read("role-code-map-evidence.json");
const source = c.tables.find((t) => t.table === "pdata_n.ref_cd_cvt_map");
assert(source);
uses.push({
  sourceDatasetId: source.id,
  sourceTable: source.table,
  sourceComment: meta.get(source.id).tableComment,
  taskId: "61476",
  targetTable: "pdata_n.t04_inr_org",
  targetComment:
    annotations.tables.find((t) => t.table === "pdata_n.t04_inr_org")
      ?.tableComment ?? "未提供中文注释",
  writeObservationId: "write-observation:61476:0",
  reviewedGraphVersion: c.graphVersion,
  sourceFields: [
    "src_cd_val",
    "dw_cd_val",
    "tgt_tab_name",
    "tgt_tab_fld",
    "src_tab_name",
    "src_fld_name",
    "src_sys_name",
  ].map((name) => ({
    name,
    comment: meta.get(source.id).fieldComments[name] ?? "未提供中文注释",
  })),
  uses: ["IDENTITY_MAPPING", "CALCULATION"],
  explanation:
    "按目标表和字段、源表和字段、源系统选择转换域，再将源码映射成仓库码。类型与状态字段未匹配时回退源码。",
  sqlEvidence: verify("61476", {
    slot: "query",
    sha256: code.sha256,
    lineStart: 7,
    lineEnd: 43,
  }),
  factsEvidence: {
    path: fixed("61476").path,
    writeObservationId: "write-observation:61476:0",
    bindingFields: ["inr_org_type_cd", "inr_org_stat_cd"],
  },
  conditions: [
    "映射域内SRC_CD_VAL唯一时不会因转换关联倍增。",
    "NVL回退只处理NULL，不保证空串也回退。",
  ],
  unknowns: ["仅核一项消费者，未核全表映射域、实际唯一性及标准代码业务含义。"],
});
const checkedAt = new Date().toISOString();
const rows = labels.rows.map((row) => {
  const t = physical.get(row.datasetId);
  assert(t && t.table === row.table);
  const {
    inDegree,
    outDegree,
    inRank,
    outRank,
    downstreamSchemas,
    downstreamSchemaList,
    ...rest
  } = row;
  const r = {
    ...rest,
    identity: {
      platform: t.platform,
      dataSource: t.dataSource,
      qualifiedName: t.table,
    },
    reviewedGraphVersion: c.graphVersion,
    checkedAt,
    structuralObservation: {
      graphVersion: c.graphVersion,
      inDegree,
      outDegree,
      inRank,
      outRank,
      downstreamSchemas,
      downstreamSchemaList,
    },
    classificationScope:
      "当前排名候选中的局部角色判断，不代表所有写者与全部字段均已核验。",
  };
  r.evidence = r.evidence.map((e) => {
    if (e.type !== "SQL") return e;
    // Main review corrected this source to its actual 16-line SQL span.
    if (e.taskId === "226177" && e.lineEnd === 18)
      e = {
        ...e,
        lineEnd: 16,
        reviewCorrection: "源SQL共16行，已修正范围终点。",
      };
    return verify(e.taskId, e);
  });
  if (
    [
      "pdata_n.t03_otc_deri_book_adtnl_info",
      "pdata_news_n.t02_tit_scr_base_info",
    ].includes(row.table)
  ) {
    const specific = uses.filter((u) => u.sourceDatasetId === row.datasetId);
    assert(specific.length);
    r.evidenceLevel = "SQL_VERIFIED";
    r.roles = ["BUSINESS_FOUNDATION"];
    r.exclusionClass = "BUSINESS_FOUNDATION";
    r.rationale = row.table.includes("book_adtnl")
      ? "账簿身份、所属部门、柜台与映射标的在具体消费中承担公共业务基础作用；补属性和业务控制分别记录。"
      : "证券身份与币种属性参与合约标签判断，属于公共业务基础，不等于可在业务解释中省略。";
    r.evidence.push(
      ...specific.map((u) => ({
        type: "SQL",
        ...u.sqlEvidence,
        taskId: u.taskId,
        writeObservationId: u.writeObservationId,
        consumerUseId: [u.sourceDatasetId, u.taskId, u.writeObservationId].join(
          "|",
        ),
      })),
    );
    r.classificationScope =
      "依据已核消费者确认基础角色，全部生产分支及其他消费者尚未验收。";
  }
  if (row.table === "ods_gf1.hq_data_push_log")
    r.rationale += " 代表SQL的success为常量，不证明实际推送成功。";
  return r;
});
const registry = {
  schemaVersion: 1,
  graphVersion: c.graphVersion,
  updatedAt: checkedAt,
  scope: labels.scope,
  sourceSnapshot: "analysis/role-labels.json",
  snapshotSha256: sha(readFileSync(resolve(out, "role-labels.json"))),
  rows,
};
const decisions = rows
  .filter(
    (r) => r.evidenceLevel === "SQL_VERIFIED" && r.exclusionClass !== "NONE",
  )
  .map((r) => ({
    datasetId: r.datasetId,
    identity: r.identity,
    exclusionClass: r.exclusionClass,
    reason: r.rationale,
    evidence: r.evidence.filter((e) => e.type === "SQL"),
    reviewedGraphVersion: c.graphVersion,
    decisionBy: "main-executor",
    checkedAt,
  }));
const views = [
  { id: "full", name: "完整基线", classes: [] },
  {
    id: "without_system_access",
    name: "排除明确日志与权限结果",
    classes: ["SYSTEM_OR_ACCESS"],
  },
  {
    id: "without_public_reference",
    name: "再排除明确公共定义与参数",
    classes: ["SYSTEM_OR_ACCESS", "PUBLIC_REFERENCE"],
  },
  {
    id: "without_foundations",
    name: "再排除明确业务基础表（结构对照）",
    classes: ["SYSTEM_OR_ACCESS", "PUBLIC_REFERENCE", "BUSINESS_FOUNDATION"],
  },
];
mkdirSync(dest, { recursive: true });
const write = (name, data) =>
  writeFileSync(resolve(dest, name), JSON.stringify(data, null, 2) + "\n");
write("table-roles.json", registry);
const withKeys = uses.map((u) => ({
  ...u,
  useId: [u.sourceDatasetId, u.taskId, u.writeObservationId].join("|"),
  sourceIdentity: {
    platform: physical.get(u.sourceDatasetId).platform,
    dataSource: physical.get(u.sourceDatasetId).dataSource,
    qualifiedName: u.sourceTable,
  },
}));
assert.equal(new Set(withKeys.map((u) => u.useId)).size, withKeys.length);
for (const u of withKeys) {
  assert(c.taskReads[u.taskId]?.includes(u.sourceDatasetId));
  const observation = fixed(u.taskId).data.datasetIo.find(
    (io) => io.write_observation_id === u.writeObservationId,
  );
  assert.equal(observation?.physical_dataset, u.targetTable);
}
const sourceSnapshots = [
  "foundation-uses.json",
  "role-code-map-evidence.json",
].map((name) => ({
  path: "analysis/" + name,
  sha256: sha(readFileSync(resolve(out, name))),
}));
write("consumer-uses.json", {
  schemaVersion: 1,
  graphVersion: c.graphVersion,
  updatedAt: checkedAt,
  sourceSnapshots,
  scope: {
    tables: new Set(uses.map((u) => u.sourceDatasetId)).size,
    tasks: new Set(uses.map((u) => u.taskId)).size,
    uses: uses.length,
  },
  uses: withKeys,
});
write("exclusion-views.json", {
  schemaVersion: 1,
  graphVersion: c.graphVersion,
  updatedAt: checkedAt,
  definition:
    "仅排除精确物理身份，不按名称模式全域扩展。基础表排除只作结构对照。",
  views,
  rows: decisions,
});
const escape = (s) =>
  String(s ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ");
const roleNames = {
  SYSTEM_LOG: "系统日志",
  ACCESS_MANAGEMENT: "权限管理",
  PUBLIC_DEFINITION: "公共定义",
  PUBLIC_PARAMETER: "公共参数",
  BUSINESS_FOUNDATION: "业务基础",
  BUSINESS_RESULT: "业务结果",
  TRANSFER: "传输",
  UNKNOWN: "待确认",
};
let report =
  "# 排名表角色底账\n\n" +
  rows.length +
  "张物理表，范围是原入度前30、出度前30并集。SQL依据确认" +
  rows.filter((r) => r.evidenceLevel === "SQL_VERIFIED").length +
  "项，其他保留元数据候选；本轮排除" +
  decisions.length +
  "项。中文注释来自本地元数据，排名与下游schema列表属于固定版本观察。\n\n最终底账：[table-roles.json](table-roles.json)。初始子代理快照在 analysis/role-labels.json；主执行者补入账簿、证券具体用途核验，并纠正日志SQL行段。\n\n| 表名 | 中文注释 | 角色 | 证据级别 | 本轮排除类 | 入度 | 出度 | 下游schema数 | 下游schema列表 | 理由 |\n|---|---|---|---|---|---|---|---|---|---|\n";
for (const r of rows) {
  const d = r.structuralObservation;
  report +=
    "| " +
    [
      r.table,
      r.tableComment,
      r.roles.map((x) => roleNames[x] ?? x).join("、"),
      r.evidenceLevel,
      r.exclusionClass,
      d.inDegree,
      d.outDegree,
      d.downstreamSchemas,
      (d.downstreamSchemaList ?? []).join("、"),
      r.rationale,
    ]
      .map(escape)
      .join(" | ") +
    " |\n";
}
report +=
  "\n下游schema以直接目标表限定名首段去重，包含同schema、不递归；不同物理域同名schema合并。分散复用不自动等于跨业务。排名条目未标SQL_VERIFIED时不自动排除。\n";
writeFileSync(resolve(dest, "table-roles.md"), report);
writeFileSync(
  resolve(out, "classification-validation.json"),
  JSON.stringify(
    {
      graphVersion: c.graphVersion,
      classified: rows.length,
      sqlVerified: rows.filter((r) => r.evidenceLevel === "SQL_VERIFIED")
        .length,
      excluded: decisions.length,
      useRecords: uses.length,
      verifiedSqlTasks: [...memo.keys()],
      checks: [
        "fixed manifest evidence located",
        "actual SQL SHA256 matches declarations and cited hashes",
        "cited line ranges bounded",
        "usage write occurrence exists",
        "stable physical identities match cached graph",
        "unique usage identity",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    classified: rows.length,
    sqlVerified: rows.filter((r) => r.evidenceLevel === "SQL_VERIFIED").length,
    excluded: decisions.length,
    uses: uses.length,
  }),
);
