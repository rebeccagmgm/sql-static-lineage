import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = process.argv[2];
const target = process.argv[3];
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const values = workbook.worksheets.getItem("Edges").getUsedRange().values;
const header = values[0].map((value) => String(value ?? "").trim());
const index = Object.fromEntries(header.map((name, i) => [name, i]));
const rows = values.slice(1)
  .filter((row) => `${row[index.target_db]}.${row[index.target_table]}`.toLowerCase() === target.toLowerCase())
  .map((row) => ({
    depth: row[index.depth],
    source: `${row[index.source_db]}.${row[index.source_table]}`,
    target,
    taskId: String(row[index.task_id]),
    taskType: String(row[index.task_type]),
    pack: row[index.pack_no],
  }));
const focus = rows.filter((row) => row.taskId === "201838");
const sourceCounts = new Map();
const depthCounts = new Map();
for (const row of rows) {
  sourceCounts.set(row.source, (sourceCounts.get(row.source) ?? 0) + 1);
  depthCounts.set(String(row.depth), (depthCounts.get(String(row.depth)) ?? 0) + 1);
}
console.log(JSON.stringify({
  target,
  edgeRows: rows.length,
  uniqueTaskIds: new Set(rows.map((row) => row.taskId)).size,
  depthCounts: Object.fromEntries(depthCounts),
  sourceCounts: [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })),
  sampleRows: rows.slice(0, 20),
  focusTask201838: focus,
}, null, 2));
