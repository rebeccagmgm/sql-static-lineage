import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildCatalog, parseCsv } from './import.mjs';

test('CSV retains quoted commas, multiline text, escaped quotes and trailing empty cells', () => {
  assert.deepEqual(parseCsv('\ufeffa,b,c\r\n"x,y","line1\nline2 ""q""",\r\n'), [['a','b','c'],['x,y','line1\nline2 "q"','']]);
  assert.throws(() => parseCsv('a\n"unterminated'), /CSV/);
});

test('import preserves duplicate code rows, unresolved links, partial status and fails closed on SQL drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'asset-catalog-'));
  try {
    const indicators = join(root, 'indicators'); const tags = join(root, 'tags');
    mkdirSync(indicators); mkdirSync(tags); mkdirSync(join(tags, 'dimension-sql'));
    const jsonl = (dir, file, rows) => writeFileSync(join(dir,file), rows.map(JSON.stringify).join('\n')+'\n');
    writeFileSync(join(indicators,'manifest.json'), JSON.stringify({status:'PARTIAL',gapEstimate:23}));
    writeFileSync(join(tags,'manifest.json'), JSON.stringify({status:'COMPLETE'}));
    jsonl(indicators,'indicators.jsonl',[{indexId:'i1',chineseName:'指标',horaeTaskId:'123'}]);
    jsonl(indicators,'indicator-sources.jsonl',[{indexId:'i1',sources:['page.json']}]);
    jsonl(tags,'tag-dimensions.jsonl',[{tagDimId:'d1'}]);
    jsonl(tags,'dimension-details.jsonl',[{tagDimId:'d2',sqlFile:'old/d2.sql',sqlSha256:'bad',sqlEvidenceStatus:'FOUND'}]);
    writeFileSync(join(tags,'dimension-sql','d2.sql'),'select 1');
    jsonl(tags,'tag-values.jsonl',[{tagId:'t1',tagName:'标签'}]);
    jsonl(tags,'tag-value-dimension-links.jsonl',[{tagId:'t1',tagDimId:'missing',dimensionEvidenceStatus:'NOT_FOUND'}]);
    jsonl(tags,'object-sources.jsonl',[{objectId:'d2'}]);
    const codes = join(root,'codes.csv');
    writeFileSync(codes,'dw_cd_id,dw_cd_val,src_tbl,busi_date\nc,01,A,20260101\nc,01,B,20260101\nc,01,B,20260101\n');
    const dataElements = join(root,'data-elements.csv');
    writeFileSync(dataElements,'dw_cd_id,dw_cd_eng_name,dw_cd_chn_name,encd_mode,data_std_id,crt_date,matn,dc_dict_entry,src_dict_tbl,remark\nCD001,PTY_TYPE_CD,当事人类型代码,数据标准编码,,2021-01-26,"xiongdan,huzhuohua",,,\nCD002,SEX_CD,性别代码,国家标准编码,,2021-01-26,maintainer,,,国标说明\n');
    const grpTypes = join(root,'grp-type-info.csv');
    writeFileSync(grpTypes,'grp_type_id,grp_type_code,grp_type_name,sys_code,grp_attr_table_name,grp_attr_table_pk,tag_dim_id,grp_def_sql,data_time,modify_operator,modify_time,status\n0029,BRANCH_HEADQUARTERS,分公司本部,ERP,PDATA_N.T98_ORG_INR_ORG_BASE_INFO,"BUSI_DATE,INR_ORG_ID",,"select \'a,b\' as grp_val",2024-04-24 00:00:00,yangjinluo,2999-12-31 00:00:00,1\n');
    const config = {indicatorDir:indicators,tagDir:tags,codeCsv:codes,dataElementCsv:dataElements,grpTypeCsv:grpTypes,outputDir:join(root,'out')};
    const result = buildCatalog(config);
    const db = new DatabaseSync(result.database,{readOnly:true});
    assert.equal(db.prepare('SELECT count(*) AS n FROM code_values').get().n,3);
    assert.equal(db.prepare('SELECT count(*) AS n FROM ref_dw_cd_list').get().n,2);
    assert.equal(db.prepare('SELECT dw_cd_chn_name,matn FROM ref_dw_cd_list WHERE dw_cd_id=?').get('CD001').dw_cd_chn_name,'当事人类型代码');
    assert.equal(db.prepare('SELECT raw_json FROM records WHERE record_kind=? AND object_id=?').get('ref_dw_cd_list','CD001').raw_json.includes('xiongdan,huzhuohua'),true);
    assert.equal(db.prepare('SELECT count(*) AS n FROM grp_type_info').get().n,1);
    assert.equal(db.prepare('SELECT grp_type_name FROM grp_type_info WHERE grp_type_id=?').get('0029').grp_type_name,'分公司本部');
    assert.equal(db.prepare('SELECT grp_def_sql FROM grp_type_info WHERE grp_type_id=?').get('0029').grp_def_sql,"select 'a,b' as grp_val");
    assert.equal(db.prepare('SELECT count(*) AS n FROM tag_dimension_details').get().n,1);
    assert.equal(db.prepare('SELECT sql_text FROM tag_sql').get().sql_text,null);
    assert.equal(db.prepare('SELECT status FROM tag_sql').get().status,'HASH_MISMATCH');
    assert.equal(Buffer.from(db.prepare('SELECT raw_sql_bytes FROM source_files WHERE raw_sql_bytes IS NOT NULL').get().raw_sql_bytes).toString(),'select 1');
    assert.equal(db.prepare('SELECT dimension_present FROM tag_links').get().dimension_present,0);
    assert.equal(db.prepare("SELECT status FROM snapshots WHERE kind='indicator'").get().status,'PARTIAL');
    db.close();
    const before = readFileSync(result.database);
    const manifest = join(config.outputDir,`import-manifest-${result.inputHash}.json`);
    unlinkSync(manifest);
    assert.equal(buildCatalog(config).status,'UNCHANGED');
    assert.equal(existsSync(manifest),true);
    assert.deepEqual(readFileSync(result.database),before);
    writeFileSync(codes,'dw_cd_id\nchanged\n');
    assert.throws(()=>buildCatalog(config),/different inputs/);
    assert.deepEqual(readFileSync(result.database),before);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
