-- SELECT完整74列由本片段接入07、08两个公式；其余列保留原值、转换或NULL占位。
-- info=01主合约；det逐日明细、cp客户及短输入在00；u/pd/evt/cr/co分别由02~06提供查询体，不是名为info的物理表。
-- 初始本金输出info，动态本金展示补0；07息差直接读det动态本金，不使用展示列补0后的值。
    info.Agt_Id,  --合约编号
    info.Busi_Type,  --业务类型
    info.Cutp_Pty_Id,  --交易对手客户编号
    info.Cutp_Pty_Shor_Name,  --交易对手当事人简称
    info.Cutp_Pty_Full_Name,  --交易对手当事人名称
    info.Sign_Prd_Name,  --代签产品名称
    cp.USCC,  --统一社会信用代码
    info.Contr_Type_Cd,  --合约类型代码
    info.Contr_Type_Desc,  --合约类型描述
    info.Src_Contr_Type,  --源合约类型
    info.Src_Contr_Type_Desc,  --源合约类型描述
    info.Src_Sub_Contr_Type,  --源合约子类型
    info.Src_Sub_Contr_Type_Desc,  --源合约子类型描述
    info.Undrl_Wd_Cd,  --标的万得代码
    info.Undrl_Name,  --标的名称
    info.Init_Nom_Prin,  --初始名义本金
    coalesce(det.Dyna_Nom_Prin, 0) as Dyna_Nom_Prin,  --动态名义本金
-- @include 07_当日净创收.sql
    0 as Opt_Npv_Curr_Rev,  --当日期权NPV计提创收
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
    null as prop_group,  --关联合约分组
    info.Opt_Fee_Rate,  --期权预估期权费率
    info.Init_Marg_Prop,  --初保线
    info.Base_Marg_Rate,  --基保线
    null as Marg_Agt_Id,  --拆货基合约编号
    co.FUND_COST_RATE,  --资金成本利率
    co.MARGIN_FIXED_RATE,  --保证金固定利率
    co.COMMISSION_COST,  --佣金成本
    co.SPREAD,  --利差
    co.FIXED_RATE as LONG_FIXED_RATE,  --多头持券固定利率成本
    null as CAPITAL_COST,  --用资利率
    sh.Cms_Mode_Cd,  --佣金模式代码
    sh.Trd_Fee_Rate,  --交易费率
    sh.Bgng_Vol,  --期初数量
    sh.Peshr_Cms,  --每股佣金（标的币种）
    evt.Nom_Prin_Chg_Delta,  --名义本金变动（结算币种）
    evt.Occu_Qty,  --发生数量（结算币种）
    evt.Divd_Tax_Amt,  --分红税金额（结算币种）
    fr.intrt/100 as intrt,  --浮动利率
    cr.ir/100 as ir,  --资金成本浮动利率
    pd.Tdy_Yield,  --当日盈亏（结算币种）
    null as Simu_Hedg_Pal,  --模拟对冲盈亏（结算币种）
    if(info.book_agt_id = '10016' and coalesce(ins.undrl_clas, info.undrl_wd_cd) in ('000905.SH','000852.SH','000016.SH','000300.SH','8841431.WI') and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP',coalesce(det.Dyna_Nom_Prin, 0)/sum(if(info.book_agt_id = '10016' and coalesce(ins.undrl_clas, info.undrl_wd_cd) in ('000905.SH','000852.SH','000016.SH','000300.SH','8841431.WI') and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP',coalesce(det.Dyna_Nom_Prin, 0),0)) over(partition by coalesce(ins.undrl_clas, info.undrl_wd_cd),det.busi_date),null) as prop_ratio,  --分摊比例
    coalesce(ins.undrl_clas, info.undrl_wd_cd) as Map_Undrl_Cd,  --匹配标的代码
    coalesce(u.Tdy_Yield, 0)+coalesce(x.Tdy_Yield, 0) as Undrl_Tdy_Yield,  --标的当日盈亏（结算币种）
    null as Undrl_Simu_Hedg_Pal,  --标的模拟对冲盈亏（结算币种）
    info.Sett_Crrc_Cd,  --结算币种
    coalesce(mid.mid_price,1) as mid_price,  --人民币中间汇率
    null as OTHER_Prvs_Fee,  --按日计提其他费
    null as PREMIUM_Prvs_Fee,  --按日计提期权费
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,  --数据时间
-- @include 08_毛佣金展示.sql
    case when info.Agt_Clas_Cd = 'TRS_SAC_OTC' and ((info.Src_Contr_Type = 'S_CROSS_SWAP' and info.Src_Undrl_Type = 'EQUITY') or info.Src_Contr_Type = 'S_CROSS_OPTION_SWAP') then 'S_CROSS_SWAP'
          when info.Agt_Clas_Cd = 'TRS_SAC_OTC' and info.Src_Contr_Type = 'LONG_HOLD_SWAP' and info.Src_Undrl_Type = 'EQUITY' then 'LONG_HOLD_SWAP'
          when info.book_agt_id = '10016' and coalesce(ins.undrl_clas, info.undrl_wd_cd) in ('000905.SH','000852.SH','000016.SH','000300.SH','8841431.WI') and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP' then 'INDEX_ENHANCE_SWAP'
          end as Rev_Contr_Type_Cd,  --创收合约类型
    info.Agt_Clas_Cd,  --协议类型代码
    info.Src_Undrl_Type,  --源标的类型
    '${yyyy-MM-dd}' as busi_date,  --业务日期
    '02' as grp_id  --分组标识
