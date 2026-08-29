import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateMultiHopReconciliation,
  type MultiHopReconciliationResult,
} from "../../reconcile/consumer/multi-hop/reconcile-multi-hop.ts";
import { runDirectProjectTopology } from "./direct-project-topology.ts";
import { compareProjectRootTraversal } from "./project-evidence-parity.ts";
import { parseProjectEvidenceCli } from "./project-evidence-cli.ts";

export async function runProjectEvidenceAcceptanceCli(
  args: readonly string[],
): Promise<void> {
  const { remaining, formalArtifactRoot } = extractFormalArtifactRoot(args);
  const options = parseProjectEvidenceCli(remaining);
  const result = await runDirectProjectTopology(options);
  const parity = result.roots.map((actual) => {
    const path = join(
      formalArtifactRoot,
      "tasks",
      actual.rootTaskId,
      "multi-hop.json",
    );
    const expected = JSON.parse(
      readFileSync(path, "utf8"),
    ) as MultiHopReconciliationResult;
    validateMultiHopReconciliation(expected);
    return {
      ...compareProjectRootTraversal(expected, actual),
      formalPath: path,
      formalBytes: statSync(path).size,
      formalCounts: expected.counts,
      directCounts: actual.counts,
    };
  });
  const passed = parity.every((root) => root.matches);
  process.stdout.write(
    `${JSON.stringify({
      status: passed ? "PASS" : "FAIL",
      snapshotId: result.projection.snapshot.snapshotId,
      directory: result.published.directory,
      source: result.projection.snapshot.sources[0]?.projectEvidence ?? null,
      coverageStatus: result.projection.snapshot.coverageStatus,
      counters: result.counters,
      timingsMs: result.timingsMs,
      publishedFiles: result.published.manifest.files,
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
    remaining: args.filter((_, itemIndex) =>
      itemIndex !== index && itemIndex !== index + 1,
    ),
    formalArtifactRoot: resolve(value),
  };
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain)
  void runProjectEvidenceAcceptanceCli(process.argv.slice(2)).catch(
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
