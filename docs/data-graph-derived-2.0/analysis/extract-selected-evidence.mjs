import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const out = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(
  readFileSync(resolve(out, "baseline-summary.json"), "utf8"),
);
const manifest = JSON.parse(readFileSync(baseline.graph.manifestPath, "utf8"));
const selected = [
  "86840",
  "86841",
  "86842",
  "220650",
  "105743",
  "107491",
  "159763",
  "74272",
  "133054",
  "133055",
  "142305",
  "212728",
];
const hash = (x) => createHash("sha256").update(x).digest("hex");
mkdirSync(resolve(out, "evidence"), { recursive: true });
const index = [];
for (const id of selected) {
  const t = manifest.tasks.find((t) => t.taskId === id);
  if (!t?.evidencePath) throw new Error("NO_FIXED_EVIDENCE:" + id);
  const bytes = readFileSync(t.evidencePath),
    e = JSON.parse(bytes);
  const sqlSources = (e.sqlSources ?? []).map((s, i) => {
    if (hash(s.content) !== s.sha256)
      throw new Error("SQL_HASH_MISMATCH:" + id + ":" + s.slot);
    const name = `${id}-${i}-${s.slot}.sql`;
    writeFileSync(resolve(out, "evidence", name), s.content);
    return {
      slot: s.slot,
      sha256: s.sha256,
      lines: s.content.split("\n").length,
      file: "evidence/" + name,
    };
  });
  const facts = {
    taskId: id,
    bindings: e.bindings,
    statements: e.statements,
    datasetIo: e.datasetIo,
    relations: e.relations,
  };
  writeFileSync(
    resolve(out, "evidence", id + "-facts.json"),
    JSON.stringify(facts, null, 2) + "\n",
  );
  index.push({
    taskId: id,
    graphVersion: baseline.graph.version,
    coverage: t.coverageStatus,
    evidencePath: t.evidencePath,
    evidenceSha256: hash(bytes),
    sqlSources,
    packTarget: e.packTarget,
    packPartition: e.packPartition,
    bindings: e.bindings?.length ?? 0,
  });
}
writeFileSync(
  resolve(out, "selected-evidence.json"),
  JSON.stringify(index, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    tasks: index.length,
    sqlSlots: index.reduce((n, t) => n + t.sqlSources.length, 0),
    sqlHashesVerified: true,
  }),
);
