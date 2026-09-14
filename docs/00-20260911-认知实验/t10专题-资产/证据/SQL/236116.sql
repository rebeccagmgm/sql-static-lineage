-- task_id: 236116
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/AST/PDATA_N.T10_AST_LKMAN_H_FAM001.py
-- observed_at: 2026-09-05T01:07:29.190Z

-- createSql
CREATE TABLE IF NOT EXISTS T10_AST_LKMAN_H(
         Ast_Id                     STRING COMMENT '资产编号'
        ,Lkman_Type_Cd              STRING COMMENT '联系人类型代码'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Lkman_Shor_Name            STRING COMMENT '联系人简称'
        ,Lkman_Full_Name            STRING COMMENT '联系人全称'
        ,Cont_Addr                  STRING COMMENT '联系地址'
        ,Zip_Cd                     STRING COMMENT '联系邮编'
        ,Cont_Phone                 STRING COMMENT '联系电话'
        ,Cont_Mobile                STRING COMMENT '联系手机'
        ,Cont_Email                 STRING COMMENT '联系邮箱'
        ,Lkman_Co_Name              STRING COMMENT '联系人工作单位名称'
        ,Lkman_Post_Name            STRING COMMENT '联系人职位名称'
        ,Remark                     STRING COMMENT '备注'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '资产重要联系人历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T10_AST_LKMAN_H_TEMP_FAM001;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T10_AST_LKMAN_H_TEMP_FAM001
    AS
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_FAM.W_ASSET_ACCOUNT：资产台账]
    -----------------------------------------------------------------------------------------------------
    SELECT
         ASSET_TAG_NO                            AS  Ast_Id1                 --资产编号                     
        ,'61'                                    AS  Lkman_Type_Cd1          --联系人类型代码                  '61'--租借使用人
        ,USE_PERSON                              AS  Lkman_Shor_Name1        --联系人简称        
        ,USE_PERSON                              AS  Lkman_Full_Name1        --联系人全称        
        ,''                                      AS  Cont_Addr1              --联系地址          
        ,''                                      AS  Zip_Cd1                 --联系邮编          
        ,PHONE                                   AS  Cont_Phone1             --联系电话          
        ,''                                      AS  Cont_Mobile1            --联系手机          
        ,''                                      AS  Cont_Email1             --联系邮箱          
        ,USE_UNIT                                AS  Lkman_Co_Name1          --联系人工作单位名称
        ,''                                      AS  Lkman_Post_Name1        --联系人职位名称    
        ,''                                      AS  Remark1                 --备注              
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
        ,'${src_table}'                     AS  Real_Src_Tbl1           --真实源表
    FROM (SELECT * FROM ODATA_N_FAM.W_ASSET_ACCOUNT WHERE BUSI_DATE ='${data_day_str}') A
    ;

DROP TABLE IF EXISTS ${db_temp}.T10_AST_LKMAN_H_MID_FAM001;
    CREATE TABLE ${db_temp}.T10_AST_LKMAN_H_MID_FAM001
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.Ast_Id IS NULL     AND B.Ast_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NOT NULL AND
                 (   COALESCE(A.Lkman_Shor_Name         ,'')   <> COALESCE(B.Lkman_Shor_Name1        ,'')
                  OR COALESCE(A.Lkman_Full_Name         ,'')   <> COALESCE(B.Lkman_Full_Name1        ,'')
                  OR COALESCE(A.Cont_Addr               ,'')   <> COALESCE(B.Cont_Addr1              ,'')
                  OR COALESCE(A.Zip_Cd                  ,'')   <> COALESCE(B.Zip_Cd1                 ,'')
                  OR COALESCE(A.Cont_Phone              ,'')   <> COALESCE(B.Cont_Phone1             ,'')
                  OR COALESCE(A.Cont_Mobile             ,'')   <> COALESCE(B.Cont_Mobile1            ,'')
                  OR COALESCE(A.Cont_Email              ,'')   <> COALESCE(B.Cont_Email1             ,'')
                  OR COALESCE(A.Lkman_Co_Name           ,'')   <> COALESCE(B.Lkman_Co_Name1          ,'')
                  OR COALESCE(A.Lkman_Post_Name         ,'')   <> COALESCE(B.Lkman_Post_Name1        ,'')
                  OR COALESCE(A.Remark                  ,'')   <> COALESCE(B.Remark1                 ,'')
             ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T10_AST_LKMAN_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T10_AST_LKMAN_H_TEMP_FAM001 B               --当天的数据
    ON   A.Ast_Id= B.Ast_Id1
    AND  A.Lkman_Type_Cd= B.Lkman_Type_Cd1
    ;

-- querySql
INSERT OVERWRITE TABLE T10_AST_LKMAN_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT 
         DISTINCT
         Ast_Id                                --资产编号
        ,Lkman_Type_Cd                         --联系人类型代码
        ,Strt_Date                             --开始日期
        ,Lkman_Shor_Name                       --联系人简称
        ,Lkman_Full_Name                       --联系人全称
        ,Cont_Addr                             --联系地址
        ,Zip_Cd                                --联系邮编
        ,Cont_Phone                            --联系电话
        ,Cont_Mobile                           --联系手机
        ,Cont_Email                            --联系邮箱
        ,Lkman_Co_Name                         --联系人工作单位名称
        ,Lkman_Post_Name                       --联系人职位名称
        ,Remark                                --备注
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM (
    SELECT
         Ast_Id                                --资产编号
        ,Lkman_Type_Cd                         --联系人类型代码
        ,Strt_Date                             --开始日期
        ,Lkman_Shor_Name                       --联系人简称
        ,Lkman_Full_Name                       --联系人全称
        ,Cont_Addr                             --联系地址
        ,Zip_Cd                                --联系邮编
        ,Cont_Phone                            --联系电话
        ,Cont_Mobile                           --联系手机
        ,Cont_Email                            --联系邮箱
        ,Lkman_Co_Name                         --联系人工作单位名称
        ,Lkman_Post_Name                       --联系人职位名称
        ,Remark                                --备注
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T10_AST_LKMAN_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         Ast_Id                                --资产编号
        ,Lkman_Type_Cd                         --联系人类型代码
        ,Strt_Date                             --开始日期
        ,Lkman_Shor_Name                       --联系人简称
        ,Lkman_Full_Name                       --联系人全称
        ,Cont_Addr                             --联系地址
        ,Zip_Cd                                --联系邮编
        ,Cont_Phone                            --联系电话
        ,Cont_Mobile                           --联系手机
        ,Cont_Email                            --联系邮箱
        ,Lkman_Co_Name                         --联系人工作单位名称
        ,Lkman_Post_Name                       --联系人职位名称
        ,Remark                                --备注
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Real_Src_Tbl                          --真实源表
        ,Src_Tbl                               --源表
    FROM T10_AST_LKMAN_H
    WHERE  END_DATE ='${data_day_str}'
      AND  SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
      ) T
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
    
    INSERT OVERWRITE TABLE T10_AST_LKMAN_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         Ast_Id                                                     --资产编号
        ,Lkman_Type_Cd                                              --联系人类型代码
        ,Strt_Date                                                  --开始日期
        ,Lkman_Shor_Name                                            --联系人简称
        ,Lkman_Full_Name                                            --联系人全称
        ,Cont_Addr                                                  --联系地址
        ,Zip_Cd                                                     --联系邮编
        ,Cont_Phone                                                 --联系电话
        ,Cont_Mobile                                                --联系手机
        ,Cont_Email                                                 --联系邮箱
        ,Lkman_Co_Name                                              --联系人工作单位名称
        ,Lkman_Post_Name                                            --联系人职位名称
        ,Remark                                                     --备注
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM T10_AST_LKMAN_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         Ast_Id1                        AS  Ast_Id                  --资产编号
        ,Lkman_Type_Cd1                 AS  Lkman_Type_Cd           --联系人类型代码
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Lkman_Shor_Name1               AS  Lkman_Shor_Name         --联系人简称
        ,Lkman_Full_Name1               AS  Lkman_Full_Name         --联系人全称
        ,Cont_Addr1                     AS  Cont_Addr               --联系地址
        ,Zip_Cd1                        AS  Zip_Cd                  --联系邮编
        ,Cont_Phone1                    AS  Cont_Phone              --联系电话
        ,Cont_Mobile1                   AS  Cont_Mobile             --联系手机
        ,Cont_Email1                    AS  Cont_Email              --联系邮箱
        ,Lkman_Co_Name1                 AS  Lkman_Co_Name           --联系人工作单位名称
        ,Lkman_Post_Name1               AS  Lkman_Post_Name         --联系人职位名称
        ,Remark1                        AS  Remark                  --备注
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T10_AST_LKMAN_H_MID_FAM001 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         Ast_Id                                                     --资产编号
        ,Lkman_Type_Cd                                              --联系人类型代码
        ,Strt_Date                                                  --开始日期
        ,Lkman_Shor_Name                                            --联系人简称
        ,Lkman_Full_Name                                            --联系人全称
        ,Cont_Addr                                                  --联系地址
        ,Zip_Cd                                                     --联系邮编
        ,Cont_Phone                                                 --联系电话
        ,Cont_Mobile                                                --联系手机
        ,Cont_Email                                                 --联系邮箱
        ,Lkman_Co_Name                                              --联系人工作单位名称
        ,Lkman_Post_Name                                            --联系人职位名称
        ,Remark                                                     --备注
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T10_AST_LKMAN_H_MID_FAM001 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         Ast_Id                                                     --资产编号
        ,Lkman_Type_Cd                                              --联系人类型代码
        ,Strt_Date                                                  --开始日期
        ,Lkman_Shor_Name                                            --联系人简称
        ,Lkman_Full_Name                                            --联系人全称
        ,Cont_Addr                                                  --联系地址
        ,Zip_Cd                                                     --联系邮编
        ,Cont_Phone                                                 --联系电话
        ,Cont_Mobile                                                --联系手机
        ,Cont_Email                                                 --联系邮箱
        ,Lkman_Co_Name                                              --联系人工作单位名称
        ,Lkman_Post_Name                                            --联系人职位名称
        ,Remark                                                     --备注
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Real_Src_Tbl                                               --真实源表
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T10_AST_LKMAN_H_MID_FAM001 WHERE DATA_TYPE ='S'         --无变更-S
    ;
