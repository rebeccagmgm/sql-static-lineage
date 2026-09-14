-- task_id: 227850
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_RMS_EMP_FORE_SCOR_UPLD_EVT_RMS146.py
-- observed_at: 2026-09-05T01:07:27.471Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_RMS_EMP_FORE_SCOR_UPLD_EVT(
      Evt_Id                     STRING COMMENT '事件编号'
     ,Scor_Year                  STRING COMMENT '派点年份'
     ,Scor_Qtr                   STRING COMMENT '派点季度'
     ,Cust_Pty_Id                STRING COMMENT '客户当事人编号'
     ,Src_Scor_Subm_Prsn_Id      STRING COMMENT '源派点提交人编号'
     ,Scor_Subm_Prsn_Emp_Id      STRING COMMENT '派点提交人员工编号'
     ,Scor_Subm_Prsn_Name        STRING COMMENT '派点提交人名称'
     ,Scor_Proc_Stat_Cd          STRING COMMENT '派点流程状态代码'
     ,Scor_Det_Upld_Flag         STRING COMMENT '派点明细上传标志'
     ,Bat_Id                     STRING COMMENT '批次编号'
     ,Remark                     STRING COMMENT '备注'
     ,Del_Flag                   STRING COMMENT '删除标志'
     ,Estb_Time                  STRING COMMENT '创建时间'
     ,Modif_Time                 STRING COMMENT '修改时间'
     ,Rms_Org_Cust_Lvl_Cd        STRING COMMENT '投研机构客户等级代码'
     ,Data_Src_Cd                STRING COMMENT '数据来源代码'
     ,Task_Name                  STRING COMMENT '任务名'
     ,Data_Etl_Date              STRING COMMENT '数据加载日期'
     ,Data_Upt_Date              STRING COMMENT '数据更新日期'
     ,Data_Time                  STRING COMMENT '数据时间'
     ,Real_Src_Tbl               STRING COMMENT '真实源表'
     ,Evt_Type_Cd                STRING COMMENT '事件类型代码'
     ,Src_Cust_Mngr_Id           STRING COMMENT '源客户经理编号'
     ,Cust_Mngr_Emp_Id           STRING COMMENT '客户经理员工编号'
)COMMENT '投研员工外资派点上传事件'
PARTITIONED BY (Src_Tbl  STRING COMMENT'源表',Busi_Date  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_RMS_EMP_FORE_SCOR_UPLD_EVT PARTITION(Src_Tbl='${src_table}',Busi_Date='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1.: Source Table:[ODATA_N_RMS.P_COCKPIT_UNIFIED_SCORE:统一派点主表] 
-----------------------------------------------------------------------------------------------------
SELECT
      A.ID                                                AS  Evt_Id                  --事件编号              
     ,A.YEAR                                              AS  Scor_Year               --派点年份              
     ,A.QUARTER                                           AS  Scor_Qtr                --派点季度              
     ,''                                                  AS  Cust_Pty_Id     --客户当事人编号
     ,A.SUBMITTER_ID                                      AS  Src_Scor_Subm_Prsn_Id   --源派点提交人编号      
     ,COALESCE(B.ERP_ID, B.USERNAME, A.SUBMITTER_ID)      AS  Scor_Subm_Prsn_Emp_Id   --派点提交人员工编号    
     ,A.SUBMITTER_NAME                                    AS  Scor_Subm_Prsn_Name     --派点提交人名称        
     ,NVL(D.DW_CD_VAL,A.STATUS)                           AS  Scor_Proc_Stat_Cd       --派点流程状态代码      
     ,A.UPLOAD_SCORE                                      AS  Scor_Det_Upld_Flag      --派点明细上传标志      
     ,A.BATCH_NUMBER                                      AS  Bat_Id                  --批次编号              
     ,A.REMARK                                            AS  Remark                  --备注                  
     ,A.REMOVE_TAG                                        AS  Del_Flag                --删除标志              
     ,A.CREATE_TIME                                       AS  Estb_Time               --创建时间              
     ,A.UPDATE_TIME                                       AS  Modif_Time              --修改时间              
     ,''                                                  AS  Rms_Org_Cust_Lvl_Cd     --投研机构客户等级代码  
     ,'${data_src_cd}'                               AS  Data_Src_Cd             --数据来源代码
     ,'${filename}'                                  AS  Task_Name               --任务名
     ,'${data_day_str}'                              AS  Data_Etl_Date           --数据加载日期
     ,'${data_day_str}'                              AS  Data_Upt_Date           --数据更新日期
     ,'${data_today}'                                AS  Data_Time               --数据时间
     ,'${src_table}'                                 AS  Real_Src_Tbl            --真实源表
     ,'unif_scor_upld'                                    AS  Evt_Type_Cd             --事件类型代码  'unif_scor_upld' --统一上传派点
     ,COALESCE(C.ERP_ID,C.USERNAME,A.MANAGER_ID)          AS  Src_Cust_Mngr_Id        --源客户经理编号
     ,MANAGER_ID                                          AS  Cust_Mngr_Emp_Id        --客户经理员工编号
FROM (SELECT *  FROM ${src_table} WHERE  Busi_Date='${data_day_str}' )A
LEFT JOIN SPRT_ORGOBJECT_TEMP B
       ON A.SUBMITTER_ID =B.ORGID
LEFT JOIN SPRT_ORGOBJECT_TEMP C
       ON A.MANAGER_ID =C.ORGID
LEFT JOIN (
         SELECT SRC_CD_VAL,DW_CD_VAL
           FROM PDATA_N.REF_CD_CVT_MAP_TEMP
         WHERE TGT_TAB_NAME = 'T05_RMS_EMP_FORE_SCOR_UPLD_EVT'
            AND TGT_TAB_FLD  = 'Scor_Proc_Stat_Cd'
            AND SRC_TAB_NAME = 'COCKPIT_UNIFIED_SCORE'
            AND SRC_FLD_NAME = 'STATUS'
            AND SRC_SYS_NAME='RMS')D
   ON      nvl(trim(A.STATUS),'') =D.SRC_CD_VAL                  --STATUS 转码
;
