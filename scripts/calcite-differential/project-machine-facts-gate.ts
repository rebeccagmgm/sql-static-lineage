import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadMachineFactsGateInput } from "./machine-facts-gate-input.ts";
import { projectPlanFactsCore } from "./plan-facts-rel-projector.ts";
import { serializeDifferentialRequest } from "./protocol.ts";

function requiredArg(args: readonly string[], flag: string): string {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function projectMachineFactsGateRequests(options: {
  readonly dataRoot: string;
  readonly taskId: string;
}): {
  readonly requests: readonly string[];
  readonly summary: Readonly<Record<string, unknown>>;
} {
  const input = loadMachineFactsGateInput(options);
  if (!input.planFacts || input.status === "UNSUPPORTED")
    throw new Error(`MACHINE_FACTS_GATE_INPUT_${input.status}`);

  const requests: string[] = [];
  const issueCounts = new Map<string, number>();
  const projectionCounts = { SUCCESS: 0, PARTIAL: 0, UNSUPPORTED: 0 };
  for (const relation of input.planFacts.relations) {
    const result = projectPlanFactsCore({
      taskId: input.taskId,
      statementId: input.statementId,
      planFacts: { ...input.planFacts, roots: [relation.id] },
      schemaProjection: input.schemaProjection,
      outputTypes: input.outputTypes,
      relationEvidenceRefs: input.relationEvidenceRefs,
      expressionEvidenceRefs: input.expressionEvidenceRefs,
      ...(input.defaultSchema ? { defaultSchema: input.defaultSchema } : {}),
    });
    projectionCounts[result.status] += 1;
    for (const issue of result.issues)
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
    if (result.request) requests.push(serializeDifferentialRequest(result.request));
  }

  return {
    requests,
    summary: {
      taskId: input.taskId,
      inputStatus: input.status,
      projectionPlanSource: input.projectionPlanSource,
      relationCount: input.planFacts.relations.length,
      requestCount: requests.length,
      projectionCounts,
      issueCounts: Object.fromEntries([...issueCounts].sort()),
      warnings: input.warnings,
      canonicalArtifactsWritten: false,
    },
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const result = projectMachineFactsGateRequests({
    dataRoot: resolve(requiredArg(args, "--data-root")),
    taskId: requiredArg(args, "--task-id"),
  });
  for (const request of result.requests) process.stdout.write(request);
  process.stderr.write(`GATE_PROJECTION ${JSON.stringify(result.summary)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
