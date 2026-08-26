import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { canonicalJson } from "../../../machine-facts/machine-facts-contract.ts";
import {
	loadPhysicalTableCatalog,
	runInputPackMachineFacts,
} from "../../../machine-facts/input-pack-machine-facts.ts";
import { reconcileFieldLineage } from "./field-lineage.ts";
import { formatFieldLineageSummary } from "./format-field-lineage.ts";
import type { FactsPolicy } from "./field-lineage-contract.ts";

interface CliOptions {
	readonly dataRoot: string;
	readonly factsRoot: string;
	readonly multiHopArtifact: string;
	readonly taskId: string;
	readonly targetTable: string;
	readonly writeObservationIds?: readonly string[];
	readonly fields: readonly string[];
	readonly factsPolicy: FactsPolicy;
	readonly maxDepth: number;
	readonly maxStates: number;
	readonly maxPaths: number;
	readonly output: string;
	readonly summaryOutput?: string;
	readonly prepareFacts: boolean;
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function integerOption(args: readonly string[], name: string, fallback: number): number {
	const value = option(args, name);
	if (value === undefined) return fallback;
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
	return parsed;
}

function parseCli(args: readonly string[]): CliOptions {
	const dataRoot = option(args, "--data-root");
	const factsRoot = option(args, "--facts-root");
	const multiHopArtifact = option(args, "--multi-hop-artifact");
	const taskId = option(args, "--task-id");
	const targetTable = option(args, "--target-table");
	const writeObservationIdsValue = option(args, "--write-observation-ids") ?? option(args, "--write-observation-id") ?? option(args, "--root-write-observation-id");
	const writeObservationIds = writeObservationIdsValue?.split(",").map((value) => value.trim()).filter(Boolean);
	const fields = (option(args, "--fields") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
	const output = option(args, "--output");
	const factsPolicy = (option(args, "--facts-policy") ?? "current-only") as FactsPolicy;
	if (!dataRoot || !factsRoot || !multiHopArtifact || !taskId || !targetTable || !output)
		throw new Error("usage: reconcile-field-lineage --data-root <path> --facts-root <facts-root> --multi-hop-artifact <json> --task-id <id> --target-table <qualified> [--write-observation-id <id[,id...]>] [--fields <a,b>] --output <json> [--summary-output <txt>] [--facts-policy current-only|allow-legacy-partial]");
	if (factsPolicy !== "current-only" && factsPolicy !== "allow-legacy-partial") throw new Error("--facts-policy is invalid");
	return {
		dataRoot,
		factsRoot,
		multiHopArtifact,
		taskId,
		targetTable,
		writeObservationIds,
		fields,
		factsPolicy,
		maxDepth: integerOption(args, "--max-depth", 8),
		maxStates: integerOption(args, "--max-states", 500),
		maxPaths: integerOption(args, "--max-paths", 1000),
		output,
		summaryOutput: option(args, "--summary-output"),
		prepareFacts: !args.includes("--no-prepare-facts"),
	};
}

function availableTaskIds(dataRoot: string): Set<string> {
	const root = join(resolve(dataRoot), "tasks");
	const ids = new Set<string>();
	if (!existsSync(root)) return ids;
	const visit = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink()) continue;
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile() && entry.name === "task.json") ids.add(basename(dirname(path)));
		}
	};
	visit(root);
	return ids;
}

export function runFieldLineageCli(options: CliOptions): ReturnType<typeof reconcileFieldLineage> {
	const tableLineage = JSON.parse(readFileSync(resolve(options.multiHopArtifact), "utf8")) as Record<string, unknown>;
	const reconcile = (): ReturnType<typeof reconcileFieldLineage> => reconcileFieldLineage({
		dataRoot: options.dataRoot,
		factsRoot: options.factsRoot,
		tableLineage,
		rootTaskId: options.taskId,
		rootTable: options.targetTable,
		rootWriteObservationIds: options.writeObservationIds,
		rootFields: options.fields,
		factsPolicy: options.factsPolicy,
		maxDepth: options.maxDepth,
		maxStates: options.maxStates,
		maxPaths: options.maxPaths,
	});
	let artifact: ReturnType<typeof reconcileFieldLineage>;
	if (options.prepareFacts) {
		const available = availableTaskIds(options.dataRoot);
		const tableCatalog = loadPhysicalTableCatalog(options.dataRoot);
		const attempted = new Set<string>();
		const prepare = (taskIds: readonly string[]): void => {
			for (const taskId of [...new Set(taskIds)].filter((id) => available.has(id) && !attempted.has(id)).sort()) {
				attempted.add(taskId);
				try {
					runInputPackMachineFacts({
						dataRoot: options.dataRoot,
						taskIds: [taskId],
						outputRoot: options.factsRoot,
						tableCatalog,
					});
				} catch (error) {
					if (taskId === options.taskId) throw error;
					process.stderr.write(`Machine Facts preparation skipped ${taskId}: ${error instanceof Error ? error.message : String(error)}\n`);
				}
			}
		};

		prepare([options.taskId]);
		artifact = reconcile();
		while (true) {
			const missingTaskIds = artifact.gaps
				.filter((gap) => gap.reasonCode === "MACHINE_FACTS_UNAVAILABLE")
				.map((gap) => gap.taskId)
				.filter((taskId) => available.has(taskId) && !attempted.has(taskId));
			if (missingTaskIds.length === 0) break;
			prepare(missingTaskIds);
			artifact = reconcile();
		}
	} else artifact = reconcile();
	const output = resolve(options.output);
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, `${canonicalJson(artifact)}\n`, "utf8");
	if (options.summaryOutput) {
		const summary = resolve(options.summaryOutput);
		mkdirSync(dirname(summary), { recursive: true });
		writeFileSync(summary, formatFieldLineageSummary(artifact), "utf8");
	}
	return artifact;
}

if (process.argv[1] && basename(process.argv[1]).startsWith("reconcile-field-lineage")) {
	const artifact = runFieldLineageCli(parseCli(process.argv.slice(2)));
	process.stdout.write(`${JSON.stringify({ output: resolve(option(process.argv.slice(2), "--output")!), status: artifact.overallStatus, counts: artifact.counts }, null, 2)}\n`);
}
