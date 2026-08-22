import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error("workbook path is required");
const dataRoot = process.argv[3];
const taskIdOutput = process.argv[4];

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 5,
  tableMaxCols: 20,
  tableMaxCellChars: 120,
});
console.log(summary.ndjson);

const sheets = workbook.worksheets.items;
for (const sheet of sheets) {
  const used = sheet.getUsedRange();
  const address = used?.address ?? "A1:Z20";
  const region = await workbook.inspect({
    kind: "region",
    sheetId: sheet.name,
    range: address,
    maxChars: 9000,
    tableMaxRows: 8,
    tableMaxCols: 24,
    tableMaxCellChars: 160,
  });
  console.log(`--- SHEET ${sheet.name} ${address} ---`);
  console.log(region.ndjson);
}

const edges = workbook.worksheets.getItem("Edges");
const taskIds = [
  ...new Set(
    edges
      .getRange("F2:F11491")
      .values.flat()
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  ),
];
console.log(`EDGE_TASK_IDS count=${taskIds.length} sample=${taskIds.slice(0, 20).join(",")}`);
if (taskIdOutput) writeFileSync(taskIdOutput, `${JSON.stringify(taskIds, null, 2)}\n`, "utf8");

if (dataRoot) {
  const localTaskIds = new Set();
  const tasksRoot = join(dataRoot, "tasks");
  for (const category of readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const taskDir of readdirSync(join(tasksRoot, category.name), { withFileTypes: true })) {
      if (!taskDir.isDirectory()) continue;
      const taskJson = join(tasksRoot, category.name, taskDir.name, "task.json");
      try {
        const task = JSON.parse(readFileSync(taskJson, "utf8"));
        if (Array.isArray(task.sqlFiles) && task.sqlFiles.some((file) => file?.slot === "query")) {
          localTaskIds.add(String(task.taskId ?? taskDir.name));
        }
      } catch {}
    }
  }
  const intersection = taskIds.filter((taskId) => localTaskIds.has(taskId));
  console.log(`LOCAL_QUERY_TASK_IDS count=${localTaskIds.size}`);
  console.log(`INTERSECTION count=${intersection.length} ids=${intersection.join(",")}`);
}
