import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { SqlCode } from "./SqlCode";
import { isSameGraphVersion } from "../contract";
import type {
  GraphNode,
  MetadataStatus,
  TaskDetail,
  TerminalNode,
} from "../types";
const labels: Record<string, string> = {
  filter: "过滤条件",
  join: "Join",
  aggregate: "分组与聚合",
  window: "窗口",
  setop: "分支合并",
};
const metadataStatus: Record<MetadataStatus, string> = {
  AVAILABLE: "已收录",
  ANNOTATION_NOT_RECORDED: "未收录注释",
  METADATA_UNAVAILABLE: "元数据不可用",
  METADATA_READ_FAILED: "元数据读取失败",
};

function uniformValue(values: Array<string | undefined>): string | undefined {
  if (!values.length || values.some((value) => !value)) return undefined;
  const unique = new Set(values);
  return unique.size === 1 ? values[0] : undefined;
}

function evidenceIdentity(detail: TaskDetail): {
  column?: string;
  writeId?: string;
} {
  return {
    column:
      detail.requestedColumn ??
      uniformValue(detail.bindings.map(({ column }) => column)),
    writeId:
      detail.requestedWriteId ??
      uniformValue(detail.bindings.map(({ writeId }) => writeId)),
  };
}

function TaskEvidence({ detail }: { detail: TaskDetail }) {
  const identity = evidenceIdentity(detail);
  const stateKey = `${detail.version}|${detail.taskId}|${identity.column ?? ""}|${identity.writeId ?? ""}`;
  const requestSequence = useRef(0);
  const [sql, setSql] = useState<TaskDetail["sqlSources"]>(),
    [sqlLoading, setSqlLoading] = useState(false),
    [sqlError, setSqlError] = useState("");

  useEffect(() => {
    requestSequence.current += 1;
    setSql(undefined);
    setSqlLoading(false);
    setSqlError("");
  }, [stateKey]);

  async function loadSql() {
    if (sql || sqlLoading) return;
    const sequence = ++requestSequence.current;
    setSqlLoading(true);
    setSqlError("");
    try {
      const value = await api.task(detail.taskId, {
        column: identity.column,
        writeId: identity.writeId,
        sql: true,
      });
      if (sequence !== requestSequence.current) return;
      if (!isSameGraphVersion(detail.version, value.version)) {
        setSqlError("图谱版本已更新，请重新展开后读取 SQL。");
        return;
      }
      setSql(value.sqlSources ?? []);
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setSqlError(cause instanceof Error ? cause.message : "SQL 读取失败");
    } finally {
      if (sequence === requestSequence.current) setSqlLoading(false);
    }
  }

  return (
    <section className="task-evidence">
      <h3>{detail.taskName ?? `任务 ${detail.taskId}`}</h3>
      {detail.taskName && (
        <p className="scheduler-task-name">
          <b>调度任务名：</b>
          {detail.taskName}
        </p>
      )}
      <p className="scheduler-task-name">
        <b>负责人：</b>
        {detail.owner?.split(",").map((owner) => owner.trim()).filter(Boolean).join("、") || "未收录"}
      </p>
      <div className="badges">
        <span>任务 {detail.taskId}</span>
        {identity.writeId ? (
          <span>写入 {identity.writeId}</span>
        ) : (
          <span>写入身份未明确</span>
        )}
        {detail.taskCategory && <span>{detail.taskCategory}</span>}
        <span>
          {detail.coverage === "PROJECTED" ? "字段投影已发布" : "材料范围"}
        </span>
      </div>
      {detail.failureReason && (
        <p className="warning">材料缺口：{detail.failureReason}</p>
      )}
      {detail.bindings.map((binding, index) => (
        <section
          key={`${binding.writeId ?? "unknown-write"}-${binding.column}-${index}`}
          className="evidence"
        >
          <b>{binding.column}</b>
          {binding.valueOrigin && <p className="value-origin-detail">{binding.valueOrigin.label}</p>}
          <pre>{binding.expression ?? "当前没有字段表达式"}</pre>
          {binding.writeId && <code>{binding.writeId}</code>}
          {binding.inputFields?.map((field) => (
            <small key={`${field.table}.${field.column}`}>
              {field.table}.{field.column}
            </small>
          ))}
        </section>
      ))}
      <h3>加工条件</h3>
      {detail.controls.length ? (
        detail.controls.slice(0, 35).map((control, index) => (
          <section className="control" key={index}>
            <b>
              {labels[control.kind] ?? control.kind} {control.joinType ?? ""}
            </b>
            <p>
              {control.condition ??
                control.sourceText ??
                JSON.stringify(control.groupBy ?? control.window ?? "详见 SQL")}
            </p>
          </section>
        ))
      ) : (
        <p className="muted">当前没有独立条件记录。</p>
      )}
      <details
        onToggle={(event) => {
          if (event.currentTarget.open) void loadSql();
        }}
      >
        <summary>读取 SQL 原文</summary>
        {sqlLoading && <p className="muted">正在读取…</p>}
        {sqlError && <p className="warning">{sqlError}</p>}
        {sql?.map((source) => (
          <section key={source.slot}>
            <SqlCode source={source.content} label={source.slot} />
          </section>
        ))}
      </details>
    </section>
  );
}

export function DetailPanel({
  node,
  terminal,
  detail,
  details,
  loading,
  onContinue,
}: {
  node?: GraphNode;
  terminal?: TerminalNode;
  detail?: TaskDetail;
  details?: TaskDetail[];
  loading: boolean;
  onContinue?: () => void;
}) {
  const evidenceDetails = details?.length ? details : detail ? [detail] : [];
  if (loading)
    return (
      <aside className="detail panel">
        <h2>加工证据</h2>
        <p className="muted">正在读取证据…</p>
      </aside>
    );
  if (!node && !evidenceDetails.length)
    return (
      <aside className="detail panel">
        <h2>加工证据</h2>
        <p className="muted">点击任务或字段，查看公式、加工条件和停止原因。</p>
      </aside>
    );
  return (
    <aside className="detail panel">
      <h2>加工证据</h2>
      {node && (
        <>
          <div className="eyebrow">{node.kind}</div>
          <h3>{node.column ?? node.label ?? node.table ?? node.id}</h3>
          <code className="identity">{node.id}</code>
          {node.metadata && (
            <section className="metadata-detail">
              <h3>表说明与字段注释</h3>
              {node.metadata.schema && (
                <p>
                  <b>数据域：</b>
                  {node.metadata.schema.displayName}
                  {node.metadata.schema.displayName &&
                  node.metadata.schema.description
                    ? " · "
                    : ""}
                  {node.metadata.schema.description}
                </p>
              )}
              <p>
                <b>表说明：</b>
                {node.metadata.table.description ??
                  metadataStatus[node.metadata.table.status]}
              </p>
              {node.column && (
                <>
                  <p>
                    <b>字段注释：</b>
                    {node.metadata.field?.comment ??
                      metadataStatus[
                        node.metadata.field?.status ?? "METADATA_UNAVAILABLE"
                      ]}
                  </p>
                  <p>
                    <b>字段类型：</b>
                    {node.metadata.field?.rawType ?? "未收录"}
                  </p>
                  <p>
                    <b>字段顺序：</b>
                    {node.metadata.field?.ordinal === undefined
                      ? "未收录"
                      : node.metadata.field.ordinal + 1}
                    {node.metadata.field?.partition ? " · 分区字段" : ""}
                  </p>
                </>
              )}
              <details>
                <summary>查看元数据来源</summary>
                <p>来源：{node.metadata.source ?? "未提供"}</p>
                {node.metadata.collectedAt && (
                  <p>采集时间：{node.metadata.collectedAt}</p>
                )}
                {node.metadata.contentHash && (
                  <p>内容版本：{node.metadata.contentHash}</p>
                )}
                {node.metadata.sourceHash && (
                  <p>来源文件 hash：{node.metadata.sourceHash}</p>
                )}
                {node.metadata.ddlHash && (
                  <p>DDL hash：{node.metadata.ddlHash}</p>
                )}
                {node.metadata.metadataCatalog?.version && (
                  <p>元数据目录版本：{node.metadata.metadataCatalog.version}</p>
                )}
                {node.metadata.metadataCatalog?.builtAt && (
                  <p>目录更新时间：{node.metadata.metadataCatalog.builtAt}</p>
                )}
                {node.metadata.versionRelation && (
                  <p className="muted">
                    注释来自当前 Table Input
                    Pack，不等同于画布的已发布图谱版本。
                  </p>
                )}
              </details>
            </section>
          )}
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
      {evidenceDetails.map((item, index) => {
        const identity = evidenceIdentity(item);
        return (
          <TaskEvidence
            key={`${item.version}|${item.taskId}|${identity.column ?? ""}|${identity.writeId ?? ""}|${index}`}
            detail={item}
          />
        );
      })}
    </aside>
  );
}
