-- 本文件提供fee每日费用汇总；cp客户资料查询另在00。两路LEFT JOIN，不重新决定合约日范围。
-- fee读期权合约每日计提费用表：37类汇为期权费，非37类汇为其他费；按源产品号+计提日汇总。
-- 用info.Otc_Seri_No（场外合约流水号）+det.Busi_Date连接fee；不是info.Agt_Id。
-- cp读公司客户表OIS来源、报告日、未删除资料，按交易对手客户编号取USCC；缺失不丢合约。
-- fee无命中时两费用为NULL，收入公式没有统一补0；cp多条命中会扩行并影响后续窗口。
-- 本文件提供fee查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
SELECT
        Src_Prd_Id,
        sum(if(Fee_Type_Cd = '37',  Tdy_Prvs_Fee, 0)) as PREMIUM_Prvs_Fee,
        sum(if(Fee_Type_Cd != '37', Tdy_Prvs_Fee, 0)) as OTHER_Prvs_Fee,
        Busi_Date
    FROM PDATA_N.T98_OTC_OPT_COMP_EDAY_PRVS_FEE
    where src_tbl = 'ODATA_N_TIT.D_TRD_DAILY_ACCRUAL_FEE'
    group by Src_Prd_Id, Busi_Date
