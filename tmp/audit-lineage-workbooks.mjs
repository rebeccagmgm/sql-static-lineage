import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dataRoot = process.argv[2];
const paths = process.argv.slice(3);

function asId(value) {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? text : undefined;
}

function addId(set, value) {
  const id = asId(value);
  if (id) set.add(id);
}

function idsFromPacked(value, delimiter, positions) {
  const ids = new Set();
  for (const row of String(value ?? "").split(delimiter)) {
    const fields = row.split("|");
    for (const position of positions) addId(ids, fields[position]);
  }
  return ids;
}

function taskIdsFromRoot(root) {
  const ids = new Set();
  const tasksRoot = join(root, "tasks");
  for (const category of readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const taskDir of readdirSync(join(tasksRoot, category.name), { withFileTypes: true })) {
      if (!taskDir.isDirectory()) continue;
      const path = join(tasksRoot, category.name, taskDir.name, "task.json");
      try {
        const task = JSON.parse(readFileSync(path, "utf8"));
        addId(ids, task.taskId ?? taskDir.name);
      } catch {}
    }
  }
  return ids;
}

const processed = taskIdsFromRoot(dataRoot);
for (const path of paths) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
  const ids = new Set();
  const sheetNames = workbook.worksheets.items.map((sheet) => sheet.name);
  if (sheetNames.includes("Edges")) {
    const values = workbook.worksheets.getItem("Edges").getUsedRange().values;
    const header = values[0].map((value) => String(value ?? "").trim());
    const index = header.indexOf("task_id");
    for (const row of values.slice(1)) addId(ids, row[index]);
  } else if (sheetNames.includes("Links")) {
    const values = workbook.worksheets.getItem("Links").getUsedRange().values;
    const header = values[0].map((value) => String(value ?? "").trim());
    for (const column of ["task_from", "task_to"])
      for (const row of values.slice(1)) addId(ids, row[header.indexOf(column)]);
    if (sheetNames.includes("Seed_Tasks")) {
      const seedValues = workbook.worksheets.getItem("Seed_Tasks").getUsedRange().values;
      const seedHeader = seedValues[0].map((value) => String(value ?? "").trim());
      const seedIds = new Set();
      for (const row of seedValues.slice(1)) addId(seedIds, row[seedHeader.indexOf("task_id")]);
      const seedMissing = [...seedIds].filter((id) => !processed.has(id));
      console.log(JSON.stringify({
        workbook: path,
        scope: "Seed_Tasks",
        excelTaskIds: seedIds.size,
        processedTaskIds: [...seedIds].filter((id) => processed.has(id)).length,
        missingTaskIds: seedMissing.length,
        missingSample: seedMissing.slice(0, 30),
      }));
    }
  } else if (sheetNames.includes("Seed_Tasks")) {
    const values = workbook.worksheets.getItem("Seed_Tasks").getUsedRange().values;
    const header = values[0].map((value) => String(value ?? "").trim());
    const index = header.indexOf("task_id");
    for (const row of values.slice(1)) addId(ids, row[index]);
  } else {
    const sheet = workbook.worksheets.items[0];
    const values = sheet.getUsedRange().values;
    const header = values[0].map((value) => String(value ?? "").trim());
    const edgeIndex = header.indexOf("edge_data");
    const linkIndex = header.indexOf("link_data");
    if (edgeIndex >= 0)
      for (const row of values.slice(1))
        for (const id of idsFromPacked(row[edgeIndex], "~E~", [5])) ids.add(id);
    if (linkIndex >= 0)
      for (const row of values.slice(1))
        for (const id of idsFromPacked(row[linkIndex], "~L~", [0, 1])) ids.add(id);
  }
  const missing = [...ids].filter((id) => !processed.has(id));
  console.log(JSON.stringify({
    workbook: path,
    sheets: sheetNames,
    excelTaskIds: ids.size,
    processedTaskIds: [...ids].filter((id) => processed.has(id)).length,
    missingTaskIds: missing.length,
    missingSample: missing.slice(0, 30),
  }));
}
