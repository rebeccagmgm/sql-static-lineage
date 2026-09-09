import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphNode } from "../types";

export interface TaskOption {
  taskId: string;
  count: number;
}
export interface FieldChoice {
  field: GraphNode;
  occurrenceLabel?: string;
}
const taskIdentity = (field: GraphNode) => field.taskId || "未标注";

export function taskOptions(fields: GraphNode[]): TaskOption[] {
  const counts = new Map<string, number>();
  for (const field of fields)
    counts.set(taskIdentity(field), (counts.get(taskIdentity(field)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([taskId, count]) => ({ taskId, count }))
    .sort((a, b) =>
      a.taskId.localeCompare(b.taskId, "zh-CN", { numeric: true }),
    );
}

export function fieldChoices(
  fields: GraphNode[],
  taskId: string,
  fieldSearch: string,
): FieldChoice[] {
  const needle = fieldSearch.trim().toLowerCase();
  const filtered = fields
    .filter((field) => !taskId || taskIdentity(field) === taskId)
    .filter(
      (field) =>
        !needle ||
        String(field.column ?? "")
          .toLowerCase()
          .includes(needle),
    )
    .sort((a, b) => {
      const task = taskIdentity(a).localeCompare(taskIdentity(b), "zh-CN", {
        numeric: true,
      });
      return (
        task ||
        String(a.column ?? "").localeCompare(String(b.column ?? ""), "zh-CN") ||
        String(a.writeId ?? a.id).localeCompare(String(b.writeId ?? b.id))
      );
    });
  const siblings = new Map<string, GraphNode[]>();
  for (const field of fields) {
    const key = `${taskIdentity(field)}\u0000${String(field.column ?? "").toLowerCase()}`;
    const group = siblings.get(key) ?? [];
    group.push(field);
    siblings.set(key, group);
  }
  return filtered.map((field) => {
    const key = `${taskIdentity(field)}\u0000${String(field.column ?? "").toLowerCase()}`;
    const group = (siblings.get(key) ?? [field]).sort((a, b) =>
      String(a.writeId ?? a.id).localeCompare(String(b.writeId ?? b.id)),
    );
    return {
      field,
      occurrenceLabel:
        group.length > 1
          ? `写入 ${group.findIndex((item) => item.id === field.id) + 1}/${group.length}`
          : undefined,
    };
  });
}

export function toggleAllVisible(
  selectedIds: string[],
  visibleIds: string[],
  checked: boolean,
): string[] {
  const visible = new Set(visibleIds);
  if (!checked) return selectedIds.filter((id) => !visible.has(id));
  return [
    ...selectedIds,
    ...visibleIds.filter((id) => !selectedIds.includes(id)),
  ];
}

export function FieldSelector(props: {
  fields: GraphNode[];
  selectedIds: string[];
  hasMore: boolean;
  onChange: (ids: string[]) => void;
  onLoadMore: () => void;
}) {
  const [fieldSearch, setFieldSearch] = useState(""),
    [taskId, setTaskId] = useState(""),
    [open, setOpen] = useState(false);
  const options = useMemo(() => taskOptions(props.fields), [props.fields]);
  const choices = useMemo(
    () => fieldChoices(props.fields, taskId.trim(), fieldSearch),
    [props.fields, taskId, fieldSearch],
  );
  const selected = new Set(props.selectedIds),
    visibleIds = new Set(choices.map(({ field }) => field.id));
  const visibleSelected = props.selectedIds.filter((id) =>
      visibleIds.has(id),
    ).length,
    hiddenSelected = props.selectedIds.length - visibleSelected;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const allVisibleSelected =
    choices.length > 0 && visibleSelected === choices.length;
  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate =
        visibleSelected > 0 && !allVisibleSelected;
  }, [allVisibleSelected, visibleSelected]);
  const toggle = (id: string) =>
    selected.has(id)
      ? props.onChange(props.selectedIds.filter((item) => item !== id))
      : props.onChange([...props.selectedIds, id]);
  let currentTask = "";
  return (
    <div className="field-picker">
      <button
        type="button"
        className="field-picker-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        已选 {props.selectedIds.length} 个字段
      </button>
      {open && (
        <div className="field-picker-popover">
          <label className="field-search">
            <span>调度 ID（当前已加载字段）</span>
            <input
              list="loaded-task-ids"
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              placeholder="输入精确调度 ID"
            />
            <datalist id="loaded-task-ids">
              {options.map((option) => (
                <option key={option.taskId} value={option.taskId}>
                  {option.count} 个字段
                </option>
              ))}
            </datalist>
          </label>
          <label className="field-search">
            <span>字段名</span>
            <input
              value={fieldSearch}
              onChange={(event) => setFieldSearch(event.target.value)}
              placeholder="只搜索字段名"
            />
          </label>
          <p className="field-selection-summary">
            当前已加载范围匹配 {choices.length} 个，已选 {visibleSelected} 个
            {hiddenSelected
              ? `；另有 ${hiddenSelected} 个已选字段被筛选隐藏`
              : ""}
          </p>
          <div className="field-picker-actions">
            <label className="select-all-fields">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                disabled={!choices.length}
                onChange={(event) =>
                  props.onChange(
                    toggleAllVisible(
                      props.selectedIds,
                      choices.map(({ field }) => field.id),
                      event.target.checked,
                    ),
                  )
                }
              />
              全选当前筛选（已加载）
            </label>
            <button type="button" onClick={() => props.onChange([])}>
              清空全部选择
            </button>
          </div>
          <div className="field-picker-list">
            {choices.map(({ field, occurrenceLabel }) => {
              const nextTask = taskIdentity(field),
                heading = nextTask !== currentTask;
              currentTask = nextTask;
              return (
                <div key={field.id}>
                  {heading && (
                    <div className="field-task-heading">调度 ID {nextTask}</div>
                  )}
                  <label title={field.writeId || field.id}>
                    <input
                      type="checkbox"
                      checked={selected.has(field.id)}
                      disabled={false}
                      onChange={() => toggle(field.id)}
                    />
                    <span>
                      <b>{field.column}</b>
                      <small>{occurrenceLabel ?? "单一写入"}</small>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
          {props.hasMore && (
            <button
              type="button"
              className="load-more"
              onClick={props.onLoadMore}
            >
              加载更多字段
            </button>
          )}
          {!choices.length && (
            <p className="muted">
              当前已加载范围未匹配，可调整调度 ID 或加载更多字段。
            </p>
          )}
        </div>
      )}
      {!props.selectedIds.length && (
        <span className="field-empty-prompt">
          尚未选择字段，勾选后点击“展开”查询
        </span>
      )}
    </div>
  );
}
