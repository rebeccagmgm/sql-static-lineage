-- 223867 金仕达客户创收：主线只组织原有来源与连接，不创建生产视图。
-- 阅读：合约日 → 利息/佣金/占资/成交/报盘费/成本率 → 02创收表达式 → 74列输出。
-- info=合约主信息，det=逐日明细；其他别名实际表与键在下方就地说明。
-- @include 01_结果投影.sql
-- 合约主表 info：报告日OTC金仕达，排除原SQL三个客户；结束日期仍可覆盖历史合约。
from (
    select *, null as prop_group from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and Book_Bel_Dept = 'OTC' and coalesce(Early_Term_Date, End_Pric_Date) >= '2022-01-01'
        and grp_id = '03' and Cutp_Pty_Id not in ('DEV1100103598','DEV1100103339','DEV1100100652')
    ) info

-- 日明细 det：自身起止日期内的逐日本金；INNER JOIN按合约号，不限只取报告日。
inner join (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
    where busi_date between Strt_Pric_Date and End_Pric_Date
    ) det
on info.agt_id = det.agt_id

-- 客户 cp：报告日有效对公客户，用交易对手客户编号补USCC，缺失仍保留合约日。
left join (
    select * from PDATA_N.T01_CORP_CUST
    where src_tbl = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY' and busi_date = '${yyyy-MM-dd}' and DEL_FLAG = '0'
    ) cp
on cp.pty_id = info.Cutp_Pty_Id

-- 利息／佣金 co：内部合约号＋计提日；只对多空互换补入。
left join (
-- @include 03_当日利息与佣金.sql
) co
on co.contract_code = info.Inr_Seri_No and default.datekey2date(co.clear_date) = det.busi_date and info.Src_Contr_Type = 'B_LONG_SHORT_SWAP'

-- 占资 bc：同一内部合约号，按计提日当天或之前最近交易日取资料。
-- 净占资=max(actual_occupy_amt实际占资－remain_contract保留原字段,0)。remain_contract经济含义待核元数据。
left join odata_n_lss.s_gf_bk_contract bc  --实际占资，非交易日取上个交易日
on bc.contract_code = info.Inr_Seri_No and default.datekey2date(bc.clear_date) = default.pretradedate(date_add(det.busi_date,1),1) and info.Src_Contr_Type = 'B_LONG_SHORT_SWAP'

-- 成交 tc：按计提日精确匹配，不能套用bc的最近交易日规则。
left join (
-- @include 04_当日成交金额.sql
) tc
on tc.contract_code = info.Inr_Seri_No and default.datekey2date(tc.clear_date) = det.busi_date and info.Src_Contr_Type = 'B_LONG_SHORT_SWAP'

-- 报盘费 cas：按交易日期精确匹配，源快照已限定报告日。
left join (
-- @include 05_当日报盘费.sql
) cas
on cas.contract_code = info.Inr_Seri_No and cas.trade_date = det.busi_date and info.Src_Contr_Type = 'B_LONG_SHORT_SWAP'

-- 成本率 fc：按计提日取展开参数；缺失利率会传播NULL，保持LEFT JOIN。
left join (
-- @include 06_资金成本有效期.sql
) fc
on fc.busi_date = det.busi_date and info.Src_Contr_Type = 'B_LONG_SHORT_SWAP' 
	
) castTable

