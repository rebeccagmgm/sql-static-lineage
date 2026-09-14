-- task_id: 143527
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_API_APP_RELA_H_BDP058.py
-- observed_at: 2026-09-05T01:06:57.574Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_API_APP_RELA_H(
         App_Id                     STRING COMMENT '应用编号'
        ,Api_Id                     STRING COMMENT 'API编号'
        ,Strt_Date                  STRING COMMENT '开始日期'
        ,Auth_Time                  STRING COMMENT '授权时间'
        ,Auth_Stat                  STRING COMMENT '授权状态'
        ,Auth_Way                   STRING COMMENT '授权方式'
        ,Remark                     STRING COMMENT '备注'
        ,Creator_User_Id            STRING COMMENT '创建人用户编号'
        ,Modif_User_Id              STRING COMMENT '修改人用户编号'
        ,End_Date                   STRING COMMENT '结束日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Time                  STRING COMMENT '数据时间'
    )COMMENT 'API应用关系历史'
    PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${db_temp}.T00_API_APP_RELA_H_TEMP_BDP058;
    CREATE TABLE IF NOT EXISTS ${db_temp}.T00_API_APP_RELA_H_TEMP_BDP058
    AS
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_BDP.N_GW_APP_API：APP与API的关联关系表]
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('BDP057-',A.APP_ID)              AS  App_Id1                 --应用编号         
        ,CONCAT('BDP055-',B.Api_Id)
                                                 AS  Api_Id1                 --API编号          
        ,A.AUTHORIZED_TIME                       AS  Auth_Time1              --授权时间         
        ,A.AUTH_STATUS                           AS  Auth_Stat1              --授权状态         
        ,A.AUTH_FROM                             AS  Auth_Way1               --授权方式         
        ,A.REMARKS                               AS  Remark1                 --备注             
       --,CREATE_BY                              AS  Creator_User_Id1        --创建人用户编号                 先留空，用户主数据待入仓
       --,UPDATE_BY                              AS  Modif_User_Id1          --修改人用户编号                 先留空，用户主数据待入仓
        ,''                                      AS  Creator_User_Id1        --创建人用户编号                
        ,''                                      AS  Modif_User_Id1          --修改人用户编号                
        ,'${data_src_cd}'                   AS  Data_Src_Cd1            --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl1                --源表
        ,'${filename}'                      AS  Task_Name1              --任务名
    FROM (SELECT *FROM ODATA_N_BDP.N_GW_APP_API WHERE BUSI_DATE ='${data_day_str}') A
    INNER JOIN(SELECT *  FROM ODATA_N_BDP.N_DS_API_BASE_INFO WHERE  BUSI_DATE='${data_day_str}' AND IS_VERSION_ACTIVE='Y')B
           ON A.API_ID=B.API_CODE
    ;

DROP TABLE IF EXISTS ${db_temp}.T00_API_APP_RELA_H_MID_BDP058;
    CREATE TABLE ${db_temp}.T00_API_APP_RELA_H_MID_BDP058
    AS
    SELECT
           A.*,B.*
           ,CASE WHEN A.App_Id IS NULL     AND B.App_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
                 WHEN A.App_Id IS NOT NULL AND B.App_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
                 WHEN A.App_Id IS NOT NULL AND B.App_Id1 IS NOT NULL AND
                 (   COALESCE(A.Auth_Time               ,'')   <> COALESCE(B.Auth_Time1              ,'')
                  OR COALESCE(A.Auth_Stat               ,'')   <> COALESCE(B.Auth_Stat1              ,'')
                  OR COALESCE(A.Auth_Way                ,'')   <> COALESCE(B.Auth_Way1               ,'')
                  OR COALESCE(A.Remark                  ,'')   <> COALESCE(B.Remark1                 ,'')
                  OR COALESCE(A.Creator_User_Id         ,'')   <> COALESCE(B.Creator_User_Id1        ,'')
                  OR COALESCE(A.Modif_User_Id           ,'')   <> COALESCE(B.Modif_User_Id1          ,'')
                 ) THEN 'U'                                                        --当天和历史均存在,除主键外如有字段变更为变更
                 ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
    FROM   (  SELECT
                *
              FROM  T00_API_APP_RELA_H
              WHERE STRT_DATE <='${data_day_str}'
                AND END_DATE  > '${data_day_str}'
                AND SRC_TBL IN ('ODATA_N_BDP.N_GW_APP_API')  )A   --历史(昨日)开链数据
    FULL OUTER JOIN ${db_temp}.T00_API_APP_RELA_H_TEMP_BDP058 B               --当天的数据
    ON   A.App_Id= B.App_Id1
    AND  A.Api_Id= B.Api_Id1
    ;

-- querySql
INSERT OVERWRITE TABLE T00_API_APP_RELA_H PARTITION(SRC_TBL)
     --剔除掉源表当日新增和当日闭链的数据
    SELECT
         App_Id                                --应用编号
        ,Api_Id                                --API编号
        ,Strt_Date                             --开始日期
        ,Auth_Time                             --授权时间
        ,Auth_Stat                             --授权状态
        ,Auth_Way                              --授权方式
        ,Remark                                --备注
        ,Creator_User_Id                       --创建人用户编号
        ,Modif_User_Id                         --修改人用户编号
        ,End_Date                              --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Src_Tbl                               --源表
    FROM T00_API_APP_RELA_H
    WHERE STRT_DATE !='${data_day_str}'
      AND END_DATE  !='${data_day_str}'
      AND SRC_TBL IN ('ODATA_N_BDP.N_GW_APP_API')
    UNION ALL
     --目标表为源表当日闭链的数据还原
    SELECT
         App_Id                                --应用编号
        ,Api_Id                                --API编号
        ,Strt_Date                             --开始日期
        ,Auth_Time                             --授权时间
        ,Auth_Stat                             --授权状态
        ,Auth_Way                              --授权方式
        ,Remark                                --备注
        ,Creator_User_Id                       --创建人用户编号
        ,Modif_User_Id                         --修改人用户编号
        ,'2099-12-31'  AS End_Date             --结束日期
        ,Data_Src_Cd                           --数据来源代码
        ,Task_Name                             --任务名
        ,Data_Time                             --数据时间
        ,Src_Tbl                               --源表
    FROM T00_API_APP_RELA_H
    WHERE  END_DATE ='${data_day_str}'
      AND  SRC_TBL IN ('ODATA_N_BDP.N_GW_APP_API')
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
    
    INSERT OVERWRITE TABLE T00_API_APP_RELA_H PARTITION(SRC_TBL)
      --历史闭链的无效数据插回目标表
    SELECT
         App_Id                                                     --应用编号
        ,Api_Id                                                     --API编号
        ,Strt_Date                                                  --开始日期
        ,Auth_Time                                                  --授权时间
        ,Auth_Stat                                                  --授权状态
        ,Auth_Way                                                   --授权方式
        ,Remark                                                     --备注
        ,Creator_User_Id                                            --创建人用户编号
        ,Modif_User_Id                                              --修改人用户编号
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Src_Tbl                                                    --源表
    FROM T00_API_APP_RELA_H
    WHERE NOT(    STRT_DATE <='${data_day_str}'
              AND END_DATE  > '${data_day_str}'   )
      AND SRC_TBL IN ('ODATA_N_BDP.N_GW_APP_API')  --只插入目标表分区字段为该表的数据
    UNION ALL
     --当天有变动和新增的数据开链
    SELECT   
         App_Id1                        AS  App_Id                  --应用编号
        ,Api_Id1                        AS  Api_Id                  --API编号
        ,'${data_day_str}'         AS  Strt_Date               --开始日期
        ,Auth_Time1                     AS  Auth_Time               --授权时间
        ,Auth_Stat1                     AS  Auth_Stat               --授权状态
        ,Auth_Way1                      AS  Auth_Way                --授权方式
        ,Remark1                        AS  Remark                  --备注
        ,Creator_User_Id1               AS  Creator_User_Id         --创建人用户编号
        ,Modif_User_Id1                 AS  Modif_User_Id           --修改人用户编号
        ,'2099-12-31'                   AS  End_Date                --结束日期
        ,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
        ,Task_Name1                     AS  Task_Name               --任务名
        ,'${data_today}'           AS  Data_Time               --数据时间
        ,Src_Tbl1                       AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_API_APP_RELA_H_MID_BDP058 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
    UNION ALL
     --历史开链有变动和不存在当天的数据闭链
    SELECT
         App_Id                                                     --应用编号
        ,Api_Id                                                     --API编号
        ,Strt_Date                                                  --开始日期
        ,Auth_Time                                                  --授权时间
        ,Auth_Stat                                                  --授权状态
        ,Auth_Way                                                   --授权方式
        ,Remark                                                     --备注
        ,Creator_User_Id                                            --创建人用户编号
        ,Modif_User_Id                                              --修改人用户编号
        ,'${data_day_str}'         AS  End_Date                --结束日期
        ,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
        ,Task_Name                      AS  Task_Name               --任务名
       ,'${data_today}'            AS  Data_Time               --数据时间
        ,Src_Tbl                        AS  Src_Tbl                 --源表
    FROM ${db_temp}.T00_API_APP_RELA_H_MID_BDP058 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
    UNION ALL
     --无变动的数据插回目标表
    SELECT
         App_Id                                                     --应用编号
        ,Api_Id                                                     --API编号
        ,Strt_Date                                                  --开始日期
        ,Auth_Time                                                  --授权时间
        ,Auth_Stat                                                  --授权状态
        ,Auth_Way                                                   --授权方式
        ,Remark                                                     --备注
        ,Creator_User_Id                                            --创建人用户编号
        ,Modif_User_Id                                              --修改人用户编号
        ,End_Date                                                   --结束日期
        ,Data_Src_Cd                                                --数据来源代码
        ,Task_Name                                                  --任务名
        ,Data_Time                                                  --数据时间
        ,Src_Tbl                                                    --源表
    FROM ${db_temp}.T00_API_APP_RELA_H_MID_BDP058 WHERE DATA_TYPE ='S'         --无变更-S
    ;
