import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, "../../..");
const summary = JSON.parse(
  readFileSync(resolve(out, "baseline-summary.json"), "utf8"),
);
const manifest = JSON.parse(readFileSync(summary.graph.manifestPath, "utf8"));
const current = new Map(manifest.tasks.map((t) => [t.taskId, t]));
const hash = (x) => createHash("sha256").update(x).digest("hex");
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(resolve(dir, e.name))
      : e.name.endsWith(".md")
        ? [resolve(dir, e.name)]
        : [],
  );
const memo = new Map();
function compare(task, version) {
  const key = task + "|" + version;
  if (memo.has(key)) return memo.get(key);
  const oldPath = resolve(
    root,
    "../sql-static-lineage-data/task-projections/tasks",
    task,
    "versions",
    version + ".evidence-v3.json",
  );
  const entry = current.get(task);
  const row = {
    taskId: task,
    priorVersion: version,
    currentEvidencePath: entry?.evidencePath,
    coverage: entry?.coverageStatus,
    status: "MISSING_EVIDENCE",
  };
  if (
    existsSync(oldPath) &&
    entry?.evidencePath &&
    existsSync(entry.evidencePath)
  ) {
    const a = JSON.parse(readFileSync(oldPath, "utf8")),
      b = JSON.parse(readFileSync(entry.evidencePath, "utf8"));
    const slots = (e) =>
      (e.sqlSources ?? []).map((s) => ({
        slot: s.slot,
        sha256: hash(s.content ?? ""),
        declaredHashMatches: hash(s.content ?? "") === s.sha256,
      }));
    row.oldSql = slots(a);
    row.currentSql = slots(b);
    row.sqlIdentical =
      JSON.stringify(
        row.oldSql.map(({ slot, sha256 }) => ({ slot, sha256 })),
      ) ===
      JSON.stringify(
        row.currentSql.map(({ slot, sha256 }) => ({ slot, sha256 })),
      );
    row.writeAndPartitionIdentical =
      JSON.stringify([a.packTarget, a.packPartition]) ===
      JSON.stringify([b.packTarget, b.packPartition]);
    row.factsSectionsIdentical = Object.fromEntries(
      ["expressions", "bindings", "statements", "datasetIo", "relations"].map(
        (k) => [
          k,
          hash(JSON.stringify(a[k] ?? null)) ===
            hash(JSON.stringify(b[k] ?? null)),
        ],
      ),
    );
    row.status =
      row.sqlIdentical && row.writeAndPartitionIdentical
        ? "SQL_AND_WRITE_CONTEXT_IDENTICAL"
        : "MATERIAL_CHANGED";
  }
  memo.set(key, row);
  return row;
}
const pages = [];
for (const name of ["data-graph-knowledge", "network-understanding"])
  for (const path of files(resolve(root, "docs", name))) {
    const content = readFileSync(path, "utf8");
    const refs = [
      ...content.matchAll(
        /task-projections[\\/]tasks[\\/](\d+)[\\/]versions[\\/]([a-f0-9]{32,})\.evidence-v3\.json/gi,
      ),
    ];
    if (!refs.length) continue;
    const keys = [...new Set(refs.map((m) => m[1] + "|" + m[2]))];
    const rows = keys.map((k) => compare(...k.split("|")));
    pages.push({
      page: relative(root, path).replaceAll("\\", "/"),
      references: keys,
      statusCounts: Object.fromEntries(
        [...new Set(rows.map((r) => r.status))].map((s) => [
          s,
          rows.filter((r) => r.status === s).length,
        ]),
      ),
    });
  }
const result = {
  graphVersion: summary.graph.version,
  generatedAt: new Date().toISOString(),
  definition:
    "Actual SHA256 of every SQL slot, plus exact packTarget and packPartition; Facts sections compared separately. Equal SQL is bounded local reuse, not proof of unchanged graph role.",
  oldManifestGap:
    "Old fixed manifest unavailable; added/removed/full-version evidence diff UNKNOWN. Does not block current statistics or per-reference actual-content comparison.",
  pages,
  materials: [...memo.values()],
};
writeFileSync(
  resolve(out, "material-reuse.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      pages: pages.length,
      materials: memo.size,
      statusCounts: Object.fromEntries(
        [...new Set([...memo.values()].map((r) => r.status))].map((s) => [
          s,
          [...memo.values()].filter((r) => r.status === s).length,
        ]),
      ),
      selected: [...memo.values()]
        .filter((r) =>
          [
            "86840",
            "86841",
            "86842",
            "220650",
            "105743",
            "107491",
            "159763",
            "134442",
            "74272",
            "142305",
            "212728",
            "133052",
            "133054",
            "133055",
          ].includes(r.taskId),
        )
        .map(
          ({ taskId, status, sqlIdentical, writeAndPartitionIdentical }) => ({
            taskId,
            status,
            sqlIdentical,
            writeAndPartitionIdentical,
          }),
        ),
    },
    null,
    2,
  ),
);
