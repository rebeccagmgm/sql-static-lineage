-- task_id: 69289
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_bond_base_info_WD
-- observed_at: 2026-09-05T01:06:27.573Z

-- createSql
create table if not exists t02_bond_base_info (
     busi_date string comment '业务日期'
    ,rec_id string comment '记录编号'
    ,secu_id string comment '统一证券编号'
    ,src_sys_prdno string comment '源系统产品编号'
    ,scr_cd string comment '证券代码'
    ,full_name string comment '债券名称'
    ,abbr_name string comment '债券简称'
    ,abbr_pinyin string comment '简称拼音'
    ,mkt_cd string comment '交易所代码'
    ,crrc_cd string comment '货币代码'
    ,list_ann_date string comment '上市公告日'
    ,list_date string comment '上市日期'
    ,delist string comment '退市日期'
    ,net_iss_end_date string comment '上网发行截止日期'
    ,net_iss_begin_date string comment '上网发行起始日期'
    ,net_iss_amount string comment '上网发行数量(亿元)'
    ,net_iss_scrp_cd string comment '上网发行认购代码'
    ,pay_intr_freq string comment '付息频率'
    ,pay_intr_date_intro string comment '付息日说明'
    ,bond_term_day string comment '债券期限(天)'
    ,bond_term_year string comment '债券期限(年)'
    ,bonds_form string comment '债券形式(1记账式 2凭证式 3实物券)'
    ,rept_method string comment '偿还方式'
    ,trd_type string comment '交易方式'
    ,cash_charge_rate string comment '兑付手续费率(%)'
    ,cash_reg_begin_date string comment '兑付登记起始日'
    ,cash_date string comment '兑付日'
    ,ir_intro string comment '利率说明'
    ,ir_spread string comment '利差(%)'
    ,ir_type string comment '附息利率品种'
    ,due_date string comment '到期日'
    ,ref_yield string comment '参考收益率'
    ,iss_begin_date string comment '发行起始日'
    ,iss_end_date string comment '发行截止日'
    ,iss_charge_rate string comment '发行手续费率(%)'
    ,iss_coup_rate string comment '发行票面利率(%)'
    ,iss_ann_date string comment '发行公告日'
    ,iss_method string comment '发行方式'
    ,issr_name string comment '发行人名称'
    ,issr_no string comment '发行人编号'
    ,issr_type string comment '发行人类型'
    ,iss_obj string comment '发行对象'
    ,iss_amt_ul string comment '发行金额上限'
    ,iss_bond_rate string comment '发行时债券评级'
    ,iss_pric string comment '发行价格'
    ,actl_iss_amts string comment '实际发行总量(亿元)'
    ,plan_iss_amts string comment '计划发行总量(亿元)'
    ,yearsnum string comment '年内序号'
    ,coup_var string comment '息票品种'
    ,tax_rate string comment '所得税率'
    ,undrw_method string comment '承销方式代码'
    ,guar_intr string comment '担保简介'
    ,guar_method_cd string comment '担保方式代码'
    ,guar_name string comment '担保人'
    ,guar_id string comment '担保人ID'
    ,actl_days_inta_flag string comment '是否按实际天数计息'
    ,choice_rgt_flag string comment '是否有选择权'
    ,subordinate_flag string comment '是否次级债或混合资本债(0:一般债券 1:次级债 2: 混合资本债)'
    ,free_flag string comment '是否免税'
    ,co_bond_flag string comment '是否公司债'
    ,inc_bond_flag string comment '是否增发债'
    ,netprice_flag string comment '是否净价'
    ,iss_fail_flag string comment '是否发行失败'
    ,cross_mkt_flag string comment '是否跨市场'
    ,redem_flag string comment '是否可赎回'
    ,prev_redem_flag string comment '是否可提前兑付'
    ,inright_flag string comment '是否含权债'
    ,par_val string comment '面值'
    ,last_par_val string comment '最新面值'
    ,reg_doc_type_cd string comment '注册文件类型代码'
    ,reg_doc_no string comment '注册文件号'
    ,spec_bond_type string comment '特殊债券类型'
    ,spec_year_inta_days string comment '特殊年计息天数'
    ,inta_end_date string comment '计息截止日'
    ,inta_begin_date string comment '计息起始日'
    ,inta_method string comment '计息方式'
    ,inta_basic string comment '计息基准'
    ,former_bond_cd string comment '原债券代码'
    ,src_tbl string comment '来源表'
    ,src_rec_id string comment '来源记录'
    ,rec_upd_time string comment '记录修改时间'
    ,rec_down_time string comment '记录创建时间'   
)comment '债券基础信息表'
partitioned by (src_id string comment '来源标识')
stored as ORC;

-- querySql
set hive.merge.mapfiles = true;
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
set hive.support.concurrency=false;

with guar_det as 
(
    select 
         a.object_id
        ,concat_ws(',',collect_set(b.corp_id)) as guar_id
    from (
            select 
                 object_id
                ,guar_id
            from odata_n_uip.w_cbonddescriptionzl
            lateral view explode(split(b_info_guarantee_id,',')) t1 as guar_id
            where busi_date='{data_day_str}'
        ) a 
    left join (select * from t02_co_base_info where src_id = 'WD') b 
        on a.guar_id = b.src_corp_id
    group by a.object_id
)
INSERT OVERWRITE TABLE t02_bond_base_info partition(src_id='WD')
select
'{data_day_str}' as busi_date      
,A.object_id as rec_id --记录编号
,B.secu_id --统一证券编号
,concat('WD-',A.s_info_windcode) as src_sys_prdno --源系统产品编号(备注)
,B.scr_cd as scr_cd--证券代码
,A.B_INFO_FULLNAME full_name --债券名称
,A.s_info_name abbr_name --债券简称
,A.b_info_pinyin as abbr_pinyin --简称拼音
,A.s_info_exchmarket as mkt_cd --交易所代码
,K.const_cd as crrc_cd --货币代码
,list_ann_date --上市公告日
,A.b_info_listdate as list_date --上市日期
,A.b_info_delistdate as delist --退市日期
,A.b_info_enddbyplacing as net_iss_end_date --上网发行截止日期
,A.b_info_bgndbyplacing as net_iss_begin_date --上网发行起始日期
,A.b_info_amountbyplacing as net_iss_amount --上网发行数量(亿元)
,A.b_info_codebyplacing as net_iss_scrp_cd --上网发行认购代码
,L.const_cd as pay_intr_freq --付息频率
,A.b_info_coupondatetxt as pay_intr_date_intro --付息日说明
,A.b_info_term_day_ as  bond_term_day --债券期限(天)
,A.b_info_term_year_ as bond_term_year --债券期限(年)
,case when A.b_info_form='1' then '记账式' when A.b_info_form='2' then '凭证式' when A.b_info_form='3' then '实物券' end as bonds_form --债券形式(1记账式 2凭证式 3实物券)
,A.reimbursement as rept_method --偿还方式
,C.S_TYPNAME as trd_type --交易方式(备注)
,A.b_redemption_feeration as cash_charge_rate --兑付手续费率(%)
,A.s_div_recorddate as cash_reg_begin_date --兑付登记起始日
,A.b_info_paymentdate as cash_date --兑付日
,A.b_info_coupontxt as ir_intro --利率说明
,A.b_info_spread as ir_spread --利差(%)
,D.S_TYPNAME as ir_type --附息利率品种(备注) D.S_TYPNAME
,A.b_info_maturitydate as due_date --到期日
,A.b_tendrst_referyield as ref_yield --参考收益率
,A.b_issue_firstissue as iss_begin_date --发行起始日
,A.b_issue_lastissue as iss_end_date --发行截止日
,A.b_issue_fee as iss_charge_rate --发行手续费率(%)
,A.b_info_couponrate as iss_coup_rate --发行票面利率(%)
,A.b_issue_announcement as iss_ann_date --发行公告日
,E.S_TYPNAME as iss_method --发行方式 E.S_TYPNAME
,A.b_info_issuer as issr_name --发行人名称
,A.b_info_issuercode as issr_no --发行人编号
,A.b_info_issuertype as issr_type --发行人类型
,A.issue_object as iss_obj --发行对象
,A.b_issue_amount_max as iss_amt_ul --发行金额上限
,A.bond_rating as iss_bond_rate --发行时债券评级
,A.b_info_issueprice as iss_pric --发行价格
,A.b_issue_amountact as actl_iss_amts --实际发行总量(亿元)
,A.b_issue_amountplan as plan_iss_amts --计划发行总量(亿元)
,A.b_info_yearsnumber as yearsnum --年内序号
,F.S_TYPNAME as coup_var --息票品种
,A.b_info_taxrate as tax_rate --所得税率
,G.S_TYPNAME as undrw_method --承销方式代码
,A.b_info_guarintroduction as guar_intr --担保简介
,H.S_TYPNAME as guar_method_cd --担保方式代码
,A.b_info_guarantor as guar_name --担保人
,I.guar_id as guar_id --担保人ID
,case when A.is_act_days='1' then '是' when A.is_act_days='0' then '否' end as actl_days_inta_flag --是否按实际天数计息
,case when A.is_chooseright='1' then '是' when A.is_chooseright = '0' then '否' end as choice_rgt_flag --是否有选择权
,case when A.b_info_subordinateornot='0' then '一般债券' when A.b_info_subordinateornot='1' then '次级债' when A.b_info_subordinateornot='2' then '混合资本债' end as  subordinate_flag--是否次级债或混合资本债(0:一般债券 1:次级债 2: 混合资本债)
,A.is_taxfree as free_flag --是否免税
,case when A.is_corporate_bond='1' then '是' else '否' end as co_bond_flag --是否公司债
,case when A.is_incbonds='1' then '是' when A.is_incbonds = '0' then '否' end inc_bond_flag --是否增发债
,case when A.is_netprice='1' then '净价' when A.is_netprice='0' then '全价' end netprice_flag --是否净价
,case when A.is_failure='0' then '正常发行' when A.is_failure='1' then '发行失败' end iss_fail_flag --是否发行失败
,case when A.is_crossmarket='1' then '是' else '否' end as cross_mkt_flag --是否跨市场
,case when A.is_callable='0' then '否' when A.is_callable = '1' then '是' end as redem_flag --是否可赎回
,case when A.is_payadvanced='0' then '否' when A.is_payadvanced='1' then '是' end as prev_redem_flag --是否可提前兑付
--,case when A.is_inright='0' then '否' else '是' end as inright_flag --是否含权债
,A.IS_INRIGHT as inright_flag --是否含权债
,A.b_info_par as par_val --面值
,A.b_info_curpar as last_par_val --最新面值
,A.register_file_type_code as reg_doc_type_cd --注册文件类型代码
,A.register_file_number as reg_doc_no --注册文件号
,A.b_info_specialbondtype as spec_bond_type --特殊债券类型
,A.b_info_act as spec_year_inta_days --特殊年计息天数
,A.b_info_enddate as inta_end_date --计息截止日
,A.b_info_carrydate as inta_begin_date --计息起始日
,J.S_TYPNAME as inta_method --计息方式
,A.b_info_actualbenchmark as inta_basic --计息基准
,A.b_info_formercode as former_bond_cd --原债券代码
,'odata_n_uip.w_cbonddescriptionzl' as src_tbl --来源表
,A.object_id as src_rec_id --来源记录
,FROM_UNIXTIME(UNIX_TIMESTAMP(), 'yyyy-MM-dd HH:mm:ss') as  rec_upd_time --记录修改时间
,FROM_UNIXTIME(UNIX_TIMESTAMP(), 'yyyy-MM-dd HH:mm:ss') as  rec_down_time --记录创建时间   
 from 
(select * from odata_n_uip.w_cbonddescriptionzl where busi_date='{data_day_str}') A    
left join 
   t02_scr_base_info B 
on 
   A.s_info_windcode = B.in_code and B.src_id = 'WD'     
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}') C  --交易方式
on 
   A.trade_type_code = C.S_ORIGIN_TYPCODE and C.S_CLASSIFICATION = '交易所债券交易方式'   
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}') D --附息利率品种
on 
  A.b_info_interesttype = D.S_ORIGIN_TYPCODE and D.S_CLASSIFICATION = '利率类型配置表'
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}')  E  --发行方式
on 
  A.b_info_issuetype = E.S_ORIGIN_TYPCODE and E.S_CLASSIFICATION = '发行方式配置表'
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}')  F --息票品种
on 
   A.b_info_coupon = F.S_ORIGIN_TYPCODE and F.S_CLASSIFICATION = '付息方式配置表'
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}')  G --承销方式代码
on 
   A.b_info_underwritingcode = G.S_ORIGIN_TYPCODE  and G.S_CLASSIFICATION='承销方式配置表'
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}')  H --担保方式代码
on
   A.b_info_guartype = H.S_ORIGIN_TYPCODE and H.S_CLASSIFICATION = '担保方式配置表'
left join 
   guar_det I 
on  
  A.object_id = I.object_id 
left join 
  (select * from  odata_n_uip.w_asharetypecode where busi_date='{data_day_str}')  J 
on 
  A.b_info_paymenttype = J.S_ORIGIN_TYPCODE  and J.S_CLASSIFICATION = '计息方式配置表'
left join 
  (select * from t02_pub_covt_const where const_type_cd = 'fin00001' and src_id = 'WD') K  --货币代码
on 
  A.crncy_code = K.src_const_cd
left join
  (select * from t02_pub_covt_const where const_type_cd = 'var00127' and src_id = 'WD') L
on
  A.b_info_interestfrequency = L.src_const_cd
