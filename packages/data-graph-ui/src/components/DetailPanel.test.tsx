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
    bindings: [{ column, writeId, expression }],
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
    expect(html).toContain("source_a.amount");
    expect(html).toContain("source_b.amount * 100");
    expect(html).toContain("source_a.enabled = 1");
    expect(html).toContain("source_b.enabled = 1");
    expect(html.match(/字段投影已发布/g)).toHaveLength(2);
    expect(html.match(/读取 SQL 原文/g)).toHaveLength(2);
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
