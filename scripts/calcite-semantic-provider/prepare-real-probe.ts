import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { resolvePocOutputPath } from "./output-guard.ts";
import { buildRealProviderInput } from "./real-input.ts";

export interface PreparedRealProbe {
  readonly requestPath: string;
  readonly manifestPath: string;
}

export function prepareRealProbe(input: {
  readonly dataRoot: string;
  readonly taskId: string;
  readonly outputPrefix?: string;
}): PreparedRealProbe {
  const prepared = buildRealProviderInput(input);
  const prefix = input.outputPrefix ?? "real-209119";
  const requestPath = resolvePocOutputPath(`${prefix}/request.json`);
  const manifestPath = resolvePocOutputPath(`${prefix}/input-manifest.json`);
  mkdirSync(dirname(requestPath), { recursive: true });
  writeFileSync(requestPath, canonicalJson(prepared.request), "utf8");
  writeFileSync(
    manifestPath,
    canonicalJson({
      manifestVersion: 1,
      safety: {
        reportKind: "CALCITE_SEMANTIC_PROVIDER_REAL_INPUT",
        canonicalArtifactsWritten: false,
        nativeSemanticFallback: false,
      },
      evidence: prepared.evidence,
      dialectTransform: prepared.dialectTransform,
    }),
    "utf8",
  );
  return { requestPath, manifestPath };
}

function argumentsMap(argv: readonly string[]): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`invalid argument at position ${index}`);
    values.set(key, value);
  }
  return values;
}

function main(): void {
  const args = argumentsMap(process.argv);
  const required = (name: string): string => {
    const value = args.get(name);
    if (!value) throw new Error(`missing ${name}`);
    return resolve(value);
  };
  const result = prepareRealProbe({
    dataRoot: required("--data-root"),
    taskId: args.get("--task-id") ?? "209119",
    outputPrefix: args.get("--output-prefix"),
  });
  process.stdout.write(canonicalJson(result));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
