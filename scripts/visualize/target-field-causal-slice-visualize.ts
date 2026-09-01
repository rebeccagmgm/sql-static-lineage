import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateCausalSliceArtifact,
  type CausalSliceArtifact,
} from "../reconcile/consumer/target-field-causal-slice/causal-slice-contract.ts";

const DETAIL_LIMIT = 200;

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function escapeHtml(value: unknown): string {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface TrustedHtml {
  readonly kind: "TRUSTED_HTML";
  readonly value: string;
  toString(): string;
}

function trustedHtml(value: string): TrustedHtml {
  return {
    kind: "TRUSTED_HTML",
    value,
    toString: () => value,
  };
}

function isTrustedHtml(value: unknown): value is TrustedHtml {
  return typeof value === "object" && value !== null &&
    (value as { readonly kind?: unknown }).kind === "TRUSTED_HTML" &&
    typeof (value as { readonly value?: unknown }).value === "string";
}

function list(values: readonly string[]): TrustedHtml {
  if (values.length === 0)
    return trustedHtml('<span class="muted">无</span>');
  const visible = values.slice(0, DETAIL_LIMIT);
  const items = visible
    .map((value) => `<li>${escapeHtml(value)}</li>`)
    .join("");
  const omitted = values.length - visible.length;
  return trustedHtml(
    `<ul>${items}</ul>${omitted > 0 ? `<p class="muted">showing ${visible.length} of ${values.length}; omitted ${omitted}</p>` : ""}`,
  );
}

function bounded<T>(values: readonly T[]): { items: T[]; total: number } {
  return { items: [...values].slice(0, DETAIL_LIMIT), total: values.length };
}

function omission(total: number, showing: number): string {
  return `total=${total} · showing=${showing} · omitted=${total - showing}`;
}

function boundedTable(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const visible = bounded(rows);
  return `<p class="muted">${omission(visible.total, visible.items.length)}</p>${table(headers, visible.items)}`;
}

function cell(value: unknown): string {
  return `<td>${isTrustedHtml(value) ? value.value : escapeHtml(value)}</td>`;
}

function table(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const head = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const body =
    rows.length === 0
      ? `<tr><td class="muted" colspan="${headers.length}">无记录</td></tr>`
      : rows.map((row) => `<tr>${row.map(cell).join("")}</tr>`).join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function subjectLabel(subject: {
  readonly subjectKind: string;
  readonly physicalFieldId?: string;
  readonly relationOccurrenceId?: string;
}): string {
  return subject.subjectKind === "PHYSICAL_FIELD"
    ? `字段 ${subject.physicalFieldId ?? ""}`
    : `关系 ${subject.relationOccurrenceId ?? ""}`;
}

function pathKind(path: {
  readonly rootDependenceKind: string;
  readonly edges: readonly { readonly frontierKind: string }[];
}): string {
  const kinds = [
    ...new Set(bounded(path.edges).items.map((edge) => edge.frontierKind)),
  ];
  return kinds.length === 0 ? path.rootDependenceKind : kinds.join(" / ");
}

function renderPaths(artifact: CausalSliceArtifact): string {
  const totalPaths = artifact.traversal.roots.reduce(
    (count, root) => count + root.paths.length,
    0,
  );
  const summaryRows: (readonly unknown[])[] = [];
  const details: string[] = [];
  const rootSet = bounded(artifact.traversal.roots);
  const rootRows = rootSet.items.map((root) => [
    root.rootCriterionId,
    root.root.rootCriterion.rootTargetFieldId,
    root.root.rootCriterion.rootWriteObservationId,
    root.root.rootCriterion.statementId,
    root.root.semanticScope.semanticScopeId,
    root.paths.length,
    root.gaps.length,
  ]);
  let remaining = DETAIL_LIMIT;
  for (const root of artifact.traversal.roots) {
    for (const path of root.paths.slice(0, remaining)) {
      summaryRows.push([
        root.rootCriterionId,
        root.root.rootCriterion.rootTargetFieldId,
        root.root.semanticScope.semanticScopeId,
        path.pathId,
        pathKind(path),
        path.rootDependenceKind,
        path.pathCertainty,
        path.edges.length,
      ]);
      const edgeSet = bounded(path.edges);
      const edges = edgeSet.items.map((edge) => [
        edge.edgeId,
        edge.rootCriterionId,
        edge.fromSemanticScopeId,
        edge.toSemanticScopeId,
        `${edge.fromTaskId}: ${subjectLabel(edge.fromSubject)}`,
        `${edge.toTaskId}: ${subjectLabel(edge.toSubject)}`,
        edge.frontierKind,
        edge.localEdgeKind,
        edge.pathCertainty,
        edge.readOccurrenceId ?? "",
        list(edge.evidenceRefs),
      ]);
      details.push(
        `<details class="path-detail"><summary>${escapeHtml(`${path.pathId} · ${path.pathCertainty} · ${pathKind(path)}`)}</summary><p class="muted">edges ${omission(edgeSet.total, edgeSet.items.length)}</p>${table(
          [
            "edge",
            "root criterion",
            "from semantic scope",
            "to semantic scope",
            "from",
            "to",
            "frontier",
            "local edge",
            "certainty",
            "read occurrence",
            "evidence",
          ],
          edges,
        )}</details>`,
      );
      remaining -= 1;
    }
    if (remaining === 0) break;
  }
  const semanticEdgeSet = bounded(artifact.dependencies.edges);
  const semanticEdgeRows = semanticEdgeSet.items.map((edge) => [
    edge.edgeId,
    edge.rootCriterionId ?? "",
    edge.semanticScopeId ?? "",
    subjectLabel(edge.fromSubject),
    subjectLabel(edge.toSubject),
    edge.rootDependenceKind,
    edge.localEdgeKind,
    edge.pathCertainty,
  ]);
  return `<section id="paths"><h2>因果路径</h2><p class="lede">展示 artifact 已记录的 value、control、relation 路径；此页面不重新计算路径。</p><h3>Root write occurrences</h3><p class="muted">${omission(rootSet.total, rootSet.items.length)}</p>${table(
    [
      "root criterion",
      "root target field",
      "write observation",
      "statement",
      "semantic scope",
      "paths",
      "gaps",
    ],
    rootRows,
  )}<h3>Traversal paths</h3>${table(
    [
      "root criterion",
      "root target field",
      "semantic scope",
      "path",
      "path kind",
      "root dependence",
      "certainty",
      "edges",
    ],
    summaryRows,
  )}<p class="muted">paths ${omission(totalPaths, summaryRows.length)}; detail limit ${DETAIL_LIMIT}</p>${details.join("")}<h3>Semantic dependency edges</h3><p class="muted">${omission(semanticEdgeSet.total, semanticEdgeSet.items.length)}</p>${table(
    [
      "edge",
      "root criterion",
      "semantic scope",
      "from",
      "to",
      "root dependence",
      "local edge",
      "certainty",
    ],
    semanticEdgeRows,
  )}</section>`;
}

function renderCandidateCoverage(artifact: CausalSliceArtifact): string {
  const universe = artifact.candidateUniverse;
  const branches = universe.branches;
  const branchSet = bounded(branches);
  const rows = branchSet.items.map((branch) => [
    branch.candidateBranchId,
    branch.branchKind,
    branch.rootTaskId,
    branch.consumerTaskId ?? "",
    branch.producerTaskId ?? "",
    branch.table?.qualifiedName ?? "",
    branch.producerRole ?? "",
    list(branch.gapRefs),
    branch.boundaryReason ?? "",
  ]);
  const counts = new Map<string, number>();
  for (const branch of branches)
    counts.set(branch.branchKind, (counts.get(branch.branchKind) ?? 0) + 1);
  const countText =
    [...counts.entries()]
      .map(([kind, count]) => `${kind}: ${count}`)
      .join(" · ") || "无分支";
  return `<section id="candidate-coverage"><h2>Candidate Universe 与覆盖</h2><p>状态：<span class="status">${escapeHtml(universe.status)}</span> · 分支：${branches.length} · ${escapeHtml(countText)}</p><p>分支明细：${omission(branchSet.total, branchSet.items.length)} · detail limit ${DETAIL_LIMIT}</p><p>来源 coverage：${escapeHtml(universe.coverage.sourceCoverageStatus ?? "UNKNOWN")} · ${escapeHtml(universe.coverage.sourceCoverageSemantics ?? "UNKNOWN")} · source limits truncated：${escapeHtml(universe.coverage.sourceLimitsTruncated)}</p><p>边界 gaps：</p>${list(universe.boundaryGapRefs)}${table(
    [
      "candidate branch",
      "kind",
      "root task",
      "consumer",
      "producer",
      "table",
      "producer role",
      "gaps",
      "boundary",
    ],
    rows,
  )}</section>`;
}

function renderAssessments(artifact: CausalSliceArtifact): string {
  const statusCounts = new Map<string, number>();
  for (const assessment of artifact.assessments)
    statusCounts.set(
      assessment.status,
      (statusCounts.get(assessment.status) ?? 0) + 1,
    );
  const assessmentSet = bounded(artifact.assessments);
  const rows = assessmentSet.items.map((assessment) => [
    assessment.rootCriterionId,
    assessment.rootTargetFieldId,
    assessment.candidateBranchId,
    assessment.status,
    assessment.reasonCode,
    list(assessment.positiveProofIds),
    list(assessment.negativeProofIds),
    list(assessment.gapRefs),
  ]);
  const statusSummary =
    [...statusCounts.entries()]
      .map(([status, count]) => `${status}=${count}`)
      .join(" · ") || "无记录";
  return `<section id="assessments"><h2>四类 assessment</h2><p>status 聚合：${escapeHtml(statusSummary)}</p><p class="muted">明细 ${omission(assessmentSet.total, assessmentSet.items.length)} · detail limit ${DETAIL_LIMIT}</p>${table(
    [
      "root criterion",
      "root target field",
      "candidate branch",
      "status",
      "reason",
      "positive proofs",
      "negative proofs",
      "gaps",
    ],
    rows,
  )}</section>`;
}

function renderProofsAndGaps(artifact: CausalSliceArtifact): string {
  const positiveSet = bounded(artifact.positiveProofs);
  const negativeSet = bounded(artifact.negativeProofs);
  const positive = positiveSet.items.map(
    (proof) =>
      `<details><summary>Positive proof · ${escapeHtml(proof.proofId)}</summary><dl><dt>root criterion</dt><dd>${escapeHtml(proof.rootCriterionId)}</dd><dt>pair</dt><dd>${escapeHtml(`${proof.rootTargetFieldId} / ${proof.candidateBranchId}`)}</dd><dt>certainty</dt><dd>${escapeHtml(proof.pathCertainty)}</dd><dt>reason</dt><dd>${escapeHtml(proof.reasonCode)}</dd><dt>paths</dt><dd>${list(proof.pathIds)}</dd><dt>edges</dt><dd>${list(proof.edgeIds)}</dd><dt>evidence</dt><dd>${list(proof.evidenceRefs)}</dd></dl></details>`,
  );
  const negative = negativeSet.items.map((proof) => {
    const obligationSet = bounded(proof.checkedObligations);
    return `<details><summary>Negative proof · ${escapeHtml(proof.proofId)}</summary><dl><dt>root criterion</dt><dd>${escapeHtml(proof.rootCriterionId)}</dd><dt>pair</dt><dd>${escapeHtml(`${proof.rootTargetFieldId} / ${proof.candidateBranchId}`)}</dd><dt>reason</dt><dd>${escapeHtml(proof.reasonCode)}</dd><dt>source proof</dt><dd>${escapeHtml(proof.sourceNegativeProofId ?? "无")}</dd><dt>obligations</dt><dd><p class="muted">${omission(obligationSet.total, obligationSet.items.length)}</p>${table(
      ["kind", "evidence"],
      obligationSet.items.map((item) => [item.kind, list(item.evidenceRefs)]),
    )}</dd><dt>evidence</dt><dd>${list(proof.evidenceRefs)}</dd></dl></details>`;
  });
  const assessmentGapSet = bounded(artifact.assessmentGaps);
  const assessmentGaps = assessmentGapSet.items.map((gap) => [
    gap.gapId,
    gap.rootCriterionId,
    gap.rootTargetFieldId,
    gap.candidateBranchId,
    gap.reasonCode,
    list(gap.evidenceRefs),
  ]);
  const traversalGapSet = bounded(artifact.traversal.gaps);
  const traversalGaps = traversalGapSet.items.map((gap) => [
    gap.gapId,
    gap.rootCriterionId,
    gap.semanticScopeId,
    gap.rootTargetFieldId,
    gap.taskId,
    gap.frontierKind,
    gap.reasonCode,
    gap.message,
    list(gap.evidenceRefs),
    gap.blocksConfirmedCausality,
    gap.blocksNegativeProof,
  ]);
  const dependencyGapSet = bounded(artifact.dependencies.gaps);
  const dependencyGaps = dependencyGapSet.items.map((gap) => [
    gap.gapId,
    gap.rootCriterionId ?? "",
    gap.semanticScopeId ?? "",
    gap.reasonCode,
    gap.relationId ?? "",
    list(gap.evidenceRefs),
    gap.blocksConfirmedCausality,
    gap.blocksNegativeProof,
  ]);
  return `<section id="proof-gap-drilldown"><h2>Proof / gap drill-down</h2><p>counts：positive proofs=${positiveSet.total} · negative proofs=${negativeSet.total} · assessment gaps=${assessmentGapSet.total} · traversal gaps=${traversalGapSet.total} · dependency gaps=${dependencyGapSet.total}</p><h3>Positive proofs</h3><p class="muted">${omission(positiveSet.total, positive.length)} · detail limit ${DETAIL_LIMIT}</p>${positive.join("") || '<p class="muted">无记录</p>'}<h3>Negative proofs</h3><p class="muted">${omission(negativeSet.total, negative.length)} · detail limit ${DETAIL_LIMIT}</p>${negative.join("") || '<p class="muted">无记录</p>'}<h3>Assessment gaps</h3>${boundedTable(["gap", "root criterion", "root target field", "candidate branch", "reason", "evidence"], assessmentGaps)}<h3>Traversal gaps</h3>${boundedTable(["gap", "root criterion", "semantic scope", "root target field", "task", "frontier", "reason", "message", "evidence", "blocks confirmed causality", "blocks negative proof"], traversalGaps)}<h3>Dependency gaps</h3>${boundedTable(["gap", "root criterion", "semantic scope", "reason", "relation", "evidence", "blocks confirmed causality", "blocks negative proof"], dependencyGaps)}</section>`;
}

function renderLimitsAndQuality(artifact: CausalSliceArtifact): string {
  const limitRows = [
    [
      "VALUE",
      artifact.limits.value.maxStates,
      artifact.limits.value.maxPaths,
      artifact.limits.value.truncated,
      list(artifact.limits.value.reasons),
    ],
    [
      "CONTROL",
      artifact.limits.control.maxStates,
      artifact.limits.control.maxPaths,
      artifact.limits.control.truncated,
      list(artifact.limits.control.reasons),
    ],
  ];
  const metrics = artifact.qualityMetrics;
  return `<section id="limits-quality"><h2>独立 limits 与质量指标</h2><p>shared max depth：${escapeHtml(artifact.limits.maxDepth)}</p>${table(["budget", "max states", "max paths", "truncated", "reasons"], limitRows)}<dl class="metrics"><dt>confirmed evidence closure rate</dt><dd>${escapeHtml(metrics.confirmedEvidenceClosureRate)}</dd><dt>closed decision coverage</dt><dd>${escapeHtml(`${metrics.closedDecisionCoverage.numerator}/${metrics.closedDecisionCoverage.denominator} (${metrics.closedDecisionCoverage.rate})`)}</dd><dt>precision</dt><dd>${escapeHtml(metrics.precision)}</dd><dt>recall</dt><dd>${escapeHtml(metrics.recall)}</dd></dl><p>边界：static SQL only=${escapeHtml(artifact.boundaries.staticSqlOnly)} · runtime=${escapeHtml(artifact.boundaries.runtimeExecution)} · data correctness=${escapeHtml(artifact.boundaries.dataCorrectness)} · business acceptance=${escapeHtml(artifact.boundaries.businessAcceptance)}</p></section>`;
}

function renderRerunSet(
  title: string,
  set: CausalSliceArtifact["rerunSets"]["minimumConfirmed"],
): string {
  const entrySet = bounded(set.entries);
  const rows = entrySet.items.map((entry) => [
    entry.taskId ?? "UNRESOLVED",
    entry.unresolvedReason ?? "",
    (() => {
      const triggerSet = bounded(entry.triggers);
      return (
        triggerSet.items
          .map(
            (trigger) =>
              `${trigger.rootCriterionId} / ${trigger.rootTargetFieldId} / ${trigger.candidateBranchId} / ${trigger.causalStatus} / ${trigger.assessmentId}`,
          )
          .join("\n") +
        (triggerSet.total > triggerSet.items.length
          ? `\n... omitted=${triggerSet.total - triggerSet.items.length}`
          : "")
      );
    })(),
  ]);
  const unresolvedSet = bounded(set.unresolved);
  const unresolved = unresolvedSet.items.map(
    (entry) =>
      `${entry.unresolvedReason ?? "UNRESOLVED"}: ${bounded(entry.triggers)
        .items.map((trigger) => trigger.assessmentId)
        .join(
          ", ",
        )}${entry.triggers.length > DETAIL_LIMIT ? ` ... omitted=${entry.triggers.length - DETAIL_LIMIT}` : ""}`,
  );
  const taskIds = bounded(set.taskIds);
  return `<h3>${escapeHtml(title)}</h3><p>task IDs：${escapeHtml(taskIds.items.join(", ") || "无")} · count=${taskIds.total} · ${omission(taskIds.total, taskIds.items.length)}</p><p class="muted">entries ${omission(entrySet.total, entrySet.items.length)} · unresolved ${omission(unresolvedSet.total, unresolvedSet.items.length)} · detail limit ${DETAIL_LIMIT}</p>${table(["task", "unresolved reason", "triggers"], rows)}<p>unresolved：</p>${list(unresolved)}`;
}

function renderRerunSets(artifact: CausalSliceArtifact): string {
  return `<section id="rerun-sets"><h2>重跑集合</h2>${renderRerunSet("Minimum confirmed rerun set", artifact.rerunSets.minimumConfirmed)}${renderRerunSet("Conservative safety rerun set", artifact.rerunSets.conservativeSafety)}</section>`;
}

/** Pure renderer: every visible value is read from the supplied canonical artifact. */
export function renderTargetFieldCausalSliceHtml(
  artifact: CausalSliceArtifact,
): string {
  const title = `${artifact.request.rootTaskId} · ${artifact.request.rootTable}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(`Target Field Causal Slice · ${title}`)}</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#61708a;--line:#dce3ee;--panel:#fff;--bg:#f4f7fb;--accent:#2457a6;--good:#16794b;--warn:#a45b00;--bad:#a62929}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1500px;margin:0 auto;padding:28px}header{background:linear-gradient(135deg,#19345f,#2d6ab7);color:#fff;padding:28px;border-radius:14px;box-shadow:0 8px 24px #19345f22}h1{margin:0 0 6px;font-size:25px}h2{margin:28px 0 10px;border-bottom:2px solid var(--line);padding-bottom:7px}h3{margin:20px 0 8px}p.lede,.muted{color:var(--muted)}section{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;margin-top:18px;box-shadow:0 2px 8px #2030500b}table{width:100%;border-collapse:collapse;margin:10px 0;table-layout:auto}th,td{border-bottom:1px solid var(--line);padding:8px 9px;text-align:left;vertical-align:top;white-space:pre-wrap}th{background:#eef3fa;font-weight:650}tr:last-child td{border-bottom:0}.status{font-weight:700;color:var(--accent)}details{border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin:8px 0;background:#fbfcfe}summary{cursor:pointer;font-weight:650;color:var(--accent)}dl{display:grid;grid-template-columns:220px 1fr;gap:5px 14px;margin:12px 0}dt{font-weight:650;color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}ul{margin:5px 0;padding-left:22px}.metrics{max-width:800px}.meta{display:flex;flex-wrap:wrap;gap:9px 22px;color:#e8f0ff}.meta span{overflow-wrap:anywhere}@media(max-width:800px){main{padding:12px}table{display:block;overflow-x:auto;white-space:nowrap}dl{grid-template-columns:1fr}.meta{display:block}.meta span{display:block;margin-top:5px}}
</style>
</head>
<body>
<main>
<header><h1>Target Field Causal Slice</h1><div class="meta"><span>task: ${escapeHtml(artifact.request.rootTaskId)}</span><span>table: ${escapeHtml(artifact.request.rootTable)}</span><span>schema: ${escapeHtml(artifact.schemaVersion)}</span><span>content hash: ${escapeHtml(artifact.contentHash)}</span><span>generated: ${escapeHtml(artifact.generatedAt)}</span></div><p class="artifact-ref">canonical artifact: <a href="target-field-causal-slice.json">target-field-causal-slice.json</a></p></header>
${renderPaths(artifact)}
${renderCandidateCoverage(artifact)}
${renderAssessments(artifact)}
${renderProofsAndGaps(artifact)}
${renderLimitsAndQuality(artifact)}
${renderRerunSets(artifact)}
</main>
</body>
</html>
`;
}

export const renderCausalSliceHtml = renderTargetFieldCausalSliceHtml;

export interface TargetFieldCausalSliceVisualizationOptions {
  readonly artifactPath: string;
  readonly outputPath: string;
}

function readArtifact(path: string): CausalSliceArtifact {
  if (!existsSync(path))
    throw new Error(`TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_NOT_FOUND:${path}`);
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (value as { artifactType?: unknown }).artifactType !==
      "TARGET_FIELD_CAUSAL_SLICE"
  )
    throw new Error(`TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_INVALID:${path}`);
  const errors = validateCausalSliceArtifact(value);
  if (errors.length > 0)
    throw new Error(
      `TARGET_FIELD_CAUSAL_SLICE_ARTIFACT_INVALID:${path}:${errors.join(";")}`,
    );
  return value as CausalSliceArtifact;
}

export function visualizeTargetFieldCausalSlice(
  options: TargetFieldCausalSliceVisualizationOptions,
): string {
  const outputPath = resolve(options.outputPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    renderTargetFieldCausalSliceHtml(
      readArtifact(resolve(options.artifactPath)),
    ),
    "utf8",
  );
  return outputPath;
}

export const visualizeCausalSlice = visualizeTargetFieldCausalSlice;

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

function main(): void {
  const argv = process.argv.slice(2);
  const artifactPath = option(argv, "--artifact");
  const outputPath = option(argv, "--output");
  if (!artifactPath || !outputPath)
    throw new Error(
      "usage: target-field-causal-slice-visualize --artifact <target-field-causal-slice.json> --output <target-field-causal-slice.html>",
    );
  process.stdout.write(
    `${JSON.stringify({ output: visualizeTargetFieldCausalSlice({ artifactPath, outputPath }) })}\n`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
