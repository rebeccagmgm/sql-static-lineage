import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../machine-facts/machine-facts-contract.ts";
import { assembleRealEvidence } from "./assemble-real-evidence.ts";
import { runProviderBatch } from "./bridge-client.ts";
import { buildImpactValueReport } from "./impact-value-report.ts";
import { loadNativeLeafEvidence } from "./native-evidence-loader.ts";
import { resolvePocOutputPath } from "./output-guard.ts";
import { prepareRealProbe } from "./prepare-real-probe.ts";
import {
  parseProviderResponse,
  type CalciteSemanticProviderRequest,
} from "./protocol.ts";

interface PreparedCase {
  readonly taskId: string;
  readonly requestPath: string;
  readonly manifestPath: string;
  readonly request: CalciteSemanticProviderRequest;
}

interface RealCaseStatus {
  readonly reportVersion: 1;
  readonly taskId: string;
  readonly status: "EVALUATED" | "PARTIAL" | "NOT_EVALUATED";
  readonly reasonCode?: string;
  readonly providerStatus?: string;
  readonly summary?: Record<string, unknown>;
  readonly safety: {
    readonly canonicalArtifactsWritten: false;
    readonly nativeSemanticFallback: false;
  };
}

export async function runRealCases(input: {
  readonly dataRoot: string;
  readonly taskIds: readonly string[];
  readonly classpath: string;
  readonly timeoutMs?: number;
}): Promise<readonly RealCaseStatus[]> {
  const statuses = new Map<string, RealCaseStatus>();
  const prepared: PreparedCase[] = [];
  for (const taskId of input.taskIds) {
    try {
      const probe = prepareRealProbe({
        dataRoot: input.dataRoot,
        taskId,
        outputPrefix: `real-${taskId}`,
      });
      prepared.push({
        taskId,
        ...probe,
        request: JSON.parse(
          readFileSync(probe.requestPath, "utf8"),
        ) as CalciteSemanticProviderRequest,
      });
    } catch (error) {
      const status = caseStatus(taskId, "NOT_EVALUATED", {
        reasonCode: errorCode(error),
      });
      statuses.set(taskId, status);
      writeCaseStatus(status);
    }
  }
  if (prepared.length > 0) {
    const responses = await runProviderBatch(
      prepared.map((item) => item.request),
      {
        classpath: input.classpath,
        timeoutMs: input.timeoutMs ?? 120_000,
      },
    );
    for (let index = 0; index < prepared.length; index++) {
      const item = prepared[index]!;
      const response = parseProviderResponse(responses[index]);
      const root = `real-${item.taskId}`;
      const responsePath = writePocJson(`${root}/response.json`, response);
      if (!response.facts) {
        const status = caseStatus(item.taskId, "NOT_EVALUATED", {
          reasonCode: response.error?.code ?? `PROVIDER_${response.status}`,
          providerStatus: response.status,
        });
        statuses.set(item.taskId, status);
        writeCaseStatus(status);
        continue;
      }
      try {
        const assembled = assembleRealEvidence({
          responsePath,
          manifestPath: item.manifestPath,
        });
        writePocJson(`${root}/assembled-response.json`, assembled.response);
        writePocJson(
          `${root}/evidence-assembly-metrics.json`,
          assembled.metrics,
        );
        const facts = assembled.response.facts!;
        const native = loadNativeLeafEvidence(facts, item.manifestPath);
        const impact = buildImpactValueReport({
          facts,
          native: native.statement,
        });
        writePocJson(`${root}/impact-value-report.json`, impact);
        const status = caseStatus(
          item.taskId,
          response.status === "SUCCESS" && impact.gaps.length === 0
            ? "EVALUATED"
            : "PARTIAL",
          {
            providerStatus: response.status,
            summary: {
              tableScanCount: impact.summary.tableScanCount,
              exactNativeReadCount: impact.summary.exactNativeReadCount,
              reachedReadCount: impact.summary.reachedReadCount,
              directFieldValueReadCount:
                impact.summary.directFieldValueReadCount,
              indirectOnlyReadCount: impact.summary.indirectOnlyReadCount,
              gapCount: impact.gaps.length,
            },
          },
        );
        statuses.set(item.taskId, status);
        writeCaseStatus(status);
      } catch (error) {
        const status = caseStatus(item.taskId, "NOT_EVALUATED", {
          reasonCode: errorCode(error),
          providerStatus: response.status,
        });
        statuses.set(item.taskId, status);
        writeCaseStatus(status);
      }
    }
  }
  return input.taskIds.map(
    (taskId) =>
      statuses.get(taskId) ??
      caseStatus(taskId, "NOT_EVALUATED", {
        reasonCode: "CASE_STATUS_MISSING",
      }),
  );
}

function caseStatus(
  taskId: string,
  status: RealCaseStatus["status"],
  details: Pick<RealCaseStatus, "reasonCode" | "providerStatus" | "summary">,
): RealCaseStatus {
  return {
    reportVersion: 1,
    taskId,
    status,
    ...(details.reasonCode ? { reasonCode: details.reasonCode } : {}),
    ...(details.providerStatus
      ? { providerStatus: details.providerStatus }
      : {}),
    ...(details.summary ? { summary: details.summary } : {}),
    safety: {
      canonicalArtifactsWritten: false,
      nativeSemanticFallback: false,
    },
  };
}

function writeCaseStatus(status: RealCaseStatus): string {
  return writePocJson(`real-${status.taskId}/case-status.json`, status);
}

function writePocJson(path: string, value: unknown): string {
  const destination = resolvePocOutputPath(path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, canonicalJson(value), "utf8");
  return destination;
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/);
  return match?.[1] ?? "CALCITE_CASE_PREPARATION_FAILED";
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const classpath = readFileSync(
    resolve(argument("--classpath-file")),
    "utf8",
  ).trim();
  if (!classpath) throw new Error("classpath file is empty");
  const statuses = await runRealCases({
    dataRoot: resolve(argument("--data-root")),
    taskIds: argument("--task-ids")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    classpath,
  });
  process.stdout.write(canonicalJson(statuses));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
