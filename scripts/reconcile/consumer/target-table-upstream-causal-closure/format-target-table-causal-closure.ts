import type { TargetTableCausalClosureArtifact } from "./artifact-contract.ts";

export function formatTargetTableCausalSummary(artifact: TargetTableCausalClosureArtifact): string {
  const m = artifact.metrics;
  const rate = m.decisionCoverage.rate.toFixed(3);
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
  ].join("\n");
}
export function renderTargetTableCausalHtml(artifact: TargetTableCausalClosureArtifact): string {
  const summary = formatTargetTableCausalSummary(artifact);
  const rows = artifact.assessments.map((assessment) => `<tr><td>${escapeHtml(assessment.candidateBranchId)}</td><td>${escapeHtml(assessment.relationStatus)}</td><td>${escapeHtml(assessment.channelAssessments.filter((item) => item.status === "CONFIRMED" || item.status === "CONDITIONAL").map((item) => `${item.channel}:${item.status}`).join(", "))}</td><td>${assessment.gapRefs.length}</td></tr>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Target Table Causal Closure</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#17212b}pre{background:#f4f6f8;padding:1rem;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #d9dee3;padding:6px;text-align:left}th{background:#eef2f5}</style></head><body><h1>目标表上游因果闭包</h1><pre>${escapeHtml(summary)}</pre><table><thead><tr><th>候选分支</th><th>关系结论</th><th>影响通道</th><th>Gap</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
