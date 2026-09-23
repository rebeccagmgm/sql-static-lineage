/*
本文件是90个输出字段的表达式清单；主脚本负责FROM/JOIN及分区写入，列顺序不能改变。

用到的别名和实际来源
  a   → 02的latest_confirmation → odata_n_tit.d_ks_trade_comfirm_info（交易确认书信息表）
        key_trade_comfirm_id=确认书ID；contract_code=主合约编号；counterparty_id=交易对手。
        trs_type=互换类型；notional=名义本金；dynamic_notional=动态名义本金；mgr_rate=履保比例。
  ins → 03的underlying_summary → odata_n_tit.d_ks_trs_eod_postion（日终持仓表视图）
        按确认书汇总标的；证券全名、证券集和币种补自odata_n_tit.d_ref_instrument。
  cp  → 01的境内客户 → odata_n_ois.o_otc_derivative_counterparty（衍生品交易对手维护表）
  sct → 02的CD382字典 → pdata_n.ref_dw_cd_val（仓库代码取值），dw_cd_val_desc为源类型中文描述。

先读三处业务规则：下方“经营分类” → “04 本金” → “09 固定账簿等输出”。
其余多为字段直取或固定空值，保留中文释义，但不新增计算层。
分类和本金规则短，直接保留在下方，不另拆09/10文件。
*/
-- 01 身份与客户：确定合约编号及交易对手。
a.key_trade_comfirm_id as Agt_Id, -- 目标合约编号：实际取交易确认书ID，不是主合约编号
'TRS' as Busi_Type, -- 业务类型
a.counterparty_id as Cutp_Pty_Id, -- 交易对手客户编号
cp.abbreviation as Cutp_Pty_Shor_Name, -- 交易对手当事人简称
cp.corporate_name as Cutp_Pty_Full_Name, -- 交易对手当事人名称
cp.Signature_Name as Sign_Prd_Name, -- 代签产品名称
cp.industry as Indt_Cd, -- 行业代码
cp.aptitude as Corp_Qual, -- 企业资质
-- 经营分类（用a.trs_type，不是标的类型）：
--   B_LONG_SHORT_SWAP → TRS_KINGSTAR_SWAP / 金仕达多空互换
--   其他             → TRS_LONG_SHORT / 多空互换
-- 没有期权/普通互换的2025日期分界；源类型本身仍在下一组字段中保留。
if(a.trs_type = 'B_LONG_SHORT_SWAP', 'TRS_KINGSTAR_SWAP', 'TRS_LONG_SHORT') as Contr_Type_Cd, -- 合约类型代码
if(a.trs_type = 'B_LONG_SHORT_SWAP', '金仕达多空互换', '多空互换') as Contr_Type_Desc, -- 合约类型描述
-- 02 源系统类型：保留源类型及字典描述，与经营分类并列展示。
a.trs_type as Src_Contr_Type, -- 源合约类型
sct.dw_cd_val_desc as Src_Contr_Type_Desc, -- 源合约类型描述
'' as Src_Sub_Contr_Type, -- 源合约子类型
'' as Src_Sub_Contr_Type_Desc, -- 源合约子类型描述
-- 03 标的及方向：标的来自03的持仓汇总；不是直接用确认书中的同名标的字段。
ins.Undrl_Ins_Id, -- 标的ID
ins.Undrl_Wd_Cd, -- 标的万得代码
ins.Undrl_Name, -- 标的名称
ins.Undrl_Type, -- 标的类型
ins.Undrl_Type_Desc, -- 标的类型描述
ins.Src_Undrl_Type, -- 源标的类型
ins.Src_Undrl_Type_Desc, -- 源标的类型描述
'0' as Res_Flag, -- 限售标志
'0' as IPO_Flag, -- IPO标志
if(a.seller in ('GFS','GFZQ'), '1', '2') as Buy_Sell_Dir_Cd, -- 买卖方向代码：按源seller（卖方）判断
-- 04 本金：直接取确认书，不用03的持仓数量/价格反算，也不增加期权式的日期区间判断。
-- B_LONG_SHORT_SWAP的初始本金与动态本金同取dynamic_notional；其他类型初始本金取notional。
-- 不换算、不补0；Cny_Ex_Rate=NULL不代表汇率为1，末尾固定CNY也不能证明源金额已换算。
null as Cny_Ex_Rate, -- 人民币汇率
if(
    a.trs_type = 'B_LONG_SHORT_SWAP',
    a.dynamic_notional, -- 金仕达多空互换：初始本金也取源动态名义本金
    a.notional          -- 其他：取源名义本金
) as Init_Nom_Prin, -- 初始名义本金
a.dynamic_notional as Dyna_Nom_Prin, -- 动态名义本金
'0.0' as Absl_Nom_Prin, -- 绝对名义本金
-- 05 生命周期：起止日、提前终止日、兑付日及状态码。
substring(a.start_date, 1, 10) as Strt_Pric_Date, -- 期初定价日
substring(a.end_date, 1, 10) as End_Pric_Date, -- 期末定价日
substring(a.early_termination_date, 1, 10) as Early_Term_Date, -- 提前终止日
substring(a.Payment_Date, 1, 10) as Earn_Pymt_Date, -- 收益兑付日
a.Time_To_Maturity as Term_Days, -- 期限天数
case when a.contr_status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATING', 'TERMINATING_PENDING') then '101'
         when a.contr_status = 'TERMINATED' then '226'
         end as Agt_Stat_Cd, -- 协议状态代码
-- 06 内部关联与费用：流水号、组合、保证金及费率。
a.contract_code as Inr_Seri_No, -- 目标内部流水号：实际取主合约编号
null as Otc_Seri_No, -- 场外合约流水号
null as bndl_id, -- 组合编号
null as Rel_Agt_Id, -- 关联合约编号
a.MGR_RATE as Init_Marg_Prop, -- 源“履保比例”→目标初始保证金比例；源注释未标明单位
null as init_Marg_Bal, -- 初始保证金
null as Ddct_Ptrn, -- 抵扣模式
cp.commission_rate as cms_rate, -- 佣金费率
null as fixed_rate, -- 固定腿利率
null as fee_rate, -- 实际费率
-- 07 期权专属字段：本分支下面这些列都填NULL，没有隐藏的条款计算。
-- 读业务逻辑时可直接跳到08；这些占位列为保持统一90列顺序而保留。
null as Hedg_Type_Cd, -- 对冲类型代码
null as Opt_Fee, -- 期权费
null as Opt_Fee_Paid_Date, -- 期权费支付日期
null as KO_Prtc_rate, -- 敲出参与率
null as KO_Yield, -- 敲出收益率
null as net_coll, -- 交易净收取
null as Coup_Rate, -- 票息
null as Min_OBS_DATE, -- 最小观察日
null as Max_OBS_DATE, -- 最大观察日
null as Up_Prtc_rate, -- 向上参与率
null as Down_Prtc_rate, -- 向下参与率
null as KI_Barr_PCT, -- 敲入障碍价
null as KO_Barr_PCT, -- 敲出障碍价
null as Strk_PCT, -- 执行价
null as DOWN_Strk_PCT, -- 下跌保护执行价格
null as UP_Strk_PCT, -- 封顶价格
-- 08 加工留痕：保留源代码与调度占位符，不在本地替换参数。
'TIT' AS Data_Src_Cd, -- 原SQL固定来源码；不表示此分支从TITANS合约表起算
UPPER('${filename}') AS Task_Name, -- 任务名
'${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
'${data_day_str}' AS Data_Upt_Date, -- 数据更新日期
'${data_today}' AS Data_Time, -- 数据时间
-- 09 扩展属性与固定值：区分“有源字段”与“报表写死的值”。
-- 来源字段：a提供状态、主合约编号；ins提供标的全名/币种；cp提供客户资质复核。
-- 固定值：部门OTC，下面的账簿/柜台/销售方，以及末尾的结算币种CNY。
'OTC' as Book_Bel_Dept, -- 账簿所属部门
null as Bgng_Npv, -- 期初NPV
a.contr_status as Src_Agt_Stat_Cd, -- 源合约状态
ins.Undrl_Long_Name, -- 标的长名称
cp.client_qualify_review as Qual_Revw_Flag, -- 客户资质复核标志
a.contract_code as Ext_Comp_No, -- 主合约编号也写入目标外部合约编号
'' as Key_Cutp_Id, -- Titans客户编号
ins.Undrl_Curr, -- 标的币种
null as Intr_Marg, -- 利差
null as Base_Marg_Rate, -- 基础保证金率
null as Marg_Agt_Id, -- 保证金合约编号
null as Opt_Fee_Rate, -- 期权费率
-- 金仕达账簿/柜台/卖方为原脚本固定值，不通过公共交易账簿视图查出；Data_Src_Cd仍沿用TIT。
'10023' as Book_Agt_Id, -- 账簿协议编号
'OTC-互换-金仕达合约' as Book_Name, -- 账簿名称
'PORTFOLIO_SWAP' as Cntr, -- 柜台
'TIT060-10142' as Sler_Cutp_Pty_Id, -- 销售方交易对手当事人编号
'' as Futr_Type, -- 期货类型
'' as Agt_Clas_Cd, -- 协议分类代码
'' as Cros_Crrc_Type_Cd, -- 跨币种类型代码
'' as Float_Base_Rate, -- 浮动基础利率
'' as Float_Undrl_Cd, -- 浮动腿标的代码
'' as Flot_Intrt_Ulmt, -- 浮动利率上限
null as Comp_Usag_Cd, -- 合约用途代码
'CNY' as Sett_Crrc_Cd, -- 固定结算币种代码，不读取a.settlement_currency
null as Ex_Rate_Model -- 汇率模式
