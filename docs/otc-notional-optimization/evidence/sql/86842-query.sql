set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '${data_day_str}', grp_id = '03')
select
    a.key_trade_comfirm_id as Agt_Id,
    'TRS' as Busi_Type,
    a.counterparty_id as Cutp_Pty_Id,
    cp.abbreviation as Cutp_Pty_Shor_Name,
    cp.corporate_name as Cutp_Pty_Full_Name,
    cp.Signature_Name as Sign_Prd_Name,
    cp.industry as Indt_Cd,
    cp.aptitude as Corp_Qual,
    if(a.trs_type = 'B_LONG_SHORT_SWAP', 'TRS_KINGSTAR_SWAP', 'TRS_LONG_SHORT') as Contr_Type_Cd,
    if(a.trs_type = 'B_LONG_SHORT_SWAP', '金仕达多空互换', '多空互换') as Contr_Type_Desc,
    a.trs_type as Src_Contr_Type,
    sct.dw_cd_val_desc as Src_Contr_Type_Desc,
    '' as Src_Sub_Contr_Type,
    '' as Src_Sub_Contr_Type_Desc,
    ins.Undrl_Ins_Id,
    ins.Undrl_Wd_Cd,
    ins.Undrl_Name,
    ins.Undrl_Type,
    ins.Undrl_Type_Desc,
    ins.Src_Undrl_Type,
    ins.Src_Undrl_Type_Desc,
    '0' as Res_Flag,
    '0' as IPO_Flag,
    if(a.seller in ('GFS','GFZQ'), '1', '2') as Buy_Sell_Dir_Cd,
    null as Cny_Ex_Rate,
    if(a.trs_type = 'B_LONG_SHORT_SWAP',a.dynamic_notional,a.notional) as Init_Nom_Prin,
    a.dynamic_notional as Dyna_Nom_Prin,
    '0.0' as Absl_Nom_Prin,
    substring(a.start_date, 1, 10) as Strt_Pric_Date,
    substring(a.end_date, 1, 10) as End_Pric_Date,
    substring(a.early_termination_date, 1, 10) as Early_Term_Date,
    substring(a.Payment_Date, 1, 10) as Earn_Pymt_Date,
    a.Time_To_Maturity as Term_Days,
    case when a.contr_status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATING', 'TERMINATING_PENDING') then '101'
         when a.contr_status = 'TERMINATED' then '226'
         end as Agt_Stat_Cd,
    a.contract_code as Inr_Seri_No,
    null as Otc_Seri_No,
    null as bndl_id,
    null as Rel_Agt_Id,
    a.MGR_RATE as Init_Marg_Prop,
    null as init_Marg_Bal,
    null as Ddct_Ptrn,
    cp.commission_rate as cms_rate,
    null as fixed_rate,
    null as fee_rate,
    null as Hedg_Type_Cd,
    null as Opt_Fee,
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
    'OTC' as Book_Bel_Dept,
    null as Bgng_Npv,
    a.contr_status as Src_Agt_Stat_Cd,
    ins.Undrl_Long_Name,
    cp.client_qualify_review as Qual_Revw_Flag,
    a.contract_code as Ext_Comp_No,
    '' as Key_Cutp_Id,
    ins.Undrl_Curr,
    null as Intr_Marg,
    null as Base_Marg_Rate,
    null as Marg_Agt_Id,
    null as Opt_Fee_Rate,
    '10023' as Book_Agt_Id,
    'OTC-互换-金仕达合约' as Book_Name,
    'PORTFOLIO_SWAP' as Cntr,
    'TIT060-10142' as Sler_Cutp_Pty_Id,
    '' as Futr_Type,
    '' as Agt_Clas_Cd,
    '' as Cros_Crrc_Type_Cd,
    '' as Float_Base_Rate,
    '' as Float_Undrl_Cd,
    '' as Flot_Intrt_Ulmt,
    null as Comp_Usag_Cd,
    'CNY' as Sett_Crrc_Cd,
    null as Ex_Rate_Model
from (
    select *
    from (
        select *, row_number() over(partition by key_trade_comfirm_id order by business_date desc) as rn
        from odata_n_tit.d_ks_trade_comfirm_info
        where busi_date = '${data_day_str}'
        ) t
    where t.rn = 1
    ) a
left join (
    select
        b.key_trade_comfirm_id,
        '' as Undrl_Ins_Id,
        concat_ws(';',collect_list(b.un_code)) as Undrl_Wd_Cd,
        concat_ws(';',collect_list(b.un_name)) as Undrl_Name,
        concat_ws(';',collect_list(d.ins_lng_desc)) as Undrl_Long_Name,
        concat_ws(',',collect_set(case when d.ins_family in ('EQUITY', 'GDR', 'BASKET') and d.currency not in ('HKD', 'USD') then 'OTH_STOCK'
             when d.ins_family in ('EQUITY', 'GDR', 'BASKET') and d.currency = 'HKD' then 'HK_STOCK'
             when d.ins_family in ('EQUITY', 'GDR', 'BASKET') and d.currency = 'USD' then 'US_STOCK'
             when d.ins_family not in ('EQUITY', 'GDR', 'BASKET') then 'NON_STOCK'
             else '-' end)) as Undrl_Type,
        '' as Undrl_Type_Desc,
        concat_ws(',',collect_set(d.ins_family)) as Src_Undrl_Type,
        concat_ws(',',collect_set(sutd.dw_cd_val_desc)) as Src_Undrl_Type_Desc,
        concat_ws(',',collect_set(coalesce(d.currency,''))) as Undrl_Curr
    from (
        select
            x.key_trade_comfirm_id,
            x.underlying_wind_code as un_code,
            x.wind_name as un_name
        from (
            select *, row_number() over(partition by key_trade_comfirm_id, underlying_wind_code order by src_busi_date desc) as rn
            from odata_n_tit.d_ks_trs_eod_postion
            where busi_date = '${data_day_str}'
            ) x
        where x.rn = 1
        ) b
    left join (
        select * from odata_n_tit.d_ref_instrument where busi_Date = '${data_day_str}'
        ) d
    on d.wind_code = b.un_code
    left join (
        select *
        from PDATA_N.REF_DW_CD_VAL
        where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
        ) sutd
    on sutd.dw_cd_val = d.ins_family
    group by b.key_trade_comfirm_id
    ) ins
on ins.key_trade_comfirm_id = a.key_trade_comfirm_id
left join (--关联经办人
    select client_id,abbreviation,corporate_name,Signature_Name,industry,aptitude,commission_rate,client_qualify_review
    from odata_n_ois.o_otc_derivative_counterparty
    where busi_Date = '${data_day_str}' and delete_flag = '0' and department != 'HK'
    ) cp
on a.counterparty_id = cp.client_id
left join (
    select *
    from PDATA_N.REF_DW_CD_VAL
    where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
    ) sct
on sct.dw_cd_val = a.trs_type
where a.Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')
    and a.start_date is not null and ins.Undrl_Wd_Cd is not null
;