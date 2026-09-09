import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeOutput } from './output-description.mjs';
const lit = text => ({ kind: 'LITERAL', text });
const fn = (name, ...args) => ({ kind: 'FUNCTION', name, args });
const column = (name, qualifier) => ({ kind: 'COLUMN', name, qualifier });

test('literal, empty string, NULL and template parameter are distinct', () => {
  assert.equal(describeOutput(lit("'OPTION'")).generation, 'FIXED_VALUE');
  assert.deepEqual(describeOutput(lit("''")).literals[0].value, "''");
  assert.equal(describeOutput(lit('NULL')).generation, 'NULL_VALUE');
  assert.equal(describeOutput(lit("'${business_date}'")).generation, 'TEMPLATE_PARAMETER');
});
test('a transformed parameter retains the parameter and function', () => {
  const d = describeOutput(fn('UPPER', lit("'${filename}'")));
  assert.equal(d.generation, 'PARAMETER_TRANSFORMATION');
  assert.equal(d.parameters[0].name, 'filename');
  assert.deepEqual(d.functions, ['upper']);
});
test('a parameter literal is a complete direct assignment without a runtime value', () => {
  const d = describeOutput(lit("'${business_date}'"));
  assert.equal(d.operation, 'DIRECT_ASSIGNMENT');
  assert.equal(d.assignmentExpression, "'${business_date}'");
  assert.equal(d.descriptionStatus, 'DESCRIBED');
  assert.deepEqual(d.unknownKinds, []);
  assert.equal(d.fieldPathApplicability, 'NO_PHYSICAL_FIELD_INPUT');
});
test('clock generation differs from converting a supplied timestamp', () => {
  assert.equal(describeOutput(fn('from_unixtime', fn('unix_timestamp'), lit("'yyyy-MM-dd'"))).generation, 'CURRENT_TIME');
  assert.equal(describeOutput(fn('unix_timestamp', column('event_time'))).generation, 'FIELD_TRANSFORMATION');
});
test('a parser-produced SYSDATE column is not silently repaired by presentation', () => {
  const d = describeOutput(fn('to_char', column('SYSDATE'), lit("'format'")));
  assert.equal(d.generation, 'FIELD_TRANSFORMATION');
  assert.equal(d.valueReferences[0].name, 'SYSDATE');
});
test('CASE separates literal results from the fields that select them', () => {
  const d = describeOutput({ kind: 'CASE', whens: [{
    when: { kind: 'BINARY', op: '=', left: column('flag', 'a'), right: lit("'Y'") },
    then: lit("'accepted'"),
  }], elseExpr: lit("'other'") });
  assert.equal(d.generation, 'CONDITIONAL_VALUE');
  assert.equal(d.valueReferences.length, 0);
  assert.equal(d.controlReferences[0].name, 'flag');
  assert.deepEqual(d.literals.filter(l => l.role === 'VALUE').map(l => l.value), ["'accepted'", "'other'"]);
});
test('arithmetic preserves two references even when column names match', () => {
  const d = describeOutput({ kind: 'BINARY', op: '-', left: column('PV', 'PVS'), right: fn('NVL', column('PV', 'BP'), lit('0')) });
  assert.equal(d.generation, 'CALCULATION');
  assert.deepEqual(d.valueReferences.map(r => r.qualifier), ['PVS', 'BP']);
  assert.equal(d.defaults.length, 1);
});
test('aggregate and window computations remain visible', () => {
  assert.equal(describeOutput(fn('SUM', column('amount'))).generation, 'AGGREGATION');
  const d = describeOutput(fn('row_number'), { input_bindings: [{ role: 'WINDOW_ORDER', expression_text: 'date' }] });
  assert.equal(d.generation, 'WINDOW_GENERATION');
  assert.equal(d.windowInputs[0].role, 'WINDOW_ORDER');
});
test('unknown source-free functions and missing trees are not constants', () => {
  assert.equal(describeOutput(fn('unrecognized_generator')).generation, 'UNCLASSIFIED_FUNCTION');
  assert.equal(describeOutput(null).generation, 'UNKNOWN');
});
