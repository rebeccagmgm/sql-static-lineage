import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runProjectTaskLocalCli } from "../project-graph/task-local/project-task-local-cli.ts";

const taskIds = readFileSync(process.env.IDS!, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
console.log(`projecting ${taskIds.length}`);
const r = runProjectTaskLocalCli({
  dataRoot: process.env.DATA!,
  factsRoot: process.env.FACTS!,
  scheduleCacheRoot: process.env.SCHED!,
  outputRoot: process.env.OUT!,
  taskIds,
  expandUpstream: false,
  alsoTaskIds: [],
  prepareFacts: false,
});
const summary = { ok: true, batchManifestPath: r.batchManifestPath, taskCount: r.taskIds.length, cache: r.cache };
console.log(JSON.stringify(summary, null, 2));
writeFileSync(join(process.env.OUT!, "projection-run-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
