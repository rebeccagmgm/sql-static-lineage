-- task_id: 69799
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_co_bal_sht_WD_WABC
-- observed_at: 2026-09-05T01:06:28.998Z

-- createSql
create table if not exists T02_CO_BAL_SHT(
busi_date     string    comment'数据日期'
,rec_id     string    comment'记录编号'
,src_sys_prdno     string    comment'源系统产品编号'
,corp_id     string    comment'统一公司编号'
,src_corp_id     string    comment'源系统公司编号'
,pub_dt     string    comment'发布日期'
,info_src     string    comment'信息来源'
,Co_Prop     string    comment'公司性质'
,end_date     string    comment'截止日期'
,rpt_type     string    comment'报告期类型'
,as_cd     string    comment'会计准则代码'
,crrc_cd     string    comment'货币代码'
,data_flag     string    comment'数据标志'
,cash_fund     string    comment'货币资金'
,cust_fund_dpsi     string    comment'客户资金存款'
,sett_rsrv     string    comment'结算备付金'
,cust_rsrv     string    comment'客户备付金'
,lend_fund     string    comment'拆出资金'
,deri_fin_ast     string    comment'衍生金融资产'
,rcv_bill     string    comment'应收票据'
,rcv_acc_namt     string    comment'应收款项'
,ppay_exp     string    comment'预付款项'
,depns     string    comment'待摊费用'
,recv_prem     string    comment'应收保费'
,rinsr_acc_rcv     string    comment'应收分保账款'
,rsv_rinsr_ctr_rcv     string    comment'应收分保合同准备金'
,other_rcv_acc     string    comment'其他应收款'
,rece_int     string    comment'应收利息'
,rcv_dvd     string    comment'应收股利'
,buy_rsell_fin_ast     string    comment'买入返售金融资产'
,hld_sell_ast     string    comment'划分为持有待售的资产'
,invt     string    comment'存货'
,matu_1y_ncur_ast     string    comment'一年内到期的非流动资产'
,cur_liab_dp     string    comment'流动负债递延收益'
,entrust_loan     string    comment'委托贷款'
,other_cur_ast     string    comment'其他流动资产'
,cur_ast_total     string    comment'流动资产合计'
,cur_ast_dbi     string    comment'流动资产差额合计平衡项目'
,cur_ast_dsi     string    comment'流动资产差额特殊报表科目'
,cur_ast_dsi_expl     string    comment'流动资产差额说明特殊报表科目'
,alloc_loan     string    comment'发放贷款'
,avl_sell_fin_ast     string    comment'可供出售金融资产'
,hld_matu_insm     string    comment'持有至到期投资'
,lt_rcv_acc     string    comment'长期应收款'
,lt_eqy_insm     string    comment'长期股权投资'
,insm_estt     string    comment'投资性房地产'
,fix_ast     string    comment'固定资产'
,cnstr_proj     string    comment'在建工程'
,cnstr_matr     string    comment'工程物资'
,prod_ba     string    comment'生产性生物资产'
,cnsm_ba     string    comment'消耗性生物资产'
,oga     string    comment'油气资产'
,intn_ast     string    comment'无形资产'
,dev_payout     string    comment'开发支出'
,gdwl     string    comment'商誉'
,lt_depns     string    comment'长期待摊费用'
,defr_ict_asset     string    comment'递延所得税资产'
,other_ncur_ast     string    comment'其他非流动资产'
,ncur_ast_total     string    comment'非流动资产合计'
,ncur_ast_dbi     string    comment'非流动资产差额合计平衡项目'
,ncur_ast_dsi     string    comment'非流动资产差额特殊报表科目'
,ncur_ast_dsi_expl     string    comment'非流动资产差额说明特殊报表科目'
,cash_depin_cbk     string    comment'现金及存入中央银行款项'
,cash_fund_cscb     string    comment'货币资金现金及存放中央银行款项'
,prcs_mtl     string    comment'贵金属'
,fin_out     string    comment'融出资金'
,depout_marg     string    comment'存出保证金'
,trd_fin_ast     string    comment'交易性金融资产'
,insr_pleg_loan     string    comment'保户质押贷款'
,oarb_dpsi     string    comment'定期存款'
,depout_cap_marg     string    comment'存出资本保证金'
,alone_acct_act_asset     string    comment'独立账户资产'
,trd_seat_fee     string    comment'交易席位费'
,rsv_rlfinsr_rcv     string    comment'应收分保寿险责任准备金'
,rsv_lt_rlfinsr_rcv     string    comment'应收分保长期健康险责任准备金'
,rsv_unt_rlfinsr_rcv     string    comment'应收分保未到期责任准备金'
,rsv_claim_rlfinsr_rcv     string    comment'应收分保未决赔款准备金'
,sbrg_rcv     string    comment'应收代位追偿款'
,fair_val_chg_pnl_fin_ast     string    comment'公允价值变动损益金融资产'
,fair_val_chg_oth_cinc_fin_ast     string    comment'公允价值变动其他综合收益金融资产'
,fin_insm     string    comment'金融投资'
,debt_rt_insm     string    comment'债权投资'
,other_eqy_inst_insm     string    comment'其他权益工具投资'
,other_asset     string    comment'其他资产'
,ttl_ast     string    comment'资产总计'
,asset_dbi     string    comment'资产差额合计平衡项目'
,asset_dsi     string    comment'资产差额特殊报表科目'
,asset_dsi_expl     string    comment'资产差额说明特殊报表科目'
,st_brow     string    comment'短期借款'
,brow_cbk     string    comment'向中央银行借款'
,in_oth_fin_depin_mny     string    comment'同业及其他金融机构存放款项'
,sav_intbk_mny_item     string    comment'存放同业款项'
,brow_fund     string    comment'拆入资金'
,deri_fin_liab     string    comment'衍生金融负债'
,payb_bills     string    comment'应付票据'
,pay_acct     string    comment'应付款项'
,prcv_acc     string    comment'预收款项'
,pre_get_prem     string    comment'预收保费'
,sell_repo_f_ast     string    comment'卖出回购金融资产款'
,payb_fee_cms     string    comment'应付手续费及佣金'
,stf_slry     string    comment'应付职工薪酬'
,pay_fee     string    comment'应交税费'
,other_pay_acc     string    comment'其他应付款'
,pay_int     string    comment'应付利息'
,accr_exp     string    comment'预提费用'
,pay_dvd     string    comment'应付股利'
,rinsr_acc_pay     string    comment'应付分保账款'
,agt_secu_mny     string    comment'代理买卖证券款'
,agt_undr_secu_mny     string    comment'代理承销证券款'
,hld_sell_liab     string    comment'划分为持有待售的负债'
,matu_1y_ncur_liab     string    comment'一年内到期的非流动负债'
,expe_cur_liab     string    comment'预计流动负债'
,other_cur_liab     string    comment'其他流动负债'
,payb_st_fi_mny     string    comment'应付短期融资款'
,cur_liab_total     string    comment'流动负债合计'
,cur_liab_dbi     string    comment'流动负债差额合计平衡项目'
,cur_liab_dsi     string    comment'流动负债差额特殊报表科目'
,cur_liab_dsi_expl     string    comment'流动负债差额说明特殊报表科目'
,lt_brow     string    comment'长期借款'
,pay_bond     string    comment'应付债券'
,pay_bond_pbd     string    comment'应付债券永续债'
,pay_bond_pshr     string    comment'应付债券优先股'
,lt_pay_acc     string    comment'长期应付款'
,lt_stf_slry     string    comment'长期应付职工薪酬'
,expe_ncur_liab     string    comment'预计非流动负债'
,ncur_liab_dp     string    comment'非流动负债递延收益'
,defr_tax_liab     string    comment'递延所得税负债'
,spcl_pay_acc     string    comment'专项应付款'
,other_ncur_liab     string    comment'其他非流动负债'
,ncur_liab_total     string    comment'非流动负债合计'
,ncur_liab_dbi     string    comment'非流动负债差额合计平衡项目'
,ncur_liab_dsi_expl     string    comment'非流动负债差额说明特殊报表科目'
,ncur_liab_dsi     string    comment'非流动负债差额特殊报表科目'
,cust_dpsi     string    comment'客户存款'
,trd_fin_liab     string    comment'交易性金融负债'
,payb_st_bond     string    comment'应付短期债券'
,payb_cmps_mny     string    comment'应付赔付款'
,payb_plcy_bonus     string    comment'应付保单红利'
,pdi     string    comment'保户储金及投资款'
,insr_ctr_rsv     string    comment'保险合同准备金'
,alone_acct_act_liab     string    comment'独立账户负债'
,depin_marg     string    comment'存入保证金'
,rsv_claim     string    comment'未决赔款准备金'
,unt_duty_rfd     string    comment'未到期责任准备金'
,lt_hlinsr_duty_rfd     string    comment'长期健康险责任准备金'
,lfinsr_duty_rfd     string    comment'寿险责任准备金'
,fair_val_chg_pnl_fin_liab     string    comment'公允价值变动损益金融负债'
,ctr_liab     string    comment'合同负债'
,other_liab     string    comment'其他负债'
,ttl_liab     string    comment'负债合计'
,liab_dbi     string    comment'负债差额合计平衡项目'
,liab_dsi     string    comment'负债差额特殊报表科目'
,liab_dsi_expl     string    comment'负债差额说明特殊报表科目'
,pdin_cptl     string    comment'实收资本(或股本)'
,other_eqt_inst     string    comment'其他权益工具'
,other_eqt_inst_pbd     string    comment'永续债'
,other_eqt_inst_pshr     string    comment'优先股'
,cptl_rsv     string    comment'资本公积'
,tsry_stk     string    comment'库存股'
,oth_cinc     string    comment'其他综合收益'
,spcl_store     string    comment'专项储备'
,other_store     string    comment'其他储备'
,surp_rsv     string    comment'盈余公积'
,uncfm_insm_loss     string    comment'未确认的投资损失'
,rsv_comm_risk     string    comment'一般风险准备'
,trd_risk_prep     string    comment'交易风险准备'
,fc_rpt_cnv_diff     string    comment'外币报表折算差额'
,unassn_prof     string    comment'未分配利润'
,comm_sh_eqy     string    comment'归属于普通股股东权益合计'
,pcosh_eqt_total     string    comment'归属于母公司所有者权益合计'
,pcosh_eqt_dbi     string    comment'归属母公司股东权益差额合计平衡项目'
,pcosh_eqt_dsi     string    comment'归属母公司股东权益差额特殊报表项目'
,pcosh_eqt_dsi_expl     string    comment'归属上市公司股东权益差额说明特殊报表项目'
,mish_eqy     string    comment'少数股东权益'
,efct_eqy_oi     string    comment'影响所有者权益的其他科目'
,sh_eqy_tot     string    comment'所有者权益合计'
,sh_eqy_dbi     string    comment'股东权益差额合计平衡项目'
,sh_eqy_dsi     string    comment'股东权益差额特殊报表科目'
,sh_eqy_dsi_expl     string    comment'股东权益差额说明特殊报表科目'
,liab_and_eqy     string    comment'负债和所有者权益总计'
,liab_and_sh_eqy_dbi     string    comment'负债及股东权益差额合计平衡项目'
,liab_and_sh_eqy_dsi     string    comment'负债及股东权益差额特殊报表科目'
,liab_and_sh_eqy_dsi_expl     string    comment'负债及股东权益差额说明特殊报表科目'
--,remark_desc     string    comment'备注描述'
--,src_id     string    comment'来源标识'
--,src_rec_id     string    comment'来源记录编号'
--,rec_down_tm     string    comment'记录落地时间'
--,rec_fst_tm     string    comment'记录进表时间'
--,rec_upd_tm     string    comment'记录更新时间'
,del_id     string    comment'删除标识'
,OTHER_NCUR_FIN_AST     string    comment'其他非流动金融资产'
,FIX_AST_DISP     string    comment'固定资产清理'
,expe_liab     string    comment'预计负债'
,share_cost_fin_ast     string    comment'以摊余成本计量的金融资产'
,payb_bills_acct     string    comment'应付票据及应付账款'
,rcv_bill_acct     string    comment'应收票据及应收账款'
,other_rcv_acc_ttl     string    comment'其他应收款合计'
,rcv_acc_insm     string    comment'应收款项类投资',


-----港股资产负债新增字段
oth_dura_ivst string comment '其他长期投资',
goodwill_intan_ast string comment '商誉及无形资产',
tnt_site string comment '[内部]租赁土地',
payb_note string comment '应付账款及票据',
sav string comment '储备',
Equi_prem string comment '股本溢价',
Ret_Earn string comment '留存收益',
cust_loan_adv string comment '客户贷款及垫款净额',
bnk_dpst string comment '银行同业存款',
mtg_ass_src string comment '抵押担保证券',
sale_loan string comment '可供出售贷款',
TOT_sav string comment '总存款',
mtg_ass_marg string comment '抵押担保融资',
payb_guar string comment '应付再保',
rcvb_guar string comment '应收再保',
defr_cost string comment '递延保单获得成本',
ass_contr_liab string comment '保险合同负债',
ivst_contr_liab string comment '投资合同负债',
oth_ivst string comment '其他投资',
rpt_pd_co_type string comment '报告期公司类型',

 ---尾部字段位置调整
rec_fst_tm string comment '记录进表时间',
remark1    string comment '备用字段',--新增字段,存放json拓展字段 20220609
remark string comment '备注',
src_tbl     string    comment'来源表',
src_rec_id     string    comment'来源记录',
rec_upd_time     string    comment'记录修改时间',
rec_down_time     string    comment'记录创建时间'
 )comment'指数基本资料' 
partitioned by (src_id string comment'数据来源',grp_id string comment '分组编号') 
 stored as orc;

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


insert overwrite table T02_CO_BAL_SHT partition(src_id='WD',grp_id='001')
select 
'${data_day_str}'  as  busi_date,
a.object_id as rec_id,
--b.secu_id   as secu_id,
b.src_sys_prdno as src_sys_prdno,
b.corp_id  as  corp_id,
a.s_info_compcode  as  src_corp_id,
from_unixtime(unix_timestamp(ann_dt,'yyyyMMdd'),'yyyy-MM-dd') as pub_dt,
''   as  info_src,
COMP_TYPE_CODE   as  Co_Prop,
from_unixtime(unix_timestamp(report_period,'yyyyMMdd'),'yyyy-MM-dd') as end_date,
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
  END AS rpt_type, -- 报告期类型
'2' AS AS_CD, -- 会计准则代码
'156' AS CRRC_CD, -- 货币代码
--statement_type  as  data_flag,
d.const_cd  as  data_flag,     --数据标志
monetary_cap    as  cash_fund,
clients_cap_deposit  as  cust_fund_dpsi,
settle_rsrv   as  sett_rsrv,
clients_rsrv_settle  as  cust_rsrv,
loans_to_oth_banks  as  lend_fund,
derivative_fin_assets  as  deri_fin_ast,
notes_rcv  as  rcv_bill,
acct_rcv   as  rcv_acc_namt,
prepay     as  ppay_exp,
deferred_exp  as  depns,
prem_rcv   as  recv_prem,
rcv_from_reinsurer  as  rinsr_acc_rcv,
rcv_from_ceded_insur_cont_rsrv  as  rsv_rinsr_ctr_rcv,
oth_rcv  as  other_rcv_acc,
int_rcv  as  rece_int,
dvd_rcv  as  rcv_dvd,
red_monetary_cap_for_sale  as  buy_rsell_fin_ast,
hfs_assets  as  hld_sell_ast,
inventories  as  invt,
non_cur_assets_due_within_1y  as matu_1y_ncur_ast,
deferred_inc  as  cur_liab_dp,
''  as  entrust_loan,
oth_cur_assets  as  other_cur_ast,
tot_cur_assets  as  cur_ast_total,
tot_cur_assets_diff as  cur_ast_dbi,
spe_cur_assets_diff  as  cur_ast_dsi,
''  as  cur_ast_dsi_expl,
loans_and_adv_granted  as  alloc_loan,
fin_assets_avail_for_sale as  avl_sell_fin_ast,
held_to_mty_invest  as  hld_matu_insm,
long_term_rec  as  lt_rcv_acc,
long_term_eqy_invest  as  lt_eqy_insm,
invest_real_estate  as  insm_estt,
stm_bs_tot  as  fix_ast,
const_in_prog_tot  as  cnstr_proj,
proj_matl  as  cnstr_matr,
productive_bio_assets  as  prod_ba,
consumptive_bio_assets  as  cnsm_ba,
oil_and_natural_gas_assets  as  oga,
intang_assets  as  intn_ast,
r_and_d_costs  as  dev_payout,
goodwill  as  gdwl,
long_term_deferred_exp  as  lt_depns,
deferred_tax_assets  as  defr_ict_asset,
oth_non_cur_assets  as  other_ncur_ast,
tot_non_cur_assets  as  ncur_ast_total,
tot_non_cur_assets_diff  as  ncur_ast_dbi,
spe_non_cur_assets_diff  as  ncur_ast_dsi,
''  as  ncur_ast_dsi_expl,
cash_deposits_central_bank  as  cash_depin_cbk,
''  as  cash_fund_cscb,
precious_metals  as  prcs_mtl,
lending_funds  as  fin_out,
mrgn_paid  as  depout_marg,
tradable_fin_assets  as  trd_fin_ast,
insured_pledge_loan  as  insr_pleg_loan,
time_deposits  as  oarb_dpsi,
cap_mrgn_paid  as  depout_cap_marg,
independent_acct_assets  as  alone_acct_act_asset,
incl_seat_fees_exchange  as  trd_seat_fee,
rcv_ceded_life_insur_rsrv  as  rsv_rlfinsr_rcv,
rcv_ceded_lt_health_insur_rsrv  as  rsv_lt_rlfinsr_rcv,
rcv_ceded_unearned_prem_rsrv  as  rsv_unt_rlfinsr_rcv,
rcv_ceded_claim_rsrv  as  rsv_claim_rlfinsr_rcv,
subr_rec  as  sbrg_rcv,
''   as   fair_val_chg_pnl_fin_ast,
''   as   fair_val_chg_oth_cinc_fin_ast,
''   as   fin_insm,
DEBT_INVESTMENT   as   debt_rt_insm,
other_equity_investment   as  other_eqy_inst_insm,----20230726新增字段
--''   as  other_eqy_inst_insm,
oth_assets  as  other_asset,
tot_assets  as  ttl_ast,
tot_bal_assets_diff  as   asset_dbi,
spe_bal_assets_diff  as  asset_dsi,
''  as  asset_dsi_expl,
st_borrow  as  st_brow,
borrow_central_bank  as  brow_cbk,
liab_dep_oth_banks_fin_inst  as  in_oth_fin_depin_mny,
asset_dep_oth_banks_fin_inst  as  sav_intbk_mny_item,
loans_oth_banks  as  brow_fund,
derivative_fin_liab as  deri_fin_liab,
notes_payable  as  payb_bills,
acct_payable  as  pay_acct,
adv_from_cust  as  prcv_acc,
prem_received_adv  as  pre_get_prem,
fund_sales_fin_assets_rp  as  sell_repo_f_ast,
handling_charges_comm_payable  as  payb_fee_cms,
empl_ben_payable  as  stf_slry,
taxes_surcharges_payable  as  pay_fee,
oth_payable_tot  as  other_pay_acc,
int_payable  as  pay_int,
acc_exp  as  accr_exp,
dvd_payable  as  pay_dvd,
payable_to_reinsurer  as  rinsr_acc_pay,
acting_trading_sec  as  agt_secu_mny,
acting_uw_sec  as  agt_undr_secu_mny,
''  as  hld_sell_liab,
non_cur_liab_due_within_1y  as  matu_1y_ncur_liab,
''  as  expe_cur_liab,
oth_cur_liab  as  other_cur_liab,
st_financing_payable  as  payb_st_fi_mny,
tot_cur_liab  as   cur_liab_total,
tot_cur_liab_diff  as  cur_liab_dbi,
spe_cur_liab_diff  as  cur_liab_dsi,
''  as  cur_liab_dsi_expl,
lt_borrow  as  lt_brow,
bonds_payable  as  pay_bond,
''  as  pay_bond_pbd,
''  as  pay_bond_pshr,
lt_payable  as  lt_pay_acc,
LT_PAYROLL_PAYABLE  as  lt_stf_slry, --20230822 lys
provisions  as  expe_ncur_liab,
deferred_inc_non_cur_liab  as  ncur_liab_dp,
deferred_tax_liab  as  defr_tax_liab,
specific_item_payable as  spcl_pay_acc,
oth_non_cur_liab  as  other_ncur_liab,
tot_non_cur_liab  as   ncur_liab_total,
''   as  ncur_liab_dbi,
''   as  ncur_liab_dsi_expl,
''   as  ncur_liab_dsi,
''   as  cust_dpsi,
tradable_fin_liab  as  trd_fin_liab,
st_bonds_payable  as  payb_st_bond,
claims_payable  as  payb_cmps_mny,
dvd_payable_insured  as  payb_plcy_bonus,
insured_deposit_invest  as  pdi,
rsrv_insur_cont  as  insr_ctr_rsv,
independent_acct_liab  as  alone_acct_act_liab,
deposit_received  as  depin_marg,
out_loss_rsrv  as  rsv_claim,
unearned_prem_rsrv  as  unt_duty_rfd,
lt_health_insur_v  as  lt_hlinsr_duty_rfd,
life_insur_rsrv  as  lfinsr_duty_rfd,
''  as  fair_val_chg_pnl_fin_liab,
contract_liabilities  as  ctr_liab,
oth_liab  as  other_liab,
tot_liab  as  ttl_liab,
tot_bal_liab_diff  as  liab_dbi,
''  as  liab_dsi,
''  as  liab_dsi_expl,
cap_stk  as  pdin_cptl,
other_equity_tools  as  other_eqt_inst,
other_sustainable_bond  as  other_eqt_inst_pbd, --20230822
--''  as  other_eqt_inst_pbd,
other_equity_tools_p_shr  as  other_eqt_inst_pshr,
cap_rsrv  as  cptl_rsv,
less_tsy_stk  as  tsry_stk,
other_comp_income  as  oth_cinc,
special_rsrv  as  spcl_store,
''  as  other_store,
surplus_rsrv  as  surp_rsv,
unconfirmed_invest_loss  as  uncfm_insm_loss,
prov_nom_risks  as  rsv_comm_risk,
''  as  trd_risk_prep,
cnvd_diff_foreign_curr_stat  as  fc_rpt_cnv_diff,
undistributed_profit  as  unassn_prof,
''  as  comm_sh_eqy,
tot_shrhldr_eqy_excl_min_int  as  pcosh_eqt_total,
''  as  pcosh_eqt_dbi,
''  as  pcosh_eqt_dsi,
''  as  pcosh_eqt_dsi_expl,
minority_int  as  mish_eqy,
''  as  efct_eqy_oi,
tot_shrhldr_eqy_incl_min_int as  sh_eqy_tot,
tot_bal_shrhldr_eqy_diff  as  sh_eqy_dbi,
spe_bal_shrhldr_eqy_diff  as  sh_eqy_dsi,
''  as  sh_eqy_dsi_expl,
tot_liab_shrhldr_eqy  as  liab_and_eqy,
tot_bal_liab_eqy_diff  as  liab_and_sh_eqy_dbi,
spe_bal_liab_eqy_diff  as  liab_and_sh_eqy_dsi,
''  as  liab_and_sh_eqy_dsi_expl,
--''  as  remark_desc,
--'AShareBalanceSheet'  as  src_id,
--OBJECT_ID  as  src_rec_id,
--''  as  rec_down_tm,
--''  as  rec_fst_tm,
--''  as  rec_upd_tm,
''  as  del_id,
other_illiquidfinancial_assets  as  OTHER_NCUR_FIN_AST,----20230726新增字段
--'' as  OTHER_NCUR_FIN_AST,
fix_assets_disp  as  FIX_AST_DISP,
provisions  as  expe_liab,
FIN_ASSETS_COST_SHARING as  share_cost_fin_ast, --20230822 lys
ACCOUNTS_PAYABLE  as  payb_bills_acct,
ACCOUNTS_RECEIVABLE_BILL  as  rcv_bill_acct,
OTH_RCV_TOT  as  other_rcv_acc_ttl,
rcv_invest  as  rcv_acc_insm,


-----港股资产负债新增字段
   ''  as  oth_dura_ivst	  ,
   '' as  goodwill_intan_ast	,
   '' as  tnt_site	 ,
   '' as  payb_note	  ,
   '' as  sav	 ,
   '' as  Equi_prem ,
   '' as  Ret_Earn	,
   '' as  cust_loan_adv,
   '' as  bnk_dpst	,
   '' as  mtg_ass_src	,
   '' as  sale_loan	,
   '' as  TOT_sav ,
   '' as  mtg_ass_marg,
   '' as  payb_guar	,
   '' as  rcvb_guar	,
   '' as  defr_cost	,
   '' as  ass_contr_liab,
   '' as  ivst_contr_liab,
   '' as  oth_ivst,
   ''   as  rpt_pd_co_type,
   
 ---尾部字段位置调整
    ''  as  rec_fst_tm,
    concat('{\\"STATEMENT_TYPE\\":\\"',a.sta_type,'\\",','\\"OTHER_DEBT_INVESTMENT\\":\\"',a.oth_debt_ins,'\\",'
                ,'\\"LONG_PAYB_TOT\\":\\"',coalesce(a.lt_payable_tot,''),'\\",'
                ,'\\"OTH_PAYB\\":\\"',coalesce(a.oth_payable,''),'\\",'
                ,'\\"RECEIVABLES_FINANCING\\":\\"',coalesce(a.receivables_financing,''),'\\",'
                ,'\\"RIGHT_USE_ASSETS\\":\\"',coalesce(a.right_use_assets,''),'\\",'
                ,'\\"DEPOSIT_RECEIVED_IB_DEPOSITS\\":\\"',coalesce(a.deposit_received_ib_deposits,''),'\\",'
                ,'\\"LT_PAYROLL_PAYABLE\\":\\"',coalesce(a.lt_payroll_payable,''),'\\",'
                ,'\\"LEASE_LIAB\\":\\"',coalesce(a.lease_liab,''),'\\",'
                ,'\\"CONTRACTUAL_ASSETS\\":\\"',coalesce(a.contractual_assets,''),'\\"}')   --20230726新增字段
                as  remark1,
   ''  as  remark,
   'odata_n_uip.w_asharebalancesheet'  as  src_tbl,
   a.OBJECT_ID  as  src_rec_id,
   from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as      rec_upd_time,
   from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as      rec_create_time


from 
(select *,if(STATEMENT_TYPE is null,'',STATEMENT_TYPE) as sta_type,if(OTHER_DEBT_INVESTMENT is null,'',OTHER_DEBT_INVESTMENT) as oth_debt_ins
from odata_n_uip.w_asharebalancesheet where busi_date='${data_day_str}') a 
left join (select * from t02_scr_base_info where src_id = 'WD')b on a.s_info_windcode= b.in_code
left join (select * from t02_pub_covt_const where const_type_cd = 'inf00010' and src_id = 'WD') d on a.statement_type=d.src_const_cd
