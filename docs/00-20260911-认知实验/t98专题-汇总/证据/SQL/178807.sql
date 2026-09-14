-- task_id: 178807
-- hiveDb: dm_index_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_index_n/scrm_script/cid_prd_valu_index.py
-- observed_at: 2026-09-04T17:24:35.611Z

-- createSql
create table if not exists cid_prd_valu_index (
  inr_scr_acct_id string comment '内部证券账户id',
  prd_name string comment '产品名称(配置表)',
  ext_prd_name string comment '邮件产品名称',
  subj_cd string comment '科目代码',
  atcl_subj_cd string comment '实际科目代码',
  subj_name string comment '科目名称',
  is_trust_prtc_fnd string comment '是否信托保障基金',
  col_name string comment '细项名称',
  index_id string comment '指标id',
  index_name string comment '指标名称',
  index_val string comment '指标值',
  is_ext string comment '是否拓展(计算)指标',
  cal_dt string comment '统计日/交易日',
  prd_grp_id string comment '产品系列id',
  remark string comment '备注(json)',
  index_type_name string comment '指标类型名称'
)
comment '资本中介产品估值指标表'
PARTITIONED BY (busi_date string comment '估值日期')
STORED AS orc;

-- querySql
select default.pretradedate('2026-08-12', 15);

with trd_date_tab as (
select default.datekey2date(cal_date) as                       cal_dt --> 日期
, default.pretradedate(default.datekey2date(cal_date), 2) dt_tb2
from pdata_news_n.t02_scr_trd_cal_MD --> 交易日历表
where mkt_cd = 'NIB' --> 全国银行间同业拆借中心
and cal_date between default.date2datekey('2026-07-22') and '20260812'
and default.istradeday(default.datekey2date(cal_date)) = '1'
union all
select cast(date_add('2026-08-12', 1) as string)
, default.pretradedate(date_add('2026-08-12', 1), 2) dt_tb2
),
prd_cfg_tab as (
select inr_scr_acct_id
, PRD_NAME
, SUBJ_CD
, IS_TRUST_PRTC_FND
, INDEX_TYPE
, col_name
, prd_grp_id
from pdata_n.t98_cid_prd_subj_index_conf
group by inr_scr_acct_id
, PRD_NAME
, SUBJ_CD
, IS_TRUST_PRTC_FND
, INDEX_TYPE
, col_name
, prd_grp_id
),
recv_trust_qty_tab as (
select t.cal_dt
, prd.inr_scr_acct_id
, prd.Prd_Name
, prd.IS_TRUST_PRTC_FND
, prd.prd_grp_id
, prd.subj_cd
, t1.ext_prd_name
, t1.qty    as recv_trust_qty_tb1
, t1.busi_date as dt_tb1
, t1.subj_name
, t2.busi_date as dt_tb2
, t2.qty    as recv_trust_qty_tb2
from (
select distinct cal_dt
, date_sub(cal_dt, 1)                               dt_t1
, if(default.istradeday(date_add(dt_tb2, 1)) = '1', dt_tb2,
date_sub(default.pretradedate(dt_tb2, -1), 1)) t2_dt
from trd_date_tab
where default.istradeday(cal_dt) = '1'
) t
inner join
(
select *
from pdata_n.t98_cid_prd_valu_email
where subj_cd = '实收信托'
and busi_date between default.pretradedate('2026-08-12',30)
and date_add('2026-08-12', 1)
) t1 on t1.busi_date = t.dt_t1
inner join
(
select *
from pdata_n.t98_cid_prd_valu_email
where subj_cd = '实收信托'
and busi_date between default.pretradedate('2026-08-12',30)
and date_add('2026-08-12', 1)
) t2 on t2.busi_date = t.t2_dt and t2.inr_scr_acct_id = t1.inr_scr_acct_id
inner join
(
select *
from prd_cfg_tab
where SUBJ_CD = '实收信托'
and col_name = '数量'
) prd on prd.inr_scr_acct_id = t1.inr_scr_acct_id
)
insert overwrite table cid_prd_valu_index partition(busi_date)
select inr_scr_acct_id
, Prd_Name
, ext_prd_name
, subj_cd
, subj_cd atcl_subj_cd
, subj_name
, is_trust_prtc_fnd
, split(t.index_name, '_')[0]         as col_name
, case index_name
when '日期_T-1日' then '31C1'
when '日期_T-2日' then '31C2'
when '数量_T-1日' then '3121'
when '数量_T-2日' then '3122' end     index_id
, t.index_name
, t.index_val                         as index_val
, '1'                                 as is_ext
, cal_dt                              as cal_dt
, prd_grp_id
, ''                                     remark
, '实收信托'                               index_type_name
, cast(date_sub(cal_dt, 1) as string) as busi_date
from recv_trust_qty_tab
lateral view explode(map('日期_T-1日', dt_tb1, '日期_T-2日', dt_tb2, '数量_T-1日', recv_trust_qty_tb1,
'数量_T-2日',
recv_trust_qty_tb2)) t as index_name, index_val
union all
select prd_cfg_tab.inr_scr_acct_id
, prd_cfg_tab.Prd_Name
, val_tab.ext_prd_name
, prd_cfg_tab.subj_cd
, if(prd_cfg_tab.index_type != '持仓债券', prd_cfg_tab.subj_cd, val_tab.subj_cd) atcl_subj_cd
, val_tab.subj_name
, prd_cfg_tab.is_trust_prtc_fnd
, prd_cfg_tab.col_name
, null                                                                       index_id
, prd_cfg_tab.col_name                                                       index_name
, case prd_cfg_tab.col_name
when '科目名称' then val_tab.subj_name
when '数量' then val_tab.qty
when '单位成本' then val_tab.unit_cost
when '成本' then val_tab.cost
when '成本占净值' then val_tab.cost_of_nav
when '成本占总资产' then val_tab.cost_of_tot_ast
when '市价' then val_tab.mkt_pric
when '市值' then val_tab.mval
when '市值占净值' then val_tab.mval_of_nav
when '市值占总资产' then val_tab.mval_of_tot_ast
when '估值增值' then val_tab.valu_va end                                   index_val
, '0'                    as                                                  is_ext
, cast(date_add(val_tab.busi_date, 1) as string)                                cal_dt
, prd_grp_id
, ''                                                                         remark
, prd_cfg_tab.index_type as                                                  index_type_name
, val_tab.busi_date
from prd_cfg_tab
inner join pdata_n.t98_cid_prd_valu_email val_tab
on prd_cfg_tab.inr_scr_acct_id = val_tab.inr_scr_acct_id
and prd_cfg_tab.subj_cd = val_tab.subj_cd
where val_tab.busi_date >='2026-07-22'
;
