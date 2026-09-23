-- 04：第二段从哪些合约出发，以及客户关系用哪个客户号查。
-- info：PDATA_N.T98_OTC_DERI_COMP_SALE_INFO（场外衍生品合约销售收入基本信息表）。
-- Agt_Id=合约编号，Cutp_Pty_Id=交易对手客户编号，Inr_Seri_No=内部流水号，
-- Book_Bel_Dept=账簿所属部门；这些编号不是同一个键。
-- DISTINCT针对这四字段的组合，不保证Agt_Id唯一；不额外筛grp_id或合约状态。
sale_contract as (
    select distinct Agt_Id, Cutp_Pty_Id, Inr_Seri_No, Book_Bel_Dept
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_Date = '${data_day_str}' and Book_Bel_Dept in ('OTC','OTC_HK')
),

-- ci：读取本任务第一段生成的otc_div_temp，选择合约级关系。
-- 07_管理归属输出中按ci.Contract_Code=info.Agt_Id连接，作为逐字段优先来源。
contract_introduction as (
    select * from otc_div_temp
    where Contract_Code != ''
),

-- fl：pdata_news_n.t02_fin_float_income_vchr_info（浮动收益凭证台账信息）。
-- comp_no=合约编号；prin_prtc_prop=本金保障比例；deal_cutp_no=交易对手编号。
-- 参数日、OIS来源、01分组且本金保障比例<1，才有资格参与客户号切换。
-- 07_管理归属输出还要求info.Cutp_Pty_Id='DEV1100100652'且fl匹配成功。
-- 条件满足时用fl.deal_cutp_no查cpi和cp；其为NULL也不回退到原客户号。
-- 输出Pty_Id仍是info.Cutp_Pty_Id，不会随关系查找键一起改写。
floating_voucher as (
    select * from pdata_news_n.t02_fin_float_income_vchr_info
    where busi_Date = '${data_day_str}' and src_id = 'OIS' and grp_id = '01'
        and cast(prin_prtc_prop as double) < 1
),

-- cpi：同一个otc_div_temp中的客户级关系，供合约字段为NULL时回退。
-- 此处只划分关系类型；客户号选择、JOIN和COALESCE都留在07_管理归属输出中。
customer_introduction as (
    select * from otc_div_temp
    where client_id != ''
)
