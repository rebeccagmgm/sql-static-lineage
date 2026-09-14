-- task_id: 100243
-- hiveDb: dm_hr_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_hr_n/dm_hr_n.assm_cs_list.py
-- observed_at: 2026-09-02T06:47:23.598Z

-- createSql
create table if not exists assm_cs_list (
  data_src_cd string comment '数据来源代码',
  busi_type string comment '业务类型',
  stati_strt_date string comment '统计起始日期',
  stati_end_date string comment '统计结束日期',
  cust_id string comment '客户编号',
  cust_name string comment '客户名称',
  prd_id string comment '产品编号',
  prd_name string comment '产品名称',
  dev_dept_id string comment '拓展方部门编号',
  dev_dept_name string comment '拓展方部门名称',
  dev_dept_income string comment '拓展方部门收入',
  dev_dept_income_type string comment '拓展方部门收入类型',
  bnft_dept_income string comment '受益方部门收入',
  bnft_dept_income_type string comment '受益方部门收入类型',
  cs_income string comment '交叉销售收入',
  dev_dept_rwd_tot_amt string comment '拓展方部门奖励总额',
  dev_emp_rwd string comment '拓展方员工激励',
  cacl_trmt_ind string comment '算结标识',
  data_time string comment '数据时间',
  busi_date string comment '业务日期'
)
comment '资管交叉销售明细表'
PARTITIONED BY (stati_mth STRING COMMENT '统计月份')
STORED AS ORC ;

-- querySql
insert overwrite table assm_cs_list partition(stati_mth)
select
'AMS' as data_src_cd,
'资管产品销售' busi_type,
a.stati_strt_date,
a.stati_end_date,
coalesce(b.pty_id,a.pty_id) cust_id,
a.cust_name,
a.prd_id,
a.prd_name,
a.dev_dept_id,
a.dev_dept_name,
a.inr_org_income as dev_dept_income,
'真实收入' as dev_dept_income_type,
cast((a.prd_income - a.inr_org_income) as decimal(18,4)) as bnft_dept_income,
'真实收入' as bnft_dept_income_type,
a.prd_income as cs_income,
a.rwd_tot_amt as dev_dept_rwd_tot_amt,
a.rwd_tot_amt as dev_emp_rwd,
a.cacl_trmt_ind,
'2026-05-19 10:02:37'    as Data_Time,
'2026-05-18'  as Busi_Date,
a.stati_mth
from
(select
default.datekey2date(stati_strt_date) stati_strt_date,
default.datekey2date(stati_end_date) stati_end_date,
pty_id,
pty_name as cust_name,
fnd_acct_agt_id,
prd_id,
prd_name,
inr_org_id as dev_dept_id,
inr_org_name as dev_dept_name,
inr_org_income,
prd_income,
rwd_tot_amt,
fnsh_flag as cacl_trmt_ind,
prtt_mth as stati_mth
from
PDATA_N.T98_AMS_CS_INCOME_RWD_SUM
where
data_etl_date ='2026-05-18'
and (coalesce(inr_org_income,'0')<>'0' or coalesce(prd_income,'0')<>'0' or coalesce(rwd_tot_amt,'0')<>'0')) a
left join
(select
pty_id,
fnd_acct_agt_id,
prd_id
from
PDATA_N.T98_AMS_CS_INCOME_RWD_SUM
where
pty_id <> '0'
group by
pty_id,
fnd_acct_agt_id,
prd_id) b
on
a.pty_id = '0'
and a.fnd_acct_agt_id = b.fnd_acct_agt_id
and a.prd_id = b.prd_id                             --client_id=0的记录，通过按同一基金账户+同一产品+client_id<>'0'的条件去匹配
;
