-- 04：确定本段处理的合约范围，并带出交易对手客户号。
sale_contract as (
    select distinct Agt_Id, --合约编号
     Cutp_Pty_Id, --交易对手客户编号
     Inr_Seri_No, --内部流水号
     Book_Bel_Dept --账簿所属部门
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO --【合约主信息】场外衍生品合约销售收入基本信息表
    where busi_Date = '${data_day_str}' and Book_Bel_Dept in ('OTC','OTC_HK')
),

-- ci：读取本任务第一段生成的otc_div_temp，选择【合约级关系】。【03_介绍关系横排】
contract_introduction as (
    select * from otc_div_temp
    where Contract_Code != ''
),

/*
-- fl：pdata_news_n.t02_fin_float_income_vchr_info（浮动收益凭证台账信息）。
-- 运管源表 odata_n_ois.g_fdsypz_ledger
-- comp_no合约编号（收益凭证）、cust_no客户编号、deal_cutp_no交易对手编号、prin_prtc_prop本金保障比例
-- 参数日、OIS来源、01分组且本金保障比例<1，才有资格参与客户号切换。
*/
floating_voucher as (
    select * from pdata_news_n.t02_fin_float_income_vchr_info --浮动收益凭证台账信息【来源运管】
    where busi_Date = '${data_day_str}' and src_id = 'OIS' and grp_id = '01'
        and cast(prin_prtc_prop as double) < 1
),

-- cpi：同一个 otc_div_temp 中的【客户级关系】， 供合约字段为NULL时回退。
customer_introduction as (
    select * from otc_div_temp
    where client_id != ''
)
