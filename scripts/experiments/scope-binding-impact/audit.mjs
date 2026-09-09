import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i], process.argv[i + 1]);
const dataRoot = path.resolve(args.get("--data-root") ?? "");
const replayRoot = path.resolve(args.get("--replay-root") ?? "");
const outputRoot = path.resolve(args.get("--output") ?? "");
const replayStage = args.get("--stage") ?? "scope-binding-production-v8";
if (
  !args.get("--data-root") ||
  !args.get("--replay-root") ||
  !args.get("--output")
) {
  throw new Error(
    "USAGE: node audit.mjs --data-root <read-only-root> --replay-root <sql-replay-root> --stage <stage> --output <new-dir>",
  );
}
if (!fs.existsSync(dataRoot) || !fs.existsSync(replayRoot))
  throw new Error("INPUT_ROOT_MISSING");
if (fs.existsSync(outputRoot)) throw new Error("OUTPUT_ALREADY_EXISTS");
if (
  outputRoot === dataRoot ||
  outputRoot.startsWith(`${dataRoot}${path.sep}`)
) {
  throw new Error("OUTPUT_MUST_NOT_BE_INSIDE_FORMAL_DATA_ROOT");
}

const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const jsonlGzip = (file) => {
  const value = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8").trim();
  return value ? value.split(/\r?\n/).map(JSON.parse) : [];
};
const text = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const relationBody = (row) =>
  row?.relation && typeof row.relation === "object" ? row.relation : row;
const fieldEdges = (projection) =>
  (projection?.edges ?? []).filter(
    (edge) =>
      edge.edgeType === "FIELD_DIRECT" || edge.edgeType === "FIELD_CONDITIONAL",
  );
const statusCounts = (edges) =>
  Object.fromEntries(
    [
      ...new Set(
        edges.map(
          (edge) => edge.properties?.sourceReadOccurrenceStatus ?? "MISSING",
        ),
      ),
    ]
      .sort()
      .map((status) => [
        status,
        edges.filter(
          (edge) =>
            (edge.properties?.sourceReadOccurrenceStatus ?? "MISSING") ===
            status,
        ).length,
      ]),
  );
const edgeSignature = (edge) =>
  JSON.stringify({
    edgeType: edge.edgeType,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    outputColumn: edge.properties?.outputColumn ?? null,
    bindingId: edge.properties?.bindingId ?? null,
    expressionId: edge.properties?.expressionId ?? null,
    sourceReadOccurrenceStatus:
      edge.properties?.sourceReadOccurrenceStatus ?? null,
    sourceReadOccurrenceId: edge.properties?.sourceReadOccurrenceId ?? null,
    sourceRelationId: edge.properties?.sourceRelationId ?? null,
    scopeBindingPath: edge.properties?.scopeBindingPath ?? null,
  });
const compareProjection = (taskId) => {
  const oldPath = path.join(
    replayRoot,
    "release-final",
    "existing-projection",
    "tasks",
    taskId,
    "task-local-projection.json",
  );
  const newPath = path.join(
    replayRoot,
    replayStage,
    "existing-projection",
    "tasks",
    taskId,
    "task-local-projection.json",
  );
  if (!fs.existsSync(oldPath) || !fs.existsSync(newPath)) return null;
  const oldProjection = json(oldPath).projection;
  const newProjection = json(newPath).projection;
  const oldEdges = fieldEdges(oldProjection);
  const newEdges = fieldEdges(newProjection);
  const oldSignatures = oldEdges.map(edgeSignature).sort();
  const newSignatures = newEdges.map(edgeSignature).sort();
  return {
    oldPath,
    newPath,
    changed: JSON.stringify(oldSignatures) !== JSON.stringify(newSignatures),
    oldFieldEdges: oldEdges.length,
    newFieldEdges: newEdges.length,
    oldStatus: statusCounts(oldEdges),
    newStatus: statusCounts(newEdges),
    newExplicitEdges: newEdges.filter(
      (edge) => edge.properties?.scopeBindingStatus === "EXPLICIT",
    ).length,
    newExplicitPaths: new Set(
      newEdges
        .filter((edge) => edge.properties?.scopeBindingStatus === "EXPLICIT")
        .map((edge) => JSON.stringify(edge.properties.scopeBindingPath ?? [])),
    ).size,
  };
};

const packsByTask = new Map();
const tasksRoot = path.join(dataRoot, "tasks");
for (const kind of fs
  .readdirSync(tasksRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())) {
  const kindRoot = path.join(tasksRoot, kind.name);
  for (const task of fs
    .readdirSync(kindRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())) {
    const taskPath = path.join(kindRoot, task.name, "task.json");
    if (!fs.existsSync(taskPath)) continue;
    const paths = packsByTask.get(task.name) ?? [];
    paths.push(taskPath);
    packsByTask.set(task.name, paths);
  }
}

const factsTasksRoot = path.join(dataRoot, "field-facts", "registry", "tasks");
const projectionTasksRoot = path.join(dataRoot, "task-projections", "tasks");
const factsIds = fs.existsSync(factsTasksRoot)
  ? fs
      .readdirSync(factsTasksRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
const projectionIds = fs.existsSync(projectionTasksRoot)
  ? fs
      .readdirSync(projectionTasksRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
const factsIdSet = new Set(factsIds);
const projectionIdSet = new Set(projectionIds);
const taskIds = [
  ...new Set([...packsByTask.keys(), ...factsIds, ...projectionIds]),
].sort((a, b) => a.localeCompare(b, "en"));
const replayIds = new Set([
  "34901",
  "119044",
  "155157",
  "208983",
  "105387",
  "86840",
]);

const rows = [];
let completed = 0;
for (const taskId of taskIds) {
  const packPaths = packsByTask.get(taskId) ?? [];
  const manifestPath = path.join(
    factsTasksRoot,
    taskId,
    "bundle",
    "manifest.json",
  );
  const relationsPath = path.join(
    factsTasksRoot,
    taskId,
    "bundle",
    "relation-nodes.jsonl.gz",
  );
  const relationEdgesPath = path.join(
    factsTasksRoot,
    taskId,
    "bundle",
    "relation-edges.jsonl.gz",
  );
  const projectionPath = path.join(
    projectionTasksRoot,
    taskId,
    "task-local-projection.json",
  );
  const evidencePaths = [...packPaths];
  let packReadable = packPaths.length === 1;
  for (const packPath of packPaths) {
    try {
      json(packPath);
    } catch {
      packReadable = false;
    }
  }
  let factsReadable = false;
  let factsError = null;
  let factsVersion = null;
  let factsManifestSha256 = null;
  let relations = [];
  let relationEdges = [];
  let manifest = null;
  if (
    fs.existsSync(manifestPath) &&
    fs.existsSync(relationsPath) &&
    fs.existsSync(relationEdgesPath)
  ) {
    evidencePaths.push(manifestPath, relationsPath, relationEdgesPath);
    try {
      manifest = json(manifestPath);
      factsManifestSha256 = sha256(manifestPath);
      factsVersion = text(manifest.method?.adapter?.version);
      relations = jsonlGzip(relationsPath);
      relationEdges = jsonlGzip(relationEdgesPath);
      factsReadable = true;
    } catch (error) {
      factsError = String(error?.message ?? error);
    }
  } else if (factsIdSet.has(taskId)) {
    factsError = "FACTS_REQUIRED_FILE_MISSING";
  }

  const relationById = new Map(
    relations.map((row) => [text(row.relation_id), row]).filter(([id]) => id),
  );
  const expected = new Map();
  const structureTypes = new Set();
  for (const row of relations) {
    const body = relationBody(row);
    if (body?.is_cte === true && text(row.relation_id)) {
      structureTypes.add("CTE");
      expected.set(text(row.relation_id), {
        relationId: text(row.relation_id),
        binding: text(body.binding),
        sourceKind: "cte",
        evidence: "is_cte=true",
      });
    }
  }
  for (const edge of relationEdges) {
    const child = relationById.get(text(edge.from_relation_id));
    const parent = relationById.get(text(edge.to_relation_id));
    const childBody = child ? relationBody(child) : null;
    const parentBody = parent ? relationBody(parent) : null;
    const childScope = text(child?.scope_id) ?? text(childBody?.scope_id);
    const parentScope = text(parent?.scope_id) ?? text(parentBody?.scope_id);
    const childScopeTail = childScope?.split(".").at(-1) ?? null;
    const structuralScope =
      childScopeTail !== null &&
      (/^b\d+$/.test(childScopeTail) ||
        /^\(child(?:-\d+)?\)$/.test(childScopeTail));
    if (
      (childBody?.type === "project" || childBody?.type === "setop") &&
      childScope &&
      parentScope &&
      childScope !== parentScope &&
      !structuralScope
    ) {
      structureTypes.add("DERIVED_OR_NESTED_SCOPE");
      const relationId = text(child.relation_id);
      if (relationId && !expected.has(relationId))
        expected.set(relationId, {
          relationId,
          binding: null,
          sourceKind: "derived",
          evidence: "cross-scope project/setop relation edge",
        });
    }
  }
  const savedBindings = [];
  let declaredRelations = 0;
  for (const row of relations) {
    const body = relationBody(row);
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "scope_bindings"))
      declaredRelations += 1;
    if (Array.isArray(body?.scope_bindings))
      savedBindings.push(...body.scope_bindings);
  }
  if (savedBindings.length > 0) structureTypes.add("EXPLICIT_SCOPE_BINDING");
  const duplicateKeys = new Set();
  const seenBindingKeys = new Set();
  const invalidBindings = [];
  for (const binding of savedBindings) {
    const key = [
      binding.relation_id,
      binding.scope_id,
      binding.binding,
      binding.source_kind,
    ].join("\u0000");
    if (seenBindingKeys.has(key)) duplicateKeys.add(key);
    seenBindingKeys.add(key);
    const owner = relationById.get(text(binding.relation_id));
    const target = relationById.get(text(binding.target_relation_id));
    const targetBody = target ? relationBody(target) : null;
    const targetScope = text(target?.scope_id) ?? text(targetBody?.scope_id);
    if (
      !owner ||
      !target ||
      !text(binding.scope_id) ||
      !text(binding.binding) ||
      targetScope !== text(binding.target_scope_id)
    )
      invalidBindings.push(key);
  }
  const savedOwnerIds = new Set(
    savedBindings.map((binding) => text(binding.relation_id)).filter(Boolean),
  );
  const missingBindings = [...expected.values()].filter(
    (item) => !savedOwnerIds.has(item.relationId),
  );
  const mappingState = !factsReadable
    ? "UNREADABLE"
    : invalidBindings.length > 0 || duplicateKeys.size > 0
      ? "INVALID_OR_AMBIGUOUS"
      : expected.size === 0
        ? "NOT_REQUIRED"
        : missingBindings.length > 0
          ? declaredRelations === 0
            ? "LEGACY_MISSING"
            : "PARTIAL_MISSING"
          : "EXPLICIT_COMPLETE";

  let projectionReadable = false;
  let projectionError = null;
  let projection = null;
  let projectionEnvelope = null;
  if (fs.existsSync(projectionPath)) {
    evidencePaths.push(projectionPath);
    try {
      projectionEnvelope = json(projectionPath);
      projection = projectionEnvelope.projection;
      if (!projection || !Array.isArray(projection.edges))
        throw new Error("PROJECTION_SHAPE_INVALID");
      projectionReadable = true;
    } catch (error) {
      projectionError = String(error?.message ?? error);
    }
  } else if (projectionIdSet.has(taskId)) {
    projectionError = "PROJECTION_CURRENT_FILE_MISSING";
  }
  const oldEdges = projectionReadable ? fieldEdges(projection) : [];
  const cteUnresolvedEdges = oldEdges.filter(
    (edge) =>
      edge.properties?.sourceReadOccurrenceReason === "CTE_SCOPE_UNRESOLVED",
  );
  const affectedProjectionFields = [
    ...new Set(
      cteUnresolvedEdges
        .map((edge) => text(edge.properties?.outputColumn))
        .filter(Boolean),
    ),
  ].sort();
  const needsMappingForCurrentPath =
    mappingState.includes("MISSING") && cteUnresolvedEdges.length > 0;
  const comparison = replayIds.has(taskId) ? compareProjection(taskId) : null;
  if (comparison) evidencePaths.push(comparison.oldPath, comparison.newPath);

  let decision = "NO_ACTION_FOR_SCOPE_BINDING";
  let rebuildFacts = false;
  let rebuildProjection = false;
  let basis =
    "No CTE/derived binding owner was proven in current readable Facts.";
  if (!factsReadable) {
    decision = "EVIDENCE_INSUFFICIENT";
    basis = factsError ?? "No readable current Facts bundle.";
  } else if (mappingState === "INVALID_OR_AMBIGUOUS") {
    decision = "EVIDENCE_INSUFFICIENT";
    basis =
      "Saved mappings have missing endpoints, duplicate keys, or invalid target scope.";
  } else if (missingBindings.length > 0) {
    decision = "FACTS_AND_PROJECTION";
    rebuildFacts = true;
    rebuildProjection = true;
    basis = needsMappingForCurrentPath
      ? "Current projection has CTE_SCOPE_UNRESOLVED edges and current Facts omit proven binding owners."
      : "Current Facts omit proven CTE/derived binding owners; projection impact remains potential until isolated rebuild.";
  } else if (expected.size > 0) {
    const generatorVersion = text(
      projectionEnvelope?.cacheKeyParts?.generatorVersion,
    );
    const projectionFactsHash = text(
      projectionEnvelope?.cacheKeyParts?.factsManifestSha256,
    );
    if (
      !projectionReadable ||
      generatorVersion !== "1.3.11" ||
      projectionFactsHash !== factsManifestSha256
    ) {
      decision = "PROJECTION_ONLY";
      rebuildProjection = true;
      basis = !projectionReadable
        ? "Explicit Facts are present but no readable current projection exists."
        : "Explicit Facts are present but the current projection cache identity is stale or does not match Facts.";
    } else {
      basis =
        "Explicit binding owners and current matching projection are present.";
    }
  }

  rows.push({
    taskId,
    inputPack: {
      paths: packPaths,
      readable: packReadable,
      duplicateCount: Math.max(0, packPaths.length - 1),
    },
    structureTypes: [...structureTypes].sort(),
    facts: {
      present: fs.existsSync(manifestPath),
      readable: factsReadable,
      version: factsVersion,
      manifestSha256: factsManifestSha256,
      error: factsError,
      relationCount: relations.length,
    },
    mapping: {
      state: mappingState,
      expectedBindingCount: expected.size,
      savedBindingCount: savedBindings.length,
      missingBindings,
      invalidBindingCount: invalidBindings.length,
      duplicateBindingCount: duplicateKeys.size,
    },
    projection: {
      present: fs.existsSync(projectionPath),
      readable: projectionReadable,
      error: projectionError,
      schemaVersion: text(projection?.schemaVersion),
      contentHash: text(projection?.contentHash),
      generatorVersion: text(
        projectionEnvelope?.cacheKeyParts?.generatorVersion,
      ),
      factsManifestSha256: text(
        projectionEnvelope?.cacheKeyParts?.factsManifestSha256,
      ),
      fieldEdgeCount: oldEdges.length,
      sourceStatus: statusCounts(oldEdges),
      cteScopeUnresolvedEdges: cteUnresolvedEdges.length,
      affectedFields: affectedProjectionFields,
    },
    isolatedRebuild: comparison,
    evidencePaths: [...new Set(evidencePaths)],
    rebuild: { decision, rebuildFacts, rebuildProjection, basis },
  });
  completed += 1;
  if (completed % 2000 === 0)
    process.stderr.write(`audited ${completed}/${taskIds.length}\n`);
}

const set = (predicate) =>
  new Set(rows.filter(predicate).map((row) => row.taskId));
const A_pack = set((row) => row.inputPack.readable);
const A_facts = set((row) => row.facts.readable);
const A_projection = set((row) => row.projection.readable);
const B = set((row) => row.mapping.expectedBindingCount > 0);
const C = set(
  (row) =>
    row.mapping.state === "LEGACY_MISSING" ||
    row.mapping.state === "PARTIAL_MISSING",
);
const D = set(
  (row) => row.projection.cteScopeUnresolvedEdges > 0 && C.has(row.taskId),
);
const rebuilt = set((row) => row.isolatedRebuild !== null);
const E = set((row) => row.isolatedRebuild?.changed === true);
const F = set((row) => row.isolatedRebuild?.changed === false);
const G = set(
  (row) =>
    (C.has(row.taskId) && !rebuilt.has(row.taskId)) ||
    row.rebuild.decision === "EVIDENCE_INSUFFICIENT",
);
const intersection = (left, right) =>
  [...left].filter((item) => right.has(item)).length;
const decisions = Object.fromEntries(
  [...new Set(rows.map((row) => row.rebuild.decision))]
    .sort()
    .map((decision) => [
      decision,
      rows.filter((row) => row.rebuild.decision === decision).length,
    ]),
);
const summary = {
  generatedAt: new Date().toISOString(),
  roots: { dataRoot, replayRoot, outputRoot },
  definitions: {
    A: "Unique readable Input Pack tasks, current Facts bundles, and current projections are counted separately; allThree is their intersection.",
    B: "Readable Facts contain a proven CTE read or a project/setop relation crossing into a different scope.",
    C: "A B task has at least one proven binding owner with no saved scope_bindings owner record.",
    D: "A C task also has a current field edge with sourceReadOccurrenceReason=CTE_SCOPE_UNRESOLVED.",
    E: "Among the six isolated real-SQL rebuilds only, the field-edge semantic multiset changed.",
    F: "Among the same six rebuilds only, the field-edge semantic multiset remained identical.",
    G: "Outcome is not verified because a C task was not isolated-rebuilt, or the current artifact was unreadable/invalid.",
  },
  A: {
    discoveredUniqueTasks: taskIds.length,
    readableInputPackTasks: A_pack.size,
    readableFactsTasks: A_facts.size,
    readableProjectionTasks: A_projection.size,
    allThree: [...A_pack].filter(
      (id) => A_facts.has(id) && A_projection.has(id),
    ).length,
  },
  B: B.size,
  C: C.size,
  D: D.size,
  E: {
    changed: E.size,
    rebuiltDenominator: rebuilt.size,
    taskIds: [...E].sort(),
  },
  F: {
    unchanged: F.size,
    rebuiltDenominator: rebuilt.size,
    taskIds: [...F].sort(),
  },
  G: G.size,
  GBreakdown: {
    missingOrUnreadableFacts: rows.filter((row) => !row.facts.readable).length,
    invalidOrAmbiguousMapping: rows.filter(
      (row) => row.mapping.state === "INVALID_OR_AMBIGUOUS",
    ).length,
    mappingMissingNotIsolatedRebuilt: [...C].filter((id) => !rebuilt.has(id))
      .length,
  },
  overlaps: {
    B_and_C: intersection(B, C),
    C_and_D: intersection(C, D),
    C_and_G: intersection(C, G),
    D_and_G: intersection(D, G),
    D_and_E: intersection(D, E),
    D_and_F: intersection(D, F),
  },
  rebuildDecisions: decisions,
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvColumns = [
  "taskId",
  "structureTypes",
  "factsVersion",
  "factsManifestSha256",
  "mappingState",
  "expectedBindingCount",
  "savedBindingCount",
  "missingBindings",
  "affectedFields",
  "oldStatus",
  "newStatus",
  "evidencePaths",
  "rebuildFacts",
  "rebuildProjection",
  "decision",
  "basis",
];
const csvRows = rows.map((row) => ({
  taskId: row.taskId,
  structureTypes: JSON.stringify(row.structureTypes),
  factsVersion: row.facts.version,
  factsManifestSha256: row.facts.manifestSha256,
  mappingState: row.mapping.state,
  expectedBindingCount: row.mapping.expectedBindingCount,
  savedBindingCount: row.mapping.savedBindingCount,
  missingBindings: JSON.stringify(row.mapping.missingBindings),
  affectedFields: JSON.stringify(row.projection.affectedFields),
  oldStatus: JSON.stringify(
    row.isolatedRebuild?.oldStatus ?? row.projection.sourceStatus,
  ),
  newStatus: JSON.stringify(row.isolatedRebuild?.newStatus ?? null),
  evidencePaths: JSON.stringify(row.evidencePaths),
  rebuildFacts: row.rebuild.rebuildFacts,
  rebuildProjection: row.rebuild.rebuildProjection,
  decision: row.rebuild.decision,
  basis: row.rebuild.basis,
}));
const rebuildRows = rows.filter(
  (row) => row.rebuild.rebuildFacts || row.rebuild.rebuildProjection,
);
const replayRows = rows.filter((row) => row.isolatedRebuild !== null);
const csvText = (values) =>
  `${csvColumns.map(csvCell).join(",")}\n${values
    .map((row) => csvColumns.map((column) => csvCell(row[column])).join(","))
    .join("\n")}\n`;
const report =
  `# Machine Facts scope binding impact audit\n\n` +
  `Generated: ${summary.generatedAt}\n\n` +
  `This is a read-only inventory of current local artifacts. Only six tasks were rebuilt in isolation; all other C/D tasks remain potential impact, not proven lineage errors.\n\n` +
  `| Set | Count | Definition |\n|---|---:|---|\n` +
  `| A Input Pack | ${summary.A.readableInputPackTasks} | Unique readable task packs |\n` +
  `| A Facts | ${summary.A.readableFactsTasks} | Readable current Facts bundles |\n` +
  `| A Projection | ${summary.A.readableProjectionTasks} | Readable current task-local projections |\n` +
  `| A all three | ${summary.A.allThree} | Intersection of the three readable sets |\n` +
  `| B | ${summary.B} | CTE or cross-scope derived structure proven in Facts |\n` +
  `| C | ${summary.C} | Proven binding owner currently lacks saved mapping |\n` +
  `| D | ${summary.D} | C plus current CTE_SCOPE_UNRESOLVED field edge |\n` +
  `| E | ${summary.E.changed}/${summary.E.rebuiltDenominator} | Isolated rebuild changed field-edge semantics |\n` +
  `| F | ${summary.F.unchanged}/${summary.F.rebuiltDenominator} | Isolated rebuild unchanged |\n` +
  `| G | ${summary.G} | Not rebuilt or evidence invalid/unreadable |\n\n` +
  `G breakdown: ${JSON.stringify(summary.GBreakdown)}\n\n` +
  `Rebuild decisions: ${JSON.stringify(summary.rebuildDecisions)}\n\n` +
  `Reproduce:\n\n\`\`\`powershell\nnode scripts/experiments/scope-binding-impact/audit.mjs --data-root "${dataRoot}" --replay-root "${replayRoot}" --stage "${replayStage}" --output "<new-output-directory>"\n\`\`\`\n`;

fs.mkdirSync(outputRoot, { recursive: false });
fs.writeFileSync(
  path.join(outputRoot, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputRoot, "tasks.json"),
  `${JSON.stringify(rows, null, 2)}\n`,
);
fs.writeFileSync(path.join(outputRoot, "tasks.csv"), csvText(csvRows));
fs.writeFileSync(
  path.join(outputRoot, "rebuild-tasks.json"),
  `${JSON.stringify(rebuildRows, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputRoot, "rebuild-tasks.csv"),
  csvText(
    csvRows.filter(
      (_, index) =>
        rows[index].rebuild.rebuildFacts ||
        rows[index].rebuild.rebuildProjection,
    ),
  ),
);
fs.writeFileSync(
  path.join(outputRoot, "isolated-rebuild-tasks.json"),
  `${JSON.stringify(replayRows, null, 2)}\n`,
);
fs.writeFileSync(path.join(outputRoot, "report.md"), report);
console.log(JSON.stringify(summary, null, 2));
