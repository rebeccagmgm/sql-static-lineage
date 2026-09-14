-- task_id: 66167
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_OAO_ORD_LOG_OAO002.py
-- observed_at: 2026-09-05T01:06:26.495Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_OAO_ORD_LOG(
      Agt_Id                    STRING COMMENT '订单协议编号'	                            
     ,Agt_Modifr                STRING COMMENT '订单协议修饰符'	                            
     ,Rep_No                    STRING COMMENT '申请编号'	                                
     ,Ord_Type_Cd               STRING COMMENT '订单类型代码'	                            
     ,Appr_Type_Cd              STRING COMMENT '审核类型代码'	                            
     ,Scale_Range_Cd            STRING COMMENT '派单范围代码'	                            
     ,Ord_Stat_Cd               STRING COMMENT '订单状态代码'	                            
     ,Cust_Name                 STRING COMMENT '客户名称'	                                
     ,Cert_No                   STRING COMMENT '证件号码'	                                
     ,Inr_Org_Id                STRING COMMENT '内部机构编号'	                            
     ,Inr_Org_Name              STRING COMMENT '内部机构名称'	                            
     ,Evt_Type_Cd               STRING COMMENT '事件类型代码'	                            
     ,Occu_Time                 STRING COMMENT '发生时间'	                                
     ,Appr_User                 STRING COMMENT '审核人'	                                    
     ,Appr_Stat_Cd              STRING COMMENT '审核状态代码'	                            
     ,Appr_Rej_Rsn              STRING COMMENT '审核拒绝原因'	                            
     ,Ord_Busi_Ref              STRING COMMENT '订单业务参数'	                            
     ,Modif_Rec                 STRING COMMENT '修改记录'	                                
     ,Clbk_Ver                  STRING COMMENT '电话回访版本号'	                            
     ,His_Flag                  STRING COMMENT '备份到历史表标志'	                        
     ,Clbk_Seri_No              STRING COMMENT '电话回访流水号'                            
     ,Deal_Rslt_Cd              STRING COMMENT '柜台处理代码'	                            
     ,Is_Same_Cty               STRING COMMENT '客户的联系地址与开户营业部所在城市是否一致'	
     ,Cust_Prvd_Addr            STRING COMMENT '客户提供地址'	                            
     ,Data_Src_Cd               STRING COMMENT '数据来源代码'	                            
     ,Task_Name                 STRING COMMENT '任务名'	                                    
     ,Data_Etl_Date             STRING COMMENT '数据加载日期'	                            
     ,Data_Upt_Date             STRING COMMENT '数据更新日期'	                            
     ,Data_Time                 STRING COMMENT '数据时间'
)COMMENT '网上开户订单日志'
PARTITIONED BY (Src_Tbl   string comment'源表',BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_OAO_ORD_LOG PARTITION(Src_Tbl,BUSI_DATE)
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_OAO.C_TSYS_ORDER_LOG 订单表日志]
-----------------------------------------------------------------------------------------------------
SELECT
        ORDER_ID                                     AS Agt_Id                 --订单协议编号	                           
       ,'2040204'                                    AS Agt_Modifr             --订单协议修饰符	                           
       ,UUID                                         AS Rep_No                 --申请编号	                               
       ,NVL(B.DW_CD_VAL,A.ORDER_TYPE)                AS Ord_Type_Cd            --订单类型代码	                           
       ,IF(NVL(TRIM(STEP),'')='','',CAST(CAST(STEP AS DOUBLE) AS STRING) ) AS Appr_Type_Cd           --审核类型代码	                           
       ,SCALE                                        AS Scale_Range_Cd         --派单范围代码	                           
       ,NVL(C.DW_CD_VAL,A.STATE)                     AS Ord_Stat_Cd            --订单状态代码	                           
       ,CUSTOMER_NAME                                AS Cust_Name              --客户名称	                               
       ,IDCARD_NO                                    AS Cert_No                --证件号码	                               
       ,lpad(BRANCH_NO,4,0)                          AS Inr_Org_Id             --内部机构编号	                           
       ,BRANCH_NAME                                  AS Inr_Org_Name           --内部机构名称	                           
       ,EVENT                                        AS Evt_Type_Cd            --事件类型代码	                           
       ,\`TIME\`                                     AS Occu_Time              --发生时间	                               
       ,REVIEWER                                     AS Appr_User              --审核人	                                   
       ,NVL(D.DW_CD_VAL,A.RESULT)                    AS Appr_Stat_Cd           --审核状态代码	                           
       ,REJECT_REASON                                AS Appr_Rej_Rsn           --审核拒绝原因	                           
       ,BUSINESS_PARAM                               AS Ord_Busi_Ref           --订单业务参数	                           
       ,MODIFY_LOGS                                  AS Modif_Rec              --修改记录	                               
       ,CALL_SURVEY_VERSION                          AS Clbk_Ver               --电话回访版本号	                           
       ,HISTORY_FLAG                                 AS His_Flag               --备份到历史表标志	                       
       ,HSIPCCWEB_ORDER_ID                           AS Clbk_Seri_No           --电话回访流水号	                           
       ,BATCH_RESULT                                 AS Deal_Rslt_Cd           --柜台处理代码	                           
       ,CONTACT_ADDRESS_COMPARE_DEPARTMENT_ADDRESS   AS Is_Same_Cty            --客户的联系地址与开户营业部所在城市是否一致
       ,CUSTOMER_PROVIDE_ADDRESS                     AS Cust_Prvd_Addr         --客户提供地址	                       
       ,'${data_src_cd}'                        AS Data_Src_Cd            --数据来源代码
       ,'${filename}'                           AS Task_Name              --任务名
       ,'${data_day_str}'                       AS Data_Etl_Date          --数据加载日期
       ,'${data_today_str}'                     AS Data_Upt_Date          --数据更新日期
       ,'${data_today}'                         AS Data_Time              --数据时间
       ,'${src_table}'                          AS Src_Tbl                --源表
       ,'${data_day_str}'                       AS Busi_Date              --业务日期
FROM   (SELECT * FROM ODATA_N_OAO.C_TSYS_ORDER_LOG 
WHERE BUSI_DATE='${data_day_str}')A                                                   
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
            FROM PDATA_N.REF_CD_CVT_MAP
           WHERE TGT_TAB_NAME = 'T05_OAO_ORD_LOG'
             AND TGT_TAB_FLD  = 'Ord_Type_Cd'
             AND SRC_TAB_NAME = 'TSYS_ORDER_LOG'
             AND SRC_FLD_NAME = 'ORDER_TYPE'
             AND SRC_SYS_NAME = '${data_src_cd}'
          )B
ON NVL(A.ORDER_TYPE,'')=B.SRC_CD_VAL
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
            FROM PDATA_N.REF_CD_CVT_MAP
           WHERE TGT_TAB_NAME = 'T05_OAO_ORD_LOG'
             AND TGT_TAB_FLD  = 'Ord_Stat_Cd'
             AND SRC_TAB_NAME = 'TSYS_ORDER_LOG'
             AND SRC_FLD_NAME = 'STATE'
             AND SRC_SYS_NAME = '${data_src_cd}'
          )C
ON NVL(A.STATE,'')=C.SRC_CD_VAL
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
            FROM PDATA_N.REF_CD_CVT_MAP
           WHERE TGT_TAB_NAME = 'T05_OAO_ORD_LOG'
             AND TGT_TAB_FLD  = 'Appr_Stat_Cd'
             AND SRC_TAB_NAME = 'TSYS_ORDER_LOG'
             AND SRC_FLD_NAME = 'RESULT'
             AND SRC_SYS_NAME = '${data_src_cd}'
          )D
ON NVL(A.RESULT,'')=D.SRC_CD_VAL
;
