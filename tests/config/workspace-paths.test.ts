import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveWorkspacePaths } from "../../scripts/config/workspace-paths.ts";
import { parseInputPackMachineFactsCli } from "../../scripts/machine-facts/input-pack-machine-facts.ts";
import { fieldEvidenceQueryRoots } from "../../scripts/project-graph/field-evidence-v1/impact-query-harness.ts";

function configFixture(patch: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "lineage-paths-"));
  const configPath = join(root, "settings", "paths.json");
  mkdirSync(join(root, "settings"));
  writeFileSync(
    configPath,
    JSON.stringify({
      schemaVersion: "1.0.0",
      dataRoot: "../data",
      evidenceRoot: "../evidence",
      inputPackRoot: ".",
      factsRoot: "field-facts",
      projectionRoot: "task-projections",
      graphRoot: "artifacts/graphs",
      writerCatalogPath: "../writers/catalog.sqlite",
      activeProfile: "otc",
      profiles: { otc: { batch: "titans-otc" } },
      ...patch,
    }),
  );
  return { root, configPath };
}

describe("workspace path configuration", () => {
  it("feeds the Facts CLI and field-query roots from the same selected config", () => {
    const { root, configPath } = configFixture();
    const facts = parseInputPackMachineFactsCli([
      "--config",
      configPath,
      "--task-id",
      "101",
    ]);
    expect(facts.dataRoot).toBe(join(root, "data"));
    expect(facts.outputRoot).toBe(join(root, "data", "field-facts"));
    const paths = resolveWorkspacePaths({ configPath, env: {} });
    mkdirSync(join(paths.factsRoot, "registry", "tasks"), { recursive: true });
    mkdirSync(paths.graphOutputRoot, { recursive: true });
    writeFileSync(paths.continuationIndexPath, "{}");
    const query = fieldEvidenceQueryRoots({ configPath, env: {} });
    expect(query?.dataRoot).toBe(facts.dataRoot);
    expect(query?.factsRoot).toBe(facts.outputRoot);
    expect(query?.indexPath).toBe(paths.continuationIndexPath);
  });

  it("resolves roots from the config file and child paths from data, independently of cwd", () => {
    const { root, configPath } = configFixture();
    const paths = resolveWorkspacePaths({
      configPath,
      cwd: join(root, "elsewhere"),
      env: {},
    });
    expect(paths.dataRoot).toBe(join(root, "data"));
    expect(paths.inputPackRoot).toBe(paths.dataRoot);
    expect(paths.factsRoot).toBe(join(root, "data", "field-facts"));
    expect(paths.projectionRoot).toBe(join(root, "data", "task-projections"));
    expect(paths.evidenceRoot).toBe(join(root, "evidence"));
    expect(paths.batchManifestPath).toBe(
      join(
        root,
        "data",
        "artifacts",
        "graphs",
        "titans-otc",
        "batch-manifest.json",
      ),
    );
    expect(paths.continuationIndexPath).toBe(
      join(paths.graphOutputRoot, "union-continuation-index.json"),
    );
  });

  it("uses explicit paths before environment and config, deriving children from the selected data root", () => {
    const { root, configPath } = configFixture();
    const paths = resolveWorkspacePaths({
      configPath,
      cwd: root,
      env: {
        LINEAGE_DATA_ROOT: "env-data",
        TASK_LOCAL_GOLDEN_FACTS_ROOT: "env-facts",
      },
      overrides: { dataRoot: "cli-data", factsRoot: "cli-facts" },
    });
    expect(paths.dataRoot).toBe(join(root, "cli-data"));
    expect(paths.factsRoot).toBe(join(root, "cli-facts"));
    expect(paths.projectionRoot).toBe(
      join(root, "cli-data", "task-projections"),
    );
  });

  it("preserves legacy test and field-query environment overrides", () => {
    const { root, configPath } = configFixture();
    const paths = resolveWorkspacePaths({
      configPath,
      cwd: root,
      env: {
        TASK_LOCAL_GOLDEN_DATA_ROOT: "packs",
        TASK_LOCAL_GOLDEN_FACTS_ROOT: "facts",
        FIELD_EVIDENCE_INDEX_PATH: "index.json",
        FIELD_EVIDENCE_SCHEDULE_CACHE_ROOT: "schedule",
        WRITER_CATALOG_PATH: "writers.sqlite",
      },
    });
    expect(paths.inputPackRoot).toBe(join(root, "packs"));
    expect(paths.factsRoot).toBe(join(root, "facts"));
    expect(paths.continuationIndexPath).toBe(join(root, "index.json"));
    expect(paths.evidenceRoot).toBe(join(root, "schedule"));
    expect(paths.writerCatalogPath).toBe(join(root, "writers.sqlite"));
  });

  it("allows an explicit profile and config selected by environment", () => {
    const { root, configPath } = configFixture({
      profiles: {
        otc: { batch: "titans-otc" },
        audit: { batch: "audit", continuationIndexPath: "indexes/audit.json" },
      },
    });
    const paths = resolveWorkspacePaths({
      env: { LINEAGE_CONFIG: configPath },
      profile: "audit",
    });
    expect(paths.profile).toBe("audit");
    expect(paths.continuationIndexPath).toBe(
      join(root, "data", "indexes", "audit.json"),
    );
  });

  it("does not couple explicit input packs to the Facts and projection storage root", () => {
    const { root, configPath } = configFixture();
    const paths = resolveWorkspacePaths({
      configPath,
      cwd: root,
      env: {},
      overrides: { inputPackRoot: "packs-v2" },
    });
    expect(paths.inputPackRoot).toBe(join(root, "packs-v2"));
    expect(paths.factsRoot).toBe(join(root, "data", "field-facts"));
  });

  it.each([
    [{ schemaVersion: "99" }, /VERSION_UNSUPPORTED/],
    [{ unexpectedPath: "x" }, /UNKNOWN_KEY:unexpectedPath/],
    [{ dataRoot: " " }, /PATH_INVALID:dataRoot/],
    [{ activeProfile: "missing" }, /PROFILE_UNKNOWN/],
    [{ profiles: { otc: { batch: "../escape" } } }, /BATCH_INVALID/],
  ])("rejects invalid configuration %j", (patch, expected) => {
    const { configPath } = configFixture(patch);
    expect(() => resolveWorkspacePaths({ configPath, env: {} })).toThrow(
      expected,
    );
  });

  it("reports malformed JSON without echoing its contents", () => {
    const { configPath } = configFixture();
    writeFileSync(configPath, "{ private-value");
    expect(() => resolveWorkspacePaths({ configPath, env: {} })).toThrow(
      "WORKSPACE_CONFIG_JSON_INVALID",
    );
  });

  it("keeps the checked-in defaults under the existing data directory", () => {
    const paths = resolveWorkspacePaths({ env: {} });
    expect(paths.factsRoot).toBe(resolve(paths.dataRoot, "field-facts"));
    expect(paths.projectionRoot).toBe(
      resolve(paths.dataRoot, "task-projections"),
    );
    expect(paths.profile).toBe("titans-otc");
  });
});
