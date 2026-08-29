import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../scripts/machine-facts/machine-facts-contract.ts";
import {
  QUERY_INDEX_ALGORITHM_VERSION,
  QUERY_INDEX_SCHEMA_VERSION,
  queryIndexBuildId,
  queryIndexSourceDescriptorHash,
} from "../scripts/project-graph/query-index/query-index-contract.ts";
import { loadQueryIndexSource } from "../scripts/project-graph/query-index/query-index-source.ts";
import { buildFieldEvidenceProjection } from "../scripts/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../scripts/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../scripts/project-graph/field-evidence/field-evidence-source.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  materializeFieldEvidenceFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function temporaryDirectory(name: string): string {
  return mkdtempSync(join(tmpdir(), `${name}-`));
}

function publishedFixture(projectKey = "query-index-fixture") {
  const materialized = materializeFieldEvidenceFixture(
    temporaryDirectory("query-index-source"),
    { projectKey },
  );
  const publish = (rootFields: readonly string[]): string => {
    const source = loadFieldEvidenceSource({
      projectTopologyDirectory: materialized.projectTopologyDirectory,
      fieldLineagePath: materialized.fieldLineagePath,
      rootTaskId: "root-1",
      writeObservationId: FIELD_FIXTURE_WRITE_ID,
      target: FIELD_FIXTURE_TARGET,
      rootFields,
    });
    return publishFieldEvidence(buildFieldEvidenceProjection(source), {
      outputRoot: materialized.outputRoot,
    }).directory;
  };
  return {
    topologyDirectory: materialized.projectTopologyDirectory,
    deltaDirectory: publish(["delta"]),
    gammaDirectory: publish(["gamma"]),
  };
}

describe("project graph query-index source contract", () => {
  it("sorts explicit field sources and derives one deterministic build identity", () => {
    const fixture = publishedFixture();
    const forward = loadQueryIndexSource({
      topologyDirectory: fixture.topologyDirectory,
      fieldEvidenceDirectories: [
        fixture.deltaDirectory,
        fixture.gammaDirectory,
      ],
    });
    const reversed = loadQueryIndexSource({
      topologyDirectory: fixture.topologyDirectory,
      fieldEvidenceDirectories: [
        fixture.gammaDirectory,
        fixture.deltaDirectory,
      ],
    });

    expect(forward.descriptor).toEqual(reversed.descriptor);
    expect(forward.indexBuildId).toBe(reversed.indexBuildId);
    expect(forward.descriptor.schemaVersion).toBe(QUERY_INDEX_SCHEMA_VERSION);
    expect(forward.descriptor.algorithmVersion).toBe(
      QUERY_INDEX_ALGORITHM_VERSION,
    );
    expect(
      forward.descriptor.fieldEvidence.map((source) => source.snapshotId),
    ).toEqual(
      [
        ...forward.descriptor.fieldEvidence.map((source) => source.snapshotId),
      ].sort(),
    );
    expect(forward.descriptorHash).toBe(
      queryIndexSourceDescriptorHash(forward.descriptor),
    );
    expect(forward.indexBuildId).toBe(queryIndexBuildId(forward.descriptor));
    expect(canonicalJson(forward.descriptor)).not.toContain(
      fixture.topologyDirectory,
    );
  });

  it("changes build identity when the exact selected source set changes", () => {
    const fixture = publishedFixture();
    const deltaOnly = loadQueryIndexSource({
      topologyDirectory: fixture.topologyDirectory,
      fieldEvidenceDirectories: [fixture.deltaDirectory],
    });
    const both = loadQueryIndexSource({
      topologyDirectory: fixture.topologyDirectory,
      fieldEvidenceDirectories: [
        fixture.deltaDirectory,
        fixture.gammaDirectory,
      ],
    });

    expect(deltaOnly.descriptorHash).not.toBe(both.descriptorHash);
    expect(deltaOnly.indexBuildId).not.toBe(both.indexBuildId);
  });

  it("rejects a field snapshot from another project/topology", () => {
    const selected = publishedFixture("selected-project");
    const unrelated = publishedFixture("unrelated-project");

    expect(() =>
      loadQueryIndexSource({
        topologyDirectory: selected.topologyDirectory,
        fieldEvidenceDirectories: [unrelated.deltaDirectory],
      }),
    ).toThrow("QUERY_INDEX_FIELD_PROJECT_MISMATCH");
  });

  it("rejects exact duplicate and byte-conflicting field snapshot inputs", () => {
    const fixture = publishedFixture();
    expect(() =>
      loadQueryIndexSource({
        topologyDirectory: fixture.topologyDirectory,
        fieldEvidenceDirectories: [
          fixture.deltaDirectory,
          fixture.deltaDirectory,
        ],
      }),
    ).toThrow("QUERY_INDEX_FIELD_SOURCE_DUPLICATE");

    const conflicting = temporaryDirectory("query-index-conflict");
    cpSync(fixture.deltaDirectory, conflicting, { recursive: true });
    const manifestPath = join(conflicting, "projection-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    expect(() =>
      loadQueryIndexSource({
        topologyDirectory: fixture.topologyDirectory,
        fieldEvidenceDirectories: [fixture.deltaDirectory, conflicting],
      }),
    ).toThrow("QUERY_INDEX_FIELD_SOURCE_CONFLICT");
  });

  it("rejects a corrupt projection before deriving a build", () => {
    const fixture = publishedFixture();
    const corrupt = temporaryDirectory("query-index-corrupt");
    cpSync(fixture.deltaDirectory, corrupt, { recursive: true });
    writeFileSync(
      join(corrupt, "field-evidence.nodes.jsonl"),
      '{"corrupt":true}\n',
      "utf8",
    );

    expect(() =>
      loadQueryIndexSource({
        topologyDirectory: fixture.topologyDirectory,
        fieldEvidenceDirectories: [corrupt],
      }),
    ).toThrow("FIELD_EVIDENCE_FILE_HASH_OR_COUNT_INVALID");
  });

  it("keeps source loading isolated from acquisition and graph runtimes", () => {
    const sourceText = readFileSync(
      join(
        process.cwd(),
        "scripts/project-graph/query-index/query-index-source.ts",
      ),
      "utf8",
    );
    const forbidden = [
      "opencli",
      "schedule-evidence",
      "machine-facts-builder",
      "sql-parser",
      "/reconcile/",
      "neo4j",
      "knowledge-graph",
    ];

    for (const token of forbidden)
      expect(sourceText.toLowerCase()).not.toContain(token);
  });
});
