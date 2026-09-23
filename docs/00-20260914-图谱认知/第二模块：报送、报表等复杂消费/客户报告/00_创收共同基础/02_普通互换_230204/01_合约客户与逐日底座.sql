-- 本文件只选info主合约；det/cp/ins的查询与连接在00，连接后才形成合约日。
-- info：报告日合约主信息，grp_id=02、OTC、排除TRS_INNER、有效结束日不早于2022。
-- det：107491合约逐日明细；只用明细自身起止日过滤，再按Agt_Id INNER JOIN。
-- 不在本任务再限制det日期<=报告日，也不以info提前终止日重新截断det；缺明细的合约不出现。
-- cp：公司客户OIS来源、报告日、未删除，按客户编号补USCC；ins：证券基础资料按标的工具编号补标的分类。
-- 这里合约号Agt_Id连接det；后续事件用Inr_Seri_No、持仓盈亏用Otc_Seri_No，三者不可互换。
-- 本文件提供info查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and grp_id = '02' and Agt_Clas_Cd != 'TRS_INNER'
        and Book_Bel_Dept = 'OTC' and coalesce(Early_Term_Date, End_Pric_Date) >= '2022-01-01'
