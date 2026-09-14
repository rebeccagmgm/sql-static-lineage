-- task_id: 212663
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_OTC_DOC_ATTACH_ADTNL_INFO_OIS050.py
-- observed_at: 2026-09-05T01:07:22.717Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_OTC_DOC_ATTACH_ADTNL_INFO(
         Attach_Id                  STRING COMMENT '附件编号'
        ,Src_Comp_Id                STRING COMMENT '源合约编号'
        ,Src_Cust_Id                STRING COMMENT '源客户编号'
        ,Pty_Id                     STRING COMMENT '当事人编号'
        ,Ori_File_Name              STRING COMMENT '原文件名'
        ,Retu_Rslt                  STRING COMMENT '返回结果'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT 'OTC档案附件附加信息'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_OTC_DOC_ATTACH_ADTNL_INFO PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group1: Source Table:[ODATA_N_OOM.G_AMAZONS3_FILE_INFO:S3附件信息表] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         A.ID                                  AS  Attach_Id               --附件编号                 
        ,A.CONTRACT_ID                         AS  Src_Comp_Id             --源合约编号                
        ,A.CUSTPTY_ID                          AS  Src_Cust_Id             --源客户编号   
        ,B.CLIENT_ID                           AS  Pty_Id                  --当事人编号            
        ,A.FILE_NAME                           AS  Ori_File_Name           --原文件名                 
        ,A.RETURN_RESULT                       AS  Retu_Rslt               --返回结果                 
        ,'OIS'                                 AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                    AS  Task_Name               --任务名
        ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                  AS  Data_Time               --数据时间
        ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
    LEFT JOIN (SELECT * FROM ODATA_N_OIS.G_HK_COUNTERPARTY WHERE BUSI_DATE ='${data_day_str}') B
           ON A.CUSTPTY_ID=B.ID
    ;
