insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '2026-05-24', grp_id = '01')
select
trade.internal_trade_id as Agt_Id,
'OPTION' as Busi_Type,
rcm.outside_ctpty_code as Cutp_Pty_Id,
cp.abbreviation as Cutp_Pty_Shor_Name,
cp.corporate_name as Cutp_Pty_Full_Name,
cp.Signature_Name as Sign_Prd_Name,
cp.industry as Indt_Cd,
cp.aptitude as Corp_Qual,
if(
substring(ds.start_date, 1, 10) <= '2025-03-31'
,case when ds.contract_type = 'AUTOCALL' and ds.contract_sub_type not in ('SNOWBALL','SECURED') and coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') then 'OPTION_AUTOCALL_STOCK'
when ds.contract_type = 'AUTOCALL' and ds.contract_sub_type not in ('SNOWBALL','SECURED') and coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then 'OPTION_AUTOCALL_NONSTOCK'
when ds.contract_type = 'AUTOCALL' and ds.contract_sub_type in ('SNOWBALL','SECURED') then 'OPTION_SNOWBALL_SECURED'
when ds.contract_type = 'AIRBAG' and coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') then 'OPTION_AIRBAG_STOCK'
when ds.contract_type = 'AIRBAG' and coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then 'OPTION_AIRBAG_NONSTOCK'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(bc.ins_family,ins.ins_family) = 'EQUITY' and deal.PRIVATE_PLACEMENT = 'Y' then 'OPTION_RISKY_AIRBAGX_PRI_STOCK'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(deal.PRIVATE_PLACEMENT,'N') <> 'Y' then 'OPTION_RISKY_AIRBAGX_CIR_STOCK'
when rb.desk = 'OTCHK_QIS' and coalesce(bc.ins_family,ins.ins_family) = 'QIS' and deal.seller = '11613' then 'OPTION_N_CROSS_QTF_STRG_IDX'
when (ds.contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or ds.contract_type is null) and coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') then 'OPTION_OTHER_STOCK'
when (ds.contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or ds.contract_type is null) and coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then 'OPTION_OTHER_NONSTOCK'
end
,case when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR')
and ds.contract_type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
and not(ds.contract_type = 'AUTOCALL' and ds.contract_sub_type = 'SNOWBALL')
then 'OPTION_STOCK'
when coalesce(bc.ins_family,ins.ins_family) in ('INDEX', 'FUND')
and(ds.contract_type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (ds.contract_type = 'AUTOCALL' and ds.contract_sub_type <> 'SNOWBALL'))
then 'OPTION_IDX_ETF'
when rb.desk = 'OTCHK_QIS' and coalesce(bc.ins_family,ins.ins_family) = 'QIS' and deal.seller = '11613' then 'OPTION_N_CROSS_QTF_STRG_IDX'
when coalesce(bc.ins_family,ins.ins_family) = 'QIS' and ds.underlying_wind_code not in('GAMMA.WI', 'CHARM.WI') then 'OPTION_QTF_STRG_IDX_SPOT'
when coalesce(bc.ins_family,ins.ins_family) = 'QIS' and ds.underlying_wind_code in('GAMMA.WI', 'CHARM.WI') then 'OPTION_QTF_STRG_IDX_NONSPOT'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(bc.ins_family,ins.ins_family) = 'EQUITY' and deal.PRIVATE_PLACEMENT = 'Y' then 'OPTION_RISKY_AIRBAGX_PRI_STOCK'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(deal.PRIVATE_PLACEMENT,'N') <> 'Y' then 'OPTION_RISKY_AIRBAGX_CIR_STOCK'
else 'OPTION_OTHER_NONSTOCK'
end
) as Contr_Type_Cd,
if(
substring(ds.start_date, 1, 10) <= '2025-03-31'
,case when ds.contract_type = 'AUTOCALL' and ds.contract_sub_type not in ('SNOWBALL','SECURED') and coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') then '自动赎回（除保本雪球和保本敲入型雪球）'
when ds.contract_type = 'AUTOCALL' and ds.contract_sub_type not in ('SNOWBALL','SECURED') and coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then '自动赎回（除保本雪球和保本敲入型雪球）'
when ds.contract_type = 'AUTOCALL' and ds.contract_sub_type in ('SNOWBALL','SECURED') then '保本雪球和保本敲入型雪球'
when ds.contract_type = 'AIRBAG' and coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') then '安全气囊'
when ds.contract_type = 'AIRBAG' and coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then '安全气囊'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(bc.ins_family,ins.ins_family) = 'EQUITY' and deal.PRIVATE_PLACEMENT = 'Y' then 'Risky和安全气囊X（限售股）'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(deal.PRIVATE_PLACEMENT,'N') <> 'Y' then 'Risky和安全气囊X（流通股）'
when rb.desk = 'OTCHK_QIS' and coalesce(bc.ins_family,ins.ins_family) = 'QIS' and deal.seller = '11613' then '北上量化策略指数期权'
when (ds.contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or ds.contract_type is null) and coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') then '其他期权（除Risky和安全气囊X）'
when (ds.contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or ds.contract_type is null) and coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then '其他期权（除Risky和安全气囊X）'
end
,case when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR')
and ds.contract_type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
and not(ds.contract_type = 'AUTOCALL' and ds.contract_sub_type = 'SNOWBALL')
then '个股期权'
when coalesce(bc.ins_family,ins.ins_family) in ('INDEX', 'FUND')
and(ds.contract_type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (ds.contract_type = 'AUTOCALL' and ds.contract_sub_type <> 'SNOWBALL'))
then '指数/ETF期权'
when rb.desk = 'OTCHK_QIS' and coalesce(bc.ins_family,ins.ins_family) = 'QIS' and deal.seller = '11613' then '北上量化策略指数期权'
when coalesce(bc.ins_family,ins.ins_family) = 'QIS' and ds.underlying_wind_code not in('GAMMA.WI', 'CHARM.WI') then '量化策略指数期权（现货类）'
when coalesce(bc.ins_family,ins.ins_family) = 'QIS' and ds.underlying_wind_code in('GAMMA.WI', 'CHARM.WI') then '量化策略指数期权（非现货类）'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(bc.ins_family,ins.ins_family) = 'EQUITY' and deal.PRIVATE_PLACEMENT = 'Y' then 'Risky和安全气囊X（限售股）'
when ds.contract_type in ('RISKY','AIRBAGX') and coalesce(deal.PRIVATE_PLACEMENT,'N') <> 'Y' then 'Risky和安全气囊X（流通股）'
else '其他期权'
end
) as Contr_Type_Desc,
ds.contract_type as Src_Contr_Type,
sct.dw_cd_val_desc as Src_Contr_Type_Desc,
ds.contract_sub_type as Src_Sub_Contr_Type,
ssct.dw_cd_val_desc as Src_Sub_Contr_Type_Desc,
ds.underlying_ins_id as Undrl_Ins_Id,
ds.underlying_wind_code as Undrl_Wd_Cd,
coalesce(bc.ins_sht_desc,ins.ins_sht_desc) as Undrl_Name,
case when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') and ds.underlying_currency not in ('HKD', 'USD') then 'OTH_STOCK'
when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') and ds.underlying_currency = 'HKD' then 'HK_STOCK'
when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') and ds.underlying_currency = 'USD' then 'US_STOCK'
when coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then 'NON_STOCK'
else '-' end as Undrl_Type,
'' as Undrl_Type_Desc,
if(c.interotc_underlying_category = 'BONDS', 'BOND', coalesce(bc.ins_family,ins.ins_family)) as Src_Undrl_Type,
if(c.interotc_underlying_category = 'BONDS', '债券', sutd.dw_cd_val_desc) as Src_Undrl_Type_Desc,
if(deal.PRIVATE_PLACEMENT = 'Y', '1', '0') as Res_Flag,
'0' as IPO_Flag,
if(deal.SELLER in ('10161','10142'), '2', '1') as Buy_Sell_Dir_Cd,
case
when deal.COLLATERAL_NOTIONAL_CURRENCY = 'CNY' then 1
when deal.SETTLEMENT_CURRENCY = 'CNY' then ds.INIT_NOTL_EXCHANGE_RATE
else mid.MIDRATE
end as Cny_Ex_Rate,
(case
when deal.COLLATERAL_NOTIONAL_CURRENCY = 'CNY' then 1
when deal.SETTLEMENT_CURRENCY = 'CNY' then ds.INIT_NOTL_EXCHANGE_RATE
else mid.MIDRATE
end
) * deal.Initial_Notional as Init_Nom_Prin,
(case
when deal.COLLATERAL_NOTIONAL_CURRENCY = 'CNY' then 1
when deal.SETTLEMENT_CURRENCY = 'CNY' then ds.INIT_NOTL_EXCHANGE_RATE
else mid.MIDRATE
end
) * if('2026-05-24' between substring(ds.start_date, 1, 10) and substring(coalesce(deal.Early_Term_Date,ds.end_date), 1, 10), coalesce(deal.Notional,0), 0) as Dyna_Nom_Prin,
(case
when deal.COLLATERAL_NOTIONAL_CURRENCY = 'CNY' then 1
when deal.SETTLEMENT_CURRENCY = 'CNY' then ds.INIT_NOTL_EXCHANGE_RATE
else mid.MIDRATE
end
) * deal.Collateral_Notional as Absl_Nom_Prin,
substring(ds.start_date, 1, 10) as Strt_Pric_Date,
substring(ds.end_date, 1, 10) as End_Pric_Date,
substring(deal.Early_Term_Date, 1, 10) as Early_Term_Date,
substring(deal.Payment_Date, 1, 10) as Earn_Pymt_Date,
deal.Time_To_Maturity as Term_Days,
case when deal.Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATING', 'TERMINATING_PENDING') then '101'
when deal.Contr_Status = 'TERMINATED' then '226'
end as Agt_Stat_Cd,
trade.key_otc_trade_id as Inr_Seri_No,
trade.key_instrument_id as Otc_Seri_No,
deal.bundle_id as bndl_id,
rel.property_value as Rel_Agt_Id,
mrg.Initial_Margin as Init_Marg_Prop,
mrg.MARGIN_BALANCE_INIT as init_Marg_Bal,
mp.deduction_pattern as Ddct_Ptrn,
cp.commission_rate as cms_rate,
null as fixed_rate,
fee.fee_rate,
deal.hedge_type as Hedg_Type_Cd,
PREMIUM AS Opt_Fee,
substring(deal.premium_date, 1, 10) as Opt_Fee_Paid_Date,
ds.KNOCKOUT_EXTRA_PAR as KO_Prtc_rate,  --期权，上涨参与率
ds.REBATE_NOT_ABS as KO_Yield,  --敲出收益率，仅期权
ODS.NET_PNL as net_coll,  --期权，交易净收取
RODC.COUPON_RATE as Coup_Rate,
KO.Min_OBS_DATE,
KO.Max_OBS_DATE,
pr.Up_Prtc_rate,  --仅期权，向上参与率
pr.Down_Prtc_rate,  --仅期权，向下参与率
KI.DOWN_KI_BARRIER_PCT as KI_Barr_PCT,  --敲入障碍价
coalesce(KO.UP_KO_BARRIER_PCT,KO.DOWN_KO_BARRIER_PCT) as KO_Barr_PCT,  --敲出障碍价
STk.Strk_PCT,  --执行价
STk.DOWN_Strk_PCT,  --下跌保护执行价格
STk.UP_Strk_PCT,  --封顶价格
'TIT' AS Data_Src_Cd,
UPPER('PDATA_N.T98_OTC_DERI_COMP_SALE_INFO_TIT110') AS Task_Name,
'2026-05-24' AS Data_Etl_Date,
'2026-05-24' AS Data_Upt_Date,
'2026-05-25 03:26:09' AS Data_Time,
rb.department as Book_Bel_Dept,
calc.initial_npv as Bgng_Npv,
deal.Contr_Status as Src_Agt_Stat_Cd,
coalesce(bc.ins_lng_desc,ins.ins_lng_desc) as Undrl_Long_Name,
cp.client_qualify_review as Qual_Revw_Flag,
deal.contract_code as Ext_Comp_No,
deal.key_ctpty_id as Key_Cutp_Id,
coalesce(ds.underlying_currency,'') as Undrl_Curr,
null as Intr_Marg,
mrg.basic_margin_rate as Base_Marg_Rate,
mr.Marg_Agt_Id,  --拆货基合约
deal.premium_rate as Opt_Fee_Rate,            --期权费率
rb.key_book_id as Book_Agt_Id,
rb.Book_Name,
rb.Desk as Cntr,
IF(NVL(TRIM(deal.seller),'')='','',CONCAT('TIT060-',deal.seller)) as Sler_Cutp_Pty_Id,
coalesce(bc.future_type,fu.future_type) as Futr_Type,
trade.business_type as Agt_Clas_Cd,
ds.cross_currency_type as Cros_Crrc_Type_Cd,
'' as Float_Base_Rate,
'' as Float_Undrl_Cd,
'' as Flot_Intrt_Ulmt,
null as Comp_Usag_Cd,
deal.SETTLEMENT_CURRENCY as Sett_Crrc_Cd
from (
select * from odata_n_tit.d_trd_otc_trade
where busi_Date = '2026-05-24' and key_book_id not in ('10022', '10019')  --去掉测试book
) trade
inner join (
select * from odata_n_tit.d_ref_otc_option_deal where busi_Date = '2026-05-24'  --期权表
) deal
on deal.key_otc_trade_id = trade.key_otc_trade_id
inner join (
select * from odata_n_tit.d_ref_book
where busi_Date = '2026-05-24' and department in ('OTC','OTC_HK')  --限定OTC部及OTCHK的交易
) rb
ON rb.key_book_id = trade.key_book_id
left join (
select * from odata_n_tit.d_ref_option_deal_structure where busi_Date = '2026-05-24'
) ds
on deal.key_otc_trade_id = ds.key_otc_trade_id
left join odata_n_tit.d_ref_rmb_midrate mid -- 外汇中间价
on deal.collateral_notional_currency = mid.currency
and ds.start_date = mid.quote_date
left join (
select * from odata_n_tit.d_ref_ctpty_mapping where busi_Date = '2026-05-24'
) rcm
ON deal.key_ctpty_id = rcm.key_ctpty_id
left join (
select * from odata_n_tit.r_cfg_instrument_pool_props
where busi_Date = '2026-05-24' and KEY_POOL_ID = '10000'
) c
on c.key_instrument_id = ds.underlying_ins_id
left join (
select * from odata_n_tit.d_ref_instrument where busi_Date = '2026-05-24'
) ins
on ins.key_instrument_id = ds.underlying_ins_id
left join (
select * from odata_n_tit.d_ref_future_properties where busi_Date = '2026-05-24'
) fu
on fu.key_instrument_id = ds.underlying_ins_id
left join (
select
bc.key_instrument_id,
concat_ws(';',collect_list(ins.ins_sht_desc)) as ins_sht_desc,
concat_ws(';',collect_list(ins.ins_lng_desc)) as ins_lng_desc,
concat_ws(';',collect_set(ins.ins_family)) as ins_family,
concat_ws(';',collect_set(fu.future_type)) as future_type
from (
select * from odata_n_tit.d_ref_basket_constituent where busi_Date = '2026-05-24'
) bc
left join (
select * from odata_n_tit.d_ref_instrument where busi_Date = '2026-05-24'
) ins
on ins.key_instrument_id = bc.underlying_inst_id
left join (
select * from odata_n_tit.d_ref_future_properties where busi_Date = '2026-05-24'
) fu
on fu.key_instrument_id = bc.underlying_inst_id
group by bc.key_instrument_id
) bc
on bc.key_instrument_id = ds.underlying_ins_id
left join (
select * from odata_n_tit.d_trd_otc_contr_props
where busi_Date = '2026-05-24' and property_name = 'relatedOption'
) rel
on rel.key_otc_trade_id = trade.key_otc_trade_id
left join (
select * from odata_n_tit.d_ref_otc_contr_margin_param
where busi_Date = '2026-05-24'
) mrg
on mrg.key_otc_trade_id = trade.key_otc_trade_id
left join (
select option_key_otc_trade_id, concat_ws(';',collect_set(trs_key_otc_trade_id)) as Marg_Agt_Id
from (
select * from odata_n_tit.f_ref_option_margin_trs_relation
where busi_date = '2026-05-24' and status = 'Y'
) a
join (
select * from odata_n_tit.d_ref_trs
where busi_date = '2026-05-24' and trs_type = 'LONG_HOLD_SWAP'
) b
on a.trs_key_otc_trade_id = b.key_otc_trade_id
group by option_key_otc_trade_id
) mr
on mr.option_key_otc_trade_id = trade.key_otc_trade_id
left join (
select * from odata_n_tit.d_trd_bundle_info
where busi_Date = '2026-05-24'
) tbi
on tbi.bundle_id = deal.bundle_id
left join (
select * from odata_n_tit.d_margin_plan
where busi_Date = '2026-05-24'
) mp
on tbi.key_plan_id = mp.id
left join (
select *
from odata_n_tit.d_TRD_OPTION_DEAL_SETTLEMENT
WHERE busi_date = '2026-05-24'
) ODS
on trade.KEY_OTC_TRADE_ID = ODS.KEY_OTC_TRADE_ID
left join (
select *
from (
SELECT *, row_number() over(partition by KEY_INSTRUMENT_ID order by CALC_DATE) as rn
FROM odata_n_tit.d_trd_daily_accrual_fee
where busi_Date = '2026-05-24' and fee_type = 'ACCRUAL_PREMIUM_FEE'
) t
where rn = 1
) fee
on fee.key_instrument_id = trade.key_instrument_id
left join (
SELECT KEY_OTC_TRADE_ID, concat_ws(';',collect_set(cast(cast(COUPON_RATE as double) as string))) as COUPON_RATE
FROM odata_n_tit.d_REF_OPTION_DEAL_CR
where busi_date = '2026-05-24'
group by KEY_OTC_TRADE_ID
) RODC
on trade.KEY_OTC_TRADE_ID = RODC.KEY_OTC_TRADE_ID
LEFT JOIN (
SELECT
KEY_OTC_TRADE_ID,
MIN(substring(OBS_DATE,1,10)) as MIN_OBS_DATE,
Max(substring(OBS_DATE,1,10)) as Max_OBS_DATE,
concat_ws(';',collect_set(cast(cast(UP_KO_BARRIER_PCT as double) as string))) as UP_KO_BARRIER_PCT,
concat_ws(';',collect_set(cast(cast(DOWN_KO_BARRIER_PCT as double) as string))) as DOWN_KO_BARRIER_PCT
FROM odata_n_tit.d_REF_OP_DEAL_AUTOCALL_KODATE  --敲出
where busi_date = '2026-05-24'
GROUP BY KEY_OTC_TRADE_ID
) KO
ON trade.KEY_OTC_TRADE_ID = KO.KEY_OTC_TRADE_ID
LEFT JOIN (
SELECT
KEY_OTC_TRADE_ID,
concat_ws(';',collect_set(cast(cast(DOWN_KI_BARRIER_PCT as double) as string))) as DOWN_KI_BARRIER_PCT
FROM odata_n_tit.d_REF_OP_DEAL_AUTOCALL_KIDATE  --敲入
where busi_date = '2026-05-24'
GROUP BY KEY_OTC_TRADE_ID
) KI
ON trade.KEY_OTC_TRADE_ID = KI.KEY_OTC_TRADE_ID
left join (
select
KEY_OTC_TRADE_ID,
max(if(SEQ = '0', cast(STRIKE_PCT as double), 0)) as Strk_PCT,
max(if(SEQ = '1', cast(STRIKE_PCT as double), 0)) as DOWN_Strk_PCT,
max(if(SEQ = '2', cast(STRIKE_PCT as double), 0)) as UP_Strk_PCT
from odata_n_tit.d_REF_OPTION_DEAL_STRIKE
where busi_date = '2026-05-24'
group by KEY_OTC_TRADE_ID
) STk
on trade.KEY_OTC_TRADE_ID = STk.KEY_OTC_TRADE_ID
left join (
SELECT
KEY_OTC_TRADE_ID,
max(if(SEQ = '0', cast(participation_rate as double), 0)) as Up_Prtc_rate,
max(if(SEQ = '1', cast(participation_rate as double), 0)) as Down_Prtc_rate
FROM odata_n_tit.d_REF_OPTION_DEAL_PR
WHERE busi_date = '2026-05-24'
group by KEY_OTC_TRADE_ID
) pr
on trade.KEY_OTC_TRADE_ID = pr.KEY_OTC_TRADE_ID
left join (--关联经办人
select client_id,abbreviation,corporate_name,Signature_Name,industry,aptitude,commission_rate,client_qualify_review
from odata_n_ois.o_otc_derivative_counterparty
where busi_Date = '2026-05-24' and delete_flag = '0' and department != 'HK'
union all
select client_id,abbreviation,full_name as corporate_name, null as Signature_Name,null as industry,null as aptitude,null as commission_rate, null as client_qualify_review
from odata_n_ois.g_hk_counterparty
where busi_Date = '2026-05-24' and delete_flag = '0'
) cp
on rcm.outside_ctpty_code = cp.client_id
left join (
select *
from PDATA_N.REF_DW_CD_VAL
where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
) sct
on sct.dw_cd_val = ds.contract_type
left join (
select *
from PDATA_N.REF_DW_CD_VAL
where dw_cd_id = 'CD381'
) ssct
on ssct.dw_cd_val = ds.contract_sub_type
left join (
select *
from PDATA_N.REF_DW_CD_VAL
where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
) sutd
on sutd.dw_cd_val = coalesce(bc.ins_family,ins.ins_family)
left join (
select
key_instrument_id,
initial_npv,
key_book_id,
row_number() over(partition by key_instrument_id,key_book_id order by quote_date desc) as rk
from odata_n_tit.d_pos_eod_calc_metrics
where busi_date = '2026-05-24' and ins_family = 'OTC_OPTION_CONTRACT'
) calc
on trade.key_instrument_id = calc.key_instrument_id and trade.key_book_id = calc.key_book_id and calc.rk = 1
where Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')
;
