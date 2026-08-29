import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import {
  parseProviderResponse,
  type CalciteSemanticProviderRequest,
  type CalciteSemanticProviderResponse,
} from "./protocol.ts";

export type ProviderSpawn = (command: string, args: readonly string[], options: { readonly cwd?: string; readonly windowsHide: boolean; readonly shell: false }) => ChildProcessWithoutNullStreams;
export interface ProviderBridgeOptions {
  readonly javaExecutable?: string;
  readonly classpath: string;
  readonly mainClass?: string;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly spawnProcess?: ProviderSpawn;
}

export async function runProviderBatch(
  requests: readonly CalciteSemanticProviderRequest[],
  options: ProviderBridgeOptions,
): Promise<readonly CalciteSemanticProviderResponse[]> {
  if (requests.length === 0) return [];
  const spawnProcess = options.spawnProcess ?? ((command, args, spawnOptions) =>
    spawn(command, args, { ...spawnOptions, stdio: ["pipe", "pipe", "pipe"] }));
  const child = spawnProcess(options.javaExecutable ?? "java", [
    "-Xmx1024m", "-cp", options.classpath,
    options.mainClass ?? "com.gf.sqlstaticlineage.calcitesemanticprovider.CalciteSemanticProvider",
  ], { cwd: options.cwd, windowsHide: true, shell: false });
  const responses: CalciteSemanticProviderResponse[] = [];
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  let parseFailure: Error | undefined;
  lines.on("line", (line) => {
    if (parseFailure || line.trim() === "") return;
    try { responses.push(parseProviderResponse(JSON.parse(line))); }
    catch (error) { parseFailure = error instanceof Error ? error : new Error(String(error)); }
  });
  const completion = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Calcite Provider exited ${code}: ${stderr.trim()}`)));
  });
  const timeout = setTimeout(() => child.kill(), options.timeoutMs ?? 30_000);
  for (const request of requests) child.stdin.write(`${canonicalJson(request)}\n`);
  child.stdin.end();
  try { await completion; } finally { clearTimeout(timeout); lines.close(); }
  if (parseFailure) throw parseFailure;
  if (responses.length !== requests.length) throw new Error(`Calcite Provider returned ${responses.length} responses for ${requests.length} requests`);
  for (let index = 0; index < requests.length; index++) {
    if (responses[index]?.requestId !== requests[index]?.requestId) throw new Error(`Calcite Provider response ${index} requestId mismatch`);
  }
  return responses;
}
