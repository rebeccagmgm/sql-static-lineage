import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadTaskKnowledge,
  resolveKnowledgeDataRoot,
  verifyTaskKnowledge,
} from "../../scripts/knowledge/task-knowledge.mjs";

const taskId = "107491";
const markdown =
  "# Date expansion\n\nThe task expands dates for the contract.\n";
const sql = "select trade_date from source_table;\n";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function writeFixture(
  root: string,
  options: {
    evidence?: object;
    taskId?: string;
    markdown?: string;
    observations?: object[];
    evidenceKind?: string;
  } = {},
): Promise<void> {
  const tasksDir = join(root, "knowledge", "tasks");
  const evidenceDir = join(root, "evidence");
  await mkdir(tasksDir, { recursive: true });
  await mkdir(evidenceDir, { recursive: true });

  const authoredTaskId = options.taskId ?? taskId;
  const knowledge = {
    schemaVersion: 1,
    taskId: authoredTaskId,
    title: "Contract date expansion",
    summary: "Expands dates for the contract.",
    boundary: "Covers the task SQL and its authored evidence binding.",
    tags: { topics: ["contract"], duties: ["date_expansion"] },
    review: {
      origin: "agent_curated",
      status: "sql_reviewed_business_unconfirmed",
    },
    evidence: {
      path: `evidence/${taskId}.json`,
      querySha256: sha256(sql),
      slot: "query",
      ...(options.evidenceKind ? { kind: options.evidenceKind } : {}),
    },
    observations: options.observations ?? [],
  };

  await writeFile(
    join(tasksDir, `${authoredTaskId}.json`),
    `${JSON.stringify(knowledge, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(tasksDir, `${authoredTaskId}.md`),
    options.markdown ?? markdown,
    "utf8",
  );
  if (options.evidence) {
    await writeFile(
      join(root, "evidence", `${taskId}.json`),
      `${JSON.stringify(options.evidence, null, 2)}\n`,
      "utf8",
    );
  }
}

describe("task knowledge reader", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "task-knowledge-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("resolves dataRoot relative to its config file rather than the working directory", async () => {
    const configDir = join(root, "config");
    await mkdir(configDir, { recursive: true });
    const configPath = join(configDir, "workspace-paths.json");
    await writeFile(configPath, JSON.stringify({ dataRoot: "../shared-data" }));
    expect(await resolveKnowledgeDataRoot(configPath)).toBe(
      join(root, "shared-data"),
    );
  });

  it("rejects a workspace config without dataRoot", async () => {
    const configPath = join(root, "workspace-paths.json");
    await writeFile(configPath, "{}");
    await expect(resolveKnowledgeDataRoot(configPath)).rejects.toThrow(
      /dataRoot/,
    );
  });

  it("loads authored knowledge without requiring an evidence file", async () => {
    await writeFixture(root);

    const record = await loadTaskKnowledge(taskId, { root });

    expect(record).toMatchObject({
      knowledgeId: `task:${taskId}`,
      taskId,
      title: "Contract date expansion",
      markdown,
      source: `knowledge/tasks/${taskId}.json`,
      evidenceCheck: { status: "not_checked" },
      observations: [],
    });
    expect(record.knowledgeRevision).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes revision and content when only the authored Markdown changes", async () => {
    await writeFixture(root);
    const first = await loadTaskKnowledge(taskId, { root });

    await writeFile(
      join(root, "knowledge", "tasks", `${taskId}.md`),
      `${markdown}\nA clarified boundary.\n`,
      "utf8",
    );
    const second = await loadTaskKnowledge(taskId, { root });

    expect(second.markdown).toContain("A clarified boundary.");
    expect(second.knowledgeRevision).not.toBe(first.knowledgeRevision);
    expect(second.evidenceCheck).toEqual({ status: "not_checked" });
  });

  it("verifies an exact task and SQL hash and resolves the query observation", async () => {
    await writeFixture(root, {
      observations: [
        { kind: "expression", id: "expression-1", label: "Trade date" },
      ],
      evidence: {
        taskId,
        sqlSources: [{ slot: "query", sha256: sha256(sql), content: sql }],
        expressions: [
          {
            expression_id: "expression-1",
            statement_id: `task:${taskId}:slot:query:statement:1`,
            source_span: { start: 0, end: 17 },
            expression_text: "select trade_date",
          },
        ],
      },
    });
    const record = await loadTaskKnowledge(taskId, { root });

    const verified = await verifyTaskKnowledge(record, { root });

    expect(verified.evidenceCheck).toEqual({
      status: "matched",
      sqlSha256: sha256(sql),
      sourceKind: "published_evidence",
    });
    expect(verified.observations).toEqual([
      {
        kind: "expression",
        id: "expression-1",
        label: "Trade date",
        text: "select trade_date",
        sourceSpan: { start: 0, end: 17 },
        startLine: 1,
        endLine: 1,
      },
    ]);
  });

  it("verifies a retained excerpt without original publisher evidence", async () => {
    await writeFixture(root, {
      evidenceKind: "retained_excerpt",
      observations: [
        { kind: "expression", id: "expression-1", label: "Trade date" },
      ],
      evidence: {
        kind: "retained_task_evidence_v1",
        taskId,
        query: { slot: "query", sha256: sha256(sql), content: sql },
        observations: [
          {
            kind: "expression",
            id: "expression-1",
            label: "Trade date",
            text: "select trade_date",
            sourceSpan: { start: 0, end: 17 },
          },
        ],
      },
    });
    const record = await loadTaskKnowledge(taskId, { root });

    const verified = await verifyTaskKnowledge(record, { root });

    expect(verified.evidenceCheck).toEqual({
      status: "matched",
      sqlSha256: sha256(sql),
      sourceKind: "retained_excerpt",
    });
    expect(verified.observations[0]).toMatchObject({
      id: "expression-1",
      text: "select trade_date",
      sourceSpan: { start: 0, end: 17 },
    });
  });

  it.each([
    {
      name: "tampered retained text",
      kind: "retained_task_evidence_v1",
      text: "select settlement_date",
      sourceSpan: { start: 0, end: 17 },
    },
    {
      name: "wrong retained raw kind",
      kind: "untrusted_fixture",
      text: "select trade_date",
      sourceSpan: { start: 0, end: 17 },
    },
  ])(
    "rejects retained evidence with $name",
    async ({ kind, text, sourceSpan }) => {
      await writeFixture(root, {
        evidenceKind: "retained_excerpt",
        observations: [
          { kind: "expression", id: "expression-1", label: "Trade date" },
        ],
        evidence: {
          kind,
          taskId,
          query: { slot: "query", sha256: sha256(sql), content: sql },
          observations: [
            {
              kind: "expression",
              id: "expression-1",
              label: "Trade date",
              text,
              sourceSpan,
            },
          ],
        },
      });
      const record = await loadTaskKnowledge(taskId, { root });

      await expect(verifyTaskKnowledge(record, { root })).rejects.toThrow(
        /retained|excerpt|observation|text|span|kind/i,
      );
    },
  );

  it.each([
    {
      name: "missing expression reference",
      observation: {
        kind: "expression",
        id: "missing-expression",
        label: "Missing expression",
      },
      evidence: {
        taskId,
        sqlSources: [{ slot: "query", sha256: sha256(sql), content: sql }],
        expressions: [],
      },
    },
    {
      name: "changed source span",
      observation: {
        kind: "expression",
        id: "expression-1",
        label: "Trade date",
      },
      evidence: {
        taskId,
        sqlSources: [{ slot: "query", sha256: sha256(sql), content: sql }],
        expressions: [
          {
            expression_id: "expression-1",
            statement_id: `task:${taskId}:slot:query:statement:1`,
            source_span: { start: 0, end: 16 },
            expression_text: "select trade_date",
          },
        ],
      },
    },
  ])("rejects observation with $name", async ({ observation, evidence }) => {
    await writeFixture(root, { evidence, observations: [observation] });
    const record = await loadTaskKnowledge(taskId, { root });

    await expect(verifyTaskKnowledge(record, { root })).rejects.toThrow(
      /observation|expression|source.?span|resolve|mismatch/i,
    );
  });

  it("rejects changed SQL even when the evidence self-declares the changed hash", async () => {
    const changedSql = "select settlement_date from source_table;\n";
    await writeFixture(root, {
      evidence: {
        taskId,
        sqlSources: [
          { slot: "query", sha256: sha256(changedSql), content: changedSql },
        ],
      },
    });
    const record = await loadTaskKnowledge(taskId, { root });

    await expect(verifyTaskKnowledge(record, { root })).rejects.toThrow(
      /querySha256|hash|mismatch/i,
    );
  });

  it("rejects an evidence file with the wrong task ID", async () => {
    await writeFixture(root, {
      evidence: {
        taskId: "999999",
        sqlSources: [{ slot: "query", sha256: sha256(sql), content: sql }],
      },
    });
    const record = await loadTaskKnowledge(taskId, { root });

    await expect(verifyTaskKnowledge(record, { root })).rejects.toThrow(
      /task.?id|task identity/i,
    );
  });

  it.each(["../107491", "..\\107491", "107491.json", "107491/child"])(
    "rejects invalid task path %s",
    async (invalidTaskId) => {
      await expect(loadTaskKnowledge(invalidTaskId, { root })).rejects.toThrow(
        /task.?id|invalid|path/i,
      );
    },
  );

  it("rejects a numeric task ID before constructing a path", async () => {
    await expect(
      loadTaskKnowledge(107491 as unknown as string, { root }),
    ).rejects.toThrow(/task.?id|invalid|path|type/i);
  });

  it("reports an actionable error when authored knowledge is missing", async () => {
    await expect(loadTaskKnowledge(taskId, { root })).rejects.toThrow(
      /knowledge[\\/]tasks|107491|not found|missing/i,
    );
  });
});
