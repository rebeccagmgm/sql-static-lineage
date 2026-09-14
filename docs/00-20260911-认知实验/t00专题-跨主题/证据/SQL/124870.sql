-- task_id: 124870
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_TIT_S3_ATTACH_INFO_TIT221.py
-- observed_at: 2026-09-05T01:06:50.173Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_TIT_S3_ATTACH_INFO(
     Busi_Id                    STRING COMMENT '业务编号'
    ,Src_File_Type              STRING COMMENT '源文件类型'
    ,Bkt_Name                   STRING COMMENT '桶名'
    ,File_Path                  STRING COMMENT '文件路径'
    ,Real_File_Name             STRING COMMENT '真实文件名'
    ,Src_Data_Src               STRING COMMENT '源数据来源'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '自营投管S3附件信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_TIT_S3_ATTACH_INFO PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_TIT.D_AMAZONS3_FILE_INFO:S3附件信息表] 
-----------------------------------------------------------------------------------------------------
SELECT
     BUSI_ID                               AS  Busi_Id                 --业务编号    
    ,FILE_TYPE                             AS  Src_File_Type           --源文件类型  
    ,BUCKET_NAME                           AS  Bkt_Name                --桶名        
    ,FILE_PATH                             AS  File_Path               --文件路径    
    ,REAL_FILE_NAME                        AS  Real_File_Name          --真实文件名  
    ,DATA_SOURCE                           AS  Src_Data_Src            --源数据来源  
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;
