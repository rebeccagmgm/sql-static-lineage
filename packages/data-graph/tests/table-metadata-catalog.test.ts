import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildTableMetadataCatalog,
  type CatalogBuildOptions,
} from "../src/asset-graph/table-metadata-catalog-build.ts";
import {
  TABLE_METADATA_CATALOG_SCHEMA_VERSION,
  TableMetadataCatalog,
} from "../src/asset-graph/table-metadata-catalog.ts";
import {
  canonicalHash,
  INPUT_PACK_SCHEMA_VERSION,
} from "../../../scripts/input/shared/input-pack.ts";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const baseIdentity = {
  platform: "hive",
  dataSource: "warehouse-a",
  qualifiedName: "dm.same",
  stableTableId: "dm.same__warehouse-a",
  identityStatus: "CONFIRMED",
} as const;

function fixtureRoot() {
  const root = join(tmpdir(), `table-metadata-catalog-${randomUUID()}`);
  const tablesRoot = join(root, "input", "tables");
  const catalogRoot = join(root, "catalog");
  mkdirSync(tablesRoot, { recursive: true });
  return { root, tablesRoot, catalogRoot };
}

function writePack(
  tablesRoot: string,
  options: {
    platform?: string;
    dataSource?: string;
    qualifiedName?: string;
    stableTableId?: string;
    description?: string;
    ddl?: string;
    collectedAt?: string;
    mutateDocument?: (document: Record<string, unknown>) => void;
    mutateDdlAfterHash?: (ddl: string) => string;
  } = {},
) {
  const platform = options.platform ?? baseIdentity.platform;
  const dataSource = options.dataSource ?? baseIdentity.dataSource;
  const qualifiedName = options.qualifiedName ?? baseIdentity.qualifiedName;
  const stableTableId =
    options.stableTableId ?? `${qualifiedName}__${dataSource}`;
  const ddl =
    options.ddl ??
    "create table dm.same (amount decimal(18,2) comment '金额', plain string) comment 'DDL表说明' partitioned by (busi_date varchar(8) comment '业务日期');";
  const body: Record<string, unknown> = {
    schemaVersion: INPUT_PACK_SCHEMA_VERSION,
    stableTableId,
    platform,
    dataSource,
    qualifiedName,
    objectType: "table",
    ddlFile: {
      path: "ddl.sql",
      sha256: sha256(ddl),
      evidenceProvider: "fixture:ddl",
    },
    collectedAt: options.collectedAt ?? "2026-09-10T00:00:00.000Z",
    evidenceProvider: "fixture:table",
    ...(options.description === undefined
      ? {}
      : { description: options.description }),
  };
  body.contentHash = canonicalHash(body as never, [
    "collectedAt",
    "contentHash",
  ]);
  options.mutateDocument?.(body);
  const directory = join(tablesRoot, platform, stableTableId);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "table.json"), JSON.stringify(body), "utf8");
  writeFileSync(
    join(directory, "ddl.sql"),
    options.mutateDdlAfterHash?.(ddl) ?? ddl,
    "utf8",
  );
  return {
    directory,
    identity: { platform, dataSource, qualifiedName, stableTableId },
  };
}

async function buildAndOpen(
  tablesRoot: string,
  catalogRoot: string,
  options: Partial<CatalogBuildOptions> = {},
) {
  const report = await buildTableMetadataCatalog({
    tablesRoot,
    catalogRoot,
    now: () => "2026-09-10T01:02:03.000Z",
    ...options,
  });
  return { report, catalog: new TableMetadataCatalog(catalogRoot) };
}

describe("table metadata SQLite catalog", () => {
  it("indexes complex types, ordinals, empty comments, and partition fields", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    writePack(tablesRoot, { description: "Input Pack表说明" });
    const { report, catalog } = await buildAndOpen(tablesRoot, catalogRoot);

    expect(report).toMatchObject({
      changed: true,
      counts: { parsed: 1, failed: 0, unsupported: 0 },
    });
    expect(await catalog.resolve(baseIdentity, "amount")).toMatchObject({
      table: { status: "AVAILABLE", description: "Input Pack表说明" },
      field: {
        status: "AVAILABLE",
        name: "amount",
        ordinal: 0,
        rawType: "decimal(18,2)",
        comment: "金额",
        partition: false,
      },
      source: "fixture:table",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      ddlHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadataCatalog: {
        status: "READY",
        version: expect.any(String),
        builtAt: "2026-09-10T01:02:03.000Z",
      },
      versionRelation: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION",
    });
    expect(await catalog.resolve(baseIdentity, "plain")).toMatchObject({
      field: {
        status: "ANNOTATION_NOT_RECORDED",
        ordinal: 1,
        rawType: "string",
        partition: false,
      },
    });
    expect(await catalog.resolve(baseIdentity, "busi_date")).toMatchObject({
      field: {
        status: "AVAILABLE",
        ordinal: 2,
        rawType: "varchar(8)",
        partition: true,
      },
    });
    catalog.close();
  });

  it("never joins a same-name table from another source and reports ambiguity", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    writePack(tablesRoot);
    writePack(tablesRoot, {
      dataSource: "warehouse-b",
      stableTableId: "dm.same__warehouse-b",
      ddl: "create table dm.same (amount string comment '另一来源');",
    });
    writePack(tablesRoot, {
      stableTableId: "duplicate-pack-id",
      ddl: "create table dm.same (amount string comment '重复身份');",
    });
    const { catalog } = await buildAndOpen(tablesRoot, catalogRoot);

    expect(
      await catalog.resolve(
        { ...baseIdentity, stableTableId: undefined },
        "amount",
      ),
    ).toMatchObject({
      table: {
        status: "METADATA_UNAVAILABLE",
        reason: "TABLE_PACK_IDENTITY_AMBIGUOUS",
      },
    });
    expect(
      await catalog.resolve(
        {
          platform: "hive",
          qualifiedName: "dm.same",
          identityStatus: "CONFIRMED",
        },
        "amount",
      ),
    ).toMatchObject({
      table: {
        status: "METADATA_UNAVAILABLE",
        reason: "PHYSICAL_IDENTITY_INSUFFICIENT",
      },
    });
    expect(
      await catalog.resolve(
        {
          ...baseIdentity,
          dataSource: "warehouse-b",
          stableTableId: "dm.same__warehouse-b",
        },
        "amount",
      ),
    ).toMatchObject({ field: { comment: "另一来源" } });
    catalog.close();
  });

  it("keeps unsupported and invalid DDL explicit without inventing fields", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    const view = writePack(tablesRoot, {
      qualifiedName: "dm.a_view",
      stableTableId: "dm.a_view__warehouse-a",
      description: "视图说明",
      ddl: "create view dm.a_view as select 1 as amount;",
    });
    const invalid = writePack(tablesRoot, {
      qualifiedName: "dm.invalid",
      stableTableId: "dm.invalid__warehouse-a",
      ddl: "create table dm.invalid (broken string comment 'unterminated);",
    });
    const { report, catalog } = await buildAndOpen(tablesRoot, catalogRoot);

    expect(report.counts).toMatchObject({ unsupported: 1, failed: 1 });
    expect(
      await catalog.resolve(
        { ...view.identity, identityStatus: "CONFIRMED" },
        "amount",
      ),
    ).toMatchObject({
      table: { status: "AVAILABLE", description: "视图说明" },
      field: {
        status: "METADATA_UNAVAILABLE",
        reason: "TABLE_DDL_UNSUPPORTED",
      },
      parseStatus: "UNSUPPORTED",
    });
    expect(
      await catalog.resolve(
        { ...invalid.identity, identityStatus: "CONFIRMED" },
        "amount",
      ),
    ).toMatchObject({
      field: {
        status: "METADATA_READ_FAILED",
        reason: "TABLE_DDL_INVALID",
      },
      parseStatus: "INVALID",
    });
    catalog.close();
  });

  it("rejects source hash mismatches instead of importing them as success", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    writePack(tablesRoot, {
      mutateDdlAfterHash: (ddl) => `${ddl}\n-- changed after manifest`,
    });
    const { report, catalog } = await buildAndOpen(tablesRoot, catalogRoot);

    expect(report.counts).toMatchObject({ parsed: 0, failed: 1 });
    expect(await catalog.resolve(baseIdentity, "amount")).toMatchObject({
      table: {
        status: "METADATA_READ_FAILED",
        reason: "TABLE_DDL_HASH_MISMATCH",
      },
    });
    catalog.close();
  });

  it("handles updates, deletions, scoped refreshes, and idempotent reruns", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    const first = writePack(tablesRoot);
    const outside = writePack(tablesRoot, {
      platform: "oracle",
      dataSource: "trade-db",
      qualifiedName: "trade.orders",
      stableTableId: "trade.orders__trade-db",
      ddl: "create table trade.orders (id number comment '编号');",
    });
    const initial = await buildTableMetadataCatalog({
      tablesRoot,
      catalogRoot,
    });
    const same = await buildTableMetadataCatalog({ tablesRoot, catalogRoot });
    expect(same).toMatchObject({ changed: false, version: initial.version });

    writePack(tablesRoot, {
      ddl: "create table dm.same (amount string comment '更新后');",
    });
    const updated = await buildTableMetadataCatalog({
      tablesRoot,
      catalogRoot,
      scope: {
        tables: [
          { platform: "hive", stableTableId: first.identity.stableTableId },
        ],
      },
    });
    expect(updated.changed).toBe(true);
    const catalog = new TableMetadataCatalog(catalogRoot);
    expect(await catalog.resolve(baseIdentity, "amount")).toMatchObject({
      field: { comment: "更新后" },
    });
    expect(
      await catalog.resolve(
        { ...outside.identity, identityStatus: "CONFIRMED" },
        "id",
      ),
    ).toMatchObject({ field: { comment: "编号" } });
    catalog.close();

    const tableJson = join(first.directory, "table.json");
    const tableDocument = JSON.parse(readFileSync(tableJson, "utf8"));
    writeFileSync(tableJson, "{}", "utf8");
    const deleted = await buildTableMetadataCatalog({
      tablesRoot,
      catalogRoot,
      scope: {
        tables: [
          { platform: "hive", stableTableId: first.identity.stableTableId },
        ],
      },
    });
    expect(deleted.counts.failed).toBeGreaterThanOrEqual(1);
    const afterDelete = new TableMetadataCatalog(catalogRoot);
    expect(await afterDelete.resolve(baseIdentity, "amount")).toMatchObject({
      table: { status: "METADATA_READ_FAILED" },
    });
    expect(
      await afterDelete.resolve(
        { ...outside.identity, identityStatus: "CONFIRMED" },
        "id",
      ),
    ).toMatchObject({ field: { comment: "编号" } });
    afterDelete.close();
    writeFileSync(tableJson, JSON.stringify(tableDocument), "utf8");
    buildTableMetadataCatalog({
      tablesRoot,
      catalogRoot,
      scope: {
        tables: [
          { platform: "hive", stableTableId: first.identity.stableTableId },
        ],
      },
    });
    rmSync(first.directory, { recursive: true, force: true });
    const removed = buildTableMetadataCatalog({
      tablesRoot,
      catalogRoot,
      scope: {
        tables: [
          { platform: "hive", stableTableId: first.identity.stableTableId },
        ],
      },
    });
    expect(removed.counts.deleted).toBe(1);
    const afterRemoval = new TableMetadataCatalog(catalogRoot);
    expect(await afterRemoval.resolve(baseIdentity, "amount")).toMatchObject({
      table: { status: "METADATA_UNAVAILABLE", reason: "TABLE_PACK_NOT_FOUND" },
    });
    expect(
      await afterRemoval.resolve(
        { ...outside.identity, identityStatus: "CONFIRMED" },
        "id",
      ),
    ).toMatchObject({ field: { comment: "编号" } });
    afterRemoval.close();
  });

  it("does not expose a staged catalog when activation is interrupted", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    writePack(tablesRoot);
    const initial = await buildTableMetadataCatalog({
      tablesRoot,
      catalogRoot,
    });
    writePack(tablesRoot, {
      ddl: "create table dm.same (amount string comment '不得暴露');",
    });
    expect(() =>
      buildTableMetadataCatalog({
        tablesRoot,
        catalogRoot,
        beforeActivate: () => {
          throw new Error("SIMULATED_IMPORT_INTERRUPTION");
        },
      }),
    ).toThrow("SIMULATED_IMPORT_INTERRUPTION");

    const manifest = JSON.parse(
      readFileSync(join(catalogRoot, "current.json"), "utf8"),
    );
    expect(manifest.version).toBe(initial.version);
    expect(
      readdirSync(catalogRoot).filter(
        (name) => name.endsWith(".sqlite") || name.startsWith(".current-"),
      ),
    ).toEqual([initial.file]);
    const catalog = new TableMetadataCatalog(catalogRoot);
    expect(await catalog.resolve(baseIdentity, "amount")).toMatchObject({
      field: { comment: "金额" },
    });
    catalog.close();
  });

  it("keeps graph enrichment callable when the catalog is missing or incompatible", async () => {
    const { catalogRoot } = fixtureRoot();
    const missing = new TableMetadataCatalog(catalogRoot);
    expect(await missing.resolve(baseIdentity, "amount")).toMatchObject({
      table: {
        status: "METADATA_UNAVAILABLE",
        reason: "METADATA_CATALOG_MISSING",
      },
      metadataCatalog: { status: "MISSING" },
    });

    mkdirSync(catalogRoot, { recursive: true });
    writeFileSync(
      join(catalogRoot, "current.json"),
      JSON.stringify({
        schemaVersion: "999.0.0",
        version: "bad",
        file: "bad.sqlite",
      }),
      "utf8",
    );
    const incompatible = new TableMetadataCatalog(catalogRoot);
    expect(await incompatible.resolve(baseIdentity)).toMatchObject({
      table: {
        status: "METADATA_UNAVAILABLE",
        reason: "METADATA_CATALOG_VERSION_UNSUPPORTED",
      },
      metadataCatalog: { status: "INCOMPATIBLE" },
    });
    incompatible.close();

    writeFileSync(
      join(catalogRoot, "current.json"),
      JSON.stringify({
        schemaVersion: TABLE_METADATA_CATALOG_SCHEMA_VERSION,
        version: "missing-file",
        file: "missing.sqlite",
        builtAt: "2026-09-10T00:00:00.000Z",
        parserVersion: "test",
        catalogHash: "missing-file",
      }),
      "utf8",
    );
    const unreadable = new TableMetadataCatalog(catalogRoot);
    expect(await unreadable.resolve(baseIdentity)).toMatchObject({
      table: {
        status: "METADATA_UNAVAILABLE",
        reason: "METADATA_CATALOG_UNREADABLE",
      },
      metadataCatalog: { status: "UNREADABLE" },
    });
    unreadable.close();
  });

  it("supports bounded description search and batched identity lookup", async () => {
    const { tablesRoot, catalogRoot } = fixtureRoot();
    writePack(tablesRoot, { description: "共同说明甲" });
    const second = writePack(tablesRoot, {
      dataSource: "warehouse-b",
      stableTableId: "dm.same__warehouse-b",
      description: "共同说明乙",
      ddl: "create table dm.same (amount string);",
    });
    const { catalog } = await buildAndOpen(tablesRoot, catalogRoot);

    expect(
      await catalog.searchDescription("共同", { limit: 1, offset: 1 }),
    ).toEqual([
      {
        platform: second.identity.platform,
        dataSource: second.identity.dataSource,
        qualifiedName: second.identity.qualifiedName,
      },
    ]);
    const values = await catalog.resolveMany([
      { identity: baseIdentity, column: "amount" },
      {
        identity: { ...second.identity, identityStatus: "CONFIRMED" },
        column: "amount",
      },
    ]);
    expect(values).toHaveLength(2);
    expect(values[0]?.field?.comment).toBe("金额");
    expect(values[1]?.field?.rawType).toBe("string");
    catalog.close();
  });
});
