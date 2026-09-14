-- task_id: 173964
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_DOC_ATTACH_INFO_TIT221.py
-- observed_at: 2026-09-05T01:07:10.114Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_DOC_ATTACH_INFO(
         Doc_Id                     STRING COMMENT '档案编号'
        ,Doc_Type_Cd                STRING COMMENT '档案类型代码'
        ,Attach_Id                  STRING COMMENT '附件编号'
        ,Src_File_Type              STRING COMMENT '源文件类型'
        ,Bkt_Name                   STRING COMMENT '桶名'
        ,File_Path                  STRING COMMENT '文件路径'
        ,File_Name                  STRING COMMENT '文件名'
        ,File_Size                  STRING COMMENT '文件大小'
        ,Src_Date_Src               STRING COMMENT '源数据来源'
        ,Create_User_Id             STRING COMMENT '创建人用户编号'
        ,Create_Time                STRING COMMENT '创建时间'
        ,Del_Flag                   STRING COMMENT '删除标志'
        ,Del_Date                   STRING COMMENT '删除日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
        ,Busi_Id                    STRING COMMENT '业务编号'
        ,File_Cont_Md5              STRING COMMENT '文件内容md5码'
        ,File_Rank                  STRING COMMENT '文件排序'
        ,File_Title                 STRING COMMENT '文件标题'
    )COMMENT '档案附件信息'
    PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_DOC_ATTACH_INFO PARTITION(SRC_TBL)
    SELECT
         ''                                       AS  Doc_Id                  --档案编号      
        ,'08'                                     AS  Doc_Type_Cd             --档案类型代码  
        ,''                                       AS  Attach_Id               --附件编号      
        ,FILE_TYPE                                AS  Src_File_Type           --源文件类型    
        ,BUCKET_NAME                              AS  Bkt_Name                --桶名          
        ,FILE_PATH                                AS  File_Path               --文件路径      
        ,REAL_FILE_NAME                           AS  File_Name               --文件名        
        ,''                                       AS  File_Size               --文件大小      
        ,DATA_SOURCE                              AS  Src_Date_Src            --源数据来源    
        ,''                                       AS  Create_User_Id          --创建人用户编号
        ,''                                       AS  Create_Time             --创建时间      
        ,'0'                                      AS  Del_Flag                --删除标志
        ,''                                       AS  Del_Date                --删除日期
        ,'${data_src_cd}'                    AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                       AS  Task_Name               --任务名
        ,'${data_day_str}'                   AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                   AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                     AS  Data_Time               --数据时间
        ,'${src_table}'                      AS  Real_Src_Tbl            --真实源表
        ,BUSI_ID                                  AS  Busi_Id                 --业务编号
        ,''                                       AS  File_Cont_Md5           --文件内容md5码
        ,''                                       AS  File_Rank               --文件排序
        ,''                                       AS  File_Title              --文件标题
        ,'${src_table}'                      AS  Src_Tbl                 --源表
    FROM  (SELECT * FROM ${src_table}  WHERE BUSI_DATE='${data_day_str}' )A
    ;
