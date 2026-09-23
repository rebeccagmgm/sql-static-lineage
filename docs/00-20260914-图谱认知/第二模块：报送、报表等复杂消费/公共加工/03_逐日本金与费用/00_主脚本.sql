/*
107491 / 合约销售收入附加明细：按计提日组织本金、利息、交易收入成本和费率
入口说明：README.md；原始基准：../99_证据/107491-query.sql。

当前合约快照 → 展开计提日info
  ├─ 期权事件evt       → 累计名本变化
  ├─ 互换历史持仓his_dy → 当日价格×数量
  ├─ 金仕达ks / ks_t   → 延续金额 / 当日交易收入成本
  ├─ FAST持仓nd        → 当日源本金
  └─ 风控prop / 费率fee → 按区间延续的比例、费率
                        ↓
              下方CASE选择最终动态本金

@include由render.mjs展开，不是Hive原生语法。这里只整理SQL，不连接或执行生产库。
*/
set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

WITH
-- @include 01_合约范围与计提日.sql
,
-- @include 02_期权事件与名本变动.sql
,
-- @include 03_普通互换历史持仓.sql
,
-- @include 04_金仕达本金与费用.sql
,
-- @include 05_FAST历史持仓.sql
,
-- @include 06_逐日费率.sql

-- 按展开后的计提日、业务分组写动态分区；不是把所有行写到加工日分区。
insert overwrite table T98_OTC_DERI_COMP_SALE_ADTNL_DET PARTITION(busi_date,grp_id)
select
    info.Agt_Id, -- 合约编号；TIT分支为主合约编号，金仕达为确认书id
    info.Busi_Type, -- 业务类型
    info.Cutp_Pty_Id, -- 交易对手客户编号
    info.Undrl_Ins_Id, -- 标的ID
    info.Undrl_Wd_Cd, -- 标的万得代码
    info.Undrl_Name, -- 标的名称；以上资料跟随当前合约快照，不按历史日重取
    info.Strt_Pric_Date, -- 期初定价日
    info.End_Pric_Date_n as End_Pric_Date, -- 优先提前终止日，否则期末定价日
    info.Init_Nom_Prin, -- 四个分组均直接取合约主信息的初始本金

    -- 最终动态本金：先看业务分组，再看分组内部的日期规则。
    case
         -- 01 期权：开始日用初始本金；结束边界后为0；中间按累计事件变化调整。
         when grp_id = '01' then
             if(info.Accrued_Date = info.Strt_Pric_Date, info.Init_Nom_Prin,
                if(info.Accrued_Date > info.End_Pric_Date_n, 0,
                   coalesce(evt.notional_change * info.Cny_Ex_Rate + info.Init_Nom_Prin, info.Init_Nom_Prin, 0)))
         -- 02 普通互换：开始日同样优先初始本金；其他存续日用该日持仓金额×汇率，缺失补0。
         when grp_id = '02' then
             if(info.Accrued_Date = info.Strt_Pric_Date, info.Init_Nom_Prin,
                if(info.Accrued_Date > info.End_Pric_Date_n, 0,
                   coalesce(his_dy.Dyna_Nom_Prin_Org * info.Cny_Ex_Rate, 0)))
         -- 03 金仕达：直接取延续后的源本金；无汇率乘法、无结束后归零、无缺失补0。
         when grp_id = '03' then ks.dynamic_notional
         -- 04 FAST：历史日源本金×汇率，乘积为NULL时补0；无开始日特判或结束后归零。
         when grp_id = '04' then coalesce(nd.dynamic_notional * info.Cny_Ex_Rate,0)
         end as Dyna_Nom_Prin,

    fee.fee_rate, -- 费率：按工具、计提日期延续；不是已计算的费用金额，缺失保持NULL
    ks.accrued_interest * (-1) as Inta, -- 源“当日应记利息”取反；可能从更早业务日延续而来
    ks.occupy_cost as Fnd_Cost, -- 源用资成本，同样按确认记录区间延续
    coalesce(ks_t.profit,0) as Trd_Cms, -- 源股票交易收入；只匹配实际业务日，缺失补0
    coalesce(ks_t.fee_cost,0) as Trd_Cms_Cost, -- 源股票交易成本；只匹配实际业务日，缺失补0
    prop.Marg_Prop, -- 源履约保证比例，按生成日期延续
    'TIT' AS Data_Src_Cd,
    UPPER('${filename}') AS Task_Name,
    '${data_day_str}' AS Data_Etl_Date, -- 本次加工日
    '${data_day_str}' AS Data_Upt_Date,
    '${data_today}' AS Data_Time,
    info.Accrued_Date as Busi_Date, -- 计提日：目标分区日期，不是上面的加工日
    info.Grp_Id -- 业务分组：目标分区值

-- 以下LEFT JOIN保留没有金额/费率资料的合约日；各连接都没有额外grp_id条件。
-- CASE选择哪笔金额，并不消除其他连接产生的多条匹配；这里不做最终去重。
from contract_days info
left join option_event_days evt
on evt.key_option_deal_id = info.Inr_Seri_No and evt.Accrued_Date = info.Accrued_Date
left join trs_daily_positions his_dy
on his_dy.key_otc_trade_id = info.Inr_Seri_No and his_dy.Accrued_Date = info.Accrued_Date
left join ks_amount_days ks
on info.Agt_Id = ks.key_trade_comfirm_id and info.Accrued_Date = ks.Accrued_Date
left join ks_trade_days ks_t
on info.Agt_Id = ks_t.key_trade_comfirm_id and info.Accrued_Date = ks_t.Accrued_Date
left join fast_daily_positions nd
on nd.key_instrument_id = info.Otc_Seri_No and info.Accrued_Date = nd.Accrued_Date
left join ks_margin_days prop
on prop.Accrued_Date = info.Accrued_Date and prop.CONTRACT_ID = info.agt_id
left join fee_days fee
on fee.key_instrument_id = info.Otc_Seri_No and fee.Accrued_Date = info.Accrued_Date
;
