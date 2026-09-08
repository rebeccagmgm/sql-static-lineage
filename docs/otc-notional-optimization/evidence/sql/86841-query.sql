set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '${data_day_str}', grp_id = '02')
select
    trade.internal_trade_id as Agt_Id,
    'TRS' as Busi_Type,
    rcm.outside_ctpty_code as Cutp_Pty_Id,
    cp.abbreviation as Cutp_Pty_Shor_Name,
    cp.corporate_name as Cutp_Pty_Full_Name,
    cp.Signature_Name as Sign_Prd_Name,
    cp.industry as Indt_Cd,
    cp.aptitude as Corp_Qual,
    if(
        substring(rt.START_DATE, 1, 10) <= '2025-03-31'
        ,case when rb.department = 'OTC_HK' and rt.trs_type in ('CROSS_LEND_SWAP','HK_LONG_HOLD_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_QFII_SWAP') then concat('TRS_',rt.trs_type)
              when rt.trs_type = 'N_CROSS_SWAP' then 'TRS_N_STOCK'
              when rt.trs_type in ('CALL_SWAP', 'PUT_SWAP') then 'TRS_LONG_SHORT'
              when rt.trs_type = 'S_CROSS_FUTURE_SWAP' then 'TRS_S_CROSS_FUTURES'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.interotc_underlying_category = 'BONDS' then 'TRS_S_CROSS_BOND'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency != 'CNY' and rtl.ipo_type = 'Y' then 'TRS_S_IPO'  --？
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency != 'CNY' and (rtl.ipo_type = 'N' or rtl.ipo_type is null) and rtl.Private_Placement = 'Y' then 'TRS_S_STOCK_LIMITED'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency = 'HKD' and (rtl.ipo_type = 'N' or rtl.ipo_type is null) and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null) then 'TRS_S_CROSS_HK'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency not in ('HKD','CNY') and (rtl.ipo_type = 'N' or rtl.ipo_type is null) and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null) then 'TRS_S_CROSS_OTHER'
              when rb.company = 'GFS_HK' and rt.trs_type = 'FEE_SWAP' and rt.contract_use = 'REBATE_INTEREST' then 'FEE_SWAP_HK'
              when rb.company = 'GFS_HK' and rt.trs_type = 'INDEX_ENHANCE_SWAP' then 'TRS_N_CROSS_INDEX_ENHANCE'
              else 'TRS_OTHER_SWAP' end
        ,case when rt.trs_type = 'LEND_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') then 'TRS_SHORT_SELL'
              when his_ini.ins_family = 'QIS' then 'TRS_S_CROSS_QTF_STRG_IDX'
              when rt.trs_type = 'S_CROSS_FUTURE_SWAP' then 'TRS_S_CROSS_FUTURES'
              when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP') and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency != 'CNY' and rtl.ipo_type = 'Y' then 'TRS_S_IPO'
              when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP') and his_ini.ins_family in ('EQUITY', 'GDR') and (rtl.ipo_type = 'N' or rtl.ipo_type is null) then 'TRS_S_CROSS_STOCK'
              when rb.company = 'GFS_HK' and rt.trs_type = 'INDEX_ENHANCE_SWAP' then 'TRS_N_CROSS_INDEX_ENHANCE'
              else 'TRS_OTHER_SWAP' end
    ) as Contr_Type_Cd,
    if(
        substring(rt.START_DATE, 1, 10) <= '2025-03-31'
        ,case when rb.department = 'OTC_HK' and rt.trs_type in ('CROSS_LEND_SWAP','HK_LONG_HOLD_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_QFII_SWAP') then sct.dw_cd_val_desc
              when rt.trs_type = 'N_CROSS_SWAP' then '北上A股'
              when rt.trs_type in ('CALL_SWAP', 'PUT_SWAP') then '多空互换'
              when rt.trs_type = 'S_CROSS_FUTURE_SWAP' then '南下期货'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.interotc_underlying_category = 'BONDS' then '南下债券'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency != 'CNY' and rtl.ipo_type = 'Y' then '南下IPO'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency != 'CNY' and (rtl.ipo_type = 'N' or rtl.ipo_type is null) and rtl.Private_Placement = 'Y' then '南下跨境互换（限售股）'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency = 'HKD' and (rtl.ipo_type = 'N' or rtl.ipo_type is null) and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null) then '南下跨境港股'
              when rt.trs_type = 'S_CROSS_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency not in ('HKD','CNY') and (rtl.ipo_type = 'N' or rtl.ipo_type is null) and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null) then '南下跨境-其他股票市场'
              when rb.company = 'GFS_HK' and rt.trs_type = 'FEE_SWAP' and rt.contract_use = 'REBATE_INTEREST' then '费用合约'
              when rb.company = 'GFS_HK' and rt.trs_type = 'INDEX_ENHANCE_SWAP' then '北上指数增强'
              else '其它互换类型' end
        ,case when rt.trs_type = 'LEND_SWAP' and his_ini.ins_family in ('EQUITY', 'GDR') then '借券互换'
              when his_ini.ins_family = 'QIS' then '南下量化策略指数互换'
              when rt.trs_type = 'S_CROSS_FUTURE_SWAP' then '南下期货'
              when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP') and his_ini.ins_family in ('EQUITY', 'GDR') and his_ini.currency != 'CNY' and rtl.ipo_type = 'Y' then '南下IPO'
              when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP') and his_ini.ins_family in ('EQUITY', 'GDR') and (rtl.ipo_type = 'N' or rtl.ipo_type is null) then '南下跨境股票'
              when rb.company = 'GFS_HK' and rt.trs_type = 'INDEX_ENHANCE_SWAP' then '北上指数增强'
              else '其它互换类型' end
    ) as Contr_Type_Desc,
    rt.trs_type as Src_Contr_Type,
    sct.dw_cd_val_desc as Src_Contr_Type_Desc,
    '' as Src_Sub_Contr_Type,
    '' as Src_Sub_Contr_Type_Desc,
    his_ini.underlying_ins_id as Undrl_Ins_Id,
    his_ini.wind_code as Undrl_Wd_Cd,
    his_ini.ins_sht_desc as Undrl_Name,
    case when his_ini.ins_family in ('EQUITY', 'GDR', 'BASKET') and his_ini.currency not in ('HKD', 'USD') then 'OTH_STOCK'
         when his_ini.ins_family in ('EQUITY', 'GDR', 'BASKET') and his_ini.currency = 'HKD' then 'HK_STOCK'
         when his_ini.ins_family in ('EQUITY', 'GDR', 'BASKET') and his_ini.currency = 'USD' then 'US_STOCK'
         when his_ini.ins_family not in ('EQUITY', 'GDR', 'BASKET') then 'NON_STOCK'
         else '-' end as Undrl_Type,
    '' as Undrl_Type_Desc,
    if(his_ini.interotc_underlying_category = 'BONDS', 'BOND', his_ini.ins_family) as Src_Undrl_Type,
    if(his_ini.interotc_underlying_category = 'BONDS', '债券', his_ini.dw_cd_val_desc) as Src_Undrl_Type_Desc,
    if(rtl.PRIVATE_PLACEMENT = 'Y', '1', '0') as Res_Flag,
    if(rtl.IPO_Type = 'Y', '1', '0') as IPO_Flag,
    if(rt.seller in ('10161','10142'), '1', '2') as Buy_Sell_Dir_Cd,
    CASE WHEN RT.CURRENCY = 'CNY' THEN 1 
         WHEN RT.BASE_CURRENCY = 'CNY' THEN RT.BASE_INIT_EXCHANGE_RATE 
         WHEN RT.SETTLEMENT_CURRENCY = 'CNY' THEN RT.SETTLE_INIT_EXCHANGE_RATE
         end as Cny_Ex_Rate,
    his_ini.Nom_Prin * CASE WHEN RT.CURRENCY = 'CNY' THEN 1 
         WHEN RT.BASE_CURRENCY = 'CNY' THEN RT.BASE_INIT_EXCHANGE_RATE 
         WHEN RT.SETTLEMENT_CURRENCY = 'CNY' THEN RT.SETTLE_INIT_EXCHANGE_RATE
         end as Init_Nom_Prin,
    coalesce(his_dy.Nom_Prin, 0) * CASE WHEN RT.CURRENCY = 'CNY' THEN 1 
         WHEN RT.BASE_CURRENCY = 'CNY' THEN RT.BASE_INIT_EXCHANGE_RATE 
         WHEN RT.SETTLEMENT_CURRENCY = 'CNY' THEN RT.SETTLE_INIT_EXCHANGE_RATE
         end as Dyna_Nom_Prin,
    '0.0' as Absl_Nom_Prin,
    substring(rt.START_DATE, 1, 10) as Strt_Pric_Date,
    substring(rt.End_Date, 1, 10) as End_Pric_Date,
    substring(tocr.Actual_Settlement_Date, 1, 10) as Early_Term_Date,
    substring(rt.Payment_Date, 1, 10) as Earn_Pymt_Date,
    rt.Time_To_Maturity as Term_Days,
    case when rt.contr_status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATING', 'TERMINATING_PENDING') then '101'
         when rt.contr_status = 'TERMINATED' then '226'
         end as Agt_Stat_Cd,
    trade.key_otc_trade_id as Inr_Seri_No,
    trade.key_instrument_id as Otc_Seri_No,
    rt.bundle_id as bndl_id,
    rel.property_value as Rel_Agt_Id,
    mrg.Initial_Margin as Init_Marg_Prop,
    mrg.MARGIN_BALANCE_INIT as init_Marg_Bal,
    mp.deduction_pattern as Ddct_Ptrn,
    cp.commission_rate as cms_rate,
    case when rtl_f.leg_type = 'FIXED_LEG_TYPE' then rtl_f.fixed_rate end as fixed_rate,
    null as fee_rate,
    null as Hedg_Type_Cd,
    null AS Opt_Fee,
    null as Opt_Fee_Paid_Date,
    null as KO_Prtc_rate,
    null as KO_Yield,
    null as net_coll,
    null as Coup_Rate,
    null as Min_OBS_DATE,
    null as Max_OBS_DATE,
    null as Up_Prtc_rate,
    null as Down_Prtc_rate,
    null as KI_Barr_PCT,
    null as KO_Barr_PCT,
    null as Strk_PCT,
    null as DOWN_Strk_PCT,
    null as UP_Strk_PCT,
    'TIT' AS Data_Src_Cd,
    UPPER('${filename}') AS Task_Name,
    '${data_day_str}' AS Data_Etl_Date,
    '${data_day_str}' AS Data_Upt_Date,
    '${data_today}' AS Data_Time,
    rb.department as Book_Bel_Dept,
    null as Bgng_Npv,
    rt.contr_status as Src_Agt_Stat_Cd,
    his_ini.ins_lng_desc as Undrl_Long_Name,
    cp.client_qualify_review as Qual_Revw_Flag,
    rt.contract_code as Ext_Comp_No,
    rt.key_ctpty_id as Key_Cutp_Id,
    coalesce(his_ini.currency,'') as Undrl_Curr,
    rtl_f.spread as Intr_Marg,
    mrg.basic_margin_rate as Base_Marg_Rate,
    mr.Marg_Agt_Id,
    null as Opt_Fee_Rate,
    rb.key_book_id as Book_Agt_Id,
    rb.Book_Name,
    rb.Desk as Cntr,
    IF(NVL(TRIM(rt.seller),'')='','',CONCAT('TIT060-',rt.seller)) as Sler_Cutp_Pty_Id,
    his_ini.future_type as Futr_Type,
    trade.business_type as Agt_Clas_Cd,
    rt.cross_currency_type as Cros_Crrc_Type_Cd,
    case when rtl_f.leg_type = 'FLOAT_LEG_TYPE' then rtl_f.fixed_rate end as Float_Base_Rate,
    case when rtl_f.leg_type = 'FLOAT_LEG_TYPE' then rtl_f.underlying_ins_id end as Float_Undrl_Cd,
    case when rtl_f.leg_type = 'FLOAT_LEG_TYPE' then rtl_f.floating_rate_cap end as Flot_Intrt_Ulmt,
    rt.contract_use as Comp_Usag_Cd,
    rt.SETTLEMENT_CURRENCY as Sett_Crrc_Cd,
    rt.fx_rate_model as Ex_Rate_Model
from (
    select * from odata_n_tit.d_trd_otc_trade
    where busi_Date = '${data_day_str}' and key_book_id NOT IN ('10022', '10019')  --去掉测试book
    ) trade
inner join (
    select * from odata_n_tit.d_ref_book
    where busi_Date = '${data_day_str}' and department in ('OTC','OTC_HK')  --限定OTC部及OTCHK的交易
    ) rb
ON rb.key_book_id = trade.key_book_id
inner join (
    select * from odata_n_tit.d_ref_trs where busi_Date = '${data_day_str}'
    ) rt
ON rt.key_otc_trade_id = trade.key_otc_trade_id
left join (
    select *
    from odata_n_tit.d_ref_trs_leg
    where busi_Date = '${data_day_str}' and leg_type = 'STRUCTURE_LEG_TYPE'
    ) rtl
ON rtl.key_otc_trade_id = rt.key_otc_trade_id
left join (
    select *
    from odata_n_tit.d_ref_trs_leg
    where busi_Date = '${data_day_str}' and leg_type != 'STRUCTURE_LEG_TYPE'
    ) rtl_f
ON rtl_f.key_otc_trade_id = rt.key_otc_trade_id
left join (
    select * from odata_n_tit.d_trd_otc_contr_report where busi_Date = '${data_day_str}'
    ) TOCR
ON TOCR.KEY_OTC_TRADE_ID = rt.KEY_OTC_TRADE_ID
left join (
    select * from odata_n_tit.d_ref_ctpty_mapping where busi_Date = '${data_day_str}'
    ) rcm
ON rt.key_ctpty_id = rcm.key_ctpty_id
left join (
    SELECT
        t.key_leg_id,
        concat_ws(';',collect_list(t.underlying_ins_id)) as underlying_ins_id,
        concat_ws(';',collect_list(t.wind_code)) as wind_code,
        concat_ws(';',collect_list(t.ins_sht_desc)) as ins_sht_desc,
        concat_ws(';',collect_set(c.interotc_underlying_category)) as interotc_underlying_category,
        concat_ws(';',collect_set(d.ins_family)) as ins_family,
        concat_ws(';',collect_set(d.currency)) as currency,
        concat_ws(';',collect_set(d.ins_lng_desc)) as ins_lng_desc,
        concat_ws(';',collect_set(sutd.dw_cd_val_desc)) as dw_cd_val_desc,
        concat_ws(';',collect_set(f.future_type)) as future_type,
        sum(t.Init_Price * t.Init_Quantity) as Nom_Prin
    FROM (
        select *,row_number() over(partition by key_leg_id, underlying_ins_id order by src_busi_date) as rk
        from odata_n_tit.d_pos_trs_leg_his_pos
        where busi_Date = '${data_day_str}'
        ) t
    left join (
        select * from odata_n_tit.r_cfg_instrument_pool_props
        where busi_Date = '${data_day_str}' and KEY_POOL_ID = '10000'
        ) c
    on c.key_instrument_id = t.underlying_ins_id
    left join (
        select * from odata_n_tit.d_ref_instrument where busi_Date = '${data_day_str}'
        ) d
    on d.key_instrument_id = t.underlying_ins_id
    left join (
        select * from odata_n_tit.d_ref_future_properties where busi_Date = '${data_day_str}'
        ) f
    on f.key_instrument_id = t.underlying_ins_id
    left join (
        select *
        from PDATA_N.REF_DW_CD_VAL
        where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
        ) sutd
    on sutd.dw_cd_val = d.ins_family
    where t.rk = 1
    group by key_leg_id
    ) his_ini
ON his_ini.key_leg_id = rtl.key_leg_id
left join (
    SELECT
        key_leg_id,
        sum(Init_Price * Quantity) as Nom_Prin
    FROM odata_n_tit.d_pos_trs_leg_his_pos
    where busi_Date = '${data_day_str}' and substring(src_busi_date,1,10) = '${data_day_str}'
    group by key_leg_id
    ) his_dy
ON his_dy.key_leg_id = his_ini.key_leg_id
left join (
    select * from odata_n_tit.d_trd_otc_contr_props
    where busi_Date = '${data_day_str}' and property_name = 'relatedOption'
    ) rel
on rel.key_otc_trade_id = trade.key_otc_trade_id
left join (
    select * from odata_n_tit.d_ref_otc_contr_margin_param
    where busi_Date = '${data_day_str}'
    ) mrg
on mrg.key_otc_trade_id = trade.key_otc_trade_id
left join (
    select trs_key_otc_trade_id, concat_ws(';',collect_set(option_key_otc_trade_id)) as Marg_Agt_Id
    from odata_n_tit.f_ref_option_margin_trs_relation
    where busi_date = '${data_day_str}' and status = 'Y'
    group by trs_key_otc_trade_id
    ) mr
on mr.trs_key_otc_trade_id = trade.key_otc_trade_id
left join (
    select * from odata_n_tit.d_trd_bundle_info
    where busi_Date = '${data_day_str}'
    ) tbi
on tbi.bundle_id = rt.bundle_id
left join (
    select * from odata_n_tit.d_margin_plan
    where busi_Date = '${data_day_str}'
    ) mp
on tbi.key_plan_id = mp.id
left join (--关联客户信息
    select client_id,abbreviation,corporate_name,Signature_Name,industry,aptitude,commission_rate,client_qualify_review
    from odata_n_ois.o_otc_derivative_counterparty
    where busi_Date = '${data_day_str}' and delete_flag = '0' and department != 'HK'
    union all
    select client_id,abbreviation,full_name as corporate_name, null as Signature_Name,null as industry,null as aptitude,null as commission_rate, null as client_qualify_review
    from odata_n_ois.g_hk_counterparty
    where busi_Date = '${data_day_str}' and delete_flag = '0'
    ) cp
on rcm.outside_ctpty_code = cp.client_id
left join (
    select *
    from PDATA_N.REF_DW_CD_VAL
    where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
    ) sct
on sct.dw_cd_val = rt.trs_type
left join (
    select *
    from PDATA_N.REF_DW_CD_VAL
    where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
    ) sutd
on sutd.dw_cd_val = his_ini.ins_family
where Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')
;