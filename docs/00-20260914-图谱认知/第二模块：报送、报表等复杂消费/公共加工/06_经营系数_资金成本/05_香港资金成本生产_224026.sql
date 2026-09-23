-- 用途：保存香港资金成本配置；不是220979冻结SQL的必经上游。
-- 输入：G_REV_HK_CAPITAL_COST加工日快照；一条源配置原值映射一行，无JOIN/去重。
-- 输出：业务类型、合约类型、标的类型、资金成本、起息起止日期；不算成本金额。
-- 使用：220979实际直接读源表，用香港合约类型、标的类型、期初定价日匹配。
-- START_DATE/END_DATE原值映射；该生产查询不改哨兵日期、不截短时间。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_DERI_COMP_TYPE_FND_COST_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_REV_HK_CAPITAL_COST:销售收入资金成本（香港）]
-----------------------------------------------------------------------------------------------------
SELECT
    BUSINESS_TYPE    AS  Busi_Type    --业务类型
    ,CONTRACT_TYPE    AS  Src_Comp_Type_Cd    --源合约类型代码
    ,CONTRACT_TYPE_NAME    AS  Src_Comp_Type_Desc    --源合约类型名称
    ,UNDERLYING_TYPE    AS  Src_Undrl_Type_Cd    --源标的类型代码
    ,''    AS  Vld_Date    --生效日期
    ,CAPITAL_COST    AS  Fnd_Cost    --资金成本
    ,CREATED_DATETIME    AS  Estb_Time    --创建时间
    ,UPDATED_DATETIME    AS  Upd_Time    --更新时间
    ,CREATED_BY    AS  Creator    --创建人
    ,UPDATED_BY    AS  Upd_Prsn    --更新人
    ,DESCRIPTION    AS  Desc    --描述
    ,CASE WHEN IS_DELETED='Y' THEN '1'
    WHEN IS_DELETED='N' THEN '0'
    ELSE IS_DELETED END    AS  Del_Flag    --删除标志
    ,'${data_src_cd}'    AS  Data_Src_Cd    --数据来源代码
    ,'${filename}'    AS  Task_Name    --任务名
    ,'${data_day_str}'    AS  Data_Etl_Date    --数据加载日期
    ,'${data_today_str}'    AS  Data_Upt_Date    --数据更新日期
    ,'${data_today}'    AS  Data_Time    --数据时间
    ,'${src_table}'    AS  Real_Src_Tbl    --真实源表
    ,''    AS  Src_Dept_No    --源部门编码
    ,START_DATE    AS  Intr_Strt_Date    --起息开始日期
    ,END_DATE    AS  Intr_End_Date    --起息结束日期
    ,'OTC_HK'    AS  Bel_Busi_Dept    --所属业务部门    'OTC_HK' --香港股衍
FROM    (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
