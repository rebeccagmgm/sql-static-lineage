-- task_id: 98511
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/PTY/PDATA_N.T01_PTY_IDTY_INFO_RMS049.py
-- observed_at: 2026-09-05T01:06:41.977Z

-- createSql
CREATE TABLE IF NOT EXISTS T01_PTY_IDTY_INFO(
     Pty_Id                     STRING COMMENT '当事人编号'
    ,Idty_Info_Type_Cd          STRING COMMENT '鉴别信息类型代码'
    ,Pty_Cate_Cd                STRING COMMENT '当事人类别代码'
    ,Idty_Info_Cont             STRING COMMENT '鉴别信息内容'
    ,Idty_Info_Addr             STRING COMMENT '鉴别信息地址'
    ,Idty_Info_Iss_Addr         STRING COMMENT '鉴别信息签发地'
    ,Idty_Info_Iss_Org          STRING COMMENT '鉴别信息签发机构'
    ,Idty_Info_Iss_Date         STRING COMMENT '鉴别信息签发日期'
    ,Idty_Info_Exp_Date         STRING COMMENT '鉴别信息到期日期'
    ,Idty_Info_Insp_Annu_Date   STRING COMMENT '鉴别信息年检日期'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '当事人鉴别信息'
PARTITIONED BY (BUSI_DATE  STRING COMMENT '业务日期',SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T01_PTY_IDTY_INFO PARTITION(BUSI_DATE='${data_day_str}',SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group48: Source Table:[ODATA_N_RMS.N_EXPERT_INFO:专家信息表] 
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('RMS049-',ID)                              AS  Pty_Id                  --当事人编号
    ,NVL(DW_CD_VAL,CERT_TYPE)                          AS  Idty_Info_Type_Cd       --鉴别信息类型代码 
    ,'190301'                                          AS  Pty_Cate_Cd             --当事人类别代码 
    ,CERT_ID                                           AS  Idty_Info_Cont          --鉴别信息内容    
    ,''                                                AS  Idty_Info_Addr          --鉴别信息地址    
    ,''                                                AS  Idty_Info_Iss_Addr      --鉴别信息签发地  
    ,''                                                AS  Idty_Info_Iss_Org       --鉴别信息签发机构
    ,''                                                AS  Idty_Info_Iss_Date      --鉴别信息签发日期
    ,''                                                AS  Idty_Info_Exp_Date      --鉴别信息到期日期
    ,''                                                AS  Idty_Info_Insp_Annu_Date--鉴别信息年检日期
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
FROM   (SELECT *  FROM ODATA_N_RMS.N_EXPERT_INFO WHERE  BUSI_DATE='${data_day_str}' AND NOT(TELECONFERENCE_ID='0' and OFFLINE_EXPERT_ID='0') AND REMOVE_TAG='0' )A
LEFT JOIN (
         SELECT SRC_CD_VAL,DW_CD_VAL
           FROM PDATA_N.REF_CD_CVT_MAP
         WHERE TGT_TAB_NAME = 'T07_PROM_EPRT_INFO'
            AND TGT_TAB_FLD  = 'Cert_Type_Cd'
            AND SRC_TAB_NAME = 'EXPERT_INFO'
            AND SRC_FLD_NAME = 'CERT_TYPE'
            AND SRC_SYS_NAME='RMS')B
   ON      A.CERT_TYPE =B.SRC_CD_VAL                  --CERT_TYPE 转码
;
