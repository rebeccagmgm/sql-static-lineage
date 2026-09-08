import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// This is an evidence-only consumer. It never modifies the published graph or Facts.
const outputRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(outputRoot, '../../..');
const dataRoot = resolve(repoRoot, '../sql-static-lineage-data');
const pointerPath = join(dataRoot, 'artifacts/graphs/titans-otc/current.json');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
    : value;
const canonicalHash = (value) => sha256(`${JSON.stringify(canonical(value))}\n`);
// Same physical identity contract as scripts/project-graph/task-local/ids.ts.
const physicalIdentity = (value) => ({
  platform: value.platform?.trim().toLowerCase() ?? null,
  dataSource: value.dataSource?.trim().toLowerCase() ?? null,
  qualifiedName: value.qualifiedName.trim().toLowerCase(),
});
const relPath = (path) => relative(repoRoot, path).split(sep).join('/');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const sorted = (values) => [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
const counts = (values) => Object.fromEntries([...values.reduce((m, value) => {
  const key = String(value ?? 'UNKNOWN'); m.set(key, (m.get(key) ?? 0) + 1); return m;
}, new Map())].sort(([a], [b]) => a.localeCompare(b)));
const countBy = (rows, field) => counts(rows.map((row) => row[field]));
const safeText = (value) => typeof value !== 'string' ? value : value
  .replace(/(?:https?|jdbc|hdfs):[^\s'"<>]+/gi, '[内部地址已省略]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[地址已省略]')
  .replace(/\b[a-z0-9._-]+\.(?:gf\.com\.cn|gfinet\.com\.cn)\b/gi, '[内部主机已省略]')
  .replace(/\b(password|passwd|pwd|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[已省略]');
function assert(condition, message) { if (!condition) throw new Error(message); }
function inside(root, path) {
  const rel = relative(root, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function sourcePath(path) {
  const result = resolve(path);
  assert(inside(dataRoot, result), 'Manifest source path leaves the data root');
  return result;
}

// A narrow DDL column-list reader, not SQL semantics. Counts are labelled as such.
function closeParen(sql, start) {
  let depth = 0, quote = null;
  for (let i = start; i < sql.length; i++) {
    const char = sql[i];
    if (quote) {
      if (char === quote && sql[i + 1] === quote) { i++; continue; }
      if (char === quote && sql[i - 1] !== '\\') quote = null;
      continue;
    }
    if (['\'', '"', '`'].includes(char)) { quote = char; continue; }
    if (char === '(') depth++;
    if (char === ')' && --depth === 0) return i;
  }
  return -1;
}
function splitColumns(body) {
  const result = []; let start = 0, depth = 0, angle = 0, quote = null;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (quote) {
      if (char === quote && body[i + 1] === quote) { i++; continue; }
      if (char === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (['\'', '"', '`'].includes(char)) { quote = char; continue; }
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === '<') angle++;
    if (char === '>') angle--;
    if (char === ',' && depth === 0 && angle === 0) { result.push(body.slice(start, i)); start = i + 1; }
  }
  result.push(body.slice(start));
  return result;
}
function parseDdl(ddl) {
  const tableHead = /\bcreate\s+(?:external\s+)?table\s+(?:if\s+not\s+exists\s+)?[^\s(]+\s*\(/i.exec(ddl);
  if (!tableHead) return { parserStatus: 'NO_CREATE_TABLE_COLUMN_LIST', fields: [], description: null };
  const start = tableHead.index + tableHead[0].length - 1;
  const end = closeParen(ddl, start);
  if (end < 0) return { parserStatus: 'UNBALANCED_COLUMN_LIST', fields: [], description: null };
  const sections = [{ body: ddl.slice(start + 1, end), partition: false }];
  const partition = /\bpartitioned\s+by\s*\(/i.exec(ddl.slice(end + 1));
  if (partition) {
    const pstart = end + 1 + partition.index + partition[0].length - 1;
    const pend = closeParen(ddl, pstart);
    if (pend > pstart) sections.push({ body: ddl.slice(pstart + 1, pend), partition: true });
  }
  const fields = [];
  for (const section of sections) for (const column of splitColumns(section.body)) {
    const trimmed = column.trim();
    if (/^(?:constraint|primary|unique|foreign|check|key|index|like)\b/i.test(trimmed)) continue;
    const match = /^(?:`([^`]+)`|"([^"]+)"|\[([^\]]+)\]|([\w$]+))\s+([\s\S]+)$/.exec(trimmed);
    if (!match) continue;
    const name = match[1] ?? match[2] ?? match[3] ?? match[4];
    const type = match[5].split(/\s+(?:comment|not|null|default|constraint|primary|references|encode|distkey|sortkey)\b/i)[0].trim();
    const comment = /\bcomment\s+'((?:''|[^'])*)'/i.exec(match[5]);
    fields.push({ name, type: safeText(type), description: comment ? safeText(comment[1].replace(/''/g, "'")) : null, partition: section.partition });
  }
  // Hive/MySQL table COMMENT follows the main column list. PostgreSQL uses COMMENT ON TABLE.
  const tableComment = /\bcomment\s*(?:=\s*)?'((?:''|[^'])*)'/i.exec(ddl.slice(end + 1).split(/\bpartitioned\s+by\b/i)[0])
    ?? /\bcomment\s+on\s+table\s+[^;]+?\s+is\s+'((?:''|[^'])*)'/i.exec(ddl);
  return { parserStatus: 'COLUMN_LIST_READ', fields, description: tableComment ? safeText(tableComment[1].replace(/''/g, "'")) : null };
}

const pointerBytes = readFileSync(pointerPath);
const pointer = JSON.parse(pointerBytes);
const manifestPath = sourcePath(pointer.manifestPath);
const publicationPath = sourcePath(pointer.publicationPath);
const manifest = readJson(manifestPath), publication = readJson(publicationPath);
assert(pointer.version === publication.version, 'Pointer and publication version mismatch');
assert(resolve(publication.manifestPath) === manifestPath, 'Publication points at another manifest');
assert(manifest.tasks.length === publication.taskCount, 'Published task count mismatch');
assert(new Set(manifest.tasks.map((task) => task.taskId)).size === manifest.tasks.length, 'Duplicate manifest task IDs');
const tables = new Map(), taskRows = [], integrityIssues = [];

for (const task of manifest.tasks) {
  const projectionPath = sourcePath(task.path), evidencePath = sourcePath(task.evidencePath);
  const projectionBytes = readFileSync(projectionPath), evidenceBytes = readFileSync(evidencePath);
  const envelope = JSON.parse(projectionBytes), projection = envelope.projection, evidence = JSON.parse(evidenceBytes);
  assert(projection?.taskId === task.taskId && evidence.taskId === task.taskId, `Task source ID mismatch: ${task.taskId}`);
  const { generatedAt: _generatedAt, contentHash: _contentHash, ...hashPayload } = projection;
  const actualHash = canonicalHash(hashPayload);
  const contentHashMatches = actualHash === projection.contentHash && actualHash === task.contentHash && actualHash === envelope.projectionContentHash;
  if (!contentHashMatches) integrityIssues.push({ taskId: task.taskId, kind: 'PROJECTION_HASH_MISMATCH' });
  const sqlSources = (evidence.sqlSources ?? []).map((source) => {
    const actualSha256 = sha256(source.content ?? '');
    const hashMatches = actualSha256 === source.sha256;
    if (!hashMatches) integrityIssues.push({ taskId: task.taskId, slot: source.slot, kind: 'SQL_HASH_MISMATCH' });
    return { slot: source.slot, characterCount: (source.content ?? '').length, lineCount: source.content ? source.content.split(/\r\n|\r|\n/).length : 0, sha256: source.sha256, actualSha256, hashMatches };
  });
  const taskNode = projection.nodes.find((node) => node.nodeType === 'TASK');
  const physicalNodes = projection.nodes.filter((node) => node.nodeType === 'PHYSICAL_DATASET');
  const localClosure = projection.localClosure ?? {};
  const externalReads = (localClosure.externalReads ?? []).map((read) => ({ ...read }));
  const finalWrites = (localClosure.finalWrites ?? []).map((write) => ({ ...write }));
  const reads = new Set(externalReads.map((read) => read.datasetNodeId));
  const writes = new Set(finalWrites.map((write) => write.datasetNodeId));
  const fieldNodes = projection.nodes.filter((node) => node.nodeType === 'PHYSICAL_FIELD');
  for (const node of physicalNodes) {
    const p = node.properties;
    if (!tables.has(node.nodeId)) tables.set(node.nodeId, {
      nodeId: node.nodeId, platform: p.platform ?? null, dataSource: safeText(p.dataSource ?? null),
      qualifiedName: p.qualifiedName, identityStatus: p.identityStatus ?? null,
      identityFingerprint: canonicalHash({ platform: p.platform, dataSource: p.dataSource, qualifiedName: p.qualifiedName }),
      _identity: { platform: p.platform, dataSource: p.dataSource, qualifiedName: p.qualifiedName },
      occurrenceTaskIds: new Set(), consumerTaskIds: new Set(), producerTaskIds: new Set(),
      externalReadOccurrenceCount: 0, finalWriteOccurrenceCount: 0, _observedFields: new Set(),
    });
    const row = tables.get(node.nodeId);
    assert(canonicalHash(row._identity) === canonicalHash({ platform: p.platform, dataSource: p.dataSource, qualifiedName: p.qualifiedName }), `Dataset ID identity conflict: ${node.nodeId}`);
    row.occurrenceTaskIds.add(task.taskId);
    if (reads.has(node.nodeId)) row.consumerTaskIds.add(task.taskId);
    if (writes.has(node.nodeId)) row.producerTaskIds.add(task.taskId);
    row.externalReadOccurrenceCount += externalReads.filter((read) => read.datasetNodeId === node.nodeId).length;
    row.finalWriteOccurrenceCount += finalWrites.filter((write) => write.datasetNodeId === node.nodeId).length;
    for (const field of fieldNodes) {
      const f = field.properties;
      if (f.platform === p.platform && f.dataSource === p.dataSource && f.qualifiedName === p.qualifiedName) row._observedFields.add(f.column);
    }
  }
  const bindings = evidence.bindings ?? [], relations = evidence.relations ?? [], expressions = evidence.expressions ?? [];
  taskRows.push({
    taskId: task.taskId, taskName: safeText(task.taskName ?? evidence.taskName ?? taskNode?.properties.taskName ?? null),
    scheduleTaskName: safeText(taskNode?.properties.taskName ?? null), topicName: safeText(taskNode?.properties.topicName ?? null),
    taskCategory: task.taskCategory, coverageStatus: task.coverageStatus, coverageDisposition: task.coverageDisposition,
    failureReasonCode: task.failureReasonCode, factsState: task.factsState, issues: (task.issues ?? []).map(safeText),
    projectionGapReasonCounts: countBy(projection.gaps ?? [], 'reasonCode'), declaredTarget: safeText(task.target),
    contentHash: task.contentHash, contentHashMatches, projectionCacheKey: envelope.cacheKey, projectionCacheKeyParts: envelope.cacheKeyParts,
    projectionFileSha256: sha256(projectionBytes), evidenceFileSha256: sha256(evidenceBytes),
    projectionPath: relPath(projectionPath), evidencePath: relPath(evidencePath), sqlSources,
    externalReads, finalWrites, physicalDatasetIds: sorted(physicalNodes.map((node) => node.nodeId)),
    schemas: sorted(physicalNodes.map((node) => node.properties.qualifiedName?.includes('.') ? node.properties.qualifiedName.split('.')[0] : '(unqualified)')),
    relationSummary: { count: relations.length, typeCounts: countBy(relations, 'relation_type'), expressionCount: expressions.length, expressionDependencyStatusCounts: countBy(expressions, 'input_dependency_status') },
    bindingSummary: { count: bindings.length, statusCounts: countBy(bindings, 'binding_status'), methodCounts: countBy(bindings, 'binding_method'), targetSchemaStatusCounts: countBy(bindings, 'target_schema_status') },
    statementSummary: { count: (evidence.statements ?? []).length, parseStatusCounts: countBy(evidence.statements ?? [], 'parse_status'), typeCounts: countBy(evidence.statements ?? [], 'statement_type') },
    datasetIoSummary: { count: (evidence.datasetIo ?? []).length, directionCounts: countBy(evidence.datasetIo ?? [], 'direction'), resolutionStatusCounts: countBy(evidence.datasetIo ?? [], 'resolution_status') },
    scheduleReference: { role: 'SCHEDULE_REFERENCE_ONLY', upstreamTaskIds: taskNode?.properties.scheduleReference?.upstreamTaskIds ?? [], downstreamTaskIds: taskNode?.properties.scheduleReference?.downstreamTaskIds ?? [] },
  });
}

const tableRows = [];
for (const row of tables.values()) {
  const { platform, qualifiedName, dataSource } = row._identity;
  const metadataDir = typeof platform === 'string' && typeof qualifiedName === 'string' && typeof dataSource === 'string'
    ? join(dataRoot, 'tables', platform, `${qualifiedName}__${dataSource}`) : null;
  const metadataPath = metadataDir && inside(join(dataRoot, 'tables'), metadataDir) ? join(metadataDir, 'table.json') : null;
  let metadata = { status: 'EXACT_METADATA_NOT_FOUND', tablePath: null, ddlPath: null, description: null, fields: [] };
  if (metadataPath && existsSync(metadataPath)) {
    const tablePack = readJson(metadataPath);
    const metadataDatasetNodeId = `dataset:${canonicalHash(physicalIdentity(tablePack))}`;
    const identityMatches = metadataDatasetNodeId === row.nodeId;
    if (!identityMatches) metadata = { ...metadata, status: 'EXACT_PATH_IDENTITY_MISMATCH', tablePath: relPath(metadataPath) };
    else {
      const ddlPath = typeof tablePack.ddlFile?.path === 'string' ? resolve(metadataDir, tablePack.ddlFile.path) : null;
      const validDdl = ddlPath && inside(metadataDir, ddlPath) && existsSync(ddlPath);
      const ddlBytes = validDdl ? readFileSync(ddlPath) : null;
      const ddl = ddlBytes ? ddlBytes.toString('utf8') : '';
      const parsed = ddl ? parseDdl(ddl) : { parserStatus: 'DDL_NOT_FOUND', fields: [], description: null };
      const ddlHashMatches = ddlBytes ? sha256(ddlBytes) === tablePack.ddlFile.sha256 : null;
      metadata = { status: 'EXACT_IDENTITY_MATCH', identityMethod: 'EXISTING_PHYSICAL_DATASET_NODE_ID_CONTRACT',
        metadataDatasetNodeId, originalQualifiedName: tablePack.qualifiedName,
        tablePath: relPath(metadataPath), tableFileSha256: sha256(readFileSync(metadataPath)),
        objectType: tablePack.objectType, sourceObjectStatus: tablePack.status ?? null,
        collectedAt: tablePack.collectedAt, ddlPath: validDdl ? relPath(ddlPath) : null,
        ddlSha256: validDdl ? sha256(ddlBytes) : null, ddlHashMatches,
        description: safeText(tablePack.description ?? tablePack.comment ?? parsed.description),
        fieldParserStatus: parsed.parserStatus, fields: parsed.fields, partitionFields: tablePack.partitionFields ?? [],
      };
      if (ddlHashMatches === false) integrityIssues.push({ datasetNodeId: row.nodeId, kind: 'DDL_HASH_MISMATCH' });
    }
  }
  const observedFields = sorted(row._observedFields);
  const { _identity, _observedFields, ...publicRow } = row;
  tableRows.push({ ...publicRow, schema: qualifiedName?.includes('.') ? qualifiedName.split('.')[0] : '(unqualified)',
    occurrenceTaskIds: sorted(row.occurrenceTaskIds), consumerTaskIds: sorted(row.consumerTaskIds), producerTaskIds: sorted(row.producerTaskIds),
    role: row.consumerTaskIds.size && row.producerTaskIds.size ? 'READ_AND_WRITTEN' : row.consumerTaskIds.size ? 'READ_ONLY_IN_SCOPE' : row.producerTaskIds.size ? 'WRITE_ONLY_IN_SCOPE' : 'OTHER_PHYSICAL_REFERENCE',
    observedFieldCount: observedFields.length, observedFieldNames: observedFields,
    availableFieldCount: metadata.fields.length || observedFields.length,
    availableFieldCountSource: metadata.fields.length ? 'LOCAL_DDL_COLUMN_LIST_READER' : 'PROJECTED_PHYSICAL_FIELDS_LOWER_BOUND',
    metadata,
  });
}
tableRows.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName) || a.nodeId.localeCompare(b.nodeId));
const qualifiedNameView = [];
for (const name of sorted(tableRows.map((table) => table.qualifiedName))) {
  const matches = tableRows.filter((table) => table.qualifiedName === name);
  qualifiedNameView.push({ qualifiedName: name, datasetNodeIds: matches.map((table) => table.nodeId), identityCount: matches.length,
    producerTaskIds: sorted(matches.flatMap((table) => table.producerTaskIds)), consumerTaskIds: sorted(matches.flatMap((table) => table.consumerTaskIds)) });
}
const taskMap = new Map(taskRows.map((task) => [task.taskId, task]));
const schemaRows = sorted(tableRows.map((table) => table.schema)).map((schema) => {
  const matches = tableRows.filter((table) => table.schema === schema);
  const taskIds = sorted(matches.flatMap((table) => table.occurrenceTaskIds));
  const readIds = sorted(matches.flatMap((table) => table.consumerTaskIds)), writeIds = sorted(matches.flatMap((table) => table.producerTaskIds));
  const topTables = [...matches].sort((a, b) => b.consumerTaskIds.length - a.consumerTaskIds.length || b.producerTaskIds.length - a.producerTaskIds.length).slice(0, 8);
  return { schema, physicalDatasetCount: matches.length, qualifiedNameCount: new Set(matches.map((table) => table.qualifiedName)).size,
    taskIds, taskCount: taskIds.length, readerTaskCount: readIds.length, writerTaskCount: writeIds.length,
    externalReadOccurrenceCount: matches.reduce((n, table) => n + table.externalReadOccurrenceCount, 0),
    finalWriteOccurrenceCount: matches.reduce((n, table) => n + table.finalWriteOccurrenceCount, 0),
    tableRoleCounts: countBy(matches, 'role'), metadataStatusCounts: counts(matches.map((table) => table.metadata.status)),
    tasks: taskIds.map((id) => ({ taskId: id, taskName: taskMap.get(id).taskName, category: taskMap.get(id).taskCategory })),
    topTables: topTables.map((table) => ({ nodeId: table.nodeId, qualifiedName: table.qualifiedName, description: table.metadata.description,
      consumerTaskCount: table.consumerTaskIds.length, producerTaskCount: table.producerTaskIds.length })),
  };
}).sort((a, b) => b.physicalDatasetCount - a.physicalDatasetCount || a.schema.localeCompare(b.schema));
const baseline = {
  publicationVersion: pointer.version, pointerPath: relPath(pointerPath), pointerFileSha256: sha256(pointerBytes),
  manifestPath: relPath(manifestPath), manifestFileSha256: sha256(readFileSync(manifestPath)),
  publicationPath: relPath(publicationPath), publicationFileSha256: sha256(readFileSync(publicationPath)),
  manifestGeneratedAt: manifest.generatedAt,
};
const inventory = { schemaVersion: '1.0', artifactType: 'NETWORK_UNDERSTANDING_SCOPE_INVENTORY', generatedAt: new Date().toISOString(), baseline,
  definition: {
    scope: 'All manifest tasks and distinct PHYSICAL_DATASET node IDs from their pinned projections.',
    physicalIdentity: 'nodeId retained; platform, dataSource and qualifiedName retained separately. Qualified-name view is a display grouping, never an identity merge.',
    readWriteRole: 'External reads and final writes from task-local closure. Shared table identity does not by itself establish runtime or confirmed inter-task continuation.',
    metadata: 'Exact PHYSICAL_DATASET nodeId match from platform + qualifiedName + dataSource using the existing trim/lowercase graph identity contract. DDL is a separately hashed local snapshot and may have been collected at another time.',
    fieldCounts: 'DDL column-list reader when available; otherwise projected field names are a lower bound, not a complete schema.',
    coverage: 'Graph inclusion and static Facts states do not prove business completeness, runtime success, delivery, or acceptance.',
  },
  counts: {
    tasks: taskRows.length, physicalDatasets: tableRows.length, qualifiedNames: qualifiedNameView.length,
    multiIdentityQualifiedNames: qualifiedNameView.filter((row) => row.identityCount > 1).length,
    coverage: countBy(taskRows, 'coverageStatus'), coverageDisposition: countBy(taskRows, 'coverageDisposition'), factsState: countBy(taskRows, 'factsState'),
    taskCategory: countBy(taskRows, 'taskCategory'), failureReason: countBy(taskRows, 'failureReasonCode'),
    issueCodes: counts(taskRows.flatMap((task) => task.issues)), tableRole: countBy(tableRows, 'role'),
    metadataStatus: counts(tableRows.map((table) => table.metadata.status)),
    sourceObjectStatus: counts(tableRows.filter((table) => table.metadata.status === 'EXACT_IDENTITY_MATCH').map((table) => table.metadata.sourceObjectStatus ?? 'NOT_RECORDED')),
    tablesWithDescription: tableRows.filter((table) => table.metadata.description).length,
    tablesWithDdl: tableRows.filter((table) => table.metadata.ddlPath).length,
    tablesWithParsedFields: tableRows.filter((table) => table.metadata.fields.length).length,
    tasksWithSql: taskRows.filter((task) => task.sqlSources.some((source) => source.characterCount > 0)).length,
    tasksWithoutPhysicalDatasets: taskRows.filter((task) => !task.physicalDatasetIds.length).length,
    tasksWithoutExternalReads: taskRows.filter((task) => !task.externalReads.length).length,
    tasksWithoutFinalWrites: taskRows.filter((task) => !task.finalWrites.length).length,
    sqlSlots: taskRows.reduce((n, task) => n + task.sqlSources.length, 0), sqlLineCount: taskRows.reduce((n, task) => n + task.sqlSources.reduce((a, source) => a + source.lineCount, 0), 0),
    externalReadOccurrences: taskRows.reduce((n, task) => n + task.externalReads.length, 0), finalWriteOccurrences: taskRows.reduce((n, task) => n + task.finalWrites.length, 0),
    schemas: schemaRows.length,
  },
  verification: { pointerUnchangedAtEnd: sha256(readFileSync(pointerPath)) === sha256(pointerBytes),
    projectionHashesChecked: taskRows.length, sqlHashesChecked: taskRows.reduce((n, task) => n + task.sqlSources.length, 0),
    ddlHashesChecked: tableRows.filter((table) => table.metadata.ddlHashMatches !== undefined && table.metadata.ddlHashMatches !== null).length,
    physicalDatasetCountMatchesPublication: tableRows.length === publication.counts.nodes.PHYSICAL_DATASET, integrityIssues },
  publicationContinuationMetrics: publication.continuationMetrics, schemas: schemaRows,
  tasksWithoutPhysicalDatasets: taskRows.filter((task) => !task.physicalDatasetIds.length).map((task) => ({ taskId: task.taskId, taskName: task.taskName,
    topicName: task.topicName, category: task.taskCategory, coverage: task.coverageStatus, disposition: task.coverageDisposition, factsState: task.factsState, declaredTarget: task.declaredTarget })),
};

assert(inventory.verification.pointerUnchangedAtEnd, 'Current pointer changed during inventory; pinned results retained in memory only');
assert(inventory.verification.physicalDatasetCountMatchesPublication, 'Physical dataset count differs from publication');
assert(integrityIssues.length === 0, `Evidence integrity checks failed; existing outputs preserved: ${JSON.stringify(integrityIssues)}`);
mkdirSync(outputRoot, { recursive: true });
for (const [name, body] of [['scope-inventory.json', inventory], ['task-catalog.json', { baseline, tasks: taskRows }], ['table-catalog.json', { baseline, tables: tableRows, qualifiedNameView }]])
  writeFileSync(join(outputRoot, name), `${JSON.stringify(body)}\n`, 'utf8');
const markdownEscape = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const lines = [
  '# 当前业务加工网络：范围底账', '',
  `固定发布版本：\`${pointer.version}\`。盘点时间：${inventory.generatedAt}。`, '',
  '这份底账只回答当前图里有哪些对象、证据能看到什么。它不把图规模当作业务覆盖完整，也不把共享表当作已确认的跨任务因果关系。', '',
  `共 ${taskRows.length} 个任务、${tableRows.length} 个物理表身份、${qualifiedNameView.length} 个表全名、${schemaRows.length} 个 schema。${inventory.counts.multiIdentityQualifiedNames} 个全名有多个物理身份，展示时可以归组，分析时必须分开。`, '',
  `任务投影：${JSON.stringify(inventory.counts.coverage)}；覆盖处置：${JSON.stringify(inventory.counts.coverageDisposition)}。`, '',
  `Facts 状态：${JSON.stringify(inventory.counts.factsState)}。有非空 SQL 的任务 ${inventory.counts.tasksWithSql} 个；SQL 槽位 ${inventory.counts.sqlSlots} 个，共 ${inventory.counts.sqlLineCount} 行（包括 SQL 内的空行，未复制 SQL 原文）。`, '',
  `精确匹配本地表元数据 ${inventory.counts.metadataStatus.EXACT_IDENTITY_MATCH ?? 0} 个，DDL ${inventory.counts.tablesWithDdl} 个，带表说明 ${inventory.counts.tablesWithDescription} 个。DDL 字段数由窄语法读取器提取，其余字段数只是图中已观测字段的下界。`, '',
  `已匹配元数据中的源对象状态：${JSON.stringify(inventory.counts.sourceObjectStatus)}。源对象状态与身份匹配分别记录；DELETED 不从已发布范围自动移除，未记录状态也不当作 ACTIVE。`, '',
  `完整性核验：${taskRows.length} 个 projection canonical hash、${inventory.verification.sqlHashesChecked} 个 SQL hash、${inventory.verification.ddlHashesChecked} 个 DDL hash；发现 ${integrityIssues.length} 项不一致。当前指针在盘点结束时未变化。`, '',
  '## 全 schema 范围', '',
  '“涉及任务”可能同时归入多个 schema，因此各行任务数不可相加。读写数量来自任务内外部读取与最终写入；没有物理表的任务另列在底账中。', '',
  '| Schema | 物理身份 | 表全名 | 涉及任务 | 读任务 | 写任务 | 外读次数 | 最终写次数 | 主要表（按消费任务数） |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ...schemaRows.map((row) => `| ${markdownEscape(row.schema)} | ${row.physicalDatasetCount} | ${row.qualifiedNameCount} | ${row.taskCount} | ${row.readerTaskCount} | ${row.writerTaskCount} | ${row.externalReadOccurrenceCount} | ${row.finalWriteOccurrenceCount} | ${row.topTables.slice(0, 3).map((table) => markdownEscape(`${table.qualifiedName}${table.description ? `（${table.description}）` : ''}`)).join('；')} |`),
  '', '## 缺口和阅读边界', '',
  `- ${inventory.counts.tasksWithoutPhysicalDatasets} 个任务未形成物理表投影，仍属于总范围。完整清单位于 scope-inventory.json 的 tasksWithoutPhysicalDatasets。`,
  `- 失败原因：${JSON.stringify(inventory.counts.failureReason)}。UNKNOWN 表示该字段未记录原因，不能据此归因。`,
  `- Facts/收集 issue：${JSON.stringify(inventory.counts.issueCodes)}。`,
  `- 表角色：${JSON.stringify(inventory.counts.tableRole)}。READ_ONLY_IN_SCOPE 是当前范围未见最终生产者，不等于企业内没有生产者；WRITE_ONLY_IN_SCOPE 是当前范围未见消费者，不等于没有下游使用。`,
  '- SQL、元数据和投影可能提供不同层面的证据；业务意义仍需要章节解释。调度引用仅作调度关系，不能代替数据血缘。',
  '- 任务目录提供每个任务的来源路径、哈希、SQL 槽位和行数、外部读取、最终写入、关系/绑定概要。表目录保留每个物理身份、精确元数据路径、字段与读写任务。',
  '', '## 附录入口', '',
  '- [任务目录](task-catalog.json)', '- [物理表目录与表全名分组](table-catalog.json)', '- [范围底账、全任务归属和发布接续指标](scope-inventory.json)',
  '- [重建脚本](build-inventory.mjs)：从本地仓库根目录执行 `node docs/network-understanding/evidence/build-inventory.mjs`，仅改写本目录的四份产物。', '',
];
writeFileSync(join(outputRoot, 'scope-summary.md'), lines.join('\n'), 'utf8');
process.stdout.write(`${JSON.stringify({ baseline, counts: inventory.counts, verification: inventory.verification })}\n`);
