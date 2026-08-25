import type { SourceSpan } from "../plan-contract.js";

export type SpanNode = {
	start?: { start?: number } | null;
	stop?: { stop?: number } | null;
};

/** IR 节点 (cell 坐标) → 文档坐标 SourceSpan。 */
export function spanOf(
	cellBase: number,
	node: SpanNode | null | undefined,
): SourceSpan {
	const start = node?.start?.start;
	const stop = node?.stop?.stop;
	if (start === undefined || stop === undefined)
		return { start: cellBase, end: cellBase };
	return {
		start: cellBase + start,
		end: cellBase + stop + 1,
	};
}

export function spanOfCst(
	cellBase: number,
	cst: unknown,
): SourceSpan {
	return spanOf(cellBase, cst as SpanNode);
}

const DISPLAY_MAX = 120;

/** 完整表达式文本 (不截断，空白按现有 adapter 规则规范化)。 */
export function fullTextOf(
	sql: string,
	cellBase: number,
	node: SpanNode | null | undefined,
): string {
	const s = spanOf(cellBase, node);
	return sql.slice(s.start, s.end).replace(/\s+/g, " ").trim();
}

/** 截断预览 (人看)。 */
export function displayTextOf(
	sql: string,
	cellBase: number,
	node: SpanNode | null | undefined,
): string {
	const text = fullTextOf(sql, cellBase, node);
	return text.length > DISPLAY_MAX
		? text.slice(0, DISPLAY_MAX) + "…"
		: text;
}
