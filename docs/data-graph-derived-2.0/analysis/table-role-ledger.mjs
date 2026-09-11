import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

export const headers = [
  "物理表ID",
  "平台",
  "数据源",
  "表名",
  "中文注释",
  "角色",
  "证据级别",
  "判断理由",
  "核验范围",
  "待确认问题",
  "核验图版本",
  "核验时间",
  "证据ID",
];

// Accept Excel UTF-8 CSV: BOM, CRLF, escaped quotes and embedded newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else value += ch;
    } else if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (ch !== ",") {
        rows.push(row);
        row = [];
        if (ch === "\r" && text[i + 1] === "\n") i++;
      }
    } else if (ch === '"') {
      assert(!value && !closed, "Unexpected CSV quote");
      quoted = true;
    } else {
      assert(!closed, "Unexpected text after closing CSV quote");
      value += ch;
    }
  }
  assert(!quoted, "Unclosed CSV quote");
  if (row.length || value || closed) rows.push([...row, value]);
  return rows;
}

export function encodeCsv(rows) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            if (/^\s*[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  );
}

export function loadRoleLedger(directory) {
  const [head, ...data] = parseCsv(
    readFileSync(resolve(directory, "table-roles.csv"), "utf8"),
  );
  assert.deepEqual(head, headers, "Classification CSV headers changed");
  const details = JSON.parse(
    readFileSync(resolve(directory, "table-role-evidence.json"), "utf8"),
  );
  const evidence = new Map(details.rows.map((r) => [r.evidenceId, r]));
  assert.equal(evidence.size, details.rows.length, "Duplicate evidence IDs");
  const roles = new Set([
    "SYSTEM_LOG",
    "ACCESS_MANAGEMENT",
    "PUBLIC_DEFINITION",
    "PUBLIC_PARAMETER",
    "BUSINESS_FOUNDATION",
    "BUSINESS_RESULT",
    "TRANSFER",
    "UNKNOWN",
  ]);
  const rows = data.map((cells) => {
    assert.equal(cells.length, headers.length, "CSV column count mismatch");
    // Reverse only the formula-protection prefix used by encodeCsv.
    const values = cells.map((v) => (/^'\s*[=+@-]/.test(v) ? v.slice(1) : v));
    const [
      datasetId,
      platform,
      dataSource,
      table,
      tableComment,
      roleText,
      evidenceLevel,
      rationale,
      classificationScope,
      unknownText,
      reviewedGraphVersion,
      checkedAt,
      evidenceId,
    ] = values;
    const detail = evidence.get(evidenceId);
    assert(detail, `Missing evidence: ${evidenceId}`);
    assert.equal(
      detail.datasetId,
      datasetId,
      "Evidence belongs to another table",
    );
    assert.equal(
      reviewedGraphVersion,
      details.graphVersion,
      "CSV graph version mismatch",
    );
    const rowRoles = roleText.split(";").map((v) => v.trim());
    assert(
      rowRoles.length && rowRoles.every((v) => roles.has(v)),
      `Invalid role: ${roleText}`,
    );
    assert(
      ["SQL_VERIFIED", "METADATA_ONLY"].includes(evidenceLevel),
      "Invalid evidence level",
    );
    if (evidenceLevel === "SQL_VERIFIED")
      assert(
        detail.evidence.some((e) => e.type === "SQL"),
        "SQL_VERIFIED needs SQL evidence",
      );
    assert(
      datasetId && table && platform && dataSource && rationale,
      "Missing required classification value",
    );
    return {
      ...detail,
      datasetId,
      platform,
      dataSource,
      table,
      tableComment,
      roles: rowRoles,
      evidenceLevel,
      rationale,
      classificationScope,
      uncertainties: unknownText ? unknownText.split("\n") : [],
      reviewedGraphVersion,
      checkedAt,
      identity: { platform, dataSource, qualifiedName: table },
    };
  });
  assert.equal(
    new Set(rows.map((r) => r.datasetId)).size,
    rows.length,
    "Duplicate table IDs",
  );
  return { graphVersion: details.graphVersion, rows };
}
