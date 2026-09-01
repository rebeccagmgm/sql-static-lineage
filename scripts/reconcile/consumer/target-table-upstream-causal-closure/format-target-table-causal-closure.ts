import type { ShrinkReport, ShrinkReportEntry, TargetTableCausalClosureArtifact } from "./artifact-contract.ts";

function formatTier(title: string, entries: readonly ShrinkReportEntry[]): string[] {
  if (entries.length === 0) return [`${title}: (empty)`];
  return [
    `${title}:`,
    ...entries.map((entry) =>
      `  ${entry.taskId} ${entry.table ?? ""}  via ${entry.viaFields.join(",") || "(none)"}  witness ${entry.witness.slice(0, 3).join(",") || "(none)"}`,
    ),
  ];
}

function formatMultiplicity(entries: readonly ShrinkReportEntry[]): string[] {
  const header = `档三 倍增风险（默认折叠，不单独构成必查）: ${entries.length}`;
  if (entries.length === 0) return [header];
  return [
    header,
    ...entries.map((entry) =>
      `  ${entry.taskId} ${entry.table ?? ""}  JOIN ${entry.joinNode ?? "(none)"}  keys ${entry.viaFields.join(",") || "(none)"}  witness ${entry.witness.slice(0, 3).join(",") || "(none)"}`,
    ),
  ];
}

function formatPruned(report: ShrinkReport): string[] {
  const lines = [`档四 本轮证不出 / 未进入确定集: ${report.prunedCount}`];
  for (const reason of report.prunedReasons) {
    lines.push(`  ${reason.reasonCode} ${reason.count}`);
    for (const sample of reason.samples ?? []) {
      lines.push(`    ${sample.taskId ?? "(no-task)"} ${sample.table ?? ""}`.trimEnd());
    }
  }
  return lines;
}

export function formatTargetTableCausalSummary(artifact: TargetTableCausalClosureArtifact): string {
  const m = artifact.metrics;
  const rate = m.decisionCoverage.rate.toFixed(3);
  const report = artifact.shrinkReport;
  return [
    `Target table causal closure: ${artifact.targetWrite.identity.taskId} ${artifact.targetWrite.identity.targetTableKey}`,
    `status: assessments=${m.assessmentCount}, branches=${m.candidateBranchCount}, upstreamTasks=${m.upstreamTaskCount}`,
    `minimumCertainSet: ${artifact.minimumCertainTaskIds.join(",") || "(empty)"}`,
    `conservativeSafetySet: ${artifact.conservativeSafetyTaskIds.join(",") || "(empty)"}`,
    `decisionCoverage: ${m.decisionCoverage.numerator}/${m.decisionCoverage.denominator} (${rate})`,
    `evidenceClosure: ${m.evidenceClosureRate === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : `${(m.evidenceClosureRate * 100).toFixed(1)}%`}`,
    `writeScopedConfirmed: ${m.writeScopedConfirmedCount ?? "NOT_EVALUATED"}/${m.confirmedAssessmentCount ?? "NOT_EVALUATED"}`,
    `crossChannelConfirmedBranches: ${m.crossChannelConfirmedBranchCount ?? "NOT_EVALUATED"}`,
    `crossWriteScopeLeaks: ${m.crossWriteScopeLeakCount ?? "NOT_EVALUATED"}`,
    `unknownReasons: ${Object.entries(m.unknownReasonCounts ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([reason, count]) => `${reason}=${count}`).join(",") || "(none)"}`,
    `runtimeRerunDecision: ${artifact.runtimeRerunDecision}`,
    `gaps: ${artifact.gaps.length}`,
    ...(report
      ? [
          "",
          ...formatTier("档一 值必达", report.valueCertain),
          ...formatTier("档二 行决定", report.rowDetermining),
          ...formatMultiplicity(report.multiplicityRisk),
          ...formatPruned(report),
        ]
      : []),
  ].join("\n");
}

export function renderTargetTableCausalHtml(artifact: TargetTableCausalClosureArtifact): string {
  const summary = formatTargetTableCausalSummary(artifact);
  const report = artifact.shrinkReport;
  const multiplicity = report?.multiplicityRisk ?? [];
  const multiplicityLines = multiplicity.length === 0
    ? "(empty)"
    : multiplicity.map((entry) =>
      `${entry.taskId} ${entry.table ?? ""}  JOIN ${entry.joinNode ?? "(none)"}  keys ${entry.viaFields.join(",") || "(none)"}  witness ${entry.witness.slice(0, 3).join(",") || "(none)"}`,
    ).join("\n");
  const prunedRows = (report?.prunedReasons ?? []).map((reason) => {
    const samples = (reason.samples ?? [])
      .map((sample) => `${sample.taskId ?? "(no-task)"} ${sample.table ?? ""}`.trim())
      .join("; ");
    return `<tr><td>${escapeHtml(reason.reasonCode)}</td><td>${reason.count}</td><td>${escapeHtml(samples || "(none)")}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Target Table Causal Closure</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#17212b}pre{background:#f4f6f8;padding:1rem;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #d9dee3;padding:6px;text-align:left}th{background:#eef2f5}details{margin:1rem 0}summary{cursor:pointer;font-weight:600}</style></head><body><h1>目标表上游因果闭包</h1><pre>${escapeHtml(summary)}</pre><h2>档四 本轮证不出 / 未进入确定集</h2><p>未进入确定集的候选，按原因分组展示计数与样本。</p><table><thead><tr><th>原因码</th><th>计数</th><th>样本</th></tr></thead><tbody>${prunedRows}</tbody></table><details><summary>档三 倍增风险（默认折叠）: ${multiplicity.length}</summary><pre>${escapeHtml(multiplicityLines)}</pre></details></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
