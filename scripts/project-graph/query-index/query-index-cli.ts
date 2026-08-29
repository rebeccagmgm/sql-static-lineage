import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { projectKeySegment } from "../contracts/project-topology-contract.ts";
import type {
  FieldEvidenceEdgeType,
  FieldEvidenceNodeType,
} from "../field-evidence/field-evidence-contract.ts";
import type {
  ProjectTopologyEdgeType,
  ProjectTopologyNodeType,
  ProjectTopologyRelationLayer,
} from "../contracts/project-topology-contract.ts";
import {
  explainIndexedFieldEvidenceRecord,
  getIndexedFieldEvidence,
  traceIndexedFieldValuePath,
} from "./indexed-field-evidence-query.ts";
import {
  explainIndexedTopologyEdge,
  getIndexedProjectTopology,
  traceIndexedProjectUpstream,
} from "./indexed-project-topology-query.ts";
import {
  explainIndexedTargetCausalAssessment,
  getIndexedTargetCausalOverlay,
  getIndexedTargetCausalTaskRollup,
} from "./indexed-target-causal-overlay-query.ts";
import type { RelationStatus } from "../../reconcile/consumer/target-table-upstream-causal-closure/artifact-contract.ts";
import type { ImpactChannel } from "../../reconcile/consumer/target-table-upstream-causal-closure/task-relation-summary.ts";
import {
  openNeo4jQueryIndexDriver,
  resolveNeo4jQueryIndexConnection,
  type Neo4jQueryIndexConnectionInput,
} from "./neo4j-query-index-connection.ts";
import { Neo4jQueryIndexStore } from "./neo4j-query-index-store.ts";
import { buildQueryIndex } from "./query-index-builder.ts";
import { runRequiredQueryIndexParity } from "./query-index-parity.ts";
import { loadQueryIndexSource } from "./query-index-source.ts";

type QueryName =
  | "get_project_topology"
  | "trace_project_upstream"
  | "explain_topology_edge"
  | "get_field_evidence"
  | "trace_field_value_path"
  | "explain_field_evidence_record"
  | "get_target_causal_overlay"
  | "get_target_causal_task_rollup"
  | "explain_target_causal_assessment";

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

const QUERY_OPTIONS = new Set([
  "--project-key",
  "--expected-descriptor-hash",
  "--query",
  "--field-snapshot",
  "--causal-snapshot",
  "--node-type",
  "--edge-type",
  "--offset",
  "--limit",
  "--start-node-id",
  "--relation-layer",
  "--max-hops",
  "--max-nodes",
  "--max-edges",
  "--max-paths",
  "--edge-id",
  "--root-field",
  "--start-state-id",
  "--record-id",
  "--max-attachments",
  "--relation-status",
  "--channel",
  "--task-id",
  "--assessment-id",
  "--max-assessments",
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
    for (const option of QUERY_OPTIONS) allowed.add(option);
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
      targetCausalOverlayDirectories:
        options.targetCausalOverlayDirectories,
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

async function runIndexedQuery(
  store: Neo4jQueryIndexStore,
  options: Extract<QueryIndexCliOptions, { readonly command: "query" }>,
): Promise<unknown> {
  const expected = {
    store,
    projectKey: options.projectKey,
    expectedSourceDescriptorHash: options.expectedSourceDescriptorHash,
  };
  const one = (name: string) => optionalOne(options.values, name);
  const many = (name: string) => options.values.get(name);
  const integer = (
    name: string,
    minimum: number,
    maximum = Number.MAX_SAFE_INTEGER,
  ) => optionalInteger(options.values, name, minimum, maximum);
  switch (options.query) {
    case "get_project_topology":
      return getIndexedProjectTopology(expected, {
        nodeTypes: many("--node-type") as
          readonly ProjectTopologyNodeType[] | undefined,
        edgeTypes: many("--edge-type") as
          readonly ProjectTopologyEdgeType[] | undefined,
        offset: integer("--offset", 0),
        limit: integer("--limit", 1, 5_000),
      });
    case "trace_project_upstream":
      return traceIndexedProjectUpstream(expected, {
        startNodeId: requiredOne(options.values, "--start-node-id"),
        relationLayers: many("--relation-layer") as
          readonly ProjectTopologyRelationLayer[] | undefined,
        maxHops: integer("--max-hops", 0, 100),
        maxNodes: integer("--max-nodes", 1, 100_000),
        maxEdges: integer("--max-edges", 1, 250_000),
        maxPaths: integer("--max-paths", 1, 1_000_000),
      });
    case "explain_topology_edge":
      return explainIndexedTopologyEdge(
        expected,
        requiredOne(options.values, "--edge-id"),
      );
    case "get_field_evidence":
      return getIndexedFieldEvidence(fieldExpected(expected, options), {
        nodeTypes: many("--node-type") as
          readonly FieldEvidenceNodeType[] | undefined,
        edgeTypes: many("--edge-type") as
          readonly FieldEvidenceEdgeType[] | undefined,
        offset: integer("--offset", 0),
        limit: integer("--limit", 1),
      });
    case "trace_field_value_path":
      return traceIndexedFieldValuePath(fieldExpected(expected, options), {
        rootField: one("--root-field"),
        startStateId: one("--start-state-id"),
        maxHops: integer("--max-hops", 1),
        maxNodes: integer("--max-nodes", 1),
        maxEdges: integer("--max-edges", 1),
        maxPaths: integer("--max-paths", 1),
      });
    case "explain_field_evidence_record":
      return explainIndexedFieldEvidenceRecord(
        fieldExpected(expected, options),
        requiredOne(options.values, "--record-id"),
        { maxAttachments: integer("--max-attachments", 1) },
      );
    case "get_target_causal_overlay":
      return getIndexedTargetCausalOverlay(causalExpected(expected, options), {
        relationStatuses: many("--relation-status") as
          | readonly RelationStatus[]
          | undefined,
        channels: many("--channel") as readonly ImpactChannel[] | undefined,
        taskIds: many("--task-id"),
        offset: integer("--offset", 0),
        limit: integer("--limit", 1),
      });
    case "get_target_causal_task_rollup":
      return getIndexedTargetCausalTaskRollup(
        causalExpected(expected, options),
        requiredOne(options.values, "--task-id"),
        { maxAssessments: integer("--max-assessments", 1) },
      );
    case "explain_target_causal_assessment":
      return explainIndexedTargetCausalAssessment(
        causalExpected(expected, options),
        requiredOne(options.values, "--assessment-id"),
        { maxAttachments: integer("--max-attachments", 1) },
      );
  }
}

function fieldExpected(
  expected: {
    readonly store: Neo4jQueryIndexStore;
    readonly projectKey: string;
    readonly expectedSourceDescriptorHash: string;
  },
  options: Extract<QueryIndexCliOptions, { readonly command: "query" }>,
) {
  if (!options.fieldEvidenceSnapshotId)
    throw new Error("QUERY_INDEX_FIELD_SNAPSHOT_REQUIRED");
  return {
    ...expected,
    fieldEvidenceSnapshotId: options.fieldEvidenceSnapshotId,
  };
}

function causalExpected(
  expected: {
    readonly store: Neo4jQueryIndexStore;
    readonly projectKey: string;
    readonly expectedSourceDescriptorHash: string;
  },
  options: Extract<QueryIndexCliOptions, { readonly command: "query" }>,
) {
  if (!options.targetCausalOverlaySnapshotId)
    throw new Error("QUERY_INDEX_CAUSAL_SNAPSHOT_REQUIRED");
  return {
    ...expected,
    targetCausalOverlaySnapshotId: options.targetCausalOverlaySnapshotId,
  };
}

function collectOptions(
  args: readonly string[],
  allowed: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  const values = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]!;
    if (!allowed.has(option))
      throw new Error(`QUERY_INDEX_OPTION_UNKNOWN:${option}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`QUERY_INDEX_OPTION_VALUE_MISSING:${option}`);
    index += 1;
    values.set(option, [...(values.get(option) ?? []), value]);
  }
  return values;
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
    targetCausalOverlayDirectories: (
      values.get("--causal-overlay") ?? []
    ).map((path) => absolutePath(path, "TARGET_CAUSAL_OVERLAY")),
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

function validateQueryOptions(
  query: QueryName,
  values: ReadonlyMap<string, readonly string[]>,
): void {
  const allowedValues: Readonly<Record<string, readonly string[]>> = {
    "--node-type": [
      "PROJECT_SNAPSHOT",
      "TASK",
      "PHYSICAL_DATASET",
      "BOUNDARY",
      "PROJECT_SNAPSHOT_REF",
      "TASK_REF",
      "PHYSICAL_FIELD",
      "TARGET_WRITE",
      "FIELD_BINDING_STATE",
      "EXPRESSION",
      "READ_OCCURRENCE",
      "WRITE_OBSERVATION",
      "ROWSET_CONTROL",
      "CANDIDATE",
      "GAP",
    ],
    "--edge-type": [
      "HAS_ENTRY_TASK",
      "ROOT_REACHES_TASK",
      "READS",
      "WRITES",
      "PRODUCER_BRIDGE",
      "SCHEDULE_DEPENDS_ON",
      "HAS_BOUNDARY",
      "PROJECT_HAS_FIELD_EVIDENCE",
      "TASK_HAS_TARGET_WRITE",
      "WRITE_TARGETS_DATASET",
      "TARGET_WRITE_HAS_OUTPUT",
      "TASK_HAS_STATE",
      "STATE_IDENTIFIES_FIELD",
      "DATASET_HAS_FIELD",
      "STATE_COMPUTED_BY",
      "VALUE_FLOW",
      "VALUE_FLOW_READS_AT",
      "VALUE_FLOW_WRITTEN_BY",
      "CONTROL_ANNOTATES_STATE",
      "EVIDENCE_SCOPED_TO_TASK",
      "EVIDENCE_SCOPED_TO_FIELD",
      "EVIDENCE_SCOPED_TO_STATE",
    ],
    "--relation-layer": [
      "PROJECT",
      "PROJECTION_SCOPE",
      "DATA_PRODUCTION",
      "SCHEDULE",
      "BOUNDARY",
    ],
    "--relation-status": [
      "CONFIRMED_RELATED",
      "CONDITIONAL_RELATED",
      "PROVEN_UNRELATED",
      "UNKNOWN",
    ],
    "--channel": [
      "FIELD_VALUE",
      "EXPRESSION_CONTROL",
      "ROW_MEMBERSHIP",
      "MULTIPLICITY",
      "GROUPING",
      "SET_MEMBERSHIP",
      "ORDER_SELECTION",
      "WINDOW_EFFECT",
      "RELATION_EXISTENCE",
    ],
  };
  for (const [option, allowed] of Object.entries(allowedValues))
    for (const value of values.get(option) ?? [])
      if (!allowed.includes(value))
        throw new Error(`QUERY_INDEX_OPTION_VALUE_INVALID:${option}`);
  const requiredByQuery: Partial<Record<QueryName, readonly string[]>> = {
    trace_project_upstream: ["--start-node-id"],
    explain_topology_edge: ["--edge-id"],
    get_field_evidence: ["--field-snapshot"],
    trace_field_value_path: ["--field-snapshot"],
    explain_field_evidence_record: ["--field-snapshot", "--record-id"],
    get_target_causal_overlay: ["--causal-snapshot"],
    get_target_causal_task_rollup: ["--causal-snapshot", "--task-id"],
    explain_target_causal_assessment: [
      "--causal-snapshot",
      "--assessment-id",
    ],
  };
  for (const option of requiredByQuery[query] ?? [])
    requiredOne(values, option);
  if (
    query === "trace_field_value_path" &&
    (optionalOne(values, "--root-field") === undefined) ===
      (optionalOne(values, "--start-state-id") === undefined)
  )
    throw new Error("QUERY_INDEX_FIELD_TRACE_START_REQUIRED_EXACTLY_ONE");
  for (const [option, minimum, maximum] of [
    ["--offset", 0, Number.MAX_SAFE_INTEGER],
    [
      "--limit",
      1,
      query === "get_project_topology" ? 5_000 : Number.MAX_SAFE_INTEGER,
    ],
    [
      "--max-hops",
      query === "trace_project_upstream" ? 0 : 1,
      query === "trace_project_upstream" ? 100 : Number.MAX_SAFE_INTEGER,
    ],
    [
      "--max-nodes",
      1,
      query === "trace_project_upstream" ? 100_000 : Number.MAX_SAFE_INTEGER,
    ],
    [
      "--max-edges",
      1,
      query === "trace_project_upstream" ? 250_000 : Number.MAX_SAFE_INTEGER,
    ],
    [
      "--max-paths",
      1,
      query === "trace_project_upstream" ? 1_000_000 : Number.MAX_SAFE_INTEGER,
    ],
    ["--max-attachments", 1, Number.MAX_SAFE_INTEGER],
    ["--max-assessments", 1, Number.MAX_SAFE_INTEGER],
  ] as const)
    optionalInteger(values, option, minimum, maximum);
}

function requiredOne(
  values: ReadonlyMap<string, readonly string[]>,
  option: string,
): string {
  const value = optionalOne(values, option);
  if (value === undefined)
    throw new Error(`QUERY_INDEX_OPTION_REQUIRED:${option}`);
  return value;
}

function optionalOne(
  values: ReadonlyMap<string, readonly string[]>,
  option: string,
): string | undefined {
  const found = values.get(option);
  if (found === undefined) return undefined;
  if (found.length !== 1)
    throw new Error(`QUERY_INDEX_OPTION_DUPLICATE:${option}`);
  return found[0];
}

function integerOption(
  values: ReadonlyMap<string, readonly string[]>,
  option: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return optionalInteger(values, option, minimum, maximum) ?? fallback;
}

function optionalInteger(
  values: ReadonlyMap<string, readonly string[]>,
  option: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = optionalOne(values, option);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`QUERY_INDEX_OPTION_INTEGER_INVALID:${option}`);
  return parsed;
}

function absolutePath(value: string, label: string): string {
  if (!isAbsolute(value))
    throw new Error(`QUERY_INDEX_${label}_PATH_NOT_ABSOLUTE`);
  return resolve(value);
}

function writeJson(write: (text: string) => void, value: unknown): void {
  write(`${JSON.stringify(value)}\n`);
}

const QUERY_OPTIONS_BY_NAME = new Set<QueryName>([
  "get_project_topology",
  "trace_project_upstream",
  "explain_topology_edge",
  "get_field_evidence",
  "trace_field_value_path",
  "explain_field_evidence_record",
  "get_target_causal_overlay",
  "get_target_causal_task_rollup",
  "explain_target_causal_assessment",
]);

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
