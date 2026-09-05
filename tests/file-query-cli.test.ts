import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("neo4j-driver", () => {
  throw new Error("File queries must not load the Neo4j driver");
});

import { runFileQueryCli } from "../src/project-graph/query/file-query-cli.ts";
import {
  getProjectTopology,
  traceProjectUpstream,
  explainTopologyEdge,
} from "../src/project-graph/query/project-topology-query.ts";
import { materializeFieldEvidenceFixture } from "./fixtures/field-evidence-graph/cases.ts";
import { projectTopologyFixturePair } from "./fixtures/project-topology/cases.ts";

const root = mkdtempSync(join(tmpdir(), "file-query-cli-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

async function query(args: readonly string[]) {
  let output = "";
  await runFileQueryCli(args, {
    write: (text) => {
      output += text;
    },
  });
  return JSON.parse(output);
}

describe("file query CLI", () => {
  it("uses the existing file queries, preserving partial evidence, filters and traversal limits", async () => {
    const { projectTopologyDirectory: directory } =
      materializeFieldEvidenceFixture(join(root, "partial"), {
        topology: projectTopologyFixturePair({ partial: true }),
      });
    expect(
      await query([
        "--directory",
        directory,
        "--query",
        "get_project_topology",
        "--node-type",
        "TASK",
        "--limit",
        "1",
      ]),
    ).toEqual(getProjectTopology(directory, { nodeTypes: ["TASK"], limit: 1 }));
    const edge = getProjectTopology(directory).result.edges[0]!;
    expect(
      await query([
        "--directory",
        directory,
        "--query",
        "trace_project_upstream",
        "--start-node-id",
        edge.fromNodeId,
        "--max-hops",
        "0",
      ]),
    ).toEqual(
      traceProjectUpstream(directory, {
        startNodeId: edge.fromNodeId,
        maxHops: 0,
      }),
    );
    expect(
      await query([
        "--directory",
        directory,
        "--query",
        "explain_topology_edge",
        "--edge-id",
        edge.edgeId,
      ]),
    ).toEqual(explainTopologyEdge(directory, edge.edgeId));
  });

  it("validates query names, required arguments and limits before reading files", async () => {
    for (const [args, error] of [
      [["--query", "unknown"], "QUERY_INDEX_QUERY_UNKNOWN"],
      [
        ["--query", "trace_project_upstream"],
        "QUERY_INDEX_OPTION_REQUIRED:--start-node-id",
      ],
      [
        ["--query", "get_project_topology", "--limit", "5001"],
        "QUERY_INDEX_OPTION_INTEGER_INVALID:--limit",
      ],
      [
        [
          "--query",
          "trace_field_value_path",
          "--root-field",
          "x",
          "--start-state-id",
          "y",
        ],
        "QUERY_INDEX_FIELD_TRACE_START_REQUIRED_EXACTLY_ONE",
      ],
      [
        ["--query", "get_project_topology", "--neo4j-uri", "unused"],
        "QUERY_INDEX_OPTION_UNKNOWN:--neo4j-uri",
      ],
    ] as const) {
      await expect(
        query(["--directory", join(root, "missing"), ...args]),
      ).rejects.toThrow(error);
    }
  });

  it("retains publication integrity checks and does not emit a result on corrupt input", async () => {
    const { projectTopologyDirectory: directory } =
      materializeFieldEvidenceFixture(join(root, "corrupt"));
    writeFileSync(join(directory, "topology.nodes.jsonl"), "{}\n");
    const write = vi.fn();
    await expect(
      runFileQueryCli(
        ["--directory", directory, "--query", "get_project_topology"],
        { write },
      ),
    ).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
});
