import { useCallback, useEffect, useRef } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import type { LineageNodeData } from "../graph-adapter";
import type { GraphNode, TerminalNode } from "../types";
import { TaskNode } from "./TaskNode";

const names: Record<string, string> = {
  TASK: "任务",
  PHYSICAL_DATASET: "物理表",
  PHYSICAL_FIELD: "物理字段",
  READ_FIELD: "表字段",
  WRITE_FIELD: "表字段",
  READ_OCCURRENCE: "表读取",
  TARGET_WRITE: "表写入",
};

function terminalCopy(terminal: TerminalNode) {
  const boundary =
    terminal.role === "REFERENCE_CONFIG"
      ? "定义/参数边界"
      : terminal.role === "SOURCE_ENDPOINT"
        ? "源端点边界"
        : "追溯边界";
  return `${boundary} · ${terminal.reason}`;
}

function FieldRow({
  member,
  terminal,
  onFieldClick,
  highlightActive = false,
  active = true,
  aliases = [],
}: {
  member: GraphNode;
  terminal?: TerminalNode;
  onFieldClick?: LineageNodeData["onFieldClick"];
  highlightActive?: boolean;
  active?: boolean;
  aliases?: GraphNode[];
}) {
  const handleNodes = [member, ...aliases].filter(
    (alias, index, all) =>
      all.findIndex((candidate) => candidate.id === alias.id) === index,
  );
  return (
    <button
      className={`field-row ${terminal ? "terminal" : ""}`}
      data-highlight={highlightActive ? (active ? "active" : "dimmed") : "none"}
      style={{
        position: "relative",
        opacity: highlightActive && !active ? 0.28 : 1,
        background: highlightActive && active ? "#d8f1e8" : undefined,
        boxShadow:
          highlightActive && active ? "inset 0 0 0 1px #26746d" : undefined,
      }}
      title={terminal?.reason ?? member.id}
      onClick={(event) => {
        event.stopPropagation();
        onFieldClick?.(member, terminal);
      }}
    >
      {handleNodes.map((alias) => (
        <Handle
          key={`in:${alias.id}`}
          id={alias.id}
          type="target"
          position={Position.Left}
        />
      ))}
      <span>{member.column ?? member.label ?? member.id}</span>
      {terminal && <small>{terminalCopy(terminal)}</small>}
      {handleNodes.map((alias) => (
        <Handle
          key={`out:${alias.id}`}
          id={alias.id}
          type="source"
          position={Position.Right}
        />
      ))}
    </button>
  );
}

export function LineageNode(props: NodeProps) {
  const { data } = props;
  const updateNodeInternals = useUpdateNodeInternals();
  const fieldListRef = useRef<HTMLDivElement | null>(null);
  const clampFieldHandles = useCallback(() => {
    const list = fieldListRef.current;
    if (!list) return;
    const bounds = list.getBoundingClientRect();
    for (const row of list.querySelectorAll<HTMLElement>(".field-row")) {
      const rowBounds = row.getBoundingClientRect();
      const scale =
        row.offsetHeight > 0 ? rowBounds.height / row.offsetHeight : 1;
      const top = bounds.top + 7 * scale;
      const bottom = bounds.bottom - 7 * scale;
      const center = rowBounds.top + rowBounds.height / 2;
      const clamped = Math.max(top, Math.min(bottom, center));
      row.style.setProperty(
        "--handle-shift",
        `${(clamped - center) / scale}px`,
      );
    }
    requestAnimationFrame(() => updateNodeInternals(props.id));
  }, [props.id, updateNodeInternals]);
  useEffect(() => {
    const frame = requestAnimationFrame(clampFieldHandles);
    return () => cancelAnimationFrame(frame);
  }, [clampFieldHandles, (data as LineageNodeData).members?.length]);
  const nodeData = data as LineageNodeData;
  const fieldAliases =
    (
      nodeData as LineageNodeData & {
        fieldAliases?: Record<string, GraphNode[]>;
      }
    ).fieldAliases ?? {};
  const { raw, members, terminal, memberTerminals = {}, isAnchor } = nodeData;
  if (raw?.kind === "TASK") return <TaskNode {...props} />;
  if (members?.length) {
    const first = members[0]!;
    return (
      <div
        className={`lineage-node grouped ${isAnchor ? "anchor" : ""} ${Object.keys(memberTerminals).length ? "terminal" : ""}`}
        title={first.table}
      >
        <div className="node-topline">
          <span>{names[first.kind] ?? first.kind}</span>
          <span
            title={first.writeId ?? String(first.detail?.occurrenceId ?? "")}
          >
            任务 {first.taskId ?? "—"}
          </span>
        </div>
        <strong>{first.table ?? first.label ?? first.id}</strong>
        <small>{members.length} 个字段 · 点击字段查看依据</small>
        <div
          className="field-rows"
          ref={fieldListRef}
          onScroll={clampFieldHandles}
        >
          {members.map((member) => (
            <FieldRow
              key={member.id}
              member={member}
              terminal={memberTerminals[member.id]}
              onFieldClick={nodeData.onFieldClick}
              highlightActive={nodeData.highlightActive}
              active={
                nodeData.activeFieldIds?.includes(member.id) ||
                (fieldAliases[member.id] ?? []).some((alias) =>
                  nodeData.activeFieldIds?.includes(alias.id),
                )
              }
              aliases={fieldAliases[member.id] ?? []}
            />
          ))}
        </div>
        {!!nodeData.candidateCount && nodeData.onExpandCandidates && (
          <button
            type="button"
            className="table-candidate-badge"
            aria-expanded={nodeData.candidatesExpanded}
            onClick={(event) => {
              event.stopPropagation();
              nodeData.onExpandCandidates?.();
            }}
          >
            候选生产任务 {nodeData.candidateCount} ·{" "}
            {nodeData.candidatesExpanded ? "收起" : "展开"}
          </button>
        )}
      </div>
    );
  }

  if (!raw) return null;
  if (raw.kind.includes("FIELD"))
    return (
      <div
        className={`lineage-node ${isAnchor ? "anchor" : ""} ${terminal ? "terminal" : ""}`}
      >
        <div className="node-topline">
          <span>{names[raw.kind] ?? raw.kind}</span>
        </div>
        <strong>{raw.table ?? raw.label ?? raw.id}</strong>
        <FieldRow
          member={raw}
          terminal={terminal}
          onFieldClick={nodeData.onFieldClick}
          highlightActive={nodeData.highlightActive}
          active={nodeData.activeFieldIds?.includes(raw.id)}
          aliases={fieldAliases[raw.id] ?? []}
        />
      </div>
    );

  const title = raw.label || raw.table || raw.id;
  const context =
    raw.kind === "TASK"
      ? `任务 ${raw.taskId ?? raw.id.replace(/^task:/, "")}`
      : raw.table;
  return (
    <div
      className={`lineage-node ${isAnchor ? "anchor" : ""} ${terminal ? "terminal" : ""}`}
      title={raw.id}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-topline">
        <span>{names[raw.kind] ?? raw.kind}</span>
        {raw.writeId && <span>{raw.writeId}</span>}
      </div>
      <strong>{title}</strong>
      <small>{context}</small>
      {terminal && (
        <span className="terminal-copy">{terminalCopy(terminal)}</span>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
