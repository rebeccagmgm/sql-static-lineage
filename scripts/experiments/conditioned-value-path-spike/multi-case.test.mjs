import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { multiCases, selectCase } from './multi-cases.mjs';
import { describeOutput } from './output-description.mjs';

const directory = new URL('../../../tmp/conditioned-value-path-spike-20260909/multi-case/', import.meta.url);
const report = JSON.parse(fs.readFileSync(new URL('report.json', directory), 'utf8'));
const row = id => report.results.find(r => r.id === id);
const frozen = new Map();
for (const task of new Set(multiCases.map(c => c.task)))
  frozen.set(task, JSON.parse(fs.readFileSync(new URL(`frozen-${task}.json`, directory), 'utf8')));

test('five real tasks cover fourteen independently selected cases without missing inputs', () => {
  assert.equal(report.taskCount, 5); assert.equal(report.caseCount, 14);
  assert.equal(report.originalsUnchanged, true);
  for (const c of multiCases) assert.ok(selectCase(frozen.get(c.task), c).relation);
});
test('the thirteen matching descriptions are not labeled full path acceptance', () => {
  assert.equal(report.descriptionMatches, 13);
  assert.equal(report.additionalFullPathProofs, 0);
  assert.equal(report.wholeArchitectureAccepted, false);
  const sourceFree = new Set(['constant', 'empty-string', 'date-parameter', 'parameter-transform', 'hive-clock']);
  for (const r of report.results) assert.equal(r.pathExperiment.status,
    sourceFree.has(r.id) ? 'NOT_APPLICABLE' : 'NOT_EVALUABLE');
});
test('SYSDATE is a recorded semantic failure, not a passing architecture case', () => {
  assert.deepEqual(report.semanticMismatches, ['oracle-clock']);
  const r = row('oracle-clock');
  assert.equal(r.expected, 'CURRENT_TIME');
  assert.equal(r.description.generation, 'FIELD_TRANSFORMATION');
  assert.equal(r.description.valueReferences[0].name, 'SYSDATE');
  assert.equal(r.expressionShapeMatchesExpected, false);
  const c = multiCases.find(c => c.id === 'oracle-clock');
  const e = selectCase(frozen.get(c.task), c).expression;
  assert.ok(e.input_fields.some(f => f.column === 'sysdate'));
  assert.deepEqual(r.oldProjection.statuses, ['RESOLVED']);
});
test('ordinary copies and join aliases retain their already-resolved baselines', () => {
  for (const id of ['direct', 'rename', 'join-alias']) {
    assert.equal(row(id).oldProjection.exactBindingEdges, 1);
    assert.deepEqual(row(id).oldProjection.statuses, ['RESOLVED']);
  }
  assert.equal(row('rename').description.valueReferences[0].name, 'BUSI_DATE');
  assert.equal(row('join-alias').description.valueReferences[0].qualifier, 'C');
});
test('source-free outputs keep descriptions despite having no physical field edges', () => {
  for (const id of ['constant', 'empty-string', 'date-parameter', 'parameter-transform']) {
    assert.equal(row(id).oldProjection.exactBindingEdges, 0);
    assert.equal(row(id).description.valueReferences.length, 0);
    assert.notEqual(row(id).description.generation, 'UNKNOWN');
  }
  assert.equal(row('constant').description.literals[0].value, "'OPTION'");
  assert.equal(row('empty-string').description.literals[0].value, "''");
  assert.equal(row('date-parameter').description.parameters[0].name, 'data_day_str');
  assert.equal(row('date-parameter').description.operation, 'DIRECT_ASSIGNMENT');
  assert.equal(row('date-parameter').description.descriptionStatus, 'DESCRIBED');
  assert.equal(row('date-parameter').pathExperiment.status, 'NOT_APPLICABLE');
  assert.equal(row('parameter-transform').description.parameters[0].name, 'filename');
});
test('real timestamp generation records a clock and formatting, never a field origin', () => {
  const d = row('hive-clock').description;
  assert.equal(d.generation, 'CURRENT_TIME');
  assert.deepEqual(d.functions, ['from_unixtime', 'unix_timestamp']);
  assert.equal(d.valueReferences.length, 0);
  assert.equal(d.literals[0].value, "'yyyy-MM-dd HH:mm:ss'");
});
test('arithmetic preserves both logical inputs while Facts physical summary has one', () => {
  const r = row('arithmetic');
  assert.equal(r.physicalSummaryCount, 1);
  assert.deepEqual(r.description.valueReferences.map(r => `${r.qualifier}.${r.name}`), ['PVS.PV', 'BP.PV']);
  assert.deepEqual(r.description.operators, ['-']);
  assert.equal(r.description.defaults.length, 1);
});
test('SUM with a default and three different UNION branches remain distinguishable', () => {
  assert.deepEqual(row('aggregate').description.functions, ['sum', 'nvl']);
  const branches = row('union').description.branches;
  assert.equal(branches.length, 3);
  assert.deepEqual(branches.map(b => b.generation), ['CALCULATION', 'AGGREGATION', 'FIELD_COPY']);
});
test('CASE constant results are separated from branch-selection fields', () => {
  const d = row('conditional-literals').description;
  assert.equal(d.valueReferences.length, 0);
  assert.deepEqual(d.controlReferences.map(r => r.qualifier), ['B', 'C', 'D', 'E']);
  assert.deepEqual(d.literals.filter(l => l.role === 'VALUE').map(l => l.value),
    ["'20206'", "'20207'", "'20208'", "'20206'", "''"]);
});
test('window sequence generation retains partition and ordering dependencies', () => {
  const d = row('window').description;
  assert.deepEqual(d.windowInputs.map(i => i.role), ['WINDOW_PARTITION', 'WINDOW_ORDER']);
  assert.equal(d.valueReferences.length, 0);
  assert.equal(d.generation, 'WINDOW_GENERATION');
});
test('a literal output rename cannot make its generation description disappear', () => {
  const c = multiCases.find(c => c.id === 'constant');
  const { raw } = selectCase(frozen.get(c.task), c);
  const changed = structuredClone(raw); changed.output = 'arbitrary_name';
  assert.deepEqual(describeOutput(changed.structured_expression), describeOutput(raw.structured_expression));
});
