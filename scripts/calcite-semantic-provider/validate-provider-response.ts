import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { parseProviderResponse } from "./protocol.ts";

export function validateProviderResponseFile(path: string): ReturnType<typeof parseProviderResponse> {
  return parseProviderResponse(JSON.parse(readFileSync(path, "utf8")));
}

function main(): void {
  const inputIndex = process.argv.indexOf("--input");
  const input = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined;
  if (!input) throw new Error("usage: --input <provider-response.json>");
  const response = validateProviderResponseFile(resolve(input));
  process.stdout.write(canonicalJson({
    requestId: response.requestId,
    status: response.status,
    statementStatus: response.facts?.statementStatus,
    relationCount: response.facts?.relations.length ?? 0,
    dependencyCount: response.facts?.dependencies.length ?? 0,
    issueCodes: [...new Set(response.facts?.issues.map((issue) => issue.code) ?? [])].sort(),
    error: response.error,
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
