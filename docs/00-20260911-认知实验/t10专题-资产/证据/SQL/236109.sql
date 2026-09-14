-- task_id: 236109
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/AST/PDATA_N.T10_AST_INFO_FAM001.py
-- observed_at: 2026-09-05T01:07:29.149Z

-- createSql
CREATE TABLE IF NOT EXISTS T10_AST_INFO(
         Ast_Id                     STRING COMMENT '资产编号'
        ,Ast_Name                   STRING COMMENT '资产名称'
        ,Ast_Cate_Cd                STRING COMMENT '资产类别代码'
        ,Ast_Proprt_Type_Cd         STRING COMMENT '资产权属类型代码'
        ,Proprt_Prsn_Id             STRING COMMENT '权属人编号'
        ,Ast_Lbl                    STRING COMMENT '资产标签'
        ,Ast_Type_Cd                STRING COMMENT '资产类型代码'
        ,Ast_Stat_Cd                STRING COMMENT '资产状态代码'
        ,Ast_Get_Method_Cd          STRING COMMENT '资产取得方式代码'
        ,Ast_Prop_Cd                STRING COMMENT '资产属性代码'
        ,Main_Ast_Flag              STRING COMMENT '主资产标志'
        ,Crrc_Cd                    STRING COMMENT '币种代码'
        ,Vld_Date                   STRING COMMENT '有效日期'
        ,Exp_Date                   STRING COMMENT '到期日期'
        ,Stki_Time                  STRING COMMENT '入库时间'
        ,Stki_Prop_Cd               STRING COMMENT '入库性质代码'
        ,Ast_Use_Life               STRING COMMENT '资产使用年限'
        ,Use_Strt_Time              STRING COMMENT '使用开始时间'
        ,Ast_Lock_Rsn_Cd            STRING COMMENT '资产锁定原因代码'
        ,Depr_Flag                  STRING COMMENT '折旧标志'
        ,Remark                     STRING COMMENT '备注'
        ,Del_Flag                   STRING COMMENT '删除标志'
        ,Del_Date                   STRING COMMENT '删除日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '资产信息'
    PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.T10_AST_INFO_TEMP_FAM001;
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T10_AST_INFO_TEMP_FAM001
    AS
    -----------------------------------------------------------------------------------------------------
    --GROUP1: SOURCE TABLE:[ODATA_N_FAM.W_ASSET_ACCOUNT: 资产台账]
    -----------------------------------------------------------------------------------------------------
    SELECT
         ASSET_TAG_NO                             AS  Ast_Id                  --资产编号                     
        ,ASSET_NAME                               AS  Ast_Name                --资产名称                     
        ,CASE WHEN NVL(TRIM(ASSET_SON),'') !='' THEN NVL(E.DW_CD_VAL,ASSET_SON) 
              WHEN NVL(TRIM(ASSET_SON),'')  ='' THEN NVL(F.DW_CD_VAL,ASSET_TYPE) 
              END                                 AS  Ast_Cate_Cd             --资产类别代码         
        ,'01'                                     AS  Ast_Proprt_Type_Cd      --资产权属类型代码
        ,'GF'                                     AS  Proprt_Prsn_Id          --权属人编号      
        ,''                                       AS  Ast_Lbl                 --资产标签        
        ,NVL(B.DW_CD_VAL,ASSET_TYPE)              AS  Ast_Type_Cd             --资产类型代码    
        ,NVL(C.DW_CD_VAL,STATUS)                  AS  Ast_Stat_Cd             --资产状态代码    
        ,''                                       AS  Ast_Get_Method_Cd       --资产取得方式代码
        ,NVL(D.DW_CD_VAL,ASSET_NATURE)            AS  Ast_Prop_Cd             --资产属性代码    
        ,ASSET_ATTRIBUTE                          AS  Main_Ast_Flag           --主资产标志      
        ,''                                       AS  Crrc_Cd                 --币种代码        
        ,''                                       AS  Vld_Date                --有效日期        
        ,''                                       AS  Exp_Date                --到期日期        
        ,STORE_TIME                               AS  Stki_Time               --入库时间        
        ,STORE_NATURE                             AS  Stki_Prop_Cd            --入库性质代码    
        ,ASSET_USE_LIFE                           AS  Ast_Use_Life            --资产使用年限    
        ,ASSET_START_DATE                         AS  Use_Strt_Time           --使用开始时间    
        ,LOCK_STATUS                              AS  Ast_Lock_Rsn_Cd         --资产锁定原因代码
        ,IS_DEVALUE                               AS  Depr_Flag               --折旧标志        
        ,REMARK                                   AS  Remark                  --备注            
        ,'${data_src_cd}'                    AS  Data_Src_Cd             --数据来源代码
        ,'${src_table}'                      AS  Src_Tbl                 --源表
        ,'${filename}'                       AS  Task_Name               --任务名
        ,'${data_day_str}'                   AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                   AS  Data_Upt_Date           --数据更新日期
        ,'${src_table}'                      AS  Real_Src_Tbl            --真实源表
    FROM  (SELECT * FROM ${src_table}  WHERE BUSI_DATE='${data_day_str}' )A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T10_AST_INFO'
                 AND TGT_TAB_FLD  = 'Ast_Type_Cd'
                 AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                 AND SRC_FLD_NAME = 'ASSET_TYPE'
                 AND SRC_SYS_NAME='FAM')B
          ON      A.ASSET_TYPE =B.SRC_CD_VAL                  --ASSET_TYPE 转码
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T10_AST_INFO'
                 AND TGT_TAB_FLD  = 'Ast_Stat_Cd'
                 AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                 AND SRC_FLD_NAME = 'STATUS'
                 AND SRC_SYS_NAME='FAM')C
          ON      A.STATUS =C.SRC_CD_VAL                  --STATUS 转码
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T10_AST_INFO'
                 AND TGT_TAB_FLD  = 'Ast_Prop_Cd'
                 AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                 AND SRC_FLD_NAME = 'ASSET_NATURE'
                 AND SRC_SYS_NAME='FAM')D
          ON      A.ASSET_NATURE =D.SRC_CD_VAL                  --ASSET_NATURE 转码
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T10_AST_INFO'
                 AND TGT_TAB_FLD  = 'Ast_Cate_Cd'
                 AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                 AND SRC_FLD_NAME = 'ASSET_SON'
                 AND SRC_SYS_NAME='FAM')E
          ON      A.ASSET_SON =E.SRC_CD_VAL                  --ASSET_SON 转码
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T10_AST_INFO'
                 AND TGT_TAB_FLD  = 'Ast_Cate_Cd'
                 AND SRC_TAB_NAME = 'ASSET_ACCOUNT'
                 AND SRC_FLD_NAME = 'ASSET_TYPE'
                 AND SRC_SYS_NAME='FAM')F
          ON      A.ASSET_TYPE =F.SRC_CD_VAL                  --ASSET_TYPE 转码
    ;

DROP TABLE IF EXISTS ${DB_TEMP}.T10_AST_INFO_MID_FAM001;
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T10_AST_INFO_MID_FAM001
    AS
    SELECT
             A.*
            ,B.Ast_Id                     AS Ast_Id1                   --资产编号
            ,B.Ast_Name                   AS Ast_Name1                 --资产名称
            ,B.Ast_Cate_Cd                AS Ast_Cate_Cd1              --资产类别代码
            ,B.Ast_Proprt_Type_Cd         AS Ast_Proprt_Type_Cd1       --资产权属类型代码
            ,B.Proprt_Prsn_Id             AS Proprt_Prsn_Id1           --权属人编号
            ,B.Ast_Lbl                    AS Ast_Lbl1                  --资产标签
            ,B.Ast_Type_Cd                AS Ast_Type_Cd1              --资产类型代码
            ,B.Ast_Stat_Cd                AS Ast_Stat_Cd1              --资产状态代码
            ,B.Ast_Get_Method_Cd          AS Ast_Get_Method_Cd1        --资产取得方式代码
            ,B.Ast_Prop_Cd                AS Ast_Prop_Cd1              --资产属性代码
            ,B.Main_Ast_Flag              AS Main_Ast_Flag1            --主资产标志
            ,B.Crrc_Cd                    AS Crrc_Cd1                  --币种代码
            ,B.Vld_Date                   AS Vld_Date1                 --有效日期
            ,B.Exp_Date                   AS Exp_Date1                 --到期日期
            ,B.Stki_Time                  AS Stki_Time1                --入库时间
            ,B.Stki_Prop_Cd               AS Stki_Prop_Cd1             --入库性质代码
            ,B.Ast_Use_Life               AS Ast_Use_Life1             --资产使用年限
            ,B.Use_Strt_Time              AS Use_Strt_Time1            --使用开始时间
            ,B.Ast_Lock_Rsn_Cd            AS Ast_Lock_Rsn_Cd1          --资产锁定原因代码
            ,B.Depr_Flag                  AS Depr_Flag1                --折旧标志
            ,B.Remark                     AS Remark1                   --备注
            ,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
            ,B.SRC_TBL                    AS SRC_TBL1                  --源表
            ,B.TASK_NAME                  AS TASK_NAME1                --任务名
            ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
            ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
            ,B.Real_Src_Tbl               AS Real_Src_Tbl1             --真实源表
            ,CASE WHEN A.Ast_Id IS NULL     AND B.Ast_Id IS NOT NULL THEN 'I' --新增
                  WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id IS NULL THEN 'D' --删除
                  WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id IS NOT NULL AND (
                     COALESCE(A.Ast_Name                ,'') <> COALESCE(B.Ast_Name                ,'')
                  OR COALESCE(A.Ast_Cate_Cd             ,'') <> COALESCE(B.Ast_Cate_Cd             ,'')
                  OR COALESCE(A.Ast_Proprt_Type_Cd      ,'') <> COALESCE(B.Ast_Proprt_Type_Cd      ,'')
                  OR COALESCE(A.Proprt_Prsn_Id          ,'') <> COALESCE(B.Proprt_Prsn_Id          ,'')
                  OR COALESCE(A.Ast_Lbl                 ,'') <> COALESCE(B.Ast_Lbl                 ,'')
                  OR COALESCE(A.Ast_Type_Cd             ,'') <> COALESCE(B.Ast_Type_Cd             ,'')
                  OR COALESCE(A.Ast_Stat_Cd             ,'') <> COALESCE(B.Ast_Stat_Cd             ,'')
                  OR COALESCE(A.Ast_Get_Method_Cd       ,'') <> COALESCE(B.Ast_Get_Method_Cd       ,'')
                  OR COALESCE(A.Ast_Prop_Cd             ,'') <> COALESCE(B.Ast_Prop_Cd             ,'')
                  OR COALESCE(A.Main_Ast_Flag           ,'') <> COALESCE(B.Main_Ast_Flag           ,'')
                  OR COALESCE(A.Crrc_Cd                 ,'') <> COALESCE(B.Crrc_Cd                 ,'')
                  OR COALESCE(A.Vld_Date                ,'') <> COALESCE(B.Vld_Date                ,'')
                  OR COALESCE(A.Exp_Date                ,'') <> COALESCE(B.Exp_Date                ,'')
                  OR COALESCE(A.Stki_Time               ,'') <> COALESCE(B.Stki_Time               ,'')
                  OR COALESCE(A.Stki_Prop_Cd            ,'') <> COALESCE(B.Stki_Prop_Cd            ,'')
                  OR COALESCE(A.Ast_Use_Life            ,'') <> COALESCE(B.Ast_Use_Life            ,'')
                  OR COALESCE(A.Use_Strt_Time           ,'') <> COALESCE(B.Use_Strt_Time           ,'')
                  OR COALESCE(A.Ast_Lock_Rsn_Cd         ,'') <> COALESCE(B.Ast_Lock_Rsn_Cd         ,'')
                  OR COALESCE(A.Depr_Flag               ,'') <> COALESCE(B.Depr_Flag               ,'')
                  OR COALESCE(A.Remark                  ,'') <> COALESCE(B.Remark                  ,'')
             ) THEN 'U' --变更
                 ELSE 'S' --无变更
                 END                 AS DATA_TYPE              --数据类型
    FROM  (SELECT * FROM T10_AST_INFO 
                    WHERE SRC_TBL='ODATA_N_FAM.W_ASSET_ACCOUNT')A
    FULL OUTER JOIN ${DB_TEMP}.T10_AST_INFO_TEMP_FAM001 B
    ON    A.Ast_Id=B.Ast_Id
    ;

-- querySql
INSERT OVERWRITE TABLE T10_AST_INFO PARTITION(SRC_TBL)
     --剔除当日新增的数据
    SELECT DISTINCT
         Ast_Id                                        --资产编号
        ,Ast_Name                                      --资产名称
        ,Ast_Cate_Cd                                   --资产类别代码
        ,Ast_Proprt_Type_Cd                            --资产权属类型代码
        ,Proprt_Prsn_Id                                --权属人编号
        ,Ast_Lbl                                       --资产标签
        ,Ast_Type_Cd                                   --资产类型代码
        ,Ast_Stat_Cd                                   --资产状态代码
        ,Ast_Get_Method_Cd                             --资产取得方式代码
        ,Ast_Prop_Cd                                   --资产属性代码
        ,Main_Ast_Flag                                 --主资产标志
        ,Crrc_Cd                                       --币种代码
        ,Vld_Date                                      --有效日期
        ,Exp_Date                                      --到期日期
        ,Stki_Time                                     --入库时间
        ,Stki_Prop_Cd                                  --入库性质代码
        ,Ast_Use_Life                                  --资产使用年限
        ,Use_Strt_Time                                 --使用开始时间
        ,Ast_Lock_Rsn_Cd                               --资产锁定原因代码
        ,Depr_Flag                                     --折旧标志
        ,Remark                                        --备注
        ,Del_Flag                                      --删除标志
        ,Del_Date                                      --删除日期
        ,Data_Src_Cd                                   --数据来源代码
        ,Task_Name                                     --任务名
        ,Data_Etl_Date                                 --数据加载日期
        ,Data_Upt_Date                                 --数据更新日期
        ,Data_Time                                     --数据时间
        ,Real_Src_Tbl                                  --真实源表
        ,Src_Tbl                                       --源表
      FROM T10_AST_INFO
      WHERE DATA_ETL_DATE !='${data_day_str}' 
        AND SRC_TBL = 'ODATA_N_FAM.W_ASSET_ACCOUNT'
    ;

set hive.merge.mapfiles = true ;
    set hive.merge.mapredfiles = true;
    set hive.merge.size.per.task=1073741824;
    set hive.merge.smallfiles.avgsize=1073741824;
    set hive.merge.orcfile.stripe.level=false;
    set hive.exec.dynamic.partition=true;
    set hive.exec.dynamic.partition.mode=nonstrict;
    set hive.exec.max.created.files=10000;
    set hive.exec.max.dynamic.partitions.pernode=10000;
    set hive.exec.max.dynamic.partitions=10000;
    set hive.auto.convert.join=false;
    
    INSERT OVERWRITE TABLE T10_AST_INFO PARTITION(SRC_TBL)
    SELECT
         Ast_Id                                        --资产编号
        ,Ast_Name                                      --资产名称
        ,Ast_Cate_Cd                                   --资产类别代码
        ,Ast_Proprt_Type_Cd                            --资产权属类型代码
        ,Proprt_Prsn_Id                                --权属人编号
        ,Ast_Lbl                                       --资产标签
        ,Ast_Type_Cd                                   --资产类型代码
        ,Ast_Stat_Cd                                   --资产状态代码
        ,Ast_Get_Method_Cd                             --资产取得方式代码
        ,Ast_Prop_Cd                                   --资产属性代码
        ,Main_Ast_Flag                                 --主资产标志
        ,Crrc_Cd                                       --币种代码
        ,Vld_Date                                      --有效日期
        ,Exp_Date                                      --到期日期
        ,Stki_Time                                     --入库时间
        ,Stki_Prop_Cd                                  --入库性质代码
        ,Ast_Use_Life                                  --资产使用年限
        ,Use_Strt_Time                                 --使用开始时间
        ,Ast_Lock_Rsn_Cd                               --资产锁定原因代码
        ,Depr_Flag                                     --折旧标志
        ,Remark                                        --备注
        ,'0'                     AS Del_Flag           --删除标志
        ,''                      AS Del_Date           --删除日期
        ,Data_Src_Cd                                   --数据来源代码
        ,Task_Name                                     --任务名
        ,Data_Etl_Date                                 --数据加载日期
        ,Data_Upt_Date                                 --数据更新日期
        ,Data_Time                                     --数据时间
        ,Real_Src_Tbl                                  --真实源表
        ,Src_Tbl                                       --源表
    FROM ${DB_TEMP}.T10_AST_INFO_MID_FAM001 WHERE DATA_TYPE='S'  --插入无变化的数据
    UNION ALL
    SELECT
         Ast_Id1                                      AS Ast_Id                   --资产编号
        ,Ast_Name1                                    AS Ast_Name                 --资产名称
        ,Ast_Cate_Cd1                                 AS Ast_Cate_Cd              --资产类别代码
        ,Ast_Proprt_Type_Cd1                          AS Ast_Proprt_Type_Cd       --资产权属类型代码
        ,Proprt_Prsn_Id1                              AS Proprt_Prsn_Id           --权属人编号
        ,Ast_Lbl1                                     AS Ast_Lbl                  --资产标签
        ,Ast_Type_Cd1                                 AS Ast_Type_Cd              --资产类型代码
        ,Ast_Stat_Cd1                                 AS Ast_Stat_Cd              --资产状态代码
        ,Ast_Get_Method_Cd1                           AS Ast_Get_Method_Cd        --资产取得方式代码
        ,Ast_Prop_Cd1                                 AS Ast_Prop_Cd              --资产属性代码
        ,Main_Ast_Flag1                               AS Main_Ast_Flag            --主资产标志
        ,Crrc_Cd1                                     AS Crrc_Cd                  --币种代码
        ,Vld_Date1                                    AS Vld_Date                 --有效日期
        ,Exp_Date1                                    AS Exp_Date                 --到期日期
        ,Stki_Time1                                   AS Stki_Time                --入库时间
        ,Stki_Prop_Cd1                                AS Stki_Prop_Cd             --入库性质代码
        ,Ast_Use_Life1                                AS Ast_Use_Life             --资产使用年限
        ,Use_Strt_Time1                               AS Use_Strt_Time            --使用开始时间
        ,Ast_Lock_Rsn_Cd1                             AS Ast_Lock_Rsn_Cd          --资产锁定原因代码
        ,Depr_Flag1                                   AS Depr_Flag                --折旧标志
        ,Remark1                                      AS Remark                   --备注
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   AS Task_Name                --任务名
        ,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'${data_today}'                         AS Data_Time                --数据时间
        ,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM ${DB_TEMP}.T10_AST_INFO_MID_FAM001  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
    UNION ALL
    SELECT
         Ast_Id1                                      AS Ast_Id                   --资产编号
        ,Ast_Name1                                    AS Ast_Name                 --资产名称
        ,Ast_Cate_Cd1                                 AS Ast_Cate_Cd              --资产类别代码
        ,Ast_Proprt_Type_Cd1                          AS Ast_Proprt_Type_Cd       --资产权属类型代码
        ,Proprt_Prsn_Id1                              AS Proprt_Prsn_Id           --权属人编号
        ,Ast_Lbl1                                     AS Ast_Lbl                  --资产标签
        ,Ast_Type_Cd1                                 AS Ast_Type_Cd              --资产类型代码
        ,Ast_Stat_Cd1                                 AS Ast_Stat_Cd              --资产状态代码
        ,Ast_Get_Method_Cd1                           AS Ast_Get_Method_Cd        --资产取得方式代码
        ,Ast_Prop_Cd1                                 AS Ast_Prop_Cd              --资产属性代码
        ,Main_Ast_Flag1                               AS Main_Ast_Flag            --主资产标志
        ,Crrc_Cd1                                     AS Crrc_Cd                  --币种代码
        ,Vld_Date1                                    AS Vld_Date                 --有效日期
        ,Exp_Date1                                    AS Exp_Date                 --到期日期
        ,Stki_Time1                                   AS Stki_Time                --入库时间
        ,Stki_Prop_Cd1                                AS Stki_Prop_Cd             --入库性质代码
        ,Ast_Use_Life1                                AS Ast_Use_Life             --资产使用年限
        ,Use_Strt_Time1                               AS Use_Strt_Time            --使用开始时间
        ,Ast_Lock_Rsn_Cd1                             AS Ast_Lock_Rsn_Cd          --资产锁定原因代码
        ,Depr_Flag1                                   AS Depr_Flag                --折旧标志
        ,Remark1                                      AS Remark                   --备注
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   As Task_Name                --任务名
        ,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'${data_today}'                         AS Data_Time                --数据时间
        ,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM ${DB_TEMP}.T10_AST_INFO_MID_FAM001  WHERE DATA_TYPE='I'   --插入新增的数据
    UNION ALL
    SELECT
         Ast_Id                                                  --资产编号
        ,Ast_Name                                                --资产名称
        ,Ast_Cate_Cd                                             --资产类别代码
        ,Ast_Proprt_Type_Cd                                      --资产权属类型代码
        ,Proprt_Prsn_Id                                          --权属人编号
        ,Ast_Lbl                                                 --资产标签
        ,Ast_Type_Cd                                             --资产类型代码
        ,Ast_Stat_Cd                                             --资产状态代码
        ,Ast_Get_Method_Cd                                       --资产取得方式代码
        ,Ast_Prop_Cd                                             --资产属性代码
        ,Main_Ast_Flag                                           --主资产标志
        ,Crrc_Cd                                                 --币种代码
        ,Vld_Date                                                --有效日期
        ,Exp_Date                                                --到期日期
        ,Stki_Time                                               --入库时间
        ,Stki_Prop_Cd                                            --入库性质代码
        ,Ast_Use_Life                                            --资产使用年限
        ,Use_Strt_Time                                           --使用开始时间
        ,Ast_Lock_Rsn_Cd                                         --资产锁定原因代码
        ,Depr_Flag                                               --折旧标志
        ,Remark                                                  --备注
        ,'1'                              AS Del_Flag            --删除标志
        ,CASE WHEN Del_Date !=''
                THEN Del_Date
              ELSE '${data_day_str}'
              END                         AS Del_Date            --删除日期
        ,Data_Src_Cd                                            --数据来源代码
        ,Task_Name                                              --任务名
        ,Data_Etl_Date                                          --数据加载日期
        ,CASE WHEN Del_Date !=''
              THEN Data_Upt_Date
              ELSE '${data_day_str}'
             END                         AS Data_Upt_Date       --数据更新日期
        ,CASE WHEN Del_Date !=''
               THEN Data_Time
             ELSE '${data_today}'
             END                         AS Data_Time           --数据时间
        ,Real_Src_Tbl                                            --真实源表
        ,Src_Tbl                                                 --源表
    FROM ${DB_TEMP}.T10_AST_INFO_MID_FAM001 WHERE DATA_TYPE='D'  --插入删除的数据
    ;
