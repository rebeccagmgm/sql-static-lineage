-- 用途：把香港交易对手价差配置映射到客户类型价差T99；不是220979当前冻结SQL的必经上游。
-- 输入：G_REV_HKCPTY_BID_ASK_SPREAD_COEF加工日快照；G_HK_COUNTERPARTY补客户类别。
-- 一行：一条源配置及客户类别匹配结果；右侧客户多条时可能扩行，没有去重。
-- 输出：客户、业务类型、标的类型、价差类型与系数、适用期初区间。
-- 使用：现有220979/220981直接读源配置，具体关联与选择见06_对内与香港价差.md。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_REV_HKCPTY_BID_ASK_SPREAD_COEF:销售收入交易对手价差系数（香港）]
-----------------------------------------------------------------------------------------------------
SELECT
    A.CLIENT_ID    AS  Pty_Id    --当事人编号
    ,CASE WHEN B.CLIENT_TYPE='Individual(PI Confirmed)' THEN '110500'
    WHEN B.CLIENT_TYPE in ('CPI','IPI')    THEN '210500'
    ELSE B.CLIENT_TYPE END    AS  Pty_Cate_Cd    --当事人类别代码
    ,A.BUSINESS_TYPE    AS  Busi_Type    --业务类型
    ,A.SPREAD_CALC_TYPE    AS  Calc_Type    --计算类型
    ,'CROSS'    AS  Coef_Type    --系数类型    'CROSS' --交叉
    ,''    AS  Src_Comp_Type_Cd    --源合约类型代码
    ,''    AS  Src_Comp_Type_Desc    --源合约类型名称
    ,A.UNDERLYING_TYPE    AS  Src_Undrl_Type_Cd    --源标的类型代码
    ,A.ANNUALIZED_SPREAD    AS  Annu_Sprd_Coef    --年化价差系数
    ,A.ABSOLUTE_SPREAD    AS  Absl_Sprd_Coef    --绝对价差系数
    ,''    AS  Vld_Date    --生效日期
    ,''    AS  Desc    --描述
    ,A.CREATED_DATETIME    AS  Estb_Time    --创建时间
    ,A.CREATED_BY    AS  Creator    --创建人
    ,CASE WHEN A.IS_DELETED='Y' THEN '1'
    WHEN A.IS_DELETED='N' THEN '0'
    ELSE A.IS_DELETED END    AS  Del_Flag    --删除标志
    ,'${data_src_cd}'    AS  Data_Src_Cd    --数据来源代码
    ,'${filename}'    AS  Task_Name    --任务名
    ,'${data_day_str}'    AS  Data_Etl_Date    --数据加载日期
    ,'${data_today_str}'    AS  Data_Upt_Date    --数据更新日期
    ,'${data_today}'    AS  Data_Time    --数据时间
    ,A.START_DATE    AS  Bgng_Prcg_Date_Llmt    --期初定价日下限
    ,A.END_DATE    AS  Bgng_Prcg_Date_Ulmt    --期初定价日上限
-- A：销售收入交易对手价差系数（香港），一条客户/业务/标的/日期范围的配置。
FROM (
    SELECT * FROM ${src_table}
    WHERE BUSI_DATE='${data_day_str}'
) A
-- B：香港交易对手。按客户编号补客户类别；类别映射不改价差系数或适用日期。
-- 没匹配时CLIENT_TYPE为NULL，CASE的ELSE原值返回NULL；多条客户匹配会扩行。
LEFT JOIN (
    SELECT CLIENT_ID,CLIENT_TYPE FROM ODATA_N_OIS.G_HK_COUNTERPARTY
    WHERE BUSI_DATE='${data_day_str}'
) B
    ON A.CLIENT_ID=B.CLIENT_ID

;
