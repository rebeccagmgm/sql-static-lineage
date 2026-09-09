import { useState } from "react";
import { api } from "../api";
import { isSameGraphVersion } from "../contract";
import type { GraphNode, TaskDetail, TerminalNode } from "../types";
const labels: Record<string, string> = {
  filter: "过滤条件",
  join: "Join",
  aggregate: "分组与聚合",
  window: "窗口",
  setop: "分支合并",
};
export function DetailPanel({
  node,
  terminal,
  detail,
  loading,
  onContinue,
}: {
  node?: GraphNode;
  terminal?: TerminalNode;
  detail?: TaskDetail;
  loading: boolean;
  onContinue?: () => void;
}) {
  const [sql, setSql] = useState<TaskDetail["sqlSources"]>(),
    [sqlLoading, setSqlLoading] = useState(false),
    [sqlError, setSqlError] = useState("");
  if (loading)
    return (
      <aside className="detail panel">
        <h2>加工证据</h2>
        <p className="muted">正在读取证据…</p>
      </aside>
    );
  if (!node && !detail)
    return (
      <aside className="detail panel">
        <h2>加工证据</h2>
        <p className="muted">点击任务或字段，查看公式、加工条件和停止原因。</p>
      </aside>
    );
  async function loadSql() {
    if (!detail || sql || sqlLoading) return;
    setSqlLoading(true);
    setSqlError("");
    try {
      const value = await api.task(detail.taskId, { sql: true });
      if (!isSameGraphVersion(detail.version, value.version)) {
        setSqlError("图谱版本已更新，请重新展开后读取 SQL。");
        return;
      }
      setSql(value.sqlSources ?? []);
    } catch (cause) {
      setSqlError(cause instanceof Error ? cause.message : "SQL 读取失败");
    } finally {
      setSqlLoading(false);
    }
  }
  return (
    <aside className="detail panel">
      <h2>加工证据</h2>
      {node && (
        <>
          <div className="eyebrow">{node.kind}</div>
          <h3>{node.column ?? node.label ?? node.table ?? node.id}</h3>
          <code className="identity">{node.id}</code>
        </>
      )}
      {terminal && (
        <div className="terminal-box">
          <b>追溯在此停止</b>
          <p>{terminal.reason}</p>
          {terminal.ruleRef && <code>{terminal.ruleRef}</code>}
        </div>
      )}
      {node?.kind?.includes("FIELD") && !terminal && onContinue && (
        <button className="continue-button" onClick={onContinue}>
          以此字段继续追溯
        </button>
      )}
      {detail && (
        <>
          <div className="badges">
            <span>任务 {detail.taskId}</span>
            {detail.taskCategory && <span>{detail.taskCategory}</span>}
            <span>
              {detail.coverage === "PROJECTED" ? "字段投影已发布" : "材料范围"}
            </span>
          </div>
          {detail.failureReason && (
            <p className="warning">材料缺口：{detail.failureReason}</p>
          )}
          {detail.bindings.map((b, i) => (
            <section key={`${b.writeId}-${b.column}-${i}`} className="evidence">
              <b>{b.column}</b>
              <pre>{b.expression ?? "当前没有字段表达式"}</pre>
              {b.writeId && <code>{b.writeId}</code>}
              {b.inputFields?.map((f) => (
                <small key={`${f.table}.${f.column}`}>
                  {f.table}.{f.column}
                </small>
              ))}
            </section>
          ))}
          <h3>加工条件</h3>
          {detail.controls.length ? (
            detail.controls.slice(0, 35).map((c, i) => (
              <section className="control" key={i}>
                <b>
                  {labels[c.kind] ?? c.kind} {c.joinType ?? ""}
                </b>
                <p>
                  {c.condition ??
                    c.sourceText ??
                    JSON.stringify(c.groupBy ?? c.window ?? "详见 SQL")}
                </p>
              </section>
            ))
          ) : (
            <p className="muted">当前没有独立条件记录。</p>
          )}
          <details
            onToggle={(e) => {
              if (e.currentTarget.open) void loadSql();
            }}
          >
            <summary>读取 SQL 原文</summary>
            {sqlLoading && <p className="muted">正在读取…</p>}
            {sqlError && <p className="warning">{sqlError}</p>}
            {sql?.map((s) => (
              <section key={s.slot}>
                <b>{s.slot}</b>
                <pre>{s.content}</pre>
              </section>
            ))}
          </details>
        </>
      )}
    </aside>
  );
}
