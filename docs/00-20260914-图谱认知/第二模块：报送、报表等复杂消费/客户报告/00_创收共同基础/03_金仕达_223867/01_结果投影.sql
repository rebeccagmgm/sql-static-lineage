-- 保留外层74列（含2分区）及内层字段顺序。金额公式由02模块真实引用，不另抄一份。
-- info来自T98_OTC_DERI_COMP_SALE_INFO；det来自T98_OTC_DERI_COMP_SALE_ADTNL_DET；cp来自T01_CORP_CUST。
-- Trd_Cms=co.ks_long_fee（当日毛佣金），不是净创收；Accrued_Date=det.busi_date，busi_date=报告日快照。
SELECT Agt_Id,
	Busi_Type,
	Cutp_Pty_Id,
	Cutp_Pty_Shor_Name,
	Cutp_Pty_Full_Name,
	Sign_Prd_Name,
	USCC,
	Contr_Type_Cd,
	Contr_Type_Desc,
	Src_Contr_Type,
	Src_Contr_Type_Desc,
	Src_Sub_Contr_Type,
	Src_Sub_Contr_Type_Desc,
	Undrl_Wd_Cd,
	Undrl_Name,
	Init_Nom_Prin,
	Dyna_Nom_Prin,
	Curr_Rev,
	Opt_Npv_Curr_Rev,
	Strt_Pric_Date,
	End_Pric_Date,
	Is_Preterm_Flag,
	Early_Term_Date,
	Agt_Stat_Cd,
	Accrued_Date,
	Inr_Seri_No,
	otc_seri_no,
	Book_Agt_Id,
	Cntr,
	Cros_Crrc_Type_Cd,
	fixed_rate,
	Flot_Intrt_Ulmt,
	Float_Base_Rate,
	Intr_Marg,
	Float_Undrl_Cd,
	Undrl_Curr,
	Bgng_Npv,
	prop_group,
	Opt_Fee_Rate,
	Init_Marg_Prop,
	Base_Marg_Rate,
	Marg_Agt_Id,
	FUND_COST_RATE,
	MARGIN_FIXED_RATE,
	COMMISSION_COST,
	SPREAD,
	LONG_FIXED_RATE,
	CAPITAL_COST,
	Cms_Mode_Cd,
	Trd_Fee_Rate,
	Bgng_Vol,
	Peshr_Cms,
	Nom_Prin_Chg_Delta,
	Occu_Qty,
	Divd_Tax_Amt,
	intrt,
	ir,
	Tdy_Yield,
	Simu_Hedg_Pal,
	prop_ratio,
	Map_Undrl_Cd,
	Undrl_Tdy_Yield,
	Undrl_Simu_Hedg_Pal,
	Sett_Crrc_Cd,
	mid_price,
	OTHER_Prvs_Fee,
	PREMIUM_Prvs_Fee,
	Data_Time,
	Trd_Cms,
	Rev_Contr_Type_Cd,
	Agt_Clas_Cd,
	Src_Undrl_Type,
	busi_date,
	grp_id FROM (
	 select
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
    -- @include 02_当日创收.sql
  --当日计提创收
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
    info.prop_group,  --关联合约分组
    info.Opt_Fee_Rate,  --期权预估期权费率
    info.Init_Marg_Prop,  --初保线
    info.Base_Marg_Rate,  --基保线
    null as Marg_Agt_Id,  --拆货基合约编号
    fc.FUND_COST_RATE,  --资金成本利率
    null as MARGIN_FIXED_RATE,  --保证金固定利率
    null as COMMISSION_COST,  --佣金成本
    null as SPREAD,  --利差
    null as LONG_FIXED_RATE,  --多头持券固定利率成本
    null as CAPITAL_COST,  --用资利率
    null as Cms_Mode_Cd,  --佣金模式代码
    null as Trd_Fee_Rate,  --交易费率
    null as Bgng_Vol,  --期初数量
    null as Peshr_Cms,  --每股佣金（标的币种）
    null as Nom_Prin_Chg_Delta,  --名义本金变动（结算币种）
    null as Occu_Qty,  --发生数量（结算币种）
    null as Divd_Tax_Amt,  --分红税金额（结算币种）
    null as intrt,  --浮动利率
    null as ir,  --资金成本浮动利率
    null as Tdy_Yield,  --当日盈亏（结算币种）
    null as Simu_Hedg_Pal,  --模拟对冲盈亏（结算币种）
    null as prop_ratio,  --分摊比例
    null as Map_Undrl_Cd,  --匹配标的代码
    null as Undrl_Tdy_Yield,  --标的当日盈亏（结算币种）
    null as Undrl_Simu_Hedg_Pal,  --标的模拟对冲盈亏（结算币种）
    null as Sett_Crrc_Cd,  --结算币种
    null as mid_price,  --人民币中间汇率
    null as OTHER_Prvs_Fee,  --按日计提其他费
    null as PREMIUM_Prvs_Fee,  --按日计提期权费
    from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS Data_Time,  --数据时间
    co.ks_long_fee as Trd_Cms,  --交易佣金收入
    info.Src_Contr_Type as Rev_Contr_Type_Cd,  --创收合约类型
    info.Agt_Clas_Cd,  --协议类型代码
    info.Src_Undrl_Type,  --源标的类型
    '${yyyy-MM-dd}' as busi_date,  --业务日期
    '03' as grp_id  --分组标识


