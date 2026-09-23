-- task_id: 133056
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/REF/PDATA_N.T99_DERI_COMP_TYPE_BASE_COEF_REF_OIS013.py
-- observed_at: 2026-09-05T01:06:53.165Z

-- createSql
CREATE TABLE IF NOT EXISTS T99_DERI_COMP_TYPE_BASE_COEF_REF(
     Busi_Type                  STRING COMMENT '业务类型'
    ,Calc_Type                  STRING COMMENT '计算类型'
    ,Coef_Type                  STRING COMMENT '系数类型'
    ,Src_Comp_Type_Cd           STRING COMMENT '源合约类型代码'
    ,Src_Comp_Type_Desc         STRING COMMENT '源合约类型名称'
    ,Src_Undrl_Type_Cd          STRING COMMENT '源标的类型代码'
    ,Vld_Date                   STRING COMMENT '生效日期'
    ,Base_Yield                 STRING COMMENT '基础收益率'
    ,Estb_Time                  STRING COMMENT '创建时间'
    ,Upd_Time                   STRING COMMENT '更新时间'
    ,Creator                    STRING COMMENT '创建人'
    ,Upd_Prsn                   STRING COMMENT '更新人'
    ,Desc                       STRING COMMENT '描述'
    ,Del_Flag                   STRING COMMENT '删除标志'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Src_Dept_No                STRING COMMENT '源部门编码'
    ,Bgng_Prcg_Date_Llmt        STRING COMMENT '期初定价日下限'
    ,Bgng_Prcg_Date_Ulmt        STRING COMMENT '期初定价日上限'
    ,Bel_Busi_Dept              STRING COMMENT '所属业务部门'
)COMMENT '衍生品合约类型基础系数参考信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T99_DERI_COMP_TYPE_BASE_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OIS.O_BUS_TYPE_BASE_RATE:销售收入交叉销售合约类型基础系数表]
-----------------------------------------------------------------------------------------------------
SELECT
     BUSINESS_TYPE                         AS  Busi_Type               --业务类型
    ,BASE_CALCULATION                      AS  Calc_Type               --计算类型
    ,'CROSS'                               AS  Coef_Type               --系数类型
    ,CONTRACT_TYPE                         AS  Src_Comp_Type_Cd        --源合约类型代码
    ,CONTRACT_TYPE_NAME                    AS  Src_Comp_Type_Desc      --源合约类型名称
    ,UNDERLYING_TYPE                       AS  Src_Undrl_Type_Cd       --源标的类型代码
    ,EFFECTIVE_DATE                        AS  Vld_Date                --生效日期
    ,BASE_AWARD_RATE                       AS  Base_Yield              --基础收益率
    ,CREATED_DATETIME                      AS  Estb_Time               --创建时间
    ,UPDATED_DATETIME                      AS  Upd_Time                --更新时间
    ,CREATED_BY                            AS  Creator                 --创建人
    ,UPDATED_BY                            AS  Upd_Prsn                --更新人
    ,DISCRIPTION                           AS  Desc                    --描述
    ,CASE WHEN IS_DELETED='Y' THEN '1'
          WHEN IS_DELETED='N' THEN '0'
          ELSE IS_DELETED END              AS  Del_Flag                --删除标志
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    ,DEPARTMENT                            AS  Src_Dept_No             --源部门编码
    ,CONTRACT_START_DATE_MIN               AS  Bgng_Prcg_Date_Llmt     --期初定价日下限
    ,CONTRACT_START_DATE_MAX               AS  Bgng_Prcg_Date_Ulmt     --期初定价日上限
    ,'OTC'                                 AS  Bel_Busi_Dept           --所属业务部门   'OTC' --总部股衍
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
