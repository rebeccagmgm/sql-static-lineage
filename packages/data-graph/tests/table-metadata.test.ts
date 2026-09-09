import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TableMetadataResolver } from "../src/asset-graph/table-metadata.ts";

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
    await writeFile(
      join(directory, "table.json"),
      JSON.stringify({
        ...table,
        stableTableId: name,
        description: options.description ?? "中文表说明 & <safe>",
        collectedAt: "2026-09-09T00:00:00.000Z",
        contentHash: "table-content-hash",
        evidenceProvider: "local:test",
      }),
    );
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
  return root;
}

describe("TableMetadataResolver", () => {
  it("reads table description and complex-DLL field comments by physical identity", async () => {
    const root = await fixture();
    const metadata = await new TableMetadataResolver(root).resolve(
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
    const root = await fixture({ second: true });
    const resolver = new TableMetadataResolver(root);
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
    const root = await fixture();
    let clock = 0;
    const resolver = new TableMetadataResolver(root, {
      now: () => clock,
      indexTtlMs: 0,
    });
    expect((await resolver.resolve(identity, "plain")).field).toMatchObject({
      status: "ANNOTATION_NOT_RECORDED",
    });
    const ddl = join(root, "hive", identity.stableTableId, "ddl.sql");
    await writeFile(
      ddl,
      "create table dm.same (amount string comment '刷新后注释', plain string);",
    );
    clock++;
    expect((await resolver.resolve(identity, "amount")).field).toMatchObject({
      comment: "刷新后注释",
    });
  });

  it("keeps table descriptions but labels unreadable field metadata explicitly", async () => {
    const root = await fixture({ ddl: "not a create table statement" });
    expect(
      await new TableMetadataResolver(root).resolve(identity, "amount"),
    ).toMatchObject({
      table: { status: "AVAILABLE", description: "中文表说明 & <safe>" },
      field: { status: "METADATA_READ_FAILED" },
    });
  });
});
