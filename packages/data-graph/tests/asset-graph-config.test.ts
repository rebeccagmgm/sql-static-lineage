import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetGraphConfig } from "../src/asset-graph/config.ts";

function fixture(database: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), "asset-store-config-"));
  const configPath = join(root, "workspace.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      schemaVersion: "1.0.0",
      dataRoot: ".",
      evidenceRoot: ".",
      inputPackRoot: ".",
      factsRoot: "facts",
      projectionRoot: "projections",
      graphRoot: "graphs",
      writerCatalogPath: "writers.sqlite",
      activeProfile: "test",
      profiles: { test: { batch: "test" } },
      ...database,
    }),
  );
  return { root, configPath };
}
const arcade = {
  provider: "arcadedb",
  uri: "bolt://127.0.0.1:17688",
  username: "root",
  database: "lineage",
  graphId: "test",
  passwordFile: "secrets/password.txt",
  passwordFileEnv: "ARCADEDB_PASSWORD_FILE",
};

describe("asset graph database configuration", () => {
  it("resolves an ArcadeDB credential file relative to the config, without reading it", () => {
    const { root, configPath } = fixture({ graphDatabase: arcade });
    const config = assetGraphConfig(configPath, {});
    expect(config.provider).toBe("arcadedb");
    expect(config.connection.database).toBe("lineage");
    expect(config.connection.passwordSource).toEqual({
      kind: "FILE",
      path: join(root, "secrets/password.txt"),
    });
  });
  it("honors an explicit password-file environment override", () => {
    const { configPath } = fixture({ graphDatabase: arcade });
    const config = assetGraphConfig(configPath, {
      ARCADEDB_PASSWORD_FILE: "/override/password",
    });
    expect(config.connection.passwordSource.path).toBe("/override/password");
  });
  it("retains explicit legacy Neo4j configurations", () => {
    const { configPath } = fixture({
      neo4j: {
        ...arcade,
        provider: undefined,
        passwordFile: undefined,
        passwordFileEnv: "NEO4J_PASSWORD_FILE",
      },
    });
    const config = assetGraphConfig(configPath, {
      NEO4J_PASSWORD_FILE: "/legacy/password",
    });
    expect(config.provider).toBe("neo4j");
    expect(config.connection.passwordSource.path).toBe("/legacy/password");
  });
  it.each([
    null,
    { ...arcade, provider: "unknown" },
    { ...arcade, provider: undefined },
  ])(
    "does not fall back to Neo4j for invalid graphDatabase config %j",
    (graphDatabase) => {
      const { configPath } = fixture({ graphDatabase, neo4j: arcade });
      expect(() => assetGraphConfig(configPath, {})).toThrow(
        /GRAPH_DATABASE_CONFIG_INVALID|GRAPH_DATABASE_PROVIDER_UNSUPPORTED/,
      );
    },
  );
  it("fails closed when no credential source is configured", () => {
    const { configPath } = fixture({
      graphDatabase: { ...arcade, passwordFile: undefined },
    });
    expect(() => assetGraphConfig(configPath, {})).toThrow(
      "GRAPH_DATABASE_PASSWORD_FILE_MISSING",
    );
  });
});
