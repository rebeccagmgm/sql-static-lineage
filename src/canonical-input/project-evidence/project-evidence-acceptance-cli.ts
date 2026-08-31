import { readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  validateMultiHopReconciliation,
  type MultiHopReconciliationResult,
} from "../../contracts/canonical-artifacts.ts";
import { compareProjectRootTraversal } from "./project-evidence-parity.ts";
import { parseProjectEvidenceCli } from "./project-evidence-cli.ts";
import { runDirectProjectTopology } from "./direct-project-topology.ts";

export function runProjectEvidenceAcceptanceCli(args: readonly string[]): void {
  const { remaining, formalArtifactRoot } = extractFormalArtifactRoot(args);
  const result = runDirectProjectTopology(parseProjectEvidenceCli(remaining));
  const parity = result.roots.map((actual) => {
    const path = join(
      formalArtifactRoot,
      "tasks",
      actual.source.rootTaskId,
      "multi-hop.json",
    );
    const expected = JSON.parse(
      readFileSync(path, "utf8"),
    ) as MultiHopReconciliationResult;
    validateMultiHopReconciliation(expected);
    return {
      ...compareProjectRootTraversal(expected, actual.multiHop),
      formalPath: path,
      formalBytes: statSync(path).size,
      formalCounts: expected.counts,
      consumedCounts: actual.multiHop.counts,
    };
  });
  const passed = parity.every((root) => root.matches);
  process.stdout.write(
    `${JSON.stringify({
      status: passed ? "PASS" : "FAIL",
      publicationStatus: result.published.status,
      graphPublicationStatus: result.graph.status,
      sourceId: result.source.sourceId,
      contentHash: result.source.contentHash,
      evidenceDirectory: result.published.directory,
      graphDirectory: result.graph.directory,
      coverageStatus: result.graph.manifest.coverageStatus,
      counters: result.counters,
      parity,
    })}\n`,
  );
  if (!passed) process.exitCode = 1;
}

function extractFormalArtifactRoot(args: readonly string[]): {
  readonly remaining: readonly string[];
  readonly formalArtifactRoot: string;
} {
  const index = args.indexOf("--formal-artifact-root");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--"))
    throw new Error("OPTION_REQUIRED:--formal-artifact-root");
  return {
    remaining: args.filter(
      (_, itemIndex) => itemIndex !== index && itemIndex !== index + 1,
    ),
    formalArtifactRoot: resolve(value),
  };
}

if (
  process.argv[1] &&
  basename(process.argv[1]) === "project-evidence-acceptance-cli.ts"
)
  runProjectEvidenceAcceptanceCli(process.argv.slice(2));
