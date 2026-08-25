import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

import {
  loadTableProducerIndex,
  type ProducerTableIdentity,
  type ProducerWriteObservation,
  type TableProducerIndex,
} from "../reconcile/producer/producer-index.ts";

export type PartitionQuery = Readonly<Record<string, string>>;

export interface ProducerTableQuery {
  readonly platform?: string;
  readonly dataSource?: string;
  readonly qualifiedName: string;
}

export interface ProducerIndexPartitionQueryOptions {
  readonly table: ProducerTableQuery;
  readonly partition?: PartitionQuery;
}

export interface ProducerIndexPartitionMatch {
  readonly taskId: string;
  readonly taskCategory: string;
  readonly table: ProducerTableIdentity;
  readonly writes: readonly ProducerWriteObservation[];
}

interface ProducerIndexPartitionMatchOutput {
  readonly taskId: string;
  readonly taskCategory: string;
  readonly table: ProducerTableIdentity;
  readonly writes: readonly {
    readonly observationKind: ProducerWriteObservation["observationKind"];
    readonly sqlWriteKind: ProducerWriteObservation["sqlWriteKind"];
    readonly partition: ProducerWriteObservation["partition"];
    readonly partitionStatus: ProducerWriteObservation["partitionStatus"];
    readonly operationClass: ProducerWriteObservation["operationClass"];
    readonly dataPathRole: ProducerWriteObservation["dataPathRole"];
  }[];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function isDateTemplate(value: string): boolean {
  return value === "${YYYY-MM-DD}";
}

function tableIdentityKey(table: ProducerTableIdentity): string {
  return [table.platform, table.dataSource, table.qualifiedName]
    .map((value) => String(value).trim().toLowerCase().replaceAll("`", ""))
    .join("\u0000");
}

function normalizeTableQuery(table: ProducerTableQuery): ProducerTableQuery {
  return {
    qualifiedName: table.qualifiedName.trim().toLowerCase().replaceAll("`", ""),
    ...(table.platform === undefined
      ? {}
      : { platform: table.platform.trim().toLowerCase() }),
    ...(table.dataSource === undefined
      ? {}
      : { dataSource: table.dataSource.trim().toLowerCase() }),
  };
}

function resolveTableCandidates(
  index: TableProducerIndex,
  tableQuery: ProducerTableQuery,
): readonly ProducerTableIdentity[] {
  const query = normalizeTableQuery(tableQuery);
  const candidates = index.confirmedProducerEdges
    .map((edge) => edge.table)
    .filter(
      (table) =>
        table.qualifiedName.toLowerCase() === query.qualifiedName &&
        (query.platform === undefined ||
          table.platform.toLowerCase() === query.platform) &&
        (query.dataSource === undefined ||
          table.dataSource.toLowerCase() === query.dataSource),
    )
    .filter(
      (table, index, all) =>
        all.findIndex(
          (candidate) =>
            tableIdentityKey(candidate) === tableIdentityKey(table),
        ) === index,
    )
    .map((table) => ({
      platform: table.platform,
      dataSource: table.dataSource,
      qualifiedName: table.qualifiedName,
    }));
  return candidates;
}

function valueMatches(
  assignment: ProducerWriteObservation["partition"][number],
  wanted: string,
): boolean {
  const queryValue = wanted.trim();
  if (queryValue === "*") return true;

  const observedValue = assignment.observedValue;
  const expression = assignment.expression.trim();
  if (observedValue === "*" || expression === "*") return true;

  if (isDateTemplate(expression) && isIsoDate(queryValue)) return true;
  if (isDateTemplate(queryValue) && isDateTemplate(expression)) return true;

  if (observedValue !== null)
    return String(observedValue).trim() === queryValue;

  return expression === queryValue;
}

function partitionMatches(
  assignments: ProducerWriteObservation["partition"],
  partition: PartitionQuery | undefined,
): boolean {
  if (partition === undefined) return true;
  const byField = new Map(
    assignments.map((assignment) => [
      assignment.field.toLowerCase(),
      assignment,
    ]),
  );
  return Object.entries(partition).every(([field, wanted]) => {
    const assignment = byField.get(field.toLowerCase());
    return assignment !== undefined && valueMatches(assignment, String(wanted));
  });
}

export function lookupProducersByTablePartition(
  index: TableProducerIndex,
  options: ProducerIndexPartitionQueryOptions,
): readonly ProducerIndexPartitionMatch[] {
  const matches: ProducerIndexPartitionMatch[] = [];
  const candidates = resolveTableCandidates(index, options.table);
  if (candidates.length === 0) return matches;
  for (const edge of index.confirmedProducerEdges) {
    if (
      !candidates.some(
        (candidate) =>
          tableIdentityKey(edge.table) === tableIdentityKey(candidate),
      )
    )
      continue;
    const writes = edge.writes.filter((write) =>
      partitionMatches(write.partition, options.partition),
    );
    if (writes.length === 0) continue;
    matches.push({
      taskId: edge.taskId,
      taskCategory: edge.taskCategory,
      table: {
        platform: edge.table.platform,
        dataSource: edge.table.dataSource,
        qualifiedName: edge.table.qualifiedName,
      },
      writes,
    });
  }
  return matches;
}

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredOption(args: readonly string[], name: string): string {
  const value = option(args, name);
  if (!value) throw new Error(`missing required option ${name}`);
  return value;
}

function parsePartition(value: string): PartitionQuery {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("partition must not be empty");

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("partition JSON must be an object");
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([field, item]) => [
        field,
        String(item),
      ]),
    );
  }

  const entries = trimmed.split(",").map((item) => item.trim());
  const partition: Record<string, string> = {};
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator <= 0)
      throw new Error(`invalid partition entry ${entry}; expected field=value`);
    const field = entry.slice(0, separator).trim();
    const fieldValue = entry.slice(separator + 1).trim();
    if (!field || !fieldValue)
      throw new Error(`invalid partition entry ${entry}`);
    partition[field] = fieldValue;
  }
  return partition;
}

function main(): void {
  const args = process.argv.slice(2);
  const indexPath = requiredOption(args, "--index");
  const partitionValue = option(args, "--partition");
  const index = loadTableProducerIndex(
    isAbsolute(indexPath) ? indexPath : resolve(indexPath),
  );
  const options: ProducerIndexPartitionQueryOptions = {
    table: {
      qualifiedName: requiredOption(args, "--table"),
      ...(option(args, "--platform") === undefined
        ? {}
        : { platform: option(args, "--platform") }),
      ...(option(args, "--data-source") === undefined
        ? {}
        : { dataSource: option(args, "--data-source") }),
    },
    ...(partitionValue === undefined
      ? {}
      : { partition: parsePartition(partitionValue) }),
  };
  const matches = lookupProducersByTablePartition(index, options);
  const output: ProducerIndexPartitionMatchOutput[] = matches.map((match) => ({
    taskId: match.taskId,
    taskCategory: match.taskCategory,
    table: match.table,
    writes: match.writes.map((write) => ({
      observationKind: write.observationKind,
      sqlWriteKind: write.sqlWriteKind,
      partition: write.partition,
      partitionStatus: write.partitionStatus,
      operationClass: write.operationClass,
      dataPathRole: write.dataPathRole,
    })),
  }));
  process.stdout.write(
    `${JSON.stringify(
      {
        indexContentHash: index.contentHash,
        table: options.table,
        ...(options.partition === undefined
          ? {}
          : { partition: options.partition }),
        matchCount: matches.length,
        tasks: output,
      },
      null,
      2,
    )}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
)
  main();
