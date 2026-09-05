import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../src/contracts/runtime.ts";
import { parseProjectTopologyViewCli } from "../src/project-graph/project-topology-view-cli.ts";
import { buildFieldEvidenceProjection } from "../src/project-graph/field-evidence/field-evidence-projector.ts";
import { publishFieldEvidence } from "../src/project-graph/field-evidence/field-evidence-publication.ts";
import { loadFieldEvidenceSource } from "../src/project-graph/field-evidence/field-evidence-source.ts";
import { buildProjectTopology } from "../src/project-graph/topology/project-topology-projector.ts";
import { publishProjectTopology } from "../src/project-graph/topology/project-topology-publication.ts";
import { loadProjectTopologySources } from "../src/project-graph/topology/project-topology-source.ts";
import {
  summarizeFieldTrace,
  traceFieldBundle,
} from "../src/project-graph/view/field-drilldown-client.mjs";
import {
  buildProjectTopologyAcceptanceViewModel,
  publishProjectTopologyAcceptanceView,
  renderProjectTopologyAcceptanceViewHtml,
} from "../src/project-graph/view/project-topology-acceptance-view.ts";
import { projectTopologyFixturePair } from "./fixtures/project-topology/cases.ts";
import {
  FIELD_FIXTURE_TARGET,
  FIELD_FIXTURE_WRITE_ID,
  fieldLineageFixture,
} from "./fixtures/field-evidence-graph/cases.ts";

function temporaryDirectory(name: string): string {
  return mkdtempSync(join(tmpdir(), `${name}-`));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
}

function writeTaskPack(
  dataRoot: string,
  taskId: string,
  taskName: string,
  contentHash: string | null,
): void {
  const directory = join(dataRoot, "tasks", "fixture", taskId);
  mkdirSync(directory, { recursive: true });
  writeJson(join(directory, "task.json"), {
    schemaVersion: "1.0.0",
    taskId,
    taskName,
    taskType: "fixture",
    topicName: "TEST",
    contentHash,
  });
}

function fixture(): {
  readonly root: string;
  readonly snapshotDirectory: string;
  readonly dataRoot: string;
  readonly outputRoot: string;
} {
  const root = temporaryDirectory("project-topology-view");
  const sourceRoot = join(root, "sources");
  const dataRoot = join(root, "data");
  const outputRoot = join(root, "views");
  mkdirSync(sourceRoot, { recursive: true });
  const pair = projectTopologyFixturePair();
  const oneHopPath = join(sourceRoot, "one-hop.json");
  const multiHopPath = join(sourceRoot, "multi-hop.json");
  writeJson(oneHopPath, pair.oneHop);
  writeJson(multiHopPath, pair.multiHop);
  const roots = loadProjectTopologySources([
    {
      rootTaskId: "root-1",
      oneHopPath,
      multiHopPath,
    },
  ]);
  const projection = buildProjectTopology({
    projectKey: "acceptance-view-fixture",
    roots,
  });
  const published = publishProjectTopology(projection, {
    outputRoot: join(root, "topology"),
  });
  writeTaskPack(
    dataRoot,
    "root-1",
    "Root </script><script>alert(1)</script>",
    "d".repeat(64),
  );
  writeTaskPack(dataRoot, "shared-producer", "Shared producer", "e".repeat(64));
  writeTaskPack(
    dataRoot,
    "root-1-unknown-producer",
    "Unknown producer candidate",
    "f".repeat(64),
  );
  writeTaskPack(dataRoot, "root-1-schedule-only", "Schedule-only task", null);
  return { root, snapshotDirectory: published.directory, dataRoot, outputRoot };
}

function publishFullFieldFixture(setup: ReturnType<typeof fixture>): string {
  const fieldLineagePath = join(setup.root, "field-lineage.json");
  writeJson(fieldLineagePath, fieldLineageFixture());
  const source = loadFieldEvidenceSource({
    projectTopologyDirectory: setup.snapshotDirectory,
    fieldLineagePath,
    rootTaskId: "root-1",
    writeObservationId: FIELD_FIXTURE_WRITE_ID,
    target: FIELD_FIXTURE_TARGET,
    rootFields: ["delta", "gamma"],
  });
  return publishFieldEvidence(buildFieldEvidenceProjection(source), {
    outputRoot: join(setup.root, "field-evidence"),
  }).directory;
}

describe("project topology acceptance view", () => {
  it("resolves Task Pack names without changing stable Task identities", () => {
    const setup = fixture();
    const model = buildProjectTopologyAcceptanceViewModel({
      projectTopologyDirectory: setup.snapshotDirectory,
      dataRoot: setup.dataRoot,
    });

    expect(model.taskDisplayCounts).toMatchObject({
      VERIFIED: 3,
      UNVERIFIED: 1,
      MISSING: 0,
      HASH_MISMATCH: 0,
    });
    expect(model.nodes).toContainEqual(
      expect.objectContaining({
        id: "task:shared-producer",
        label: "Shared producer (shared-producer)",
        taskDisplayStatus: "VERIFIED",
      }),
    );
    expect(model.nodes.find((node) => node.id === "task:root-1")).toMatchObject(
      {
        properties: { taskId: "root-1", displayStatus: "VERIFIED" },
      },
    );
    expect(model.edges.length).toBeGreaterThan(0);
    expect(model.groups).toContainEqual(
      expect.objectContaining({ key: "root-1", roots: ["root-1"] }),
    );
  });

  it("fails closed to the Task ID when the exact Task Pack hash differs", () => {
    const setup = fixture();
    writeTaskPack(
      setup.dataRoot,
      "shared-producer",
      "Stale display name",
      "0".repeat(64),
    );

    const model = buildProjectTopologyAcceptanceViewModel({
      projectTopologyDirectory: setup.snapshotDirectory,
      dataRoot: setup.dataRoot,
    });
    const task = model.nodes.find((node) => node.id === "task:shared-producer");
    expect(task).toMatchObject({
      label: "shared-producer",
      taskDisplayStatus: "HASH_MISMATCH",
      properties: { taskName: null, displayStatus: "HASH_MISMATCH" },
    });
  });

  it("renders a searchable overlap and one-hop evidence view safely", () => {
    const setup = fixture();
    const model = buildProjectTopologyAcceptanceViewModel({
      projectTopologyDirectory: setup.snapshotDirectory,
      dataRoot: setup.dataRoot,
    });
    const html = renderProjectTopologyAcceptanceViewHtml(model);

    expect(html).toContain("共享范围");
    expect(html).toContain("边界保留各根任务的停止作用域");
    expect(html).toContain("所选节点的一跳关系");
    expect(html).toContain("数据生产");
    expect(html).toContain("Shared producer");
    expect(html).toContain('id="graph"');
    expect(html).not.toContain("</script><script>");
    const script = html.match(/<script>([\s\S]+)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(() => new Function(script!)).not.toThrow();
  });

  it("publishes an immutable view and reuses identical inputs", () => {
    const setup = fixture();
    const options = {
      projectTopologyDirectory: setup.snapshotDirectory,
      dataRoot: setup.dataRoot,
      outputRoot: setup.outputRoot,
    } as const;
    const created = publishProjectTopologyAcceptanceView(options);
    const reused = publishProjectTopologyAcceptanceView(options);

    expect(created.status).toBe("CREATED");
    expect(reused.status).toBe("REUSED");
    expect(reused.directory).toBe(created.directory);
    expect(readFileSync(created.htmlPath, "utf8")).toContain("联合拓扑验收");
    expect(created.manifest.viewId).toBe(
      `project-topology-view-${sha256(
        canonicalJson({
          viewVersion: created.manifest.viewVersion,
          snapshotId: created.manifest.snapshotId,
          modelContentHash: created.manifest.modelContentHash,
          htmlContentHash: created.manifest.files.html.sha256,
        }),
      )}`,
    );
    expect(
      JSON.parse(readFileSync(created.manifestPath, "utf8")),
    ).toMatchObject({
      artifactType: "PROJECT_TOPOLOGY_ACCEPTANCE_VIEW",
      snapshotId: created.manifest.snapshotId,
      counts: { taskLabels: { VERIFIED: 3, UNVERIFIED: 1 } },
    });
  });

  it("publishes a searchable full-field catalog and queries one local upstream graph", () => {
    const setup = fixture();
    const fieldEvidenceDirectory = publishFullFieldFixture(setup);
    const options = {
      projectTopologyDirectory: setup.snapshotDirectory,
      dataRoot: setup.dataRoot,
      outputRoot: setup.outputRoot,
      fieldEvidenceDirectories: [fieldEvidenceDirectory],
    } as const;

    const created = publishProjectTopologyAcceptanceView(options);
    const reused = publishProjectTopologyAcceptanceView(options);
    const catalog = JSON.parse(
      readFileSync(join(created.directory, "field-catalog.json"), "utf8"),
    );
    const bundlePath = join(created.directory, catalog.tasks[0].bundleFile);
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    const trace = traceFieldBundle(bundle, "delta", {
      maxHops: 25,
      maxNodes: 100,
      maxEdges: 200,
      maxPaths: 200,
    });
    const taskFlow = summarizeFieldTrace(trace);

    expect(reused.status).toBe("REUSED");
    expect(catalog).toMatchObject({
      artifactType: "PROJECT_FIELD_DRILLDOWN_CATALOG",
      totalFields: 2,
      tasks: [
        {
          taskId: "root-1",
          fields: [
            { name: "delta", stateId: expect.any(String) },
            { name: "gamma", stateId: expect.any(String) },
          ],
        },
      ],
    });
    expect(trace).toMatchObject({
      status: "ok",
      truncated: false,
      states: { length: 3 },
      valueEdges: { length: 2 },
    });
    expect(taskFlow).toMatchObject({
      targetTaskId: "root-1",
      sourceTaskIds: ["shared-producer"],
      groups: { length: 2 },
      links: [
        {
          fromTaskId: "shared-producer",
          toTaskId: "root-1",
          valueFlowCount: 1,
        },
      ],
    });
    expect(
      taskFlow.groups.find((group) => group.taskId === "root-1"),
    ).toMatchObject({
      target: true,
      stateCount: 2,
      fields: { length: 2 },
      internalValueFlowCount: 1,
    });
    expect(
      trace.annotationEdges.some(
        (edge) => edge.edgeType === "CONTROL_ANNOTATES_STATE",
      ),
    ).toBe(true);
    expect(readFileSync(created.htmlPath, "utf8")).toContain(
      "默认先看按任务折叠的上游链",
    );
    expect(readFileSync(created.htmlPath, "utf8")).toContain(
      'id="fieldTaskMode"',
    );
    expect(readFileSync(created.htmlPath, "utf8")).toContain(
      'class="panel evidence-details"',
    );
    expect(
      readFileSync(join(created.directory, "topology.html"), "utf8"),
    ).toContain("联合拓扑验收");
    expect(created.manifest.counts).toMatchObject({
      fieldTasks: 1,
      fields: 2,
    });
  });

  it("rejects duplicate field snapshots for one root task", () => {
    const setup = fixture();
    const fieldEvidenceDirectory = publishFullFieldFixture(setup);
    expect(() =>
      publishProjectTopologyAcceptanceView({
        projectTopologyDirectory: setup.snapshotDirectory,
        dataRoot: setup.dataRoot,
        outputRoot: setup.outputRoot,
        fieldEvidenceDirectories: [
          fieldEvidenceDirectory,
          fieldEvidenceDirectory,
        ],
      }),
    ).toThrow("PROJECT_FIELD_DRILLDOWN_TASK_DUPLICATE:root-1");
  });
});

describe("project topology acceptance view CLI", () => {
  it("requires explicit snapshot, Input Pack and output roots", () => {
    expect(
      parseProjectTopologyViewCli([
        "--project-topology",
        "snapshot",
        "--data-root",
        "data",
        "--output-root",
        "views",
        "--max-task-pack-bytes",
        "1024",
      ]),
    ).toMatchObject({ maxTaskPackBytes: 1024 });
    expect(
      parseProjectTopologyViewCli([
        "--project-topology",
        "snapshot",
        "--data-root",
        "data",
        "--output-root",
        "views",
        "--field-evidence",
        "field-176827",
        "--field-evidence",
        "field-181058",
        "--max-field-evidence-bytes",
        "2048",
      ]),
    ).toMatchObject({
      fieldEvidenceDirectories: [
        expect.stringContaining("field-176827"),
        expect.stringContaining("field-181058"),
      ],
      maxFieldEvidenceBytes: 2048,
    });
    expect(() =>
      parseProjectTopologyViewCli([
        "--project-topology",
        "snapshot",
        "--data-root",
        "data",
      ]),
    ).toThrow("usage: project-topology-view");
  });
});
