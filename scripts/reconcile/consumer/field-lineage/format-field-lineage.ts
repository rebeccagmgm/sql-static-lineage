import type { FieldLineageArtifact, FieldLineageNode } from "./field-lineage-contract.ts";

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function label(taskId: string, names: ReadonlyMap<string, string | null>): string {
	const name = names.get(taskId);
	return name && name !== taskId ? `${taskId}:${name}` : taskId;
}

function renderTree(
	rootTaskId: string,
	children: ReadonlyMap<string, readonly { taskId: string; marker?: string }[]>,
	names: ReadonlyMap<string, string | null>,
): string[] {
	const lines = [label(rootTaskId, names)];
	const visit = (taskId: string, prefix: string, active: ReadonlySet<string>): void => {
		const upstream = [...(children.get(taskId) ?? [])].sort((left, right) => compareText(`${left.marker ?? ""}|${left.taskId}`, `${right.marker ?? ""}|${right.taskId}`));
		upstream.forEach((item, index) => {
			const last = index === upstream.length - 1;
			const suffix = item.marker ? ` [${item.marker}]` : "";
			const cycle = active.has(item.taskId);
			lines.push(`${prefix}${last ? "└── " : "├── "}${label(item.taskId, names)}${suffix}${cycle ? " [CYCLE]" : ""}`);
			if (!cycle) visit(item.taskId, `${prefix}${last ? "    " : "│   "}`, new Set([...active, item.taskId]));
		});
	};
	visit(rootTaskId, "", new Set([rootTaskId]));
	return lines;
}

function taskNames(artifact: FieldLineageArtifact): Map<string, string | null> {
	const names = new Map<string, string | null>();
	for (const node of artifact.nodes) if (!names.has(node.taskId) || (!names.get(node.taskId) && node.taskName)) names.set(node.taskId, node.taskName);
	return names;
}

function fieldLabel(node: FieldLineageNode): string {
	return `${node.field.qualifiedName}.${node.field.column}`;
}

export function formatFieldLineageSummary(artifact: FieldLineageArtifact): string {
	const names = taskNames(artifact);
	const tableChildren = new Map<string, { taskId: string; marker?: string }[]>();
	for (const edge of artifact.tableEdges) {
		const values = tableChildren.get(edge.consumerTaskId) ?? [];
		values.push({ taskId: edge.producerTaskId, ...(edge.classification === "PRIMARY" ? {} : { marker: edge.classification }) });
		tableChildren.set(edge.consumerTaskId, values);
	}
	const fieldChildren = new Map<string, { taskId: string }[]>();
	for (const edge of artifact.edges) {
		if (!edge.producerTaskId) continue;
		const values = fieldChildren.get(edge.consumerTaskId) ?? [];
		if (!values.some((item) => item.taskId === edge.producerTaskId)) values.push({ taskId: edge.producerTaskId });
		fieldChildren.set(edge.consumerTaskId, values);
	}
	const lines = [
		`字段级跨 Task 血缘：${artifact.request.rootTaskId}`,
		`状态: ${artifact.overallStatus} | facts policy: ${artifact.request.factsPolicy}`,
		`根表: ${artifact.request.rootTable}`,
		`字段范围: ${artifact.request.rootFieldSelection === "ALL_TARGET_COLUMNS" ? "目标表全部字段" : "用户指定字段"}`,
		`根字段: ${artifact.request.rootFields.join(", ")}`,
		"",
		"全量上游 Task 树",
		...renderTree(artifact.request.rootTaskId, tableChildren, names),
		"",
		"字段 VALUE_FLOW Task 树",
		...renderTree(artifact.request.rootTaskId, fieldChildren, names),
		"",
		"字段映射",
	];
	const nodeById = new Map(artifact.nodes.map((node) => [node.nodeId, node]));
	const mappings = artifact.edges
		.map((edge) => ({ edge, from: nodeById.get(edge.fromNodeId), to: nodeById.get(edge.toNodeId) }))
		.filter((item): item is typeof item & { from: FieldLineageNode; to: FieldLineageNode } => Boolean(item.from && item.to))
		.sort((left, right) => compareText(`${left.edge.consumerTaskId}|${left.edge.edgeId}`, `${right.edge.consumerTaskId}|${right.edge.edgeId}`));
	if (mappings.length === 0) lines.push("- 无可证明字段映射");
	for (const item of mappings)
		lines.push(`- ${item.from.taskId}:${fieldLabel(item.from)} -> ${item.to.taskId}:${fieldLabel(item.to)} [${item.edge.evidenceStatus}]`);
	lines.push("", "ROWSET_CONTROL");
	if (artifact.rowsetControls.length === 0) lines.push("- 无可证明行集控制注解");
	for (const control of artifact.rowsetControls)
		lines.push(`- ${control.taskId}:${control.controlType} ${control.fields.map((field) => `${field.qualifiedName}.${field.column}`).join(", ") || "字段作用域未解析"} [${control.evidenceStatus}${control.reasonCode ? `/${control.reasonCode}` : ""}]`);
	lines.push("", "候选与缺口");
	if (artifact.candidates.length === 0 && artifact.gaps.length === 0) lines.push("- 无");
	for (const candidate of artifact.candidates)
		lines.push(`- CANDIDATE ${candidate.consumerTaskId} <- ${candidate.producerTaskId}: ${candidate.reasonCode}`);
	for (const gap of artifact.gaps) lines.push(`- UNRESOLVED ${gap.taskId}: ${gap.reasonCode} — ${gap.message}`);
	lines.push(
		"",
		`边界: static SQL only；调度运行、数据正确性、业务验收均未评估。`,
		`计数: nodes=${artifact.counts.nodes}, edges=${artifact.counts.edges}, controls=${artifact.counts.rowsetControls}, candidates=${artifact.counts.candidates}, gaps=${artifact.counts.gaps}`,
	);
	return `${lines.join("\n")}\n`;
}
