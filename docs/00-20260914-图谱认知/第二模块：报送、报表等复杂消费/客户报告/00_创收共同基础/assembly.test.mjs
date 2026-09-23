import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, realpathSync, renameSync, symlinkSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve, basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {expandBranch, render, header, root} from './render.mjs';

const branch = '03_金仕达_223867';
const read = files => name => files[name];

test('one approved branch expands flat SQL includes without changing literals', () => {
  const files = {'00_主脚本.sql': "SELECT\n-- @include 01_金额.sql\nFROM source", '01_金额.sql': "'${yyyy-MM-dd}' AS day, NULL AS income"};
  assert.equal(expandBranch(branch, read(files)), "SELECT\n'${yyyy-MM-dd}' AS day, NULL AS income\nFROM source");
  assert.equal(render(branch, read(files)), header + expandBranch(branch, read(files)));
});

test('unknown branch, path escape, circular and empty modules fail closed', () => {
  for (const name of ['../other', '03_金仕达_223867/..', 'unknown']) {
    assert.throws(() => expandBranch(name, () => 'SELECT 1'), /branch/);
  }
  for (const name of ['../outside.sql', 'sub/01.sql', '01.json']) {
    assert.throws(() => expandBranch(branch, read({'00_主脚本.sql': '-- @include ' + name})));
  }
  assert.throws(() => expandBranch(branch, read({'00_主脚本.sql': '-- @include 00_主脚本.sql'})), /Circular/);
  assert.throws(() => expandBranch(branch, read({'00_主脚本.sql': '-- @include 01.sql', '01.sql': ''})), /empty/);
});

function fixture(t) {
  const parent = realpathSync(tmpdir());
  const directory = mkdtempSync(join(parent, 'customer-revenue-render-'));
  t.after(() => {
    // Recursive cleanup is restricted to this test-created, resolved temporary directory.
    assert.equal(dirname(realpathSync(directory)), parent);
    assert.ok(basename(directory).startsWith('customer-revenue-render-'));
    rmSync(directory, {recursive:true});
  });
  const helper = join(directory, 'render.mjs');
  const source = readFileSync(join(root, 'render.mjs'), 'utf8');
  const originalImport = "'../../公共加工/03_逐日本金与费用/render.mjs'";
  assert.ok(source.includes(originalImport));
  writeFileSync(helper, source.replace(originalImport,
    JSON.stringify(pathToFileURL(resolve(root, '../../公共加工/03_逐日本金与费用/render.mjs')).href)));
  const branchPath = join(directory, branch);
  mkdirSync(branchPath);
  writeFileSync(join(branchPath, '00_主脚本.sql'), 'SELECT\n-- @include 01.sql\n');
  writeFileSync(join(branchPath, '01.sql'), '1 AS amount');
  const run = () => {
    const result = spawnSync(process.execPath, [helper, branch, '--write'], {encoding:'utf8',timeout:10000});
    if (result.error) throw result.error;
    return result;
  };
  return {directory, branchPath, run, output:join(branchPath,'完整SQL.sql')};
}

test('real CLI writes an assembled file but preserves an existing non-generated file', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  assert.equal(readFileSync(f.output,'utf8'), header + 'SELECT\n1 AS amount\n');
  const authored = '-- manually authored\nSELECT 9;';
  writeFileSync(f.output, authored);
  const rejected = f.run();
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /non-generated/);
  assert.equal(readFileSync(f.output,'utf8'), authored);
});

test('real CLI rejects a branch directory redirected through a junction', t => {
  const f = fixture(t);
  const outside = join(f.directory, 'outside');
  renameSync(f.branchPath, outside);
  symlinkSync(outside, f.branchPath, process.platform==='win32' ? 'junction' : 'dir');
  const rejected = f.run();
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr, /outside its documented directory/);
  assert.equal(readFileSync(join(outside,'01.sql'),'utf8'),'1 AS amount');
});

test('real CLI rejects an include symlink and does not read it as SQL', t => {
  const f = fixture(t);
  const outside = join(f.directory,'outside.sql');
  writeFileSync(outside,'SELECT 999 AS protected_value');
  unlinkSync(join(f.branchPath,'01.sql'));
  try { symlinkSync(outside,join(f.branchPath,'01.sql'),'file'); }
  catch (error) {
    if (error.code==='EPERM') {t.skip('Windows file symlink privilege unavailable'); return;}
    throw error;
  }
  const rejected = f.run();
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr,/outside branch/);
  assert.equal(readFileSync(outside,'utf8'),'SELECT 999 AS protected_value');
});

test('real CLI refuses an output symlink even when its target has the generated header', t => {
  const f = fixture(t);
  const outside = join(f.directory,'protected.sql');
  const protectedContent = header + 'SELECT 888;';
  writeFileSync(outside, protectedContent);
  try { symlinkSync(outside,f.output,'file'); }
  catch (error) {
    if (error.code==='EPERM') {t.skip('Windows file symlink privilege unavailable'); return;}
    throw error;
  }
  const rejected = f.run();
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr,/symlink output/);
  assert.equal(readFileSync(outside,'utf8'),protectedContent);
});
