-- 用途：把内部合约类型基础参数原值写入T99，不展开有效日，也不计算收入。
-- 输入：G_INR_BASE_RATE加工日快照；一行源配置输出一行，无JOIN/聚合/去重。
-- 输出：运管类型、基础收益率、拟定基础系数、附加收益率、计算方式、实际生效日。
-- 使用：114013/113993消费时才按实际生效日构造版本区间，再用合约期初日匹配。
-- 生产保留删除记录并转码；目标按SRC_TBL和BUSI_DATE分区。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_OTC_DERI_INR_BASE_REF PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OIS.G_INR_BASE_RATE:销售收入内部合约基础系数维护表]
-----------------------------------------------------------------------------------------------------
SELECT
    OTC_CONTRACT_TYPE    AS  Op_Mng_Comp_Type_Id    --运管合约类型编号
    ,BASE_EARNING_RATE    AS  Base_Yield    --基础收益率
    ,DRAFT_BASE_RATE    AS  Dft_Base_Coef    --拟定基础系数
    ,BASE_CALCULATION    AS  Calc_Way    --计算方式
    ,ADDITIONAL_RATE    AS  Adtnl_Yield    --附加收益率
    ,CREATED_DATETIME    AS  Create_Time    --创建时间
    ,EFFECTIVE_DATE    AS  Actl_Vld_Day    --实际生效日
    ,CASE WHEN IS_DELETED = 'Y' THEN '1'
    WHEN IS_DELETED = 'N' THEN '0'
    ELSE IS_DELETED END    AS  Src_Deleted_Flag    --源删除标志
    ,'${data_src_cd}'    AS  Data_Src_Cd    --数据来源代码
    ,'${filename}'    AS  Task_Name    --任务名
    ,'${data_day_str}'    AS  Data_Etl_Date    --数据加载日期
    ,'${data_today_str}'    AS  Data_Upt_Date    --数据更新日期
    ,'${data_today}'    AS  Data_Time    --数据时间
FROM    (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
