-- task_id: 69798
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_co_income_WD_WAIN
-- observed_at: 2026-09-05T01:06:28.992Z

-- createSql
create table if not exists t02_co_income(
  rec_id string  comment'记录编号',
  busi_date      string  comment'数据日期',
  src_sys_prdno string  comment'源系统产品编号',
  corp_id      string  comment'统一公司编号',
  src_corp_id string  comment'源系统公司编号',
  pub_dt string  comment'发布日期',
  info_src   string  comment'信息来源',
  Co_Prop string  comment'公司性质',
  end_date      string  comment'截止日期',
  rpt_type     string  comment'报告期类型',
  as_cd string  comment'会计准则代码',
  crrc_cd string  comment'货币代码',
  data_flag string  comment'数据标志',
  op_tinc string  comment'营业总收入',
  op_inc      string  comment'营业收入',
  int_net_inc  string  comment'利息净收入',
  int_inc      string  comment'利息收入',
  earn_insr      string  comment'已赚保费',
  fee_cms_inc  string  comment'手续费及佣金收入',
  fee_cms_net_inc  string  comment'手续费及佣金净收入',
  agy_secu_net_inc  string  comment'经纪业务手续费净收入',
  uv_secu_net_inc  string  comment'投资银行业务手续费净收入',
  cust_ast_serv_net_inc string  comment'资产管理业务手续费净收入',
  insr_inc      string comment'保险业务收入',
  reinsr_inc      string comment'分保费收入',
  reinsr_perm string comment'分出保费',
  unt_rsv_insr  string comment'提取未到期责任准备金',
  oth_biz_income  string  comment'其他业务收入',
  other_rtn      string  comment'其他收益',
  other_rtn_fin    string  comment'其他收益金融',
  insm_inc string  comment'投资收益',
  jn_co_corp_inso_inc      string  comment'对联营企业和合营企业的投资收益',
  insm_estt_fair_val_chg_rtn   string  comment'投资性房地产公允价值变动收益',
  fair_val_chg_rtn  string  comment'公允价值变动收益',
  ast_dspl_inc string  comment'资产处置收益',
  ast_dspl_inc_fin    string  comment'资产处置收益金融',
  fc_exch_inc      string  comment'汇兑收益',
  fund_mng_fee_inc   string comment'基金管理费收入',
  fund_sell_inc      string  comment'基金销售收入',
  ncast_deal_gain    string  comment'非流动资产处置利得',
  nop_net_inc        string  comment'非经营性净收益',
  op_tcost string  comment'营业总成本',
  op_tcost_dbi   string  comment'营业总成本差额合计平衡项目',
  op_tcost_dsi   string  comment'营业总成本差额特殊报表科目',
  op_tcost_dsi_expl   string  comment'营业总成本差额说明特殊报表科目',
  op_cost  string  comment'营业成本',
  op_exp      string  comment'营业支出',
  int_exp  string  comment'利息支出',
  fee_cms_exp      string  comment'手续费及佣金支出',
  fee_cms_exp_ci   string  comment'手续费及佣金支出成本科目',
  insr_exp string  comment'保险业务支出',
  srd_chrg string  comment'退保金',
  cmps_pay string  comment'赔付支出',
  rfd_cmps_pay string  comment'摊回赔付支出',
  plcy_dvd_exp string  comment'保单红利支出',
  rinsr_exp      string  comment'分保费用',
  biz_tax_srch string  comment'营业税金及附加',
  sell_exp string  comment'销售费用',
  biz_adm_fee      string  comment'业务及管理费',
  adm_exp  string  comment'管理费用',
  fin_exp  string  comment'财务费用',
  fin_exp_int_inc  string  comment'财务费用利息收入',
  int_exp_ci       string   comment'利息支出成本科目',
  ast_impr_loss      string  comment'资产减值损失',
  cred_impr_loss string  comment'信用减值损失',
  other_ast_impr_loss  string  comment'其他资产减值损失',
  ncast_deal_loss      string  comment'非流动资产处置损失',      
  uncfm_insm_loss      string  comment'未确认的投资损失',      
  rsv_insr string  comment'提取保险责任准备金',
  rfd_insr string  comment'摊回保险责任准备金',
  rfd_reinsr_exp string  comment'摊回分保费用',
  oth_biz_cost string  comment'其他业务成本',
  op_prof  string  comment'营业利润',
  op_prof_dbi  string  comment'营业利润差额合计平衡项目',  
  op_prof_dsi  string  comment'营业利润差额特殊报表科目', 
  op_prof_dsi_expl   string  comment'营业利润差额说明特殊报表科目',  
  ext_inc  string  comment'营业外收入', 
  ext_exp  string  comment'营业外支出', 
  tprof      string  comment'利润总额',
  tprof_dbi string  comment'利润总额差额合计平衡项目',  
  tprof_dsi string  comment'利润总额差额特殊报表科目',
  tprof_dsi_expl    string  comment'利润总额差额说明特殊报表科目',
  tax_fee string  comment'所得税费用', 
  net_prof      string  comment'净利润',
  efct_net_prof_ai   string  comment'影响净利润调整项目',
  efct_net_prof_oi   string  comment'影响净利润的其他科目',
  net_prof_dbi string  comment'净利润差额合计平衡项目',
  net_prof_dsi string  comment'净利润差额特殊报表科目',
  net_prof_dsi_expl    string  comment'净利润差额说明特殊报表科目',
  sust_op_net_prof string  comment'持续经营净利润',
  end_op_net_prof  string  comment'终止经营净利润',
  mish_pnl      string  comment'少数股东损益', 
  pcosh_net_prof string  comment'归属母公司所有者的净利润',
  pco_net_prof_dsi  string comment'归属于母公司的净利润差额特殊报表科目',
  pco_net_prof_dsi_expl   string  comment'归属于母公司的净利润差额说明特殊报表科目',
  pcosh_dnet_prof   string   comment'扣除非经常性损益后的归属于母公司的净利润',
  oth_cinc      string  comment'其他综合收益',
  pco_oth_cinc   string  comment'归属于母公司所有者的其他综合收益',
  mish_oth_cinc  string  comment'归属于少数股东的其他综合收益',
  cinc_gamt  string  comment'综合收益总额', 
  pco_cinc_gamt      string  comment'归属于母公司所有者的综合收益总额', 
  mish_cinc_gamt string  comment'归属于少数股东的综合收益总额', 
  beps      string  comment'基本每股收益', 
  deps      string  comment'稀释每股收益', 
  --eps       string  comment'每股收益',
  r_d_exp      string  comment'研发费用',    
  nrpl_d_net_prof   string  comment'归属上市公司股东的扣除非经常性损益的净利润',
  actual_ann_date   string  comment'实际公告日期',
  remark string  comment'备注',  
  src_tbl      string  comment'来源表',      
  src_rec_id  string  comment'来源记录',  
  rec_upd_time  string  comment'记录修改时间',
  rec_down_time string  comment'记录创建时间',
  ebitda	      string  comment'息税折旧摊销前利润',
  ebit	                       string  comment'息税前利润'
) partitioned by (src_id string comment'数据来源',grp_id string comment '分组编号')
stored as ORC;

-- querySql
set hive.merge.mapfiles = true ;
set hive.merge.mapredfiles = true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.exec.max.created.files=10000;
set hive.exec.max.dynamic.partitions.pernode=10000;
set hive.exec.max.dynamic.partitions=10000;
set hive.auto.convert.join=false;
set hive.optimize.sort.dynamic.partition=true;
set hive.map.aggr = true;
set hive.groupby.skewindata=true;
set hive.support.concurrency=false;

insert overwrite table t02_co_income partition(src_id='WD',grp_id='001')
select 
  a.object_id as rec_id,      --记录编号
  '${data_day_str}' as  busi_date,      --数据日期
  b.src_sys_prdno as  src_sys_prdno,      --源系统产品编号
  b.corp_id     as  corp_id,      --统一公司编号
  a.s_info_compcode      as  src_corp_id,      --源系统公司编号
  from_unixtime(unix_timestamp(ann_dt,'yyyyMMdd'),'yyyy-MM-dd') as pub_dt,      --发布日期
  ''  as  info_src,  --信息来源
  a.comp_type_code  as  Co_Prop,      --公司性质
  from_unixtime(unix_timestamp(report_period,'yyyyMMdd'),'yyyy-MM-dd') as end_date,      --截止日期
  CASE SUBSTR(A.REPORT_PERIOD, -4,4)
  WHEN '0331' THEN
  '1'
  WHEN '0630' THEN
  (CASE
        WHEN A.STATEMENT_TYPE in('408002000','408003000','408007000','408008000') THEN
     '2'
        ELSE
     '6'
       END)
  WHEN '0930' THEN
   (CASE
        WHEN A.STATEMENT_TYPE in('408002000','408003000','408007000','408008000') THEN
     '3'
        ELSE
     '9'
     END)
  WHEN '1231' THEN
  (CASE
        WHEN A.STATEMENT_TYPE in('408002000','408003000','408007000','408008000') THEN
     '4'
        ELSE
     '12'
        END)
  ELSE
  '99'
  END AS RPT_TYPE, -- 报告期类型
  '2'  as  as_cd,      --会计准则代码
  '156'as  crrc_cd,      --货币代码
  --a.statement_type  as  data_flag,      --数据标志
  d.const_cd  as  data_flag,     --数据标志
  a.tot_oper_rev as  op_tinc,      --营业总收入
  a.oper_rev as  op_inc,      --营业收入
  a.net_int_inc      as  int_net_inc,      --利息净收入
  a.int_inc  as  int_inc,      --利息收入
  a.insur_prem_unearned  as  earn_insr,      --已赚保费
  a.handling_chrg_comm_inc  as  fee_cms_inc,      --手续费及佣金收入
  a.net_handling_chrg_comm_inc  as  fee_cms_net_inc,      --手续费及佣金净收入
  a.net_inc_sec_trading_brok_bus  as  agy_secu_net_inc,      --经纪业务手续费净收入
  a.NET_INC_SEC_UW_BUS  uv_secu_net_inc,      --投资银行业务手续费净收入
  a.net_inc_ec_asset_mgmt_bus as  cust_ast_serv_net_inc,      --资产管理业务手续费净收入
  a.prem_inc as  insr_inc,      --保险业务收入
  a.incl_reinsurance_prem_inc  as  reinsr_inc,      --分保费收入
  a.less_ceded_out_prem  as  reinsr_perm,      --分出保费
  a.chg_unearned_prem_res  as  unt_rsv_insr,      --提取未到期责任准备金
  a.other_bus_inc  as  oth_biz_income,      --其他业务收入
  a.other_income as  other_rtn,      --其他收益
  ''   as other_rtn_fin,  --其他收益金融 
  a.plus_net_invest_inc  as  insm_inc,      --投资收益
  a.incl_inc_invest_assoc_jv_entp  as  jn_co_corp_inso_inc,      --对联营企业和合营企业的投资收益
  ''   as insm_estt_fair_val_chg_rtn, --投资性房地产公允价值变动收益
  a.plus_net_gain_chg_fv  as  fair_val_chg_rtn,      --公允价值变动收益
  a.asset_disposal_income  as  ast_dspl_inc,      --资产处置收益
  '' as ast_dspl_inc_fin,  --资产处置收益金融
  a.plus_net_gain_fx_trans  as  fc_exch_inc,      --汇兑收益
  ''    as  fund_mng_fee_inc,  --基金管理费收入
  ''    as  fund_sell_inc,  --基金销售收入
  ''    as  ncast_deal_gain,  --非流动资产处置利得
  ''    as  nop_net_inc,   --非经营性净收益
   --a.tot_oper_cost2  as  op_tcost,      --营业总成本
  case when from_unixtime(unix_timestamp(a.report_period,'yyyyMMdd'),'yyyy-MM-dd') >='2019-01-01' then tot_oper_cost2 else tot_oper_cost end as op_tcost,--营业总成本
  ''    as  op_tcost_dbi,   --营业总成本差额合计平衡项目
  ''    as  op_tcost_dsi,   --营业总成本差额特殊报表科目
  ''    as  op_tcost_dsi_expl,  --营业总成本差额说明特殊报表科目
  a.less_oper_cost  as  op_cost,      --营业成本
  a.oper_exp as  op_exp,      --营业支出
  a.less_int_exp as  int_exp,      --利息支出
  a.less_handling_chrg_comm_exp  as  fee_cms_exp,      --手续费及佣金支出
  ''    as  fee_cms_exp_ci,  --手续费及佣金支出成本科目
  a.insurance_expense  as  insr_exp,      --保险业务支出
  a.prepay_surr  as  srd_chrg,      --退保金
  a.tot_claim_exp  as  cmps_pay,      --赔付支出
  a.less_claim_recb_reinsurer  as  rfd_cmps_pay,      --摊回赔付支出
  a.dvd_exp_insured  as  plcy_dvd_exp,      --保单红利支出
  a.reinsurance_exp  as  rinsr_exp,      --分保费用
  a.less_taxes_surcharges_ops  as  biz_tax_srch,      --营业税金及附加
  a.less_selling_dist_exp  as  sell_exp,      --销售费用
  case when a.comp_type_code <> '1' then a.less_gerl_admin_exp end as biz_adm_fee,      --业务及管理费
  a.less_gerl_admin_exp as  adm_exp,      --管理费用
  a.less_fin_exp  as  fin_exp,      --财务费用
  a.fin_exp_int_inc  as  fin_exp_int_inc,      --财务费用利息收入
  ''   as  int_exp_ci,  --利息支出成本科目
  a.less_impair_loss_assets  as  ast_impr_loss,      --资产减值损失
  a.credit_impairment_loss  as  cred_impr_loss,      --信用减值损失
  a.OTHER_IMPAIR_LOSS_ASSETS   as  other_ast_impr_loss,  --其他资产减值损失 --20230822 lys 
  a.il_net_loss_disp_noncur_asset  as  ncast_deal_loss,      --非流动资产处置损失
  a.unconfirmed_invest_loss  as  uncfm_insm_loss,      --未确认的投资损失
  a.chg_insur_cont_rsrv as  rsv_insr,      --提取保险责任准备金
  a.less_ins_rsrv_recb_reinsurer  as  rfd_insr,      --摊回保险责任准备金
  a.less_exp_recb_reinsurer  as  rfd_reinsr_exp,      --摊回分保费用
  a.other_bus_cost  as  oth_biz_cost,      --其他业务成本
  a.oper_profit      as  op_prof,      --营业利润
  a.tot_bal_oper_profit  as  op_prof_dbi,      --营业利润差额合计平衡项目
  a.spe_bal_oper_profit  as  op_prof_dsi,      --营业利润差额特殊报表科目
  ''  as  op_prof_dsi_expl,  --营业利润差额说明特殊报表科目
  a.plus_non_oper_rev  as  ext_inc,      --营业外收入
  a.less_non_oper_exp  as  ext_exp,      --营业外支出
  a.tot_profit  as  tprof,      --利润总额
  a.tot_bal_tot_profit  as  tprof_dbi,      --利润总额差额合计平衡项目
  a.spe_bal_tot_profit  as  tprof_dsi,      --利润总额差额特殊报表科目
  ''   as  tprof_dsi_expl,   --利润总额差额说明特殊报表科目
  a.inc_tax  as  tax_fee,      --所得税费用
  a.net_profit_incl_min_int_inc  as  net_prof,      --净利润
  ''  as  efct_net_prof_ai,  --影响净利润调整项目
  ''  as  efct_net_prof_oi,  --影响净利润的其他科目
  a.tot_bal_net_profit  as  net_prof_dbi,      --净利润差额合计平衡项目
  a.spe_bal_net_profit  as  net_prof_dsi,      --净利润差额特殊报表科目
  ''  as    net_prof_dsi_expl,   --净利润差额说明特殊报表科目 
  a.continued_net_profit  as  sust_op_net_prof,      --持续经营净利润
  ''  as  end_op_net_prof,  --终止经营净利润
  a.minority_int_inc  as  mish_pnl,      --少数股东损益
  a.net_profit_excl_min_int_inc  as  pcosh_net_prof,      --归属母公司所有者的净利润
  ''  as  pco_net_prof_dsi,  --归属于母公司的净利润差额特殊报表科目
  ''  as  pco_net_prof_dsi_expl,  --归属于母公司的净利润差额说明特殊报表科目
  ''  as  pcosh_dnet_prof,  --扣除非经常性损益后的归属于母公司的净利润
  a.other_compreh_inc  as  oth_cinc,      --其他综合收益
  ''  as  pco_oth_cinc,  --归属于母公司所有者的其他综合收益
  ''  as  mish_oth_cinc, --归属于少数股东的其他综合收益
  a.tot_compreh_inc  as  cinc_gamt,      --综合收益总额
  a.tot_compreh_inc_parent_comp  as  pco_cinc_gamt,      --归属于母公司所有者的综合收益总额
  a.tot_compreh_inc_min_shrhldr  as  mish_cinc_gamt,      --归属于少数股东的综合收益总额
  a.s_fa_eps_basic  as  beps,      --基本每股收益
  a.s_fa_eps_diluted  as  deps,      --稀释每股收益
  a.rd_expense  as  r_d_exp,      --研发费用
  a.NET_PROFIT_AFTER_DED_NR_LP  as  nrpl_d_net_prof,  --归属上市公司股东的扣除非经常性损益的净利润
  a.actual_ann_dt  as actual_ann_date,
  concat('{\\"STATEMENT_TYPE\\":\\"',a.STATEMENT_TYPE,'\\"}')  as remark,      --备注
  'odata_n_uip.w_ashareincome'  as src_tbl,      --来源表
  a.object_id as  src_rec_id,      --来源记录
from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')	as	rec_upd_time,
from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')	as	rec_down_time,
a.ebitda                          as ebitda,
a.ebit                              as ebit
from (select * from odata_n_uip.w_ashareincome where busi_date='${data_day_str}') a
left join (select * from t02_scr_base_info where src_id = 'WD')b on a.s_info_windcode= b.in_code
left join (select * from t02_pub_covt_const where const_type_cd = 'inf00010' and src_id = 'WD') d on a.statement_type=d.src_const_cd
