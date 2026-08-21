/**
 * Temporary reader for understanding the src parser against the frozen task pack.
 *
 * This file intentionally does not publish Machine Facts and does not write output.
 * It shows the src-only pipeline:
 *   1. SqlSession/SqlDocument: split + parse + lower + scope tree
 *   2. src IR: statement/body/sources/outputs
 *   3. src analyze(): qualification, native lineage, and symbols
 *
 * Run from the repository root with:
 *   node_modules/.bin/tsx tmp/inspect-src-task.ts --task-id 86840 --slot query
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { analyze, SqlSession } from "../src/index.js";

type JsonRecord = Record<string, unknown>;

const DEFAULT_DATA_ROOT = "E:\\02_area\\股衍数据-数据cookbook\\sql-static-lineage-data";

function arg(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArg(name: string, fallback?: string): string {
	const value = arg(name) ?? fallback;
	if (!value) throw new Error(`missing ${name}`);
	return value;
}

function readJson(path: string): JsonRecord {
	return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function findTask(dataRoot: string, taskId: string, category?: string): string {
	const tasksRoot = join(dataRoot, "tasks");
	const categories = category ? [category] : readdirSync(tasksRoot);
	const matches: string[] = [];
	for (const currentCategory of categories) {
		const taskDir = join(tasksRoot, currentCategory, taskId);
		if (existsSync(join(taskDir, "task.json"))) matches.push(taskDir);
	}
	if (matches.length !== 1) {
		throw new Error(
			matches.length === 0
				? `task ${taskId} was not found below ${tasksRoot}`
				: `task ${taskId} is ambiguous: ${matches.join(", ")}`,
		);
	}
	return matches[0]!;
}

function sourceSummary(source: any): JsonRecord {
	if (source.kind === "table" || source.kind === "cte") {
		return {
			kind: source.kind,
			binding: source.source?.alias ?? source.source?.relation?.fqn ?? source.name?.join("."),
			relation: source.source?.relation?.fqn ?? null,
		};
	}
	if (source.kind === "subquery") return { kind: source.kind, alias: source.source?.alias ?? null };
	if (source.kind === "lateral") return { kind: source.kind, alias: source.source?.alias ?? null };
	return { kind: source.kind };
}

function scopeSummary(cell: any): JsonRecord {
	const root = cell.scopes.root;
	return {
		body: root.body.kind,
		outputs: root.outputs,
		sources: root.sourceList.map((entry: any) => ({ key: entry.key, ...sourceSummary(entry.source) })),
		children: root.children.length,
	};
}

function inspectSql(sql: string, filePath: string, dataRoot: string): JsonRecord {
	const session = SqlSession.create(sql, "databricks");
	const statements = session.doc.statements.map((cell, statementIndex) => {
		const analysis = analyze(cell.text, "databricks");

		return {
			index: statementIndex,
			span: cell.span,
			category: cell.category,
			syntax_errors: cell.errors,
			syntax_diagnostics: cell.diagnostics,
			ir: {
				statement: cell.ast.statement ?? null,
				body: cell.ast.body.kind,
				unsupported: (cell.ast.body as { unsupported?: string[] }).unsupported ?? [],
				cte_count: cell.ast.ctes.length,
			},
			scope: scopeSummary(cell),
			analysis: {
				semantic_diagnostics: analysis.diagnostics,
				qualified_outputs: analysis.qualification.columnsOf(analysis.scopes.root),
				lineage: analysis.lineage.all.slice(0, 12).map((item) => ({
					output: item.output,
					origins: item.origins,
				})),
				symbol_count: analysis.symbols.length,
			},
		};
	});

	return {
		file: relative(dataRoot, filePath),
		bytes: Buffer.byteLength(sql, "utf8"),
		statements,
	};
}

function main(): void {
	const dataRoot = resolve(requiredArg("--data-root", DEFAULT_DATA_ROOT));
	const taskId = requiredArg("--task-id");
	const category = arg("--category");
	const requestedSlot = arg("--slot");
	const taskDir = findTask(dataRoot, taskId, category);
	const task = readJson(join(taskDir, "task.json"));
	const declaredFiles = Array.isArray(task.sqlFiles) ? task.sqlFiles : [];
	const files = declaredFiles
		.filter((entry) => !requestedSlot || (entry as JsonRecord).slot === requestedSlot)
		.map((entry) => (entry as JsonRecord).path)
		.filter((path): path is string => typeof path === "string")
		.map((path) => resolve(taskDir, path));

	if (files.length === 0) throw new Error(`no SQL slot matched in ${taskDir}`);

	const result = {
		task: {
			id: task.taskId,
			category: task.taskCategory,
			name: task.taskName,
			target: task.target,
			partition: task.partition,
		},
		dialect: "databricks",
		// This is intentionally schema-free: physical column closure requires the table evidence pack.
		schema_mode: "OPEN_PROVIDER",
		files: files.map((filePath) => inspectSql(readFileSync(filePath, "utf8"), filePath, dataRoot)),
	};

	console.log(JSON.stringify(result, null, 2));
}

main();
