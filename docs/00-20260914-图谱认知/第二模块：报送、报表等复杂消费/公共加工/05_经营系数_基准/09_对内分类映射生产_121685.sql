-- 用途：保存运管类型与源合约/子类型/标的类型串的映射，不给具体合约做最终分类。
-- 输入：G_INR_CONTRACT_MAPPING加工日快照；一行源配置输出一行，无JOIN/去重。
-- 输出：运管类型编号及映射条件；UNDRL_TYPE仍是原字符串，不在生产阶段拆分。
-- 使用：114013/113993消费时才拆标的类型串，并将本地CASE分类优先于映射回退。
-- 生产保留删除记录并转码；目标按SRC_TBL和BUSI_DATE分区。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_OTC_DERI_INR_BASE_MAPPING PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OIS.G_INR_CONTRACT_MAPPING:销售收入内部合约类型映射表]
-----------------------------------------------------------------------------------------------------
SELECT
    BUSINESS_TYPE    AS  Otc_Deri_Comp_Type    --场外衍生品合约类型
    ,OTC_CONTRACT_TYPE    AS  Op_Mng_Comp_Type_Id    --运管合约类型编号
    ,OTC_CONTRACT_TYPE_NAME    AS  Op_Mng_Comp_Type_Desc    --运管合约类型描述
    ,SRC_CONTR_TYPE    AS  Src_Agt_Type_Cd    --源协议类型代码
    ,SRC_CONTR_TYPE_DESC    AS  Src_Agt_Type_Desc    --源协议类型描述
    ,SRC_SUB_CONTR_TYPE    AS  Src_Agt_Sub_Type_Cd    --源协议子类型代码
    ,SRC_SUB_CONTR_TYPE_DESC    AS  Src_Agt_Sub_Type_Desc    --源协议子类型描述
    ,UNDRL_TYPE    AS  Src_Undrl_Type_Cd_Str    --源标的类型代码串
    ,UNDRL_TYPE_DESC    AS  Src_Undrl_Type_Desc_Str --源标的类型描述串
    ,CREATED_DATETIME    AS  Create_Time    --创建时间
    ,CASE WHEN IS_DELETED = 'Y' THEN '1'
    WHEN IS_DELETED = 'N' THEN '0'
    ELSE IS_DELETED END
    AS  Src_Deleted_Flag    --源删除标志
    ,'${data_src_cd}'    AS  Data_Src_Cd    --数据来源代码
    ,'${filename}'    AS  Task_Name    --任务名
    ,'${data_day_str}'    AS  Data_Etl_Date    --数据加载日期
    ,'${data_today_str}'    AS  Data_Upt_Date    --数据更新日期
    ,'${data_today}'    AS  Data_Time    --数据时间
FROM    (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
