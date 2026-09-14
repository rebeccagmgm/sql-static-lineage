import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailPanel } from "./DetailPanel";
import { SchemaDescription } from "./LineageNode";
import type { TaskDetail } from "../types";

function taskDetail(
  taskId: string,
  taskName: string,
  writeId: string,
  column: string,
  expression: string,
  condition: string,
): TaskDetail {
  return {
    version: "graph-version",
    taskId,
    taskName,
    taskCategory: `category-${taskId}`,
    coverage: "PROJECTED",
    requestedColumn: column,
    requestedWriteId: writeId,
    bindings: [{ column, writeId, expression, outputScope: "FINAL" }],
    controls: [{ kind: "filter", condition }],
  };
}

describe("DetailPanel table metadata", () => {
  it("renders field type, one-based order, partition status and catalog version", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        node={{
          id: "field:demo.busi_date",
          kind: "PHYSICAL_FIELD",
          table: "pdata_n.demo",
          column: "busi_date",
          metadata: {
            table: { status: "AVAILABLE", description: "示例表" },
            schema: {
              displayName: "业务公共区",
              description: "公共业务数据",
            },
            field: {
              status: "AVAILABLE",
              comment: "业务日期",
              rawType: "decimal(18, 4)",
              ordinal: 2,
              partition: true,
            },
            source: "table.json",
            sourceHash: "source-hash",
            ddlHash: "ddl-hash",
            metadataCatalog: {
              status: "READY",
              version: "catalog-version",
              builtAt: "2026-09-10T00:00:00.000Z",
              parserVersion: "parser-version",
            },
            versionRelation: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION",
          },
        }}
      />,
    );

    expect(html).toContain("示例表");
    expect(html).toContain("业务公共区");
    expect(html).toContain("公共业务数据");
    expect(html).toContain("业务日期");
    expect(html).toContain("decimal(18, 4)");
    expect(html).toContain("字段顺序：</b>3 · 分区字段");
    expect(html).toContain("元数据目录版本：catalog-version");
    expect(html).toContain("不等同于画布的已发布图谱版本");
  });
});

describe("SchemaDescription", () => {
  it("renders only the schema display name and description", () => {
    const html = renderToStaticMarkup(
      <SchemaDescription
        schema={{
          displayName: "TITANS 业务库",
          description: "TITANS 相关业务数据",
        }}
      />,
    );

    expect(html).toContain("TITANS 业务库");
    expect(html).toContain("TITANS 相关业务数据");
    expect(html).not.toContain("dataSource");
    expect(html).not.toContain("matchStatus");
  });
});

describe("DetailPanel task evidence", () => {
  it("renders only final outputs and omits intermediate and unknown writes entirely", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        detail={{
          version: "v",
          taskId: "task",
          controls: [],
          bindings: [
            { column: "temporary_field", outputScope: "OTHER" },
            { column: "final_field", outputScope: "FINAL" },
            { column: "uncertain_field", outputScope: "UNKNOWN" },
          ],
        }}
      />,
    );
    expect(html).toContain("<b>final_field</b>");
    expect(html).not.toContain("temporary_field");
    expect(html).not.toContain("uncertain_field");
    expect(html).not.toContain("intermediate-evidence");
    expect(html).not.toContain("暂未取得最终输出字段");
  });

  it("does not fall back to all fields when a stale response lacks output scope", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        detail={{
          version: "v",
          taskId: "task",
          controls: [],
          bindings: [{ column: "unknown_field" }],
        }}
      />,
    );
    expect(html).toContain("暂未取得最终输出字段");
    expect(html).not.toContain("<b>unknown_field</b>");
    expect(html).not.toContain('class="intermediate-evidence"');
  });

  it("renders every task and write detail for one clicked field", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        node={{
          id: "field:visible.amount",
          kind: "PHYSICAL_FIELD",
          table: "visible",
          column: "amount",
        }}
        details={[
          taskDetail(
            "task-a",
            "任务甲",
            "write-a",
            "amount",
            "source_a.amount",
            "source_a.enabled = 1",
          ),
          taskDetail(
            "task-b",
            "任务乙",
            "write-b",
            "amount",
            "source_b.amount * 100",
            "source_b.enabled = 1",
          ),
        ]}
      />,
    );

    expect(html).toContain("任务甲");
    expect(html).toContain("任务乙");
    expect(html).toContain("写入 write-a");
    expect(html).toContain("写入 write-b");
    const text = html.replace(/<[^>]*>/g, "");
    expect(text).toContain("source_a.amount");
    expect(text).toContain("source_b.amount * 100");
    expect(text).toContain("source_a.enabled = 1");
    expect(text).toContain("source_b.enabled = 1");
    expect(html.match(/字段投影已发布/g)).toHaveLength(2);
    expect(html.match(/读取 SQL 原文/g)).toHaveLength(2);
  });

  it("shows each target field annotation and highlights expressions and conditions without repeating SQL toolbars", () => {
    const detail = taskDetail(
      "task",
      "当事人加工",
      "write",
      "pty_id",
      "CONCAT('TIT060-', ID) AS pty_id",
      "status = 1",
    );
    detail.bindings = [
      {
        ...detail.bindings[0]!,
        metadata: {
          table: { status: "AVAILABLE" },
          field: { status: "AVAILABLE", comment: "当事人编号" },
        },
      },
      {
        column: "pty_name",
        outputScope: "FINAL",
        expression: "LONG_NAME AS pty_name",
        metadata: {
          table: { status: "AVAILABLE" },
          field: { status: "AVAILABLE", comment: "当事人名称" },
        },
      },
      {
        column: "missing_comment",
        outputScope: "FINAL",
        metadata: {
          table: { status: "AVAILABLE" },
          field: { status: "ANNOTATION_NOT_RECORDED" },
        },
      },
      {
        column: "unknown_identity",
        outputScope: "FINAL",
        metadata: {
          table: { status: "METADATA_UNAVAILABLE" },
          field: { status: "METADATA_UNAVAILABLE" },
        },
      },
      { column: "not_loaded", outputScope: "FINAL" },
      {
        column: "failed_metadata",
        outputScope: "FINAL",
        metadata: {
          table: { status: "METADATA_READ_FAILED" },
          field: {
            status: "METADATA_READ_FAILED",
            comment: "不得误显示的注释",
          },
        },
      },
    ];
    const html = renderToStaticMarkup(
      <DetailPanel loading={false} detail={detail} />,
    );
    expect(html).toContain("<b>pty_id</b>");
    expect(html).toContain("当事人编号");
    expect(html).toContain("<b>pty_name</b>");
    expect(html).toContain("当事人名称");
    expect(html).toContain("未收录注释");
    expect(html).toContain("元数据不可用");
    expect(html).toContain("注释尚未加载");
    expect(html).toContain("元数据读取失败");
    expect(html).not.toContain("不得误显示的注释");
    expect(html.match(/class="sql-fragment"/g)).toHaveLength(3);
    expect(html).toContain('class="hljs-keyword"');
    expect(html).toContain('class="hljs-string"');
    expect(html).not.toContain("复制 SQL");
  });

  it("keeps the legacy detail prop and does not infer an unknown write", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        details={[]}
        detail={{
          version: "graph-version",
          taskId: "legacy-task",
          bindings: [
            { column: "amount", writeId: "write-a" },
            { column: "amount" },
          ],
          controls: [],
        }}
      />,
    );

    expect(html).toContain("任务 legacy-task");
    expect(html).toContain("写入身份未明确");
    expect(html).toContain("当前没有独立条件记录");
  });

  it("prefers a non-empty details array over the legacy detail prop", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        detail={taskDetail(
          "legacy-task",
          "旧详情",
          "legacy-write",
          "amount",
          "legacy_expression",
          "legacy_condition",
        )}
        details={[
          taskDetail(
            "current-task",
            "当前详情",
            "current-write",
            "amount",
            "current_expression",
            "current_condition",
          ),
        ]}
      />,
    );

    expect(html).toContain("当前详情");
    expect(html).not.toContain("旧详情");
  });
});
