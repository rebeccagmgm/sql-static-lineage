-- SELECT其余输出：保持原字段顺序，空占位也是当前程序行为，不等于已有相关业务计算。
-- End_Pric_Date使用COALESCE(提前终止日,原期末日)；空串不回退，虽然是否终止标志将空串判为0。
-- Accrued_Date=det.busi_date，busi_date=报告日快照，grp_id固定01；一份快照包含多个计提日。
-- prop_ratio/标的模拟对冲盈亏仍按pe标的组+日计算，非动态行也输出这些表达式，不宜解释为普适分摊比。
-- 展示CAPITAL_COST取co_c的CNY值；06 FLEXO公式另有co的非CNY成本，两者不能互相替代。
-- 当前平台新增Agt_Clas_Cd与Src_Undrl_Type已保留，外层共74列（含两个分区列）。
    info.Strt_Pric_Date,  --期初定价日
    coalesce(info.Early_Term_Date, info.End_Pric_Date) as End_Pric_Date,  --期末定价日
    IF(info.Early_Term_Date IS NULL OR info.Early_Term_Date = '', '0', '1') AS Is_Preterm_Flag,  --是否终止标志
    info.Early_Term_Date,  --提前终止日
    info.Agt_Stat_Cd,  --协议状态代码
    det.busi_date as Accrued_Date,  --计提日期
    info.Inr_Seri_No,  --内部流水号
    info.otc_seri_no,  --场外合约流水号
    info.Book_Agt_Id,  --账簿协议编号
    info.Cntr,  --柜台
    info.Cros_Crrc_Type_Cd,  --跨币种类型代码
    info.fixed_rate,  --固定腿利率
    info.Flot_Intrt_Ulmt,  --浮动利率上限
    info.Float_Base_Rate,  --浮动基础利率
    info.Intr_Marg,  --利差
    info.Float_Undrl_Cd,  --浮动腿标的代码
    info.Undrl_Curr,  --标的币种
    info.Bgng_Npv,  --期初NPV
    info.prop_group,  --关联合约分组
    info.Opt_Fee_Rate,  --期权预估期权费率
    info.Init_Marg_Prop,  --初保线
    info.Base_Marg_Rate,  --基保线
    info.Marg_Agt_Id,  --拆货基合约编号
    null as FUND_COST_RATE,  --资金成本利率
    null as MARGIN_FIXED_RATE,  --保证金固定利率
    null as COMMISSION_COST,  --佣金成本
    null as SPREAD,  --利差
    null as LONG_FIXED_RATE,  --多头持券固定利率成本
    co_c.CAPITAL_COST,  --CNY用资利率
    null as Cms_Mode_Cd,  --佣金模式代码
    null as Trd_Fee_Rate,  --交易费率
    null as Bgng_Vol,  --期初数量
    null as Peshr_Cms,  --每股佣金（标的币种）
    null as Nom_Prin_Chg_Delta,  --名义本金变动（结算币种）
    null as Occu_Qty,  --发生数量（结算币种）
    null as Divd_Tax_Amt,  --分红税金额（结算币种）
    null as intrt,  --浮动利率
    cr.ir/100 as ir,  --资金成本浮动利率
    pd.Tdy_Yield,  --当日盈亏（结算币种）
    pe.Simu_Hedg_Pal,  --模拟对冲盈亏（结算币种）
    abs(coalesce(pe.delta,0))/sum(abs(coalesce(pe.delta,0))) over(partition by pe.Undrl_Sum_Compr, pe.busi_date) as prop_ratio,  --分摊比例
    u.Map_Undrl_Cd,  --匹配标的代码
    coalesce(u.Tdy_Yield,0) as Undrl_Tdy_Yield,  --标的当日盈亏（结算币种）
    sum(coalesce(pe.Simu_Hedg_Pal,0)) over(partition by pe.Undrl_Sum_Compr, pe.busi_date) as Undrl_Simu_Hedg_Pal,  --标的模拟对冲盈亏（结算币种）
    info.Sett_Crrc_Cd,  --结算币种
    coalesce(mid.mid_price,1) as mid_price,  --人民币中间汇率
    fee.OTHER_Prvs_Fee,  --按日计提其他费
    fee.PREMIUM_Prvs_Fee,  --按日计提期权费
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,  --数据时间
    null as Trd_Cms,  --交易佣金收入
    case when info.Src_Contr_Type in ('RISKY','AIRBAGX') then 'AIRBAGX'
         when info.Cntr in ('DYNAMIC_HEDGING','STATIC_HEDGING') then 'OPT_HEDGING'
         end as Rev_Contr_Type_Cd,
    info.Agt_Clas_Cd,  --协议类型代码
    info.Src_Undrl_Type,  --源标的类型
    '${yyyy-MM-dd}' as busi_date,  --业务日期
    '01' as grp_id  --分组标识
