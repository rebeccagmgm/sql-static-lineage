import { expect, it } from "vitest";
import { isDayPartitionValue, matchesDayPartitionUnit } from "../../../scripts/project-graph/task-local/partition-day-grain.ts";
import { matchesReadPartitionRange } from "../../../scripts/project-graph/task-local/partition-range.ts";
import { partitionMatchStatus } from "../src/continuation/continuation-v2.ts";
const literal = (text: string) => ({ kind: "LITERAL", text });
const fn = (name: string, ...args: unknown[]) => ({ kind: "FUNCTION", name, args });
const read = (expr: unknown) => [{ kind: "OTHER", structured_expression: expr }];
it("an unrestricted read includes a known day template without inventing missing tag values", () => {
  const reader = {readOccurrenceId:"r",readOccurrenceNodeId:"rn",datasetNodeId:"d",qualifiedName:"t",identityStatus:"CONFIRMED",partitionPredicateStatus:"NONE" as const,partitionPredicates:[]};
  const writer = {taskId:"w",writeObservationId:"w",targetWriteNodeId:"wn",datasetNodeId:"d",qualifiedName:"t",source:"IN_UNION_FINAL_WRITE" as const,partitionStatus:"STATIC",partition:[{column:"busi_date",values:["${YYYY-MM-DD}"],valueStatus:"RUNTIME_EXPRESSION"}]};
  expect(partitionMatchStatus(reader,writer)).toBe("CONFIRMED");
  expect(partitionMatchStatus(reader,{...writer,partition:[...writer.partition,{column:"tag_id",values:[],valueStatus:"UNKNOWN"}]})).toBe("UNKNOWN");
});
it("matches day, previous natural day, previous trade day by approved partition unit", () => {
  const trade = fn("default.pretradedate", fn("date_add", literal("'${yyyy-MM-dd}'"), literal("1")), literal("1"));
  expect(matchesDayPartitionUnit("busi_date", ["${YYYY-MM-DD}"], read(trade))).toBe(true);
  expect(matchesDayPartitionUnit("data_date", ["${yyyy-MM-dd,-1d}"], read(trade))).toBe(true);
  expect(matchesDayPartitionUnit("busi_date", ["h15"], read(trade))).toBe(false);
  expect(matchesDayPartitionUnit("busi_mon", ["${YYYYMM}"], read(trade))).toBe(false);
  expect(matchesDayPartitionUnit("tag_id", ["20260911"], read(trade))).toBe(false);
});
it("retains date format and unit boundaries", () => {
  expect(isDayPartitionValue("${yyyy-MM-dd,-1e}")).toBe(true);
  expect(isDayPartitionValue("${yyyy-MM-dd,-1t}")).toBe(true);
  expect(isDayPartitionValue("${YYYY-MM-DD,-1d}")).toBe(false);
  expect(isDayPartitionValue("${yyyy-MM-dd HH:mm:ss}")).toBe(false);
  expect(matchesDayPartitionUnit("busi_date", ["${YYYY-MM-DD}"], read(fn("date_format",literal("'${yyyy-MM-dd}'"),literal("'yyyyMM'"))))).toBe(false);
});
it("recognizes the scheduler day alias in nested expressions on either side", () => {
  const trade = read(fn("default.pretradedate", fn("date_add", literal("'${data_day_str}'"), literal("1")), literal("1")));
  const before = JSON.stringify(trade);
  expect(isDayPartitionValue("'${data_day_str}'")).toBe(true);
  expect(matchesDayPartitionUnit("busi_date", ["${YYYY-MM-DD}"], trade)).toBe(true);
  expect(matchesDayPartitionUnit("busi_date", ["${data_day_str}"], read(fn("date_sub", literal("'${yyyy-MM-dd}'"), literal("1"))))).toBe(true);
  expect(JSON.stringify(trade)).toBe(before);
  for (const value of ["${data_day_str_backup}", "${data_day_str,-1d}", "${DATA_DAY_STR}", "${filename}", "${DB_TEMP}", "${data_day_str}_16"])
    expect(isDayPartitionValue(value)).toBe(false);
  expect(matchesDayPartitionUnit("tag_id", ["${data_day_str}"], trade)).toBe(false);
});
it("does not infer day grain from unknown functions or field arguments", () => {
  expect(matchesDayPartitionUnit("busi_date", ["${YYYY-MM-DD}"], read(fn("other.pretradedate",literal("'${yyyy-MM-dd}'"),literal("1"))))).toBe(false);
  expect(matchesDayPartitionUnit("busi_date", ["${YYYY-MM-DD}"], read(fn("pretradedate",{kind:"COLUMN",name:"busi_date"},literal("1"))))).toBe(false);
});
it("still checks the non-date partition value and keeps raw evidence intact", () => {
  const atom = (column: string, rhs: unknown) => ({kind:"ATOM",operator:"EQ",operands:[{kind:"COLUMN",column:{name:column,physical:[{table:"t",column}]}},rhs]});
  const scope = {version:1,table:"t",trees:[{kind:"AND",children:[atom("busi_date", read(fn("pretradedate",literal("'${yyyy-MM-dd}'"),literal("1")))[0]),atom("tag_id",{kind:"LITERAL",expression:"'A'"})]}]};
  const before=JSON.stringify(scope), parts=[{column:"busi_date",values:["${YYYY-MM-DD}"]},{column:"tag_id",values:["A"]}];
  expect(matchesReadPartitionRange(scope,parts)).toBe(true);
  expect(matchesReadPartitionRange(scope,[parts[0]!,{column:"tag_id",values:["B"]}])).toBe(null);
  expect(JSON.stringify(scope)).toBe(before);
});
