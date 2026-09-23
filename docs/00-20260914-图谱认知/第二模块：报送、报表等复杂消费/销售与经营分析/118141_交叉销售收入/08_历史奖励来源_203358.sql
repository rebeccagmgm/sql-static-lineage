-- 08 历史奖励来源（独立上游任务203358，不随118141主脚本拼接执行）
-- 主体：OIS的一条交叉收入奖励记录；读取参数日快照，映射45列后写入T98同日源分区。
-- 不连接其他表、不聚合、不去重，也不在本段计算保底或筛选奖励核算季度。
-- 118141使用其中的合同号、核算码、部门所得收入、核算结束日，汇成保底调整的历史输入。
-- 阅读位置：05历史奖励提供actl，04收入调整使用它；需要追溯其金额时再看本文件。

INSERT OVERWRITE TABLE T98_OTC_DERI_UNDRL_INCOME_RWD_SUM
PARTITION (SRC_TBL = '${src_table}', BUSI_DATE = '${data_day_str}')
SELECT
    -- 1. 源记录、核算期与归属：源的一行继续写成目标的一行，不是每合同汇成一行。
    ID AS Src_Id, -- 源ID
    ACCOUNTING_DATE AS Sett_Time, -- 核算时间：118141按YYYY0Q季度码比较，不按月份解析
    CREATE_TIME AS Inpt_Time, -- 数据导入时间：源注释为“创建时间”
    BRANCH_OFFICE AS Bel_Div_Org_Name, -- 所属分公司名称
    '' AS Bel_Inr_Org_Id, -- 所属内部机构编号：本来源未提供，填空串
    BRANCH_NAME AS Bel_Inr_Org_Name, -- 所属内部机构名称
    CUSTOMER_MANAGER_NAME AS Mngr_Emp_Name, -- 客户经理员工名称
    ABBREVIATION AS Cupt_Name, -- 交易对手简称
    OPTION_TYPE AS Otc_Deri_Type, -- 衍生品类型

    -- 2. 本金与部门所得：没有按本金重新计算奖励，收入直接来自源字段。
    '' AS Annu_Pric_Diff, -- 年化价差：本来源填空串
    '' AS Absl_Pric_Diff, -- 绝对价差：本来源填空串
    '' AS Sale_Coef, -- 销售费系数：本来源填空串
    NOTIONAL AS Absl_Nom_Prin, -- 绝对名义本金：源名义本金（元）
    EXPANSION_DEPT_INCOME AS Dev_Dept_Rwd, -- 拓展方部门所得收入（元）：118141真正累计的是此列

    -- 3. 未提供的计提与终止属性：都是空串，不是0或NULL。
    '' AS Bgng_Prcg_Date, -- 期初定价日期
    '' AS Accr_Begn_Date, -- 计提起始日
    '' AS Accr_End_Date, -- 计提终止日
    '' AS End_Date, -- 到期日（含提前终止日）
    '' AS Accr_Days, -- 实际天数/计提天数
    '' AS Erly_Trmt_Flag, -- 提前终止标志
    '' AS Erly_Trmt_Date, -- 提前终止日期

    -- 4. 合同与标的：合同编号直接传递，没有转换成TIT内部交易流水号。
    NOTIONAL AS Nom_Prin, -- 名义本金（元）：与上面的Absl_Nom_Prin取同一源列
    CONTRACT_NO AS Contr_Id, -- 合同编号：118141用它连接日报合约号
    CORPORATE_NAME AS Pty_Cutp_Name, -- 当事人交易对手名称：源注释为“公司名称”
    SIGNATURE_NAME AS Sign_Prd_Name, -- 代签产品名称
    UNDERLYING_CODE AS Undrl_Cd, -- 标的代码
    UNDERLYING_NAME AS Undrl_Name, -- 标的名称
    UNDERLYING_TYPE AS Undrl_Type, -- 源注释为“标的类型”；目标DDL注释却为“标的名称”
    REMARK AS Remark, -- 备注

    -- 5. 奖励预留与客户属性：四列应发/递延/实发都填空串，不能据此证明现金已经支付。
    '' AS Dev_Cust_Flag, -- 研发客户标志
    '' AS Curr_Payb_Rwd, -- 本期应发奖励
    '' AS Curr_Defr_Rwd, -- 本期递延奖励
    '' AS Mtch_Defr_Rwd, -- 历史累计递延奖励
    '' AS Curr_Actl_Rwd, -- 本期实发奖励：118141的actl没有SUM这列
    APTITUDE AS Cust_Type_Desc, -- 客户类型描述
    '' AS Matn_Emp_Id, -- 维护员工编号

    -- 6. 加工标识
    '${data_src_cd}' AS Data_Src_Cd, -- 数据来源代码
    '${filename}' AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_today_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time, -- 数据时间
    '${src_table}' AS Real_Src_Tbl, -- 真实源表

    -- 7. 跨境与核算日期：结束日期供118141求历史核算截止，不是合约到期日。
    CASE
        WHEN IS_CROSS_BORDER = 'true' THEN '1'
        WHEN IS_CROSS_BORDER = 'false' THEN '0'
        ELSE IS_CROSS_BORDER
    END AS Cros_Bord_Flag, -- 跨境标志：只转换这两种字符串，其他值原样保留
    ACCOUNTING_START_DATE AS Sett_Strt_Date, -- 核算开始日期【AI】
    ACCOUNTING_END_DATE AS Sett_End_Date -- 核算结束日期【AI】：118141按合同取MAX

-- ODATA_N_OIS.G_CROSS_INCOME_REWARD（【AI】交叉收入奖励）。
-- ${src_table}由本任务参数提供，源SQL注释绑定此表；只按BUSI_DATE取快照，无额外删除筛选。
FROM (
    SELECT *
    FROM ${src_table}
    WHERE BUSI_DATE = '${data_day_str}'
) A
;
