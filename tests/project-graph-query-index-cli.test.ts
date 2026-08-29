import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  parseQueryIndexCli,
  runQueryIndexCli,
} from "../scripts/project-graph/query-index/query-index-cli.ts";

const CONNECTION = [
  "--neo4j-uri",
  "neo4j://localhost:7687",
  "--neo4j-username",
  "neo4j",
  "--neo4j-database",
  "query-index",
  "--password-env",
  "QUERY_INDEX_TEST_SECRET",
] as const;

describe("query-index CLI safety", () => {
  it("prints help without loading a source or opening Neo4j", async () => {
    const openConnection = vi.fn();
    const output: string[] = [];
    await runQueryIndexCli(["--help"], {
      openConnection,
      write: (text) => output.push(text),
    });
    expect(openConnection).not.toHaveBeenCalled();
    expect(output.join("")).toContain("query-index build");
    expect(output.join("")).toContain("Direct --password values are forbidden");
  });

  it("rejects direct passwords, unknown options and invalid query limits before opening a driver", async () => {
    expect(() =>
      parseQueryIndexCli([
        "status",
        "--project-key",
        "project-a",
        "--password",
        "secret",
        ...CONNECTION.slice(0, 6),
      ]),
    ).toThrow("QUERY_INDEX_DIRECT_PASSWORD_FORBIDDEN");
    expect(() =>
      parseQueryIndexCli([
        "query",
        "--project-key",
        "project-a",
        "--expected-descriptor-hash",
        "a".repeat(64),
        "--query",
        "get_project_topology",
        "--limit",
        "5001",
        ...CONNECTION,
      ]),
    ).toThrow("QUERY_INDEX_OPTION_INTEGER_INVALID:--limit");
    expect(() =>
      parseQueryIndexCli(["status", "--unknown", "value", ...CONNECTION]),
    ).toThrow("QUERY_INDEX_OPTION_UNKNOWN:--unknown");
  });

  it("validates absolute source directories before driver initialization", async () => {
    const openConnection = vi.fn();
    await expect(
      runQueryIndexCli(
        [
          "parity",
          "--topology",
          "C:\\query-index-does-not-exist",
          ...CONNECTION,
        ],
        { openConnection },
      ),
    ).rejects.toThrow("QUERY_INDEX_SOURCE_DIRECTORY_INVALID");
    expect(openConnection).not.toHaveBeenCalled();
  });

  it("keeps normal pipeline, Phase 1/2 publication and file-query modules free of Neo4j initialization", () => {
    const paths = [
      "scripts/pipeline/lineage-all.ts",
      "scripts/project-graph/topology/project-topology-publication.ts",
      "scripts/project-graph/query/project-topology-query.ts",
      "scripts/project-graph/field-evidence/field-evidence-publication.ts",
      "scripts/project-graph/field-evidence/field-evidence-query.ts",
    ];
    for (const path of paths) {
      const source = readFileSync(
        join(process.cwd(), path),
        "utf8",
      ).toLowerCase();
      expect(source).not.toContain("neo4j-driver");
      expect(source).not.toContain("neo4jqueryindexstore");
      expect(source).not.toContain("openneo4jqueryindexdriver");
    }
  });
});
