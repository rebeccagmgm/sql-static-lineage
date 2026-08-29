import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { runProviderBatch, type ProviderBridgeOptions } from "./bridge-client.ts";
import { resolvePocOutputPath } from "./output-guard.ts";
import {
  providerRequestDigest,
  type CalciteSemanticProviderRequest,
  type CalciteSemanticProviderResponse,
} from "./protocol.ts";

export interface ProviderPocReport {
  readonly reportVersion: 1;
  readonly safety: { readonly reportKind: "CALCITE_SEMANTIC_PROVIDER_POC"; readonly canonicalArtifactsWritten: false; readonly nativeSemanticFallback: false };
  readonly requestCount: number;
  readonly uniqueDigestCount: number;
  readonly cacheHitCount: number;
  readonly elapsedMs: number;
  readonly responses: readonly CalciteSemanticProviderResponse[];
}

export async function runProviderPoc(
  requests: readonly CalciteSemanticProviderRequest[],
  bridge: ProviderBridgeOptions,
  execute = runProviderBatch,
): Promise<ProviderPocReport> {
  const started = performance.now();
  const unique = new Map<string, CalciteSemanticProviderRequest>();
  for (const request of requests) if (!unique.has(providerRequestDigest(request))) unique.set(providerRequestDigest(request), request);
  const evaluated = await execute([...unique.values()], bridge);
  const byDigest = new Map<string, CalciteSemanticProviderResponse>();
  let index = 0;
  for (const [digest] of unique) byDigest.set(digest, evaluated[index++]!);
  const responses = requests.map((request) => {
    const response = byDigest.get(providerRequestDigest(request));
    if (!response) throw new Error("provider digest cache lost a response");
    return response.requestId === request.requestId ? response : { ...response, requestId: request.requestId };
  });
  return {
    reportVersion: 1,
    safety: { reportKind: "CALCITE_SEMANTIC_PROVIDER_POC", canonicalArtifactsWritten: false, nativeSemanticFallback: false },
    requestCount: requests.length,
    uniqueDigestCount: unique.size,
    cacheHitCount: requests.length - unique.size,
    elapsedMs: Math.round((performance.now() - started) * 1000) / 1000,
    responses,
  };
}

export function writeProviderPocReport(report: ProviderPocReport, outputPath: string): string {
  const destination = resolvePocOutputPath(outputPath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${canonicalJson(report)}\n`, "utf8");
  return destination;
}

async function main(): Promise<void> {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index]!, process.argv[index + 1]!);
  const input = args.get("--input"); const output = args.get("--output"); const classpath = args.get("--classpath");
  if (!input || !output || !classpath) throw new Error("usage: --input requests.json --output report.json --classpath <java classpath>");
  const requests = JSON.parse(readFileSync(resolve(input), "utf8")) as CalciteSemanticProviderRequest[];
  writeProviderPocReport(await runProviderPoc(requests, { classpath }), output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
