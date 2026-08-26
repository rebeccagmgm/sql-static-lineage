import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { Schema, SqlSession, type SchemaMapping } from "../../src/index.ts";

import {
	sha256File,
	validateTableDocument,
	validateTaskDocument,
	type TableDocument,
	type TaskDocument,
} from "../input/shared/input-pack.ts";
import { loadSchemaFromTablesRoot, parseDdlSchema } from "../plans/ddl-schema.ts";
import { buildPlanFacts } from "../plans/plan-adapter.ts";
import { taskSqlDialect } from "../plans/task-sql-dialect.ts";
import { normalizeRepeatedSqlForAnalysis } from "../input/shared/sql-analysis-normalization.ts";
import {
	canonicalJson,
	normalizeName,
	sha256,
	type GenericAnalysisProfile,
	type GenericTaskProfile,
	type InputPackProvenance,
	type PlatformTargetQueryOutput,
} from "./machine-facts-contract.ts";
import { rebuildIndex, runTask, type ProfileRunResult, type TaskRunResult } from "./machine-facts.ts";

type JsonRecord = Record<string, unknown>;

export interface PhysicalTableCatalogEntry {
	readonly platform: string;
	readonly dataSource: string;
	readonly stableTableId: string;
	readonly qualifiedName: string;
	readonly guid: string | null;
	readonly partitionFields: readonly string[] | null;
	readonly columns: readonly string[];
	readonly tablePath: string;
	readonly ddlPath: string;
	readonly tableContentHash: string;
	readonly ddlSha256: string;
}

export interface PhysicalTableCatalog {
	readonly entries: readonly PhysicalTableCatalogEntry[];
	readonly issues: readonly string[];
	readonly byPhysicalKey: ReadonlyMap<string, PhysicalTableCatalogEntry>;
	readonly byQualifiedName: ReadonlyMap<string, readonly PhysicalTableCatalogEntry[]>;
}

export interface SelectedLineageSql {
	readonly slot: string;
	readonly path: string;
	readonly locator: string;
	readonly sha256: string;
	readonly content: string;
	readonly analysisContent: string;
	readonly analysisSha256: string;
	readonly evidenceProvider: string;
}

export interface PreparedInputPackTask {
	readonly taskId: string;
	readonly taskName: string | null;
	readonly taskCategory: string;
	readonly taskPath: string;
	readonly task: TaskDocument & JsonRecord;
	readonly target: PhysicalTableCatalogEntry;
	readonly sql: SelectedLineageSql;
	readonly sqlSources: readonly SelectedLineageSql[];
	readonly sqlSegments: readonly { readonly slot: string; readonly start: number; readonly end: number }[];
	readonly dialect: "databricks" | "duckdb";
	readonly logicalSourceId: string;
	readonly schemaBundle: JsonRecord;
	readonly schemaBundleHash: string;
	readonly profileTask: GenericTaskProfile;
	readonly provenance: InputPackProvenance;
	readonly inputHashes: ReadonlyMap<string, string>;
}

export interface PrepareInputPackTaskOptions {
	readonly dataRoot: string;
	readonly taskId: string;
	readonly tableCatalog?: PhysicalTableCatalog;
	readonly beforeFinalVerification?: () => void;
}

export interface RunInputPackMachineFactsOptions {
	readonly dataRoot: string;
	readonly taskIds: readonly string[];
	readonly outputRoot: string;
	readonly beforeFinalVerification?: (taskId: string) => void;
}

export interface InputPackMachineFactsRunResult {
	readonly output_root: string;
	readonly tasks: readonly TaskRunResult[];
	readonly index: ProfileRunResult["index"];
	readonly prepared: readonly {
		readonly taskId: string;
		readonly sqlSlot: string;
		readonly target: string;
		readonly taskContentHash: string;
		readonly tableContentHash: string;
	}[];
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function asRecord(value: unknown): JsonRecord | null {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function nonEmpty(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed === "" || trimmed === "-" ? null : trimmed;
}

function normalizeToken(value: string): string {
	return value.trim().toLowerCase();
}

export function physicalTableKey(value: Pick<PhysicalTableCatalogEntry, "platform" | "dataSource" | "qualifiedName">): string {
	return `${normalizeToken(value.platform)}|${normalizeToken(value.dataSource)}|${normalizeName(value.qualifiedName)}`;
}

function relativeLocator(dataRoot: string, path: string): string {
	return relative(dataRoot, path).replaceAll("\\", "/");
}

function isWithin(root: string, path: string): boolean {
	const relation = relative(resolve(root), resolve(path));
	return relation === "" || (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation));
}

function discoverNamedFiles(root: string, name: string): string[] {
	if (!existsSync(root)) return [];
	const result: string[] = [];
	const visit = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareText(left.name, right.name))) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile() && entry.name === name) result.push(path);
		}
	};
	visit(resolve(root));
	return result.sort(compareText);
}

function verifiedFile(path: string, expectedHash: string, reason: string): Buffer {
	if (!existsSync(path) || !lstatSync(path).isFile()) throw new Error(`${reason}_MISSING:${path}`);
	const bytes = readFileSync(path);
	const actual = sha256(bytes);
	if (actual !== expectedHash) throw new Error(`${reason}_HASH_MISMATCH:${path}:expected=${expectedHash}:actual=${actual}`);
	return bytes;
}

function targetRecord(task: TaskDocument & JsonRecord): { platform: string; dataSource: string; qualifiedName: string } {
	const target = asRecord(task.target);
	const platform = nonEmpty(target?.platform);
	const dataSource = nonEmpty(target?.dataSource);
	const qualifiedName = nonEmpty(target?.qualifiedName);
	if (!platform || !dataSource || !qualifiedName) throw new Error(`TASK_TARGET_PHYSICAL_IDENTITY_UNRESOLVED:${task.taskId}`);
	return { platform, dataSource, qualifiedName: normalizeName(qualifiedName) };
}

function fieldProducingSql(sql: string): boolean {
	const normalized = sql.replace(/--[^\r\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
	return (
		/^\s*(?:select|with)\b/i.test(normalized) ||
		/\binsert\s+(?:overwrite|into)\b[\s\S]*\bselect\b/i.test(normalized) ||
		/\bcreate\s+(?:or\s+replace\s+)?table\b[\s\S]*\bas\s+(?:select|with)\b/i.test(normalized)
	);
}

export function selectLineageSql(
	dataRoot: string,
	taskPath: string,
	task: TaskDocument & JsonRecord,
): { selected: SelectedLineageSql; sources: readonly SelectedLineageSql[]; hashes: ReadonlyMap<string, string> } {
	const taskDirectory = dirname(taskPath);
	const sqlEntries = Array.isArray(task.sqlFiles) ? task.sqlFiles.map(asRecord).filter((item): item is JsonRecord => item !== null) : [];
	const loaded: SelectedLineageSql[] = [];
	const hashes = new Map<string, string>([[taskPath, sha256File(taskPath)]]);
	for (const entry of sqlEntries) {
		const slot = nonEmpty(entry.slot);
		const relativePath = nonEmpty(entry.path);
		const expectedHash = nonEmpty(entry.sha256);
		const evidenceProvider = nonEmpty(entry.evidenceProvider);
		if (!slot || !relativePath || !expectedHash || !evidenceProvider) throw new Error(`TASK_SQL_INDEX_INVALID:${task.taskId}`);
		const path = resolve(taskDirectory, relativePath);
		if (!isWithin(taskDirectory, path)) throw new Error(`TASK_SQL_PATH_UNSAFE:${relativePath}`);
		const bytes = verifiedFile(path, expectedHash, "TASK_SQL");
		hashes.set(path, expectedHash);
		const content = bytes.toString("utf8");
		const analysisContent = normalizeRepeatedSqlForAnalysis(content);
		loaded.push({
			slot,
			path,
			locator: relativeLocator(dataRoot, path),
			sha256: expectedHash,
			content,
			analysisContent,
			analysisSha256: sha256(Buffer.from(analysisContent, "utf8")),
			evidenceProvider,
		});
	}
	const query = loaded.filter((item) => item.slot === "query");
	if (query.length === 1) return { selected: query[0]!, sources: loaded, hashes };
	const candidates = loaded.filter((item) => fieldProducingSql(item.content));
	if (candidates.length !== 1)
		throw new Error(`SQL_SLOT_SELECTION_AMBIGUOUS:${task.taskId}:candidates=${candidates.map((item) => item.slot).sort(compareText).join(",") || "NONE"}`);
	return { selected: candidates[0]!, sources: loaded, hashes };
}

export function loadPhysicalTableCatalog(dataRootInput: string): PhysicalTableCatalog {
	const dataRoot = resolve(dataRootInput);
	const entries: PhysicalTableCatalogEntry[] = [];
	const issues: string[] = [];
	for (const tablePath of discoverNamedFiles(join(dataRoot, "tables"), "table.json")) {
		try {
			const raw: unknown = JSON.parse(readFileSync(tablePath, "utf8"));
			validateTableDocument(raw);
			const document = raw as TableDocument & JsonRecord;
			const ddlFile = asRecord(document.ddlFile);
			const ddlRelative = nonEmpty(ddlFile?.path);
			const ddlHash = nonEmpty(ddlFile?.sha256);
			if (!ddlRelative || !ddlHash) throw new Error("DDL_INDEX_INVALID");
			const ddlPath = resolve(dirname(tablePath), ddlRelative);
			if (!isWithin(dirname(tablePath), ddlPath)) throw new Error("DDL_PATH_UNSAFE");
			const ddl = verifiedFile(ddlPath, ddlHash, "DDL").toString("utf8");
			const parsed = parseDdlSchema(ddl);
			const columns = parsed.columns.map((column) => normalizeName(column.name));
			if (columns.length === 0) throw new Error(`DDL_COLUMNS_UNAVAILABLE:${parsed.warnings.join(",")}`);
			entries.push({
				platform: String(document.platform),
				dataSource: String(document.dataSource),
				stableTableId: String(document.stableTableId),
				qualifiedName: normalizeName(String(document.qualifiedName)),
				guid: nonEmpty(document.guid),
				partitionFields: Array.isArray(document.partitionFields)
					? document.partitionFields.map((field) => normalizeName(String(field)))
					: null,
				columns,
				tablePath,
				ddlPath,
				tableContentHash: String(document.contentHash),
				ddlSha256: ddlHash,
			});
		} catch (error) {
			issues.push(`${relativeLocator(dataRoot, tablePath)}:${error instanceof Error ? error.message : String(error)}`);
		}
	}
	entries.sort((left, right) => compareText(physicalTableKey(left), physicalTableKey(right)));
	const grouped = new Map<string, PhysicalTableCatalogEntry[]>();
	for (const entry of entries) {
		const names = grouped.get(normalizeName(entry.qualifiedName)) ?? [];
		names.push(entry);
		grouped.set(normalizeName(entry.qualifiedName), names);
	}
	const byPhysicalKey = new Map<string, PhysicalTableCatalogEntry>();
	for (const entry of entries) {
		const key = physicalTableKey(entry);
		if (byPhysicalKey.has(key)) issues.push(`DUPLICATE_PHYSICAL_TABLE:${key}`);
		else byPhysicalKey.set(key, entry);
	}
	return {
		entries,
		issues: issues.sort(compareText),
		byPhysicalKey,
		byQualifiedName: new Map([...grouped.entries()].map(([key, values]) => [key, [...values].sort((a, b) => compareText(physicalTableKey(a), physicalTableKey(b)))])),
	};
}

function partitionStatus(
	task: TaskDocument & JsonRecord,
	target: PhysicalTableCatalogEntry,
): Pick<PlatformTargetQueryOutput, "partition_status" | "partition_columns"> {
	const columns = target.partitionFields;
	if (columns === null) return { partition_status: "UNKNOWN", partition_columns: [] };
	if (columns.length === 0) return { partition_status: "NOT_PARTITIONED", partition_columns: [] };
	if (task.partition === null) return { partition_status: "CONFLICT", partition_columns: columns };
	if (task.partition === undefined) return { partition_status: "UNKNOWN", partition_columns: columns };
	const variants = Array.isArray(task.partition) ? task.partition : [task.partition];
	const complete = variants.length > 0 && variants.every((variant) => {
		const record = asRecord(variant);
		return record !== null && columns.every((column) => nonEmpty(record[column]) !== null);
	});
	return { partition_status: complete ? "COMPLETE" : "INCOMPLETE", partition_columns: columns };
}

function schemaBundle(catalog: PhysicalTableCatalog, logicalSourceId: string): JsonRecord {
	const tailCounts = new Map<string, number>();
	for (const entry of catalog.entries) {
		const tail = entry.qualifiedName.split(".").at(-1)!;
		tailCounts.set(tail, (tailCounts.get(tail) ?? 0) + 1);
	}
	return {
		schema_version: "machine-facts-schema-bundle-v1",
		logical_source_id: logicalSourceId,
		records: catalog.entries.map((entry) => ({
			qualified_name: entry.qualifiedName,
			guid: entry.guid,
			status: "SUCCESS",
			source: `input-pack:${entry.tableContentHash}`,
			metadata_qualified_name: entry.qualifiedName,
			ddl_sha256: entry.ddlSha256,
			table_status: "AVAILABLE",
			required_for_star: false,
			columns: entry.columns.map((name) => ({ name, partition: entry.partitionFields?.includes(name) === true })),
			aliases: tailCounts.get(entry.qualifiedName.split(".").at(-1)!) === 1
				? [entry.qualifiedName.split(".").at(-1)!]
				: [],
		})),
	};
}

function addSchemaMapping(mapping: SchemaMapping, qualifiedName: string, columns: readonly string[]): void {
	const parts = normalizeName(qualifiedName).split(".").filter(Boolean);
	if (parts.length === 0) return;
	let current = mapping;
	for (const part of parts.slice(0, -1)) {
		const existing = current[part];
		if (!existing || typeof existing !== "object" || Array.isArray(existing)) current[part] = {};
		current = current[part] as SchemaMapping;
	}
	current[parts.at(-1)!] = Object.fromEntries(columns.map((column) => [normalizeName(column), "unknown"]));
}

function taskLocalCtasTarget(sql: string): string | null {
	const match = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([A-Za-z0-9_$`".\[\]-]+)[\s\S]*?\bas\s+(?:select|with)\b/i.exec(sql);
	if (!match?.[1]) return null;
	return normalizeName(match[1].replaceAll("`", "").replaceAll('"', "").replaceAll("[", "").replaceAll("]", ""));
}

function deriveTaskLocalSchemas(
	catalog: PhysicalTableCatalog,
	sources: readonly SelectedLineageSql[],
	taskId: string,
	dialect: "databricks" | "duckdb",
): JsonRecord[] {
	const mapping: SchemaMapping = {};
	for (const entry of catalog.entries) addSchemaMapping(mapping, entry.qualifiedName, entry.columns);
	const records: JsonRecord[] = [];
	for (const source of sources) {
		const split = SqlSession.create(source.analysisContent, dialect, { schema: new Schema(mapping) });
		for (const cell of split.doc.statements) {
			const rawSql = source.analysisContent.slice(cell.span.start, cell.span.end);
			const target = taskLocalCtasTarget(rawSql);
			if (!target) continue;
			const session = SqlSession.create(rawSql, dialect, { schema: new Schema(mapping) });
			const statement = session.doc.statements[0];
			if (!statement) continue;
			const plan = buildPlanFacts(statement, rawSql, {
				statement_index: 0,
				dialect,
				schema: new Schema(mapping),
				include_expression_dependencies: true,
			});
			const roots = (plan.relations as unknown as JsonRecord[]).filter((relation) => plan.roots.includes(String(relation.id)));
			const rootColumns = roots.length === 1 && Array.isArray(roots[0]?.output_columns)
				? roots[0]!.output_columns.map((column) => normalizeName(String(column))).filter((column) => column && column !== "*")
				: [];
			if (rootColumns.length === 0 || new Set(rootColumns).size !== rootColumns.length) continue;
			addSchemaMapping(mapping, target, rootColumns);
			if ((catalog.byQualifiedName.get(target) ?? []).length === 1) continue;
			records.push({
				qualified_name: target,
				guid: null,
				status: "SUCCESS",
				source: `input-pack-task-local-ctas:${taskId}:${source.slot}`,
				metadata_qualified_name: target,
				ddl_sha256: null,
				table_status: "TASK_LOCAL",
				required_for_star: true,
				columns: rootColumns.map((name) => ({ name, partition: false })),
				aliases: [],
			});
		}
	}
	return records;
}

function combinedLineageSql(
	allSources: readonly SelectedLineageSql[],
	selected: SelectedLineageSql,
): { sql: SelectedLineageSql; sources: readonly SelectedLineageSql[]; segments: readonly { slot: string; start: number; end: number }[] } {
	const rank = new Map(["create", "prepare", "query"].map((slot, index) => [slot, index]));
	const candidates = allSources
		.filter((source) => fieldProducingSql(source.analysisContent) || source.slot === selected.slot)
		.sort((left, right) => (rank.get(left.slot) ?? 100) - (rank.get(right.slot) ?? 100) || compareText(left.slot, right.slot));
	const sources = candidates.length > 0 ? candidates : [selected];
	let content = "";
	const segments: { slot: string; start: number; end: number }[] = [];
	for (const source of sources) {
		if (content.length > 0 && !content.endsWith("\n")) content += "\n";
		const start = content.length;
		content += source.analysisContent;
		segments.push({ slot: source.slot, start, end: content.length });
	}
	const digest = sha256(Buffer.from(content, "utf8"));
	return {
			sql: {
				slot: sources.length === 1 ? sources[0]!.slot : "multi",
				path: selected.path,
				locator: sources.length === 1 ? sources[0]!.locator : `derived:task-sql-slots:${sources.map((source) => source.slot).join(",")}`,
				sha256: digest,
				content,
				analysisContent: content,
				analysisSha256: digest,
				evidenceProvider: [...new Set(sources.map((source) => source.evidenceProvider))].sort(compareText).join(","),
		},
		sources,
		segments,
	};
}

function verifyStableInputs(hashes: ReadonlyMap<string, string>): void {
	for (const [path, expected] of hashes) {
		if (!existsSync(path) || sha256File(path) !== expected) throw new Error(`INPUT_CHANGED_DURING_PREPARATION:${path}`);
	}
}

export function prepareInputPackTask(options: PrepareInputPackTaskOptions): PreparedInputPackTask {
	const dataRoot = resolve(options.dataRoot);
	if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(options.taskId)) throw new Error("TASK_ID_INVALID");
	const taskPaths = discoverNamedFiles(join(dataRoot, "tasks"), "task.json").filter((path) => basename(dirname(path)) === options.taskId);
	if (taskPaths.length === 0) throw new Error(`TASK_INPUT_PACK_MISSING:${options.taskId}`);
	if (taskPaths.length !== 1) throw new Error(`TASK_INPUT_PACK_AMBIGUOUS:${options.taskId}`);
	const taskPath = taskPaths[0]!;
	const taskRaw: unknown = JSON.parse(readFileSync(taskPath, "utf8"));
	validateTaskDocument(taskRaw);
	const task = taskRaw as TaskDocument & JsonRecord;
	if (task.taskId !== options.taskId) throw new Error(`TASK_IDENTITY_MISMATCH:${options.taskId}`);
	const selected = selectLineageSql(dataRoot, taskPath, task);
	const combined = combinedLineageSql(selected.sources, selected.selected);
	const catalog = options.tableCatalog ?? loadPhysicalTableCatalog(dataRoot);
	const targetRef = targetRecord(task);
	const target = catalog.byPhysicalKey.get(physicalTableKey(targetRef));
	if (!target) throw new Error(`TARGET_TABLE_PACK_MISSING:${physicalTableKey(targetRef)}`);
	const loadedTargetSchema = loadSchemaFromTablesRoot(join(dataRoot, "tables"), [target.qualifiedName]);
	if (loadedTargetSchema.missing.length > 0 || !loadedTargetSchema.loaded.some((entry) => normalizeName(entry.qualified_name) === target.qualifiedName))
		throw new Error(`TARGET_SCHEMA_NOT_PROVABLE:${target.qualifiedName}`);
	const logicalSourceId = `${normalizeToken(target.platform)}-${normalizeToken(target.dataSource)}`;
	const dialect = taskSqlDialect(String(task.taskCategory));
	const baseBundle = schemaBundle(catalog, logicalSourceId);
	const bundle = {
		...baseBundle,
		records: [
			...((baseBundle.records as JsonRecord[]) ?? []),
			...deriveTaskLocalSchemas(catalog, combined.sources, options.taskId, dialect),
		],
	};
	const bundleHash = sha256(canonicalJson(bundle));
	const inputHashes = new Map(selected.hashes);
	for (const entry of catalog.entries) {
		inputHashes.set(entry.tablePath, sha256File(entry.tablePath));
		inputHashes.set(entry.ddlPath, entry.ddlSha256);
	}
	const provenance: InputPackProvenance = {
		schema_version: "machine-facts-input-pack-provenance-v1",
		data_root: realpathSync.native(dataRoot),
		task_locator: relativeLocator(dataRoot, taskPath),
		task_content_hash: String(task.contentHash),
		sql_slot: selected.selected.slot,
		sql_locator: selected.selected.locator,
		sql_sha256: selected.selected.sha256,
		sql_sources: combined.sources.map((source) => ({ slot: source.slot, locator: source.locator, sha256: source.sha256 })),
		analysis_sql_sha256: combined.sql.sha256,
		table_locator: relativeLocator(dataRoot, target.tablePath),
		table_content_hash: target.tableContentHash,
		ddl_locator: relativeLocator(dataRoot, target.ddlPath),
		ddl_sha256: target.ddlSha256,
	};
	const platformOutput = task.targetEvidenceKind === "DIRECT_PLATFORM_TARGET"
		? {
				target: target.qualifiedName,
				...partitionStatus(task, target),
				evidence_refs: [provenance.task_locator, provenance.table_locator, provenance.ddl_locator],
			} satisfies PlatformTargetQueryOutput
		: undefined;
	const profileTask: GenericTaskProfile = {
		task_id: options.taskId,
		sql_snapshot: combined.sql.path,
		writes: target.qualifiedName,
		...(combined.sources.length === 1 ? { sql_slot: combined.sources[0]!.slot } : { sql_segments: combined.segments }),
		input_pack_provenance: provenance,
		write_partition_evidence: {
			status: partitionStatus(task, target).partition_status,
			partition_columns: partitionStatus(task, target).partition_columns,
			evidence_refs: [provenance.task_locator, provenance.table_locator, provenance.ddl_locator],
		},
		...(platformOutput ? { platform_target_query_output: platformOutput } : {}),
	};
	options.beforeFinalVerification?.();
	verifyStableInputs(inputHashes);
	return {
		taskId: options.taskId,
		taskName: nonEmpty(task.taskName),
		taskCategory: String(task.taskCategory),
		taskPath,
		task,
		target,
		sql: combined.sql,
		sqlSources: combined.sources,
		sqlSegments: combined.segments,
		dialect,
		logicalSourceId,
		schemaBundle: bundle,
		schemaBundleHash: bundleHash,
		profileTask,
		provenance,
		inputHashes,
	};
}

function frozenSqlPath(outputRoot: string, prepared: PreparedInputPackTask): string {
	const directory = join(outputRoot, "input-pack-sources", prepared.taskId);
	mkdirSync(directory, { recursive: true });
	const path = join(directory, `${prepared.sql.slot}-${prepared.sql.sha256}.sql`);
	if (existsSync(path)) {
		if (sha256File(path) !== prepared.sql.sha256) throw new Error(`INPUT_PACK_SOURCE_HASH_COLLISION:${path}`);
	} else writeFileSync(path, prepared.sql.content, "utf8");
	return path;
}

function freezeRawSqlSources(outputRoot: string, prepared: PreparedInputPackTask): void {
	const directory = join(outputRoot, "input-pack-sources", prepared.taskId);
	mkdirSync(directory, { recursive: true });
	for (const source of prepared.sqlSources) {
		const path = join(directory, `${source.slot}-${source.sha256}.sql`);
		if (existsSync(path)) {
			if (sha256File(path) !== source.sha256) throw new Error(`INPUT_PACK_SOURCE_HASH_COLLISION:${path}`);
		} else writeFileSync(path, source.content, "utf8");
	}
}

export function runInputPackMachineFacts(options: RunInputPackMachineFactsOptions): InputPackMachineFactsRunResult {
	if (options.taskIds.length === 0) throw new Error("TASK_ID_REQUIRED");
	const outputRoot = resolve(options.outputRoot);
	mkdirSync(outputRoot, { recursive: true });
	const catalog = loadPhysicalTableCatalog(options.dataRoot);
	const tasks: TaskRunResult[] = [];
	const preparedSummary: InputPackMachineFactsRunResult["prepared"][number][] = [];
	for (const taskId of [...new Set(options.taskIds)].sort(compareText)) {
		const prepared = prepareInputPackTask({
			dataRoot: options.dataRoot,
			taskId,
			tableCatalog: catalog,
			beforeFinalVerification: options.beforeFinalVerification ? () => options.beforeFinalVerification!(taskId) : undefined,
		});
		freezeRawSqlSources(outputRoot, prepared);
		const frozenPath = frozenSqlPath(outputRoot, prepared);
		const profileTask: GenericTaskProfile = { ...prepared.profileTask, sql_snapshot: frozenPath };
		const profile: GenericAnalysisProfile = {
			schema_version: "input-pack-machine-facts-v1",
			dialect: prepared.dialect,
			logical_source_id: prepared.logicalSourceId,
			tasks: [profileTask],
		};
		tasks.push(runTask(profileTask, profile, prepared.logicalSourceId, outputRoot, prepared.schemaBundle, prepared.schemaBundleHash));
		preparedSummary.push({
			taskId,
			sqlSlot: prepared.sql.slot,
			target: prepared.target.qualifiedName,
			taskContentHash: String(prepared.task.contentHash),
			tableContentHash: prepared.target.tableContentHash,
		});
	}
	return { output_root: outputRoot, tasks, index: rebuildIndex(outputRoot), prepared: preparedSummary };
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function parseCli(args: readonly string[]): RunInputPackMachineFactsOptions {
	const dataRoot = option(args, "--data-root");
	const outputRoot = option(args, "--output");
	const taskIds = args
		.flatMap((value, index) => (value === "--task-id" && args[index + 1] ? args[index + 1]!.split(",") : []))
		.map((value) => value.trim())
		.filter(Boolean);
	if (!dataRoot || !outputRoot || taskIds.length === 0)
		throw new Error("usage: input-pack-machine-facts --data-root <path> --task-id <id[,id]> --output <path>");
	return { dataRoot, outputRoot, taskIds };
}

if (process.argv[1] && basename(process.argv[1]).startsWith("input-pack-machine-facts")) {
	const result = runInputPackMachineFacts(parseCli(process.argv.slice(2)));
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
