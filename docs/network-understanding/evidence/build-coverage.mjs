import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This index collects source-reviewed explanations. It never awards completion.
const evidenceRoot = path.dirname(fileURLToPath(import.meta.url));
const knowledgeRoot = path.dirname(evidenceRoot);
const repositoryRoot = path.resolve(knowledgeRoot, "../..");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const digest = (text) => createHash("sha256").update(text).digest("hex");
const splitLines = (text) => text.split(/\r\n|\r|\n/);
const businessStatuses = new Set([
  "EXPLAINED",
  "BUSINESS_SEMANTICS_EXPLAINED",
  "FAMILY_RULES_EXPLAINED",
]);
const transferStatuses = new Set([
  "TRANSFER_PATTERN_VERIFIED",
  "TRANSFER_VERIFIED",
]);
const templateStatuses = new Set(["TEMPLATE_VERIFIED"]);
const within = (root, file) => {
  const relative = path.relative(root, file);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
};

const catalog = await readJson(path.join(evidenceRoot, "task-catalog.json"));
const previousLedger = await readJson(
  path.join(evidenceRoot, "content-ledger.json"),
);
assert.equal(
  previousLedger.baseline.publicationVersion,
  catalog.baseline.publicationVersion,
);
const taskById = new Map(catalog.tasks.map((task) => [task.taskId, task]));
assert.equal(taskById.size, catalog.tasks.length, "Duplicate catalog task");
assert.deepEqual(
  previousLedger.tasks.map((t) => t.taskId).sort(),
  [...taskById.keys()].sort(),
);

const availableReviewNames = (await readdir(evidenceRoot))
  .filter((name) => name.endsWith("-review.json"))
  .sort();
const requestedReviewNames = process.argv.slice(2);
const reviewNames = requestedReviewNames.length
  ? requestedReviewNames
  : availableReviewNames;
assert.equal(
  new Set(reviewNames).size,
  reviewNames.length,
  "Duplicate requested review file",
);
for (const name of reviewNames)
  assert.ok(
    availableReviewNames.includes(name),
    `Unknown review filename: ${name}`,
  );
const excludedReviewNames = availableReviewNames.filter(
  (name) => !reviewNames.includes(name),
);
const explanationsByTask = new Map();
const reviewSummaries = [];
const evidenceCache = new Map();
const pageCache = new Map();
const supplementalCache = new Map();
const supplementalInventory = await readJson(
  path.join(evidenceRoot, "supplemental-pack-inventory.json"),
);
assert.equal(
  supplementalInventory.baseline.publicationVersion,
  catalog.baseline.publicationVersion,
);
const supplementalByTask = new Map(
  supplementalInventory.tasks.map((task) => [task.taskId, task]),
);

async function verifySupplementalSpan(taskId, span, name) {
  const record = supplementalByTask.get(taskId);
  assert.equal(
    record?.status,
    "SUPPLEMENTAL_SQL_AVAILABLE",
    `${name}: no supplemental SQL ${taskId}`,
  );
  const source = record.sql.find(
    (source) => source.slot === span.slot && source.path === span.path,
  );
  assert.ok(
    source && source.hashMatches,
    `${name}: supplemental locator mismatch ${taskId}`,
  );
  for (const field of [
    "taskPackMetadataPath",
    "packMetadataSha256",
    "packCollectedAt",
  ]) {
    assert.equal(
      span[field],
      record[field],
      `${name}: supplemental ${field} mismatch ${taskId}`,
    );
  }
  assert.equal(
    span.sha256,
    source.sha256,
    `${name}: supplemental hash mismatch ${taskId}`,
  );
  const cacheKey = `${taskId}/${span.slot}/${span.path}`;
  if (!supplementalCache.has(cacheKey)) {
    const metadataPath = path.resolve(
      repositoryRoot,
      record.taskPackMetadataPath,
    );
    const metadataText = await readFile(metadataPath, "utf8");
    assert.equal(
      digest(metadataText),
      record.packMetadataSha256,
      `${name}: current Pack changed ${taskId}`,
    );
    const metadata = JSON.parse(metadataText);
    assert.equal(
      String(metadata.taskId),
      taskId,
      `${name}: wrong supplemental Pack task ${taskId}`,
    );
    assert.equal(
      metadata.collectedAt,
      record.packCollectedAt,
      `${name}: Pack collection date changed ${taskId}`,
    );
    const sqlPath = path.resolve(repositoryRoot, source.path);
    assert.ok(
      within(path.dirname(metadataPath), sqlPath),
      `${name}: supplemental SQL outside Pack ${taskId}`,
    );
    const declared = metadata.sqlFiles.find(
      (file) =>
        file.slot === source.slot &&
        path.resolve(path.dirname(metadataPath), file.path) === sqlPath,
    );
    assert.ok(
      declared,
      `${name}: supplemental SQL not in Pack manifest ${taskId}`,
    );
    assert.equal(
      declared.sha256,
      source.sha256,
      `${name}: Pack SQL hash changed ${taskId}`,
    );
    const sqlText = await readFile(sqlPath, "utf8");
    assert.equal(
      digest(sqlText),
      source.sha256,
      `${name}: supplemental SQL bytes changed ${taskId}`,
    );
    supplementalCache.set(cacheKey, splitLines(sqlText).length);
  }
  assert.ok(
    Number.isInteger(span.startLine) &&
      Number.isInteger(span.endLine) &&
      span.startLine >= 1 &&
      span.endLine >= span.startLine &&
      span.endLine <= supplementalCache.get(cacheKey),
    `${name}: invalid supplemental SQL span ${taskId}`,
  );
}

async function verifyExternalSpan(taskId, span, name) {
  assert.equal(
    span.provider,
    "opencli:szdata-task-sql",
    `${name}: unsupported external SQL provider`,
  );
  assert.ok(
    typeof span.retrievedAt === "string" &&
      Number.isFinite(Date.parse(span.retrievedAt)),
    `${name}: missing external retrieval time ${taskId}`,
  );
  assert.ok(
    typeof span.path === "string" && typeof span.responsePath === "string",
    `${name}: missing external source paths ${taskId}`,
  );
  const sqlPath = path.resolve(repositoryRoot, span.path);
  const responsePath = path.resolve(repositoryRoot, span.responsePath);
  assert.ok(
    within(knowledgeRoot, sqlPath) && within(knowledgeRoot, responsePath),
    `${name}: external evidence outside knowledge library ${taskId}`,
  );
  const responseText = await readFile(responsePath, "utf8");
  assert.equal(
    digest(responseText),
    span.responseSha256,
    `${name}: external response changed ${taskId}`,
  );
  const response = JSON.parse(responseText);
  assert.ok(
    Array.isArray(response),
    `${name}: unexpected task-sql response shape ${taskId}`,
  );
  const matches = response.filter(
    (row) => String(row.taskId) === taskId && row.sqlCachePath,
  );
  assert.equal(
    matches.length,
    1,
    `${name}: missing or ambiguous external task identity ${taskId}`,
  );
  const source = matches[0];
  assert.equal(
    path.resolve(source.sqlCachePath),
    sqlPath,
    `${name}: response SQL locator mismatch ${taskId}`,
  );
  const sqlBytes = await readFile(sqlPath);
  assert.equal(
    sqlBytes.length,
    source.sqlBytes,
    `${name}: response SQL size mismatch ${taskId}`,
  );
  assert.equal(
    digest(sqlBytes),
    span.sha256,
    `${name}: external SQL bytes changed ${taskId}`,
  );
  assert.ok(
    Number.isInteger(span.startLine) &&
      Number.isInteger(span.endLine) &&
      span.startLine >= 1 &&
      span.endLine >= span.startLine &&
      span.endLine <= splitLines(sqlBytes.toString("utf8")).length,
    `${name}: invalid external SQL span ${taskId}`,
  );
}

for (const name of reviewNames) {
  const reviewText = await readFile(path.join(evidenceRoot, name), "utf8");
  const review = JSON.parse(reviewText);
  assert.equal(
    review.baseline?.publicationVersion,
    catalog.baseline.publicationVersion,
    `${name}: publication version mismatch`,
  );
  assert.ok(
    typeof review.processId === "string" && review.processId,
    `${name}: missing processId`,
  );
  assert.ok(Array.isArray(review.tasks), `${name}: tasks must be an array`);
  const seen = new Set();
  const statusCounts = {};
  for (const row of review.tasks) {
    const task = taskById.get(row.taskId);
    assert.ok(task, `${name}: task outside baseline ${row.taskId}`);
    assert.ok(!seen.has(row.taskId), `${name}: duplicate task ${row.taskId}`);
    seen.add(row.taskId);
    assert.ok(
      typeof row.reviewStatus === "string" && row.reviewStatus,
      `${name}: missing review status for ${row.taskId}`,
    );
    statusCounts[row.reviewStatus] = (statusCounts[row.reviewStatus] || 0) + 1;

    const chapter = row.chapter || review.chapter;
    assert.ok(
      typeof chapter === "string" && chapter,
      `${name}: missing chapter`,
    );
    const chapterPath = path.resolve(knowledgeRoot, chapter);
    assert.ok(
      within(knowledgeRoot, chapterPath),
      `${name}: chapter outside knowledge library`,
    );
    if (!pageCache.has(chapterPath))
      pageCache.set(chapterPath, await readFile(chapterPath, "utf8"));
    const page = pageCache.get(chapterPath);
    const anchor = row.sectionAnchor;
    assert.ok(
      typeof anchor === "string" && anchor,
      `${name}: missing section for ${row.taskId}`,
    );
    assert.ok(
      page.includes(`id="${anchor}"`) || page.includes(`id='${anchor}'`),
      `${name}: explicit chapter anchor missing for ${row.taskId}: ${anchor}`,
    );

    if (row.evidencePath)
      assert.equal(
        path.resolve(repositoryRoot, row.evidencePath),
        path.resolve(repositoryRoot, task.evidencePath),
        `${name}: evidence path drift for ${row.taskId}`,
      );
    if (!evidenceCache.has(task.taskId)) {
      const text = await readFile(
        path.resolve(repositoryRoot, task.evidencePath),
        "utf8",
      );
      assert.equal(
        digest(text),
        task.evidenceFileSha256,
        `${name}: evidence bytes changed ${task.taskId}`,
      );
      evidenceCache.set(task.taskId, JSON.parse(text));
    }
    const evidence = evidenceCache.get(task.taskId);
    if (row.evidenceFileSha256)
      assert.equal(
        row.evidenceFileSha256,
        task.evidenceFileSha256,
        `${name}: review evidence hash mismatch ${task.taskId}`,
      );
    assert.ok(
      Array.isArray(row.reviewedSql),
      `${name}: missing SQL read record ${task.taskId}`,
    );
    for (const span of row.reviewedSql) {
      const source = evidence.sqlSources.find((s) => s.slot === span.slot);
      assert.ok(source, `${name}: unknown slot ${task.taskId}/${span.slot}`);
      assert.equal(
        digest(source.content),
        source.sha256,
        `${name}: SQL bytes changed ${task.taskId}`,
      );
      if (span.sha256)
        assert.equal(
          span.sha256,
          source.sha256,
          `${name}: SQL hash mismatch ${task.taskId}`,
        );
      assert.ok(
        Number.isInteger(span.startLine) &&
          Number.isInteger(span.endLine) &&
          span.startLine >= 1 &&
          span.endLine >= span.startLine &&
          span.endLine <= splitLines(source.content).length,
        `${name}: invalid SQL span ${task.taskId}/${span.slot}`,
      );
    }
    const supplementalSql = row.supplementalSql ?? [];
    assert.ok(
      Array.isArray(supplementalSql),
      `${name}: supplemental SQL read record must be an array`,
    );
    for (const span of supplementalSql)
      await verifySupplementalSpan(task.taskId, span, name);
    const externalSql = row.externalSupplementalSql ?? [];
    assert.ok(
      Array.isArray(externalSql),
      `${name}: external SQL read record must be an array`,
    );
    for (const span of externalSql)
      await verifyExternalSpan(task.taskId, span, name);
    if (
      businessStatuses.has(row.reviewStatus) ||
      transferStatuses.has(row.reviewStatus) ||
      templateStatuses.has(row.reviewStatus)
    ) {
      assert.ok(
        row.reviewedSql.length + supplementalSql.length + externalSql.length >
          0,
        `${name}: explanation without recorded SQL ${task.taskId}`,
      );
    }
    const explanation = {
      processId: review.processId,
      reviewFile: name,
      chapter,
      sectionAnchor: anchor,
      reviewStatus: row.reviewStatus,
      family: row.family ?? null,
      summary: row.summary ?? null,
      gaps: row.gaps ?? [],
      recordedSqlSpanCount: row.reviewedSql.length,
      recordedSupplementalSqlSpanCount: supplementalSql.length,
      recordedExternalSqlSpanCount: externalSql.length,
      supplementalSourceDates: [
        ...new Set(supplementalSql.map((span) => span.packCollectedAt)),
      ],
      externalSourceDates: [
        ...new Set(externalSql.map((span) => span.retrievedAt)),
      ],
      scopeNote:
        "Status is the author-stated scope of this explanation, not whole-task completion.",
    };
    const existing = explanationsByTask.get(row.taskId) || [];
    explanationsByTask.set(row.taskId, [...existing, explanation]);
  }
  if (Array.isArray(review.scopeTaskIds))
    assert.deepEqual(
      [...seen].sort(),
      [...review.scopeTaskIds].sort(),
      `${name}: review rows do not match declared scope`,
    );
  reviewSummaries.push({
    processId: review.processId,
    file: name,
    sha256: digest(reviewText),
    tasks: seen.size,
    statusCounts,
  });
}

const tasks = previousLedger.tasks.map((task) => {
  const explanations = explanationsByTask.get(task.taskId) || [];
  const contentStatus = explanations.some((e) =>
    businessStatuses.has(e.reviewStatus),
  )
    ? "HAS_BUSINESS_EXPLANATION"
    : explanations.some((e) => transferStatuses.has(e.reviewStatus))
      ? "HAS_TRANSFER_REVIEW"
      : explanations.some((e) => templateStatuses.has(e.reviewStatus))
        ? "HAS_TEMPLATE_REVIEW"
        : explanations.length
          ? "LOCATED_OR_UNREVIEWED"
          : "NOT_REVIEWED";
  return { ...task, contentStatus, explanations };
});
const byContentStatus = {};
const unreviewedTopics = {};
for (const task of tasks) {
  byContentStatus[task.contentStatus] =
    (byContentStatus[task.contentStatus] || 0) + 1;
  if (!task.explanations.length) {
    const topic = taskById.get(task.taskId).topicName || "(no topic metadata)";
    unreviewedTopics[topic] = (unreviewedTopics[topic] || 0) + 1;
  }
}
const ledger = {
  ...previousLedger,
  definition:
    "Candidate allocation remains metadata navigation only. Explanations are merged from explicit source-reviewed topic records. HAS_BUSINESS_EXPLANATION means at least one scoped explanation, not all business semantics covered. Technical validation does not judge narrative adequacy or award completion.",
  reviews: reviewSummaries,
  excludedReviewFiles: excludedReviewNames,
  tasks,
  counts: {
    tasks: tasks.length,
    unassigned: tasks.filter((task) => task.unassigned).length,
    byCandidateProcess: Object.fromEntries(
      previousLedger.processes.map((process) => [
        process.id,
        tasks.filter((task) => task.candidateProcessIds.includes(process.id))
          .length,
      ]),
    ),
    notReviewed: byContentStatus.NOT_REVIEWED || 0,
    byContentStatus,
    reviewRecords: reviewSummaries.reduce((sum, r) => sum + r.tasks, 0),
    tasksWithScopeRecord: explanationsByTask.size,
    tasksWithRecordedSqlReading: tasks.filter((task) =>
      task.explanations.some(
        (e) =>
          e.recordedSqlSpanCount > 0 ||
          e.recordedSupplementalSqlSpanCount > 0 ||
          e.recordedExternalSqlSpanCount > 0,
      ),
    ).length,
    tasksWithPublishedSqlReading: tasks.filter((task) =>
      task.explanations.some((e) => e.recordedSqlSpanCount > 0),
    ).length,
    tasksWithSupplementalSqlReading: tasks.filter((task) =>
      task.explanations.some((e) => e.recordedSupplementalSqlSpanCount > 0),
    ).length,
    tasksWithExternalSqlReading: tasks.filter((task) =>
      task.explanations.some((e) => e.recordedExternalSqlSpanCount > 0),
    ).length,
  },
};
const tableText = (value) =>
  String(value)
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ");
const lines = [
  "# 知识内容覆盖账本",
  "",
  "这个页面帮助找到已经写出的解释和仍需研究的范围。记录通过了固定发布版本、任务集合、文件哈希、SQL 行段和页面锚点校验；这些技术检查不证明知识内容充分，也不会自动授予“整库完成”。",
  "",
  `已记录固定发布 SQL 核读的任务 ${ledger.counts.tasksWithPublishedSqlReading} 项；另有 ${ledger.counts.tasksWithSupplementalSqlReading} 项记录当前 Input Pack 补充 SQL 核读。两类可能重叠。补充来源独立验证 task.json 声明、采集时间、文件哈希与行段，不视为原发布中的 SQL 或新增图边。`,
  "",
  `另有 ${ledger.counts.tasksWithExternalSqlReading} 项记录当前平台定向查询的 SQL 核读，保留获取时间、响应中的任务身份与导出路径、SQL 字节数和双方哈希。这类材料同样是独立补证，不能替代固定发布或运行结果。`,
  "",
  excludedReviewNames.length
    ? `本次明确未合并的审阅文件：${excludedReviewNames.join("、")}。这些文件可能仍在编写，未计入下列状态。`
    : "本次合并了当前目录中的全部主题审阅文件；正文充分性仍需独立审阅。",
  "",
  "| 记录状态 | 不重复任务数 | 含义 |",
  "|---|---:|---|",
  `| 至少有一处业务解释 | ${byContentStatus.HAS_BUSINESS_EXPLANATION || 0} | 以具体审阅页声明的范围为准，未承诺全字段、全部消费或运行正确 |`,
  `| 已有传输规则复核 | ${byContentStatus.HAS_TRANSFER_REVIEW || 0} | 输入输出及传输处理已有解释，业务字段含义未因此补全 |`,
  `| 已有单源映射或历史模板复核 | ${byContentStatus.HAS_TEMPLATE_REVIEW || 0} | 以作者声明的模板范围为准，未因此完成业务语义解释 |`,
  `| 已定位或仍待核读 | ${byContentStatus.LOCATED_OR_UNREVIEWED || 0} | 包括仅有范围记录、SQL未读和已读但存在缺口的任务，不能统称已审阅 |`,
  `| 尚无合并后的主题审阅记录 | ${byContentStatus.NOT_REVIEWED || 0} | 继续研究；名称分类不能替代解释 |`,
  "",
  "各任务可能参与多个主题，下表的范围会重叠，不能相加当成独立任务数。",
  "",
  "| 主题审阅记录 | 任务数 | 原始审阅状态 |",
  "|---|---:|---|",
  ...reviewSummaries.map(
    (r) =>
      `| [${tableText(r.processId)}](${r.file}) | ${r.tasks} | ${Object.entries(
        r.statusCounts,
      )
        .map(([s, n]) => `${tableText(s)} ${n}`)
        .join("；")} |`,
  ),
  "",
  "## 尚无审阅记录的任务分布",
  "",
  "这里用平台主题定位后续工作，不把主题名当作业务含义。缺失主题的任务仍在总范围中。",
  "",
  "| 平台主题 | 任务数 |",
  "|---|---:|",
  ...Object.entries(unreviewedTopics)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => `| ${tableText(name)} | ${count} |`),
  "",
  "[完整逐任务记录](content-ledger.json) · [固定范围与证据状态](scope-summary.md) · [知识库入口](../README.md)",
  "",
];

// Stage complete files and preserve old copies before replacing either output.
// A process crash can still interrupt a pair; leftover .previous-* files allow recovery.
const transactionId = randomUUID();
const outputs = [
  ["content-ledger.json", `${JSON.stringify(ledger)}\n`],
  ["coverage-summary.md", lines.join("\n")],
].map(([name, content]) => ({
  file: path.join(evidenceRoot, name),
  content,
  existed: false,
  next: path.join(evidenceRoot, `.${name}.next-${transactionId}`),
  previous: path.join(evidenceRoot, `.${name}.previous-${transactionId}`),
}));
let committed = 0;
let preserveRecovery = false;
try {
  for (const output of outputs) {
    await writeFile(output.next, output.content, { flag: "wx" });
    try {
      await copyFile(output.file, output.previous, constants.COPYFILE_EXCL);
      output.existed = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const output of outputs) {
    await rename(output.next, output.file);
    committed += 1;
  }
} catch (error) {
  const rollbackErrors = [];
  for (const output of outputs.slice(0, committed).reverse()) {
    try {
      if (output.existed) await rename(output.previous, output.file);
      else await unlink(output.file);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
  }
  preserveRecovery = rollbackErrors.length > 0;
  if (preserveRecovery)
    throw new AggregateError(
      [error, ...rollbackErrors],
      `Coverage output rollback incomplete; preserve recovery files for ${transactionId}`,
    );
  throw error;
} finally {
  if (!preserveRecovery) {
    const cleanup = await Promise.allSettled(
      outputs.flatMap((output) => [
        unlink(output.next),
        unlink(output.previous),
      ]),
    );
    for (const result of cleanup)
      if (result.status === "rejected" && result.reason.code !== "ENOENT") {
        process.stderr.write(
          `Coverage temporary file cleanup failed: ${result.reason.message}\n`,
        );
      }
  }
}
process.stdout.write(
  `${JSON.stringify({ reviews: reviewSummaries.length, ...ledger.counts.byContentStatus })}\n`,
);
