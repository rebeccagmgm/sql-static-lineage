import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { projectKeySegment } from "../contracts/project-topology-contract.ts";
import {
  loadIndexedProjectTopology,
  loadIndexedFieldEvidence,
  loadIndexedTargetCausalOverlay,
} from "./query-index-query-source.ts";
import type { QueryIndexStore } from "./query-index-store.ts";
import { runProjectionQuery } from "../query/run-projection-query.ts";
import {
  QUERY_OPTIONS,
  QUERY_OPTIONS_BY_NAME,
  collectOptions,
  validateQueryOptions,
  requiredOne,
  optionalOne,
  integerOption,
  type QueryName,
} from "../query/query-cli-options.ts";
import {
  openNeo4jQueryIndexDriver,
  resolveNeo4jQueryIndexConnection,
  type Neo4jQueryIndexConnectionInput,
} from "./neo4j-query-index-connection.ts";
import { Neo4jQueryIndexStore } from "./neo4j-query-index-store.ts";
import { buildQueryIndex } from "./query-index-builder.ts";
import { runRequiredQueryIndexParity } from "./query-index-parity.ts";
import { loadQueryIndexSource } from "./query-index-source.ts";

interface SourceOptions {
  readonly topologyDirectory: string;
  readonly fieldEvidenceDirectories: readonly string[];
  readonly targetCausalOverlayDirectories: readonly string[];
}

interface ConnectionOptions {
  readonly connection: Neo4jQueryIndexConnectionInput;
}

export type QueryIndexCliOptions =
  | { readonly command: "help" }
  | (ConnectionOptions &
      SourceOptions & {
        readonly command: "build";
        readonly auditOutputRoot: string;
        readonly batchSize: number;
      })
  | (ConnectionOptions &
      SourceOptions & {
        readonly command: "parity";
      })
  | (ConnectionOptions & {
      readonly command: "status";
      readonly projectKey: string;
    })
  | (ConnectionOptions & {
      readonly command: "query";
      readonly projectKey: string;
      readonly expectedSourceDescriptorHash: string;
      readonly query: QueryName;
      readonly fieldEvidenceSnapshotId?: string;
      readonly targetCausalOverlaySnapshotId?: string;
      readonly values: ReadonlyMap<string, readonly string[]>;
    });

const COMMON_OPTIONS = new Set([
  "--neo4j-uri",
  "--neo4j-username",
  "--neo4j-database",
  "--password-env",
  "--password-file",
  "--target-alias",
]);

export function parseQueryIndexCli(
  args: readonly string[],
): QueryIndexCliOptions {
  if (args.length === 0 || args[0] === "--help" || args[0] === "help")
    return { command: "help" };
  const command = args[0];
  if (!new Set(["build", "parity", "status", "query"]).has(command!))
    throw new Error(`QUERY_INDEX_COMMAND_UNKNOWN:${command}`);
  if (args.includes("--password"))
    throw new Error("QUERY_INDEX_DIRECT_PASSWORD_FORBIDDEN");
  const allowed = new Set(COMMON_OPTIONS);
  if (command === "build" || command === "parity") {
    allowed.add("--topology");
    allowed.add("--field");
    allowed.add("--causal-overlay");
  }
  if (command === "build") {
    allowed.add("--audit-root");
    allowed.add("--batch-size");
  }
  if (command === "status") allowed.add("--project-key");
  if (command === "query")
    for (const option of [
      ...QUERY_OPTIONS,
      "--project-key",
      "--expected-descriptor-hash",
      "--field-snapshot",
      "--causal-snapshot",
    ])
      allowed.add(option);
  const values = collectOptions(args.slice(1), allowed);
  const connection = connectionOptions(values);
  if (command === "build") {
    return {
      command,
      connection,
      ...sourceOptions(values),
      auditOutputRoot: absolutePath(
        requiredOne(values, "--audit-root"),
        "AUDIT_ROOT",
      ),
      batchSize: integerOption(values, "--batch-size", 500, 1, 10_000),
    };
  }
  if (command === "parity")
    return { command, connection, ...sourceOptions(values) };
  if (command === "status")
    return {
      command,
      connection,
      projectKey: projectKeySegment(requiredOne(values, "--project-key")),
    };
  const query = requiredOne(values, "--query") as QueryName;
  if (!QUERY_OPTIONS_BY_NAME.has(query))
    throw new Error(`QUERY_INDEX_QUERY_UNKNOWN:${query}`);
  const descriptorHash = requiredOne(values, "--expected-descriptor-hash");
  if (!/^[0-9a-f]{64}$/u.test(descriptorHash))
    throw new Error("QUERY_INDEX_EXPECTED_DESCRIPTOR_HASH_INVALID");
  validateQueryOptions(query, values);
  if (query.includes("field")) requiredOne(values, "--field-snapshot");
  if (query.includes("causal")) requiredOne(values, "--causal-snapshot");
  return {
    command: "query",
    connection,
    projectKey: projectKeySegment(requiredOne(values, "--project-key")),
    expectedSourceDescriptorHash: descriptorHash,
    query,
    fieldEvidenceSnapshotId: optionalOne(values, "--field-snapshot"),
    targetCausalOverlaySnapshotId: optionalOne(values, "--causal-snapshot"),
    values,
  };
}

export async function runQueryIndexCli(
  args: readonly string[],
  dependencies: {
    readonly openConnection?: typeof openNeo4jQueryIndexDriver;
    readonly write?: (text: string) => void;
  } = {},
): Promise<void> {
  const options = parseQueryIndexCli(args);
  const write =
    dependencies.write ?? ((text: string) => process.stdout.write(text));
  if (options.command === "help") {
    write(`${usage()}\n`);
    return;
  }
  let source: ReturnType<typeof loadQueryIndexSource> | undefined;
  if (options.command === "build" || options.command === "parity") {
    validateSourceDirectories(options);
    if (options.command === "build")
      validateAuditOutputRoot(options.auditOutputRoot);
    source = loadQueryIndexSource({
      topologyDirectory: options.topologyDirectory,
      fieldEvidenceDirectories: options.fieldEvidenceDirectories,
      targetCausalOverlayDirectories: options.targetCausalOverlayDirectories,
    });
  }
  resolveNeo4jQueryIndexConnection(options.connection);
  const opened = await (
    dependencies.openConnection ?? openNeo4jQueryIndexDriver
  )(options.connection);
  const store = new Neo4jQueryIndexStore(opened.driver, opened.database);
  try {
    if (options.command === "build") {
      const result = await buildQueryIndex({
        source: source!,
        store,
        auditOutputRoot: options.auditOutputRoot,
        batchSize: options.batchSize,
        runParity: async () =>
          runRequiredQueryIndexParity({ source: source!, store }),
      });
      writeJson(write, {
        status: result.outcome,
        projectKey: result.source.descriptor.projectKey,
        indexBuildId: result.source.indexBuildId,
        sourceDescriptorHash: result.source.descriptorHash,
        indexedCounts: result.audit.manifest.indexedCounts,
        parityStatus: result.audit.parityReport.status,
        auditDirectory: result.audit.directory,
        targetAlias: opened.targetAlias,
      });
      return;
    }
    if (options.command === "parity") {
      const report = await runRequiredQueryIndexParity({
        source: source!,
        store,
      });
      writeJson(write, report);
      return;
    }
    if (options.command === "status") {
      const current = await store.resolveCurrentBuild(options.projectKey);
      writeJson(
        write,
        current === null
          ? {
              status: "QUERY_INDEX_UNAVAILABLE",
              projectKey: options.projectKey,
            }
          : {
              status: "READY",
              projectKey: current.projectKey,
              indexBuildId: current.indexBuildId,
              sourceDescriptorHash: current.sourceDescriptorHash,
              validationState: current.validationState,
              parityState: current.parityState,
              projections: current.projections.map((projection) => ({
                projectionKind: projection.projectionKind,
                projectionSnapshotId: projection.projectionSnapshotId,
                counts: projection.counts,
              })),
            },
      );
      return;
    }
    writeJson(write, await runIndexedQuery(store, options));
  } finally {
    await store.close();
  }
}

export async function runIndexedQuery(
  store: QueryIndexStore,
  options: Extract<QueryIndexCliOptions, { readonly command: "query" }>,
): Promise<unknown> {
  const expected = {
    store,
    projectKey: options.projectKey,
    expectedSourceDescriptorHash: options.expectedSourceDescriptorHash,
  };
  return runProjectionQuery(
    {
      topology: () => loadIndexedProjectTopology(expected),
      field: () =>
        loadIndexedFieldEvidence({
          ...expected,
          fieldEvidenceSnapshotId: requiredOne(
            options.values,
            "--field-snapshot",
          ),
        }),
      causal: () =>
        loadIndexedTargetCausalOverlay({
          ...expected,
          targetCausalOverlaySnapshotId: requiredOne(
            options.values,
            "--causal-snapshot",
          ),
        }),
    },
    options,
  );
}

function connectionOptions(
  values: ReadonlyMap<string, readonly string[]>,
): Neo4jQueryIndexConnectionInput {
  const passwordEnv = optionalOne(values, "--password-env");
  const passwordFile = optionalOne(values, "--password-file");
  if ((passwordEnv === undefined) === (passwordFile === undefined))
    throw new Error("QUERY_INDEX_PASSWORD_SOURCE_REQUIRED_EXACTLY_ONE");
  return {
    uri: requiredOne(values, "--neo4j-uri"),
    username: requiredOne(values, "--neo4j-username"),
    database: requiredOne(values, "--neo4j-database"),
    passwordSource:
      passwordEnv === undefined
        ? { kind: "FILE", path: absolutePath(passwordFile!, "PASSWORD_FILE") }
        : { kind: "ENVIRONMENT", variable: passwordEnv },
    targetAlias: optionalOne(values, "--target-alias"),
  };
}

function sourceOptions(
  values: ReadonlyMap<string, readonly string[]>,
): SourceOptions {
  return {
    topologyDirectory: absolutePath(
      requiredOne(values, "--topology"),
      "TOPOLOGY",
    ),
    fieldEvidenceDirectories: (values.get("--field") ?? []).map((path) =>
      absolutePath(path, "FIELD_EVIDENCE"),
    ),
    targetCausalOverlayDirectories: (values.get("--causal-overlay") ?? []).map(
      (path) => absolutePath(path, "TARGET_CAUSAL_OVERLAY"),
    ),
  };
}

function validateSourceDirectories(options: SourceOptions): void {
  for (const path of [
    options.topologyDirectory,
    ...options.fieldEvidenceDirectories,
    ...options.targetCausalOverlayDirectories,
  ]) {
    let directory = false;
    try {
      directory = statSync(path).isDirectory();
    } catch {}
    if (!directory) throw new Error("QUERY_INDEX_SOURCE_DIRECTORY_INVALID");
  }
}

function validateAuditOutputRoot(path: string): void {
  let existing = path;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing)
      throw new Error("QUERY_INDEX_AUDIT_ROOT_PARENT_INVALID");
    existing = parent;
  }
  if (!statSync(existing).isDirectory())
    throw new Error("QUERY_INDEX_AUDIT_ROOT_PARENT_INVALID");
}

function absolutePath(value: string, label: string): string {
  if (!isAbsolute(value))
    throw new Error(`QUERY_INDEX_${label}_PATH_NOT_ABSOLUTE`);
  return resolve(value);
}

function writeJson(write: (text: string) => void, value: unknown): void {
  write(`${JSON.stringify(value)}\n`);
}

export function usage(): string {
  return [
    "query-index build --topology <absolute-dir> [--field <absolute-dir>] [--causal-overlay <absolute-dir>] --audit-root <absolute-dir> <connection>",
    "query-index status --project-key <key> <connection>",
    "query-index query --project-key <key> --expected-descriptor-hash <sha256> --query <name> [query options] <connection>",
    "query-index parity --topology <absolute-dir> [--field <absolute-dir>] [--causal-overlay <absolute-dir>] <connection>",
    "connection: --neo4j-uri <uri> --neo4j-username <user> --neo4j-database <db> (--password-env <NAME> | --password-file <absolute-path>) [--target-alias <alias>]",
    "Direct --password values are forbidden.",
  ].join("\n");
}

if (process.argv[1]?.endsWith("query-index-cli.ts"))
  runQueryIndexCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "QUERY_INDEX_CLI_FAILED"}\n`,
    );
    process.exitCode = 1;
  });
