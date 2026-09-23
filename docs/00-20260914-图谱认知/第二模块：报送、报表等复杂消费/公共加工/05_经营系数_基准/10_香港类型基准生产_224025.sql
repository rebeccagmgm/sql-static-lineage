-- 用途：保存香港业务类型与标的类型的基础奖励配置；不是220979冻结SQL的必经上游。
-- 输入：G_REV_HK_SALES_BASE_COEF加工日快照；一条源配置原值映射一行，无JOIN/去重。
-- 输出：Busi_Type、Src_Undrl_Type_Cd、Calc_Type、Base_Yield；合约类型及日期范围填空。
-- 使用：220979/220981实际直接读源表，按业务类型与香港标的类型匹配，不展开日期。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_DERI_COMP_TYPE_BASE_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_REV_HK_SALES_BASE_COEF:销售收入基础系数配置（香港）]
-----------------------------------------------------------------------------------------------------
SELECT
    BUSINESS_TYPE    AS  Busi_Type    --业务类型
    ,BASE_CALCULATION    AS  Calc_Type    --计算类型
    ,'CROSS'    AS  Coef_Type    --系数类型
    ,''    AS  Src_Comp_Type_Cd    --源合约类型代码
    ,''    AS  Src_Comp_Type_Desc    --源合约类型名称
    ,UNDERLYING_TYPE    AS  Src_Undrl_Type_Cd    --源标的类型代码
    ,''    AS  Vld_Date    --生效日期
    ,BASE_AWARD_RATE    AS  Base_Yield    --基础收益率
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
    ,''    AS  Bgng_Prcg_Date_Llmt    --期初定价日下限
    ,''    AS  Bgng_Prcg_Date_Ulmt    --期初定价日上限
    ,'OTC_HK'    AS  Bel_Busi_Dept    --所属业务部门    'OTC_HK' --香港股衍
FROM    (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
