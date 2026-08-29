import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  boundedNeo4jConnectionError,
  openNeo4jQueryIndexDriver,
  resolveNeo4jQueryIndexConnection,
} from "../scripts/project-graph/query-index/neo4j-query-index-connection.ts";

describe("query-index Neo4j connection boundary", () => {
  it("resolves secrets from an explicit environment variable without importing the driver", () => {
    const config = resolveNeo4jQueryIndexConnection(
      {
        uri: "neo4j://localhost:7687",
        username: "neo4j",
        database: "query-index",
        passwordSource: { kind: "ENVIRONMENT", variable: "TEST_NEO4J_SECRET" },
        targetAlias: "isolated-test",
      },
      { TEST_NEO4J_SECRET: "secret-value" },
    );

    expect(config.password).toBe("secret-value");
    expect(config.targetAlias).toBe("isolated-test");
  });

  it("loads the driver lazily only from the explicit open function", async () => {
    const fakeDriver = { close: vi.fn() };
    const importer = vi.fn(async () => ({
      driver: vi.fn(() => fakeDriver),
      auth: { basic: vi.fn(() => ({ scheme: "basic" })) },
    }));

    expect(importer).not.toHaveBeenCalled();
    const opened = await openNeo4jQueryIndexDriver(
      {
        uri: "neo4j://localhost:7687",
        username: "neo4j",
        database: "neo4j",
        passwordSource: { kind: "ENVIRONMENT", variable: "TEST_NEO4J_SECRET" },
      },
      {
        environment: { TEST_NEO4J_SECRET: "secret-value" },
        importer: importer as never,
      },
    );
    expect(importer).toHaveBeenCalledOnce();
    expect(opened.driver).toBe(fakeDriver);
  });

  it("accepts a bounded password file and never returns its path in an error", () => {
    const directory = mkdtempSync(join(tmpdir(), "query-index-password-"));
    mkdirSync(directory, { recursive: true });
    const path = join(directory, "neo4j.secret");
    writeFileSync(path, "file-secret\r\n", "utf8");
    expect(
      resolveNeo4jQueryIndexConnection({
        uri: "bolt+s://graph.example",
        username: "reader",
        database: "query_index",
        passwordSource: { kind: "FILE", path },
      }).password,
    ).toBe("file-secret");

    const missingPath = join(directory, "missing.secret");
    expect(() =>
      resolveNeo4jQueryIndexConnection({
        uri: "bolt://localhost",
        username: "reader",
        database: "query_index",
        passwordSource: { kind: "FILE", path: missingPath },
      }),
    ).toThrow("QUERY_INDEX_NEO4J_PASSWORD_FILE_UNREADABLE");
    try {
      resolveNeo4jQueryIndexConnection({
        uri: "bolt://localhost",
        username: "reader",
        database: "query_index",
        passwordSource: { kind: "FILE", path: missingPath },
      });
    } catch (error) {
      expect(String(error)).not.toContain(missingPath);
    }
  });

  it("bounds driver failures to a safe code", () => {
    const error = boundedNeo4jConnectionError("connect", {
      code: "Neo.ClientError.Security.Unauthorized",
      message: "secret at neo4j://private-host",
    });
    expect(error.message).toBe(
      "QUERY_INDEX_NEO4J_connect_FAILED:Neo.ClientError.Security.Unauthorized",
    );
    expect(error.message).not.toContain("private-host");
    expect(error.message).not.toContain("secret");
  });

  it("rejects credentials and nested components embedded in the URI", () => {
    for (const uri of [
      "neo4j://user:secret@localhost:7687",
      "neo4j://localhost:7687/nested",
      "neo4j://localhost:7687?token=secret",
    ])
      expect(() =>
        resolveNeo4jQueryIndexConnection(
          {
            uri,
            username: "neo4j",
            database: "neo4j",
            passwordSource: {
              kind: "ENVIRONMENT",
              variable: "TEST_NEO4J_SECRET",
            },
          },
          { TEST_NEO4J_SECRET: "secret-value" },
        ),
      ).toThrow("QUERY_INDEX_NEO4J_URI_COMPONENT_INVALID");
  });
});
