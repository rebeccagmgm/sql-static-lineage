import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

export const CALCITE_PROVIDER_POC_STAGING_ROOT = resolve(
  "staging",
  "calcite-semantic-provider-poc",
);

const FORBIDDEN_ARTIFACT_NAMES = new Set([
  "field-lineage.json",
  "field-lineage.html",
  "multi-hop.json",
  "multi-hop.html",
  "one-hop.json",
  "target-field-causal-slice.json",
  "target-field-causal-slice.html",
  "target-table-upstream-causal-closure.json",
  "target-table-upstream-causal-closure.html",
]);

export class CalciteProviderOutputError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CalciteProviderOutputError";
  }
}

export function resolvePocOutputPath(
  outputPath: string,
  stagingRoot = CALCITE_PROVIDER_POC_STAGING_ROOT,
): string {
  const root = resolve(stagingRoot);
  const candidate = resolve(isAbsolute(outputPath) ? outputPath : root, outputPath);
  const normalized = candidate.replace(/[\\/]+/g, "/").toLowerCase();
  if (/(^|\/)artifacts\/tasks(?:\/|$)/.test(normalized)) {
    throw new CalciteProviderOutputError(
      "CANONICAL_ARTIFACT_PATH_FORBIDDEN",
      "Calcite Provider POC output cannot target artifacts/tasks.",
    );
  }
  if (FORBIDDEN_ARTIFACT_NAMES.has(basename(candidate).toLowerCase())) {
    throw new CalciteProviderOutputError(
      "CANONICAL_ARTIFACT_NAME_FORBIDDEN",
      "Calcite Provider POC output cannot use a canonical lineage artifact filename.",
    );
  }
  const relativePath = relative(root, candidate);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath)
  ) {
    throw new CalciteProviderOutputError(
      "POC_STAGING_ESCAPE",
      "Calcite Provider POC output must remain under its staging root.",
    );
  }
  assertNoExistingSymlinkEscape(root, candidate);
  return candidate;
}

function assertNoExistingSymlinkEscape(root: string, candidate: string): void {
  let current = dirname(candidate);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
  const realCurrent = realpathSync(current);
  const realRoot = existsSync(root) ? realpathSync(root) : root;
  const escaped = relative(realRoot, realCurrent);
  if (escaped === ".." || escaped.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new CalciteProviderOutputError(
      "POC_STAGING_SYMLINK_ESCAPE",
      "Calcite Provider POC output resolves outside its staging root.",
    );
  }
}
