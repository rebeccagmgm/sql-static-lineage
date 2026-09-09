import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
// The inventory map already owns the DDL tokeniser used for complex column
// definitions.  Graph consumption deliberately reuses it rather than trying
// to derive comments with a second, regexp-based DDL reader.
// @ts-expect-error JavaScript module has no declaration file in this package.
import { parseDefinition } from "../../../../scripts/inventory-map/analysis-evidence.mjs";

export type MetadataStatus =
  | "AVAILABLE"
  | "ANNOTATION_NOT_RECORDED"
  | "METADATA_UNAVAILABLE"
  | "METADATA_READ_FAILED";

export interface MetadataIdentity {
  readonly platform?: string;
  readonly dataSource?: string;
  readonly qualifiedName?: string;
  readonly stableTableId?: string;
  readonly identityStatus?: string;
}

export interface MetadataSearchIdentity {
  readonly platform: string;
  readonly dataSource: string;
  readonly qualifiedName: string;
}

export interface MetadataValue {
  readonly status: MetadataStatus;
  readonly reason?: string;
  readonly description?: string;
  readonly comment?: string;
}

export interface TableMetadata {
  readonly table: MetadataValue;
  readonly field?: MetadataValue;
  readonly source?: string;
  readonly collectedAt?: string;
  readonly contentHash?: string;
  /** Input Packs are live material, while graph versions are published snapshots. */
  readonly versionRelation?: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION";
}

interface TablePack {
  readonly stableTableId: string;
  readonly platform: string;
  readonly dataSource: string;
  readonly qualifiedName: string;
  readonly description: string;
  readonly collectedAt?: string;
  readonly contentHash?: string;
  readonly evidenceProvider?: string;
  readonly directory: string;
}

interface ParsedPack {
  readonly signature: string;
  readonly pack: TablePack;
  readonly ddlDescription: string;
  readonly fields: ReadonlyMap<string, string>;
}

interface IndexedPacks {
  readonly loadedAt: number;
  readonly rootMtimeMs: number;
  readonly packs: readonly TablePack[];
  readonly invalidStableIds: ReadonlySet<string>;
}

const value = (input: unknown): string =>
  typeof input === "string" ? input.trim() : "";
const normalized = (input: unknown): string => value(input).toLowerCase();

function unavailable(reason: string, field = false): TableMetadata {
  const status: MetadataValue = { status: "METADATA_UNAVAILABLE", reason };
  return { table: status, ...(field ? { field: status } : {}) };
}

function failed(reason: string, field = false): TableMetadata {
  const status: MetadataValue = { status: "METADATA_READ_FAILED", reason };
  return { table: status, ...(field ? { field: status } : {}) };
}

/**
 * Runtime-only Table Input Pack consumer.  It never mutates graph nodes and
 * only accepts a complete physical identity; a bare qualified table name is
 * intentionally not a lookup key.
 */
export class TableMetadataResolver {
  private index: IndexedPacks | undefined;
  private indexLoading: Promise<IndexedPacks> | undefined;
  private readonly parsed = new Map<string, ParsedPack>();
  private readonly parsing = new Map<string, Promise<ParsedPack>>();

  constructor(
    private readonly tablesRoot: string,
    private readonly options: {
      readonly now?: () => number;
      readonly indexTtlMs?: number;
    } = {},
  ) {}

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private async rootMtime(): Promise<number> {
    return (await stat(this.tablesRoot)).mtimeMs;
  }

  private async loadIndex(): Promise<IndexedPacks> {
    const ttl = this.options.indexTtlMs ?? 30_000;
    if (this.index && this.now() - this.index.loadedAt < ttl) return this.index;
    if (this.indexLoading) return this.indexLoading;
    const loading = this.buildIndex();
    this.indexLoading = loading;
    try {
      return await loading;
    } finally {
      if (this.indexLoading === loading) this.indexLoading = undefined;
    }
  }

  private async buildIndex(): Promise<IndexedPacks> {
    // The search index reads every table.json. Exact lookups still stat
    // table.json/ddl.sql on every use, while the index refreshes on its TTL.
    const ttl = this.options.indexTtlMs ?? 30_000;
    let rootMtimeMs: number;
    try {
      rootMtimeMs = await this.rootMtime();
    } catch {
      throw new Error("TABLE_INPUT_PACK_ROOT_UNREADABLE");
    }
    if (
      this.index &&
      this.now() - this.index.loadedAt < ttl &&
      this.index.rootMtimeMs === rootMtimeMs
    )
      return this.index;
    const packs: TablePack[] = [];
    const invalidStableIds = new Set<string>();
    try {
      const directories: Array<{ platform: string; stableTableId: string }> =
        [];
      for (const platform of await readdir(this.tablesRoot, {
        withFileTypes: true,
      })) {
        if (!platform.isDirectory()) continue;
        const platformDirectory = join(this.tablesRoot, platform.name);
        for (const directory of await readdir(platformDirectory, {
          withFileTypes: true,
        })) {
          if (!directory.isDirectory()) continue;
          directories.push({
            platform: platform.name,
            stableTableId: directory.name,
          });
        }
      }
      // Bounded parallel reads prevent a first description search from being a
      // many-thousand-file serial walk on Windows network disks.
      for (let offset = 0; offset < directories.length; offset += 48) {
        const loaded = await Promise.all(
          directories.slice(offset, offset + 48).map(async (directory) => {
            const platformDirectory = join(this.tablesRoot, directory.platform);
            const path = join(
              platformDirectory,
              directory.stableTableId,
              "table.json",
            );
            try {
              const parsed = JSON.parse(await readFile(path, "utf8")) as Record<
                string,
                unknown
              >;
              const pack: TablePack = {
                stableTableId: value(parsed.stableTableId),
                platform: normalized(parsed.platform),
                dataSource: normalized(parsed.dataSource),
                qualifiedName: normalized(parsed.qualifiedName),
                description: value(parsed.description),
                collectedAt: value(parsed.collectedAt) || undefined,
                contentHash: value(parsed.contentHash) || undefined,
                evidenceProvider: value(parsed.evidenceProvider) || undefined,
                directory: join(platformDirectory, directory.stableTableId),
              };
              return { pack, invalidStableId: undefined };
            } catch {
              return {
                pack: undefined,
                invalidStableId: directory.stableTableId,
              };
            }
          }),
        );
        for (const item of loaded) {
          if (item.invalidStableId) {
            invalidStableIds.add(item.invalidStableId);
            continue;
          }
          const pack = item.pack!;
          if (
            !pack.stableTableId ||
            !pack.platform ||
            !pack.dataSource ||
            !pack.qualifiedName
          ) {
            invalidStableIds.add(pack.stableTableId || "UNKNOWN_TABLE_PACK");
            continue;
          }
          packs.push(pack);
        }
      }
    } catch {
      throw new Error("TABLE_INPUT_PACK_INDEX_UNREADABLE");
    }
    this.index = {
      loadedAt: this.now(),
      rootMtimeMs,
      packs,
      invalidStableIds,
    };
    return this.index;
  }

  private candidates(
    identity: MetadataIdentity,
    index: IndexedPacks,
  ): readonly TablePack[] {
    const stableTableId = value(identity.stableTableId);
    const platform = normalized(identity.platform);
    const dataSource = normalized(identity.dataSource);
    const qualifiedName = normalized(identity.qualifiedName);
    if (stableTableId) {
      return index.packs.filter(
        (pack) =>
          pack.stableTableId === stableTableId &&
          (!platform || pack.platform === platform) &&
          (!dataSource || pack.dataSource === dataSource) &&
          (!qualifiedName || pack.qualifiedName === qualifiedName),
      );
    }
    if (!platform || !dataSource || !qualifiedName) return [];
    return index.packs.filter(
      (pack) =>
        pack.platform === platform &&
        pack.dataSource === dataSource &&
        pack.qualifiedName === qualifiedName,
    );
  }

  private async parse(pack: TablePack): Promise<ParsedPack> {
    const tablePath = join(pack.directory, "table.json");
    const ddlPath = join(pack.directory, "ddl.sql");
    const [tableStat, ddlStat] = await Promise.all([
      stat(tablePath),
      stat(ddlPath),
    ]);
    const signature = `${tableStat.mtimeMs}:${tableStat.size}:${ddlStat.mtimeMs}:${ddlStat.size}`;
    const cached = this.parsed.get(pack.directory);
    if (cached?.signature === signature) return cached;
    const loading = this.parsing.get(pack.directory);
    if (loading) return loading;
    const parse = (async () => {
      const definition = parseDefinition(await readFile(ddlPath, "utf8")) as {
        parseStatus?: string;
        description?: unknown;
        fields?: Array<{ name?: unknown; comment?: unknown }>;
      };
      if (definition.parseStatus !== "PARSED")
        throw new Error("TABLE_DDL_PARSE_FAILED");
      const fields = new Map<string, string>();
      for (const field of definition.fields ?? []) {
        const name = normalized(field.name);
        if (name && !fields.has(name)) fields.set(name, value(field.comment));
      }
      const parsed = {
        signature,
        pack,
        ddlDescription: value(definition.description),
        fields,
      };
      this.parsed.set(pack.directory, parsed);
      return parsed;
    })();
    this.parsing.set(pack.directory, parse);
    try {
      return await parse;
    } finally {
      if (this.parsing.get(pack.directory) === parse)
        this.parsing.delete(pack.directory);
    }
  }

  async resolve(
    identity: MetadataIdentity | undefined,
    column?: string,
  ): Promise<TableMetadata> {
    const fieldRequested = Boolean(value(column));
    if (
      !identity ||
      (identity.identityStatus !== undefined &&
        identity.identityStatus !== "CONFIRMED")
    )
      return unavailable("PHYSICAL_IDENTITY_UNAVAILABLE", fieldRequested);
    let index: IndexedPacks;
    try {
      index = await this.loadIndex();
    } catch (error) {
      return failed(
        error instanceof Error ? error.message : "TABLE_INPUT_PACK_READ_FAILED",
        fieldRequested,
      );
    }
    const stable = value(identity.stableTableId);
    if (stable && index.invalidStableIds.has(stable))
      return failed("TABLE_PACK_JSON_INVALID", fieldRequested);
    const candidates = this.candidates(identity, index);
    if (!candidates.length)
      return unavailable(
        "TABLE_PACK_NOT_FOUND_OR_IDENTITY_INSUFFICIENT",
        fieldRequested,
      );
    if (candidates.length > 1)
      return unavailable("TABLE_PACK_IDENTITY_AMBIGUOUS", fieldRequested);
    let parsed: ParsedPack;
    try {
      parsed = await this.parse(candidates[0]!);
    } catch (error) {
      const pack = candidates[0]!;
      const table: MetadataValue = pack.description
        ? { status: "AVAILABLE", description: pack.description }
        : { status: "METADATA_READ_FAILED", reason: "TABLE_PACK_READ_FAILED" };
      const reason =
        error instanceof Error ? error.message : "TABLE_PACK_READ_FAILED";
      return {
        table,
        ...(fieldRequested
          ? { field: { status: "METADATA_READ_FAILED", reason } }
          : {}),
        source: pack.evidenceProvider ?? "Table Input Pack",
        collectedAt: pack.collectedAt,
        contentHash: pack.contentHash,
        versionRelation: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION",
      };
    }
    const description = parsed.pack.description || parsed.ddlDescription;
    const table: MetadataValue = description
      ? { status: "AVAILABLE", description }
      : {
          status: "ANNOTATION_NOT_RECORDED",
          reason: "TABLE_DESCRIPTION_NOT_RECORDED",
        };
    const field = normalized(column);
    const comment = field ? parsed.fields.get(field) : undefined;
    return {
      table,
      ...(fieldRequested
        ? {
            field: comment
              ? { status: "AVAILABLE" as const, comment }
              : {
                  status: "ANNOTATION_NOT_RECORDED" as const,
                  reason: "FIELD_COMMENT_NOT_RECORDED",
                },
          }
        : {}),
      source: parsed.pack.evidenceProvider ?? "Table Input Pack",
      collectedAt: parsed.pack.collectedAt,
      contentHash: parsed.pack.contentHash,
      versionRelation: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION",
    };
  }

  /** Only pack identities with a Chinese/table-description hit are returned. */
  async searchDescription(
    text: string,
  ): Promise<readonly MetadataSearchIdentity[]> {
    const needle = normalized(text);
    if (!needle) return [];
    let index: IndexedPacks;
    try {
      index = await this.loadIndex();
    } catch {
      // Search remains usable for technical names when optional metadata is
      // temporarily unavailable; node-level responses carry the failure state.
      return [];
    }
    return index.packs
      .filter((pack) => normalized(pack.description).includes(needle))
      .map(({ platform, dataSource, qualifiedName }) => ({
        platform,
        dataSource,
        qualifiedName,
      }))
      .sort((left, right) =>
        `${left.platform}.${left.dataSource}.${left.qualifiedName}`.localeCompare(
          `${right.platform}.${right.dataSource}.${right.qualifiedName}`,
        ),
      );
  }
}
