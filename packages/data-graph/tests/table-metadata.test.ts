import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TableMetadataResolver } from "../src/asset-graph/table-metadata.ts";
import { buildTableMetadataCatalog } from "../src/asset-graph/table-metadata-catalog-build.ts";
import {
  canonicalHash,
  INPUT_PACK_SCHEMA_VERSION,
} from "../../../scripts/input/shared/input-pack.ts";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const identity = {
  platform: "hive",
  dataSource: "warehouse-a",
  qualifiedName: "dm.same",
  stableTableId: "dm.same__warehouse-a",
  identityStatus: "CONFIRMED",
};

async function fixture(
  options: { description?: string; ddl?: string; second?: boolean } = {},
) {
  const root = join(tmpdir(), `table-metadata-${randomUUID()}`, "tables");
  const write = async (name: string, source: string, table = identity) => {
    const directory = join(root, table.platform, name);
    await mkdir(directory, { recursive: true });
    const document: Record<string, unknown> = {
      schemaVersion: INPUT_PACK_SCHEMA_VERSION,
      stableTableId: name,
      platform: table.platform,
      dataSource: table.dataSource,
      qualifiedName: table.qualifiedName,
      objectType: "table",
      ddlFile: {
        path: "ddl.sql",
        sha256: sha256(source),
        evidenceProvider: "local:test",
      },
      description: options.description ?? "中文表说明 & <safe>",
      collectedAt: "2026-09-09T00:00:00.000Z",
      evidenceProvider: "local:test",
    };
    document.contentHash = canonicalHash(document as never, [
      "collectedAt",
      "contentHash",
    ]);
    await writeFile(join(directory, "table.json"), JSON.stringify(document));
    await writeFile(join(directory, "ddl.sql"), source);
  };
  await write(
    identity.stableTableId,
    options.ddl ??
      "create table dm.same (amount decimal(18,2) comment '金额 <元>', plain string);",
  );
  if (options.second)
    await write(
      "dm.same__warehouse-b",
      "create table dm.same (amount string comment '不应串用');",
      {
        ...identity,
        dataSource: "warehouse-b",
        stableTableId: "dm.same__warehouse-b",
      },
    );
  const catalogRoot = join(tmpdir(), `table-metadata-catalog-${randomUUID()}`);
  await buildTableMetadataCatalog({ tablesRoot: root, catalogRoot });
  return { root, catalogRoot };
}

describe("TableMetadataResolver", () => {
  it("reads table description and complex-DLL field comments by physical identity", async () => {
    const { catalogRoot } = await fixture();
    const metadata = await new TableMetadataResolver(catalogRoot).resolve(
      identity,
      "amount",
    );
    expect(metadata).toMatchObject({
      table: { status: "AVAILABLE", description: "中文表说明 & <safe>" },
      field: { status: "AVAILABLE", comment: "金额 <元>" },
      collectedAt: "2026-09-09T00:00:00.000Z",
      versionRelation: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION",
    });
  });

  it("does not join same qualified names from another physical source", async () => {
    const { catalogRoot } = await fixture({ second: true });
    const resolver = new TableMetadataResolver(catalogRoot);
    expect((await resolver.resolve(identity, "amount")).field).toMatchObject({
      comment: "金额 <元>",
    });
    expect(
      await resolver.resolve(
        {
          platform: "hive",
          qualifiedName: "dm.same",
          identityStatus: "CONFIRMED",
        },
        "amount",
      ),
    ).toMatchObject({ table: { status: "METADATA_UNAVAILABLE" } });
  });

  it("reports missing comments and re-reads changed DDL instead of guessing", async () => {
    const { root, catalogRoot } = await fixture();
    const resolver = new TableMetadataResolver(catalogRoot);
    expect((await resolver.resolve(identity, "plain")).field).toMatchObject({
      status: "ANNOTATION_NOT_RECORDED",
    });
    const changedDdl =
      "create table dm.same (amount string comment '刷新后注释', plain string);";
    const directory = join(root, "hive", identity.stableTableId);
    const tablePath = join(directory, "table.json");
    const document = JSON.parse(await readFile(tablePath, "utf8"));
    document.ddlFile.sha256 = sha256(changedDdl);
    document.contentHash = canonicalHash(document as never, [
      "collectedAt",
      "contentHash",
    ]);
    await writeFile(tablePath, JSON.stringify(document));
    await writeFile(join(directory, "ddl.sql"), changedDdl);
    await buildTableMetadataCatalog({
      tablesRoot: root,
      catalogRoot,
      scope: {
        tables: [
          {
            platform: identity.platform,
            stableTableId: identity.stableTableId,
          },
        ],
      },
    });
    expect((await resolver.resolve(identity, "amount")).field).toMatchObject({
      comment: "刷新后注释",
    });
  });

  it("keeps table descriptions but labels unreadable field metadata explicitly", async () => {
    const { catalogRoot } = await fixture({
      ddl: "not a create table statement",
    });
    expect(
      await new TableMetadataResolver(catalogRoot).resolve(identity, "amount"),
    ).toMatchObject({
      table: { status: "AVAILABLE", description: "中文表说明 & <safe>" },
      field: { status: "METADATA_UNAVAILABLE" },
    });
  });
});
