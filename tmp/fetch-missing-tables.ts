import { writeTableInput } from "../scripts/input/shared/input-pack.ts";
import { execSync } from "node:child_process";

type CliResult = { [key: string]: unknown };

type RawResult = CliResult | CliResult[] | string | null | undefined;

const dataRoot = "E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-data";

const targets = [
  { guid: "ca695041-7811-4176-bb69-f2ba9f398e52", preferDb: "pdata_news_n" },
  { guid: "d227e494-0a4b-4e8a-9236-eaac784c09a9", preferDb: "pdata_news_n" },
  { guid: "f2530ec5-cd54-4d40-bc78-3c605fceca54", preferDb: "pdata_news_n" },
  { guid: "76a78098-bd48-4cbe-9cde-6a8ad8ff2ee1", preferDb: "pdata_news_n" },
  { guid: "5ed3b678-7959-4f99-b5e5-3e7a8d2aaf31", preferDb: "odata_n_tit" },
];

function openCliJson(args: string): RawResult {
  const cmd = `opencli.cmd ${args}`;
  const maxRetries = 3;
  let attempt = 0;
  while (true) {
    try {
      const output = execSync(cmd, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const trimmed = output.trim();
      return trimmed === "" ? null : (JSON.parse(trimmed) as RawResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stderr = (error as { stderr?: string | Buffer } | undefined)?.stderr;
      const output = `${message}\n${typeof stderr === "string" ? stderr : stderr ? stderr.toString() : ""}`;
      const isRateLimit = /MCP.*限流|too many requests|429/.test(output);
      if (attempt < maxRetries && isRateLimit) {
        attempt += 1;
        const delayMs = 1_000 * attempt;
        // eslint-disable-next-line no-await-in-loop
        execSync(`powershell -Command "Start-Sleep -Milliseconds ${delayMs}"`);
        continue;
      }
      throw error;
    }
  }
}

function firstRow(value: RawResult): CliResult | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0] as CliResult | undefined;
  if (typeof value === "object") return value as CliResult;
  return undefined;
}

for (const target of targets) {
  const ddlRaw = openCliJson(`szdata table-ddl --guid ${target.guid} -f json`);
  const ddlRow = firstRow(ddlRaw);
  if (!ddlRow || typeof ddlRow.ddl !== "string" || ddlRow.ddl.trim() === "") {
    throw new Error(`No ddl for ${target.guid}`);
  }

  const qualifiedNameRaw = String(ddlRow.qualifiedName ?? "");
  const qualifiedName = qualifiedNameRaw.split("@", 1)[0]!;
  if (qualifiedName === "") throw new Error(`No qualifiedName for ${target.guid}`);

  const dbName = target.preferDb ?? String(ddlRow.dbName ?? qualifiedName.split(".", 1)[0] ?? "");
  const tableName = String(ddlRow.tableName ?? qualifiedName.split(".").at(-1) ?? "");

  const tableRowsRaw = openCliJson(`szdata table --db ${dbName} --table ${tableName} -f json`);
  const tableRows = Array.isArray(tableRowsRaw) ? tableRowsRaw : [tableRowsRaw];
  const tableRow = tableRows.find((row): row is CliResult =>
    row !== undefined &&
    row !== null &&
    typeof row === "object" &&
    typeof (row as CliResult).table === "object" &&
    row.table !== null
  );
  const tableSummary = (tableRow?.table as CliResult | undefined) ?? {};

  const partitionRaw = typeof ddlRow.partition === "string" ? ddlRow.partition : "";
  const partitionFields = partitionRaw.trim() === "" || partitionRaw.trim() === "-" ? undefined : partitionRaw.split(",").map((item) => item.trim()).filter(Boolean);
  const evidence = {
    guid: String(ddlRow.guid ?? ""),
    platform: "hive",
    dataSource: "gfhive",
    qualifiedName,
    schema: qualifiedName.includes(".") ? qualifiedName.split(".").slice(0, -1).join(".") : undefined,
    name: tableName || undefined,
    objectType: typeof ddlRow.typeName === "string" ? String(ddlRow.typeName) : "hive_table",
    status:
      typeof tableSummary.status === "string" &&
      tableSummary.status.trim() !== "" &&
      tableSummary.status.trim() !== "-"
        ? tableSummary.status
        : undefined,
    partitionFields,
    ddl: ddlRow.ddl,
    evidenceProvider: `opencli:szdata table-ddl`,
  };

  const result = writeTableInput(dataRoot, evidence);
  console.log(`${qualifiedName} -> ${result.directory} changed=${result.changed}`);
}
