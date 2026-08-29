import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { parseCandidateTaskSemanticFacts } from "./contract.ts";
import {
  compareSemanticGolden,
  type SemanticEdgeGolden,
} from "./semantic-golden.ts";

interface SupportMatrix {
  readonly samples: readonly Record<string, unknown>[];
  readonly [key: string]: unknown;
}

export function validateCorpusGolden(input: {
  readonly factsDirectory: string;
  readonly goldenPath: string;
  readonly supportMatrixPath: string;
}): SupportMatrix {
  const golden = JSON.parse(readFileSync(input.goldenPath, "utf8")) as Record<string, readonly SemanticEdgeGolden[]>;
  const report = JSON.parse(readFileSync(input.supportMatrixPath, "utf8")) as SupportMatrix;
  const samples = report.samples.map((sample) => {
    const id = String(sample.id);
    const expected = golden[id];
    if (!expected) throw new Error(`semantic golden missing sample ${id}`);
    const facts = parseCandidateTaskSemanticFacts(JSON.parse(readFileSync(
      join(input.factsDirectory, `${id}.candidate-facts.json`), "utf8",
    )));
    const result = compareSemanticGolden(facts, expected);
    return {
      ...sample,
      acceptanceLabel: result.status,
      expectedSemanticEdgeCount: expected.length,
      actualSemanticEdgeCount: result.actualEdges.length,
      missingSemanticEdges: result.missingEdges,
      unexpectedSemanticEdges: result.unexpectedEdges,
      duplicateSemanticEdges: result.duplicateEdges,
    };
  });
  return {
    ...report,
    semanticEdgeVerifiedCount: samples.filter((sample) => sample.acceptanceLabel === "SEMANTIC_EDGE_VERIFIED").length,
    semanticEdgePartialCount: samples.filter((sample) => sample.acceptanceLabel !== "SEMANTIC_EDGE_VERIFIED").length,
    samples,
  };
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return resolve(value);
}

function main(): void {
  const supportMatrixPath = argument("--support-matrix");
  const report = validateCorpusGolden({
    factsDirectory: argument("--facts-dir"),
    goldenPath: argument("--golden"),
    supportMatrixPath,
  });
  writeFileSync(supportMatrixPath, canonicalJson(report), "utf8");
  process.stdout.write(`semanticEdgeVerified=${String(report.semanticEdgeVerifiedCount)}/${report.samples.length}\n`);
  if (Number(report.semanticEdgePartialCount) > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
