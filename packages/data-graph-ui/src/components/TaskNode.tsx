import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { LineageNodeData } from "../graph-adapter";

export interface TaskPort {
  id: string;
  label: string;
  direction: "input" | "output";
  fieldNodeId: string;
}

export type TaskNodeData = LineageNodeData & {
  taskPorts?: TaskPort[];
  candidateCount?: number;
  candidatesExpanded?: boolean;
  onExpandCandidates?: () => void;
};

export function TaskNode({ data: rawData }: NodeProps) {
  const data = rawData as TaskNodeData;
  const taskId = data.raw?.taskId ?? data.raw?.id.replace(/^task:/, "") ?? "—";
  const taskName =
    (typeof data.raw?.detail?.taskName === "string" &&
      data.raw.detail.taskName.trim()) ||
    undefined;
  const ports = data.taskPorts ?? [];
  const inputs = ports.filter((port) => port.direction === "input");
  const outputs = ports.filter((port) => port.direction === "output");
  const handles = (
    items: TaskPort[],
    type: "target" | "source",
    position: Position,
  ) =>
    items.map((port, index) => (
      <Handle
        key={port.id}
        id={port.id}
        type={type}
        position={position}
        title={`${port.direction === "input" ? "输入" : "输出"} · ${port.label}`}
        style={{ top: `${24 + ((index + 1) / (items.length + 1)) * 56}%` }}
      />
    ));
  return (
    <div
      className={`task-node ${data.isAnchor ? "anchor" : ""}`}
      title={`${taskName ? `${taskName} · ` : ""}调度任务 ${taskId} · ${Math.max(inputs.length, outputs.length)} 条字段映射 · 点击查看加工依据`}
    >
      {ports.length ? (
        handles(inputs, "target", Position.Left)
      ) : (
        <Handle type="target" position={Position.Left} />
      )}
      <strong>调度 {taskId}</strong>
      {taskName && <small className="task-node-name">{taskName}</small>}
      {data.candidateCount ? (
        <button
          className="task-candidate-badge"
          type="button"
          disabled={!data.onExpandCandidates}
          onClick={(event) => {
            event.stopPropagation();
            data.onExpandCandidates?.();
          }}
        >
          候选来源 {data.candidateCount} ·{" "}
          {data.candidatesExpanded ? "收起" : "展开"}
        </button>
      ) : null}
      {ports.length ? (
        handles(outputs, "source", Position.Right)
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
