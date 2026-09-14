-- task_id: 209830
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_OUR_RISK_QSTN_CORR_INFO_DRC013.py
-- observed_at: 2026-09-05T01:07:21.429Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_OUR_RISK_QSTN_CORR_INFO(
      Qstn_Id                    STRING COMMENT '问题编号'
     ,Corr_Item_Id               STRING COMMENT '整改事项编号'
     ,Corr_Item_Name             STRING COMMENT '整改事项名称'
     ,Proj_Id                    STRING COMMENT '项目编号'
     ,New_Proc_Id                STRING COMMENT '新流程编号'
     ,Old_Proc_Id                STRING COMMENT '旧流程编号'
     ,Proc_Title                 STRING COMMENT '流程标题'
     ,Req_Corr_Flag              STRING COMMENT '需要整改标志'
     ,Corr_Type_Cd               STRING COMMENT '整改类型代码'
     ,Corr_Title                 STRING COMMENT '整改标题'
     ,Corr_Advs                  STRING COMMENT '整改建议'
     ,Curr_Corr_Link_Cd          STRING COMMENT '当前整改环节代码'
     ,Curr_Proc_User_Id          STRING COMMENT '当前处理人用户编号'
     ,Corr_Respon_Prsn           STRING COMMENT '整改责任人'
     ,Corr_Appr                  STRING COMMENT '整改审批人'
     ,Corr_Stat_Cd               STRING COMMENT '整改状态代码'
     ,Corr_Rslt_Cd               STRING COMMENT '整改结果代码'
     ,Fnsh_Corr_Time             STRING COMMENT '完成整改时间'
     ,Busi_Type_Desc             STRING COMMENT '业务类型描述'
     ,Rglt_Type_Desc             STRING COMMENT '规管类型描述'
     ,Chk_Flag                   STRING COMMENT '检查标志'
     ,Remark                     STRING COMMENT '备注'
     ,Create_User_Id             STRING COMMENT '创建人用户编号'
     ,Create_Time                STRING COMMENT '创建时间'
     ,Data_Src_Cd                STRING COMMENT '数据来源代码'
     ,Task_Name                  STRING COMMENT '任务名'
     ,Data_Etl_Date              STRING COMMENT '数据加载日期'
     ,Data_Upt_Date              STRING COMMENT '数据更新日期'
     ,Data_Time                  STRING COMMENT '数据时间'
     ,Real_Src_Tbl               STRING COMMENT '真实源表'
)COMMENT '我司风险问题整改信息'
PARTITIONED BY (Src_Tbl  STRING COMMENT'源表',Busi_Date  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_OUR_RISK_QSTN_CORR_INFO PARTITION(Src_Tbl='${src_table}',Busi_Date='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_DRC.D_DCAR_RECTIFY_ITEM:整改事项表] 
-----------------------------------------------------------------------------------------------------
SELECT
      A.PROBLEM_ID                                      AS  Qstn_Id                 --问题编号          
     ,A.ID                                              AS  Corr_Item_Id            --整改事项编号      
     ,A.NAME                                            AS  Corr_Item_Name          --整改事项名称      
     ,''                                                AS  Proj_Id                 --项目编号          
     ,''                                                AS  New_Proc_Id             --新流程编号        
     ,''                                                AS  Old_Proc_Id             --旧流程编号        
     ,''                                                AS  Proc_Title              --流程标题          
     ,''                                                AS  Req_Corr_Flag           --需要整改标志      
     ,''                                                AS  Corr_Type_Cd            --整改类型代码      
     ,''                                                AS  Corr_Title              --整改标题          
     ,''                                                AS  Corr_Advs               --整改建议          
     ,''                                                AS  Curr_Corr_Link_Cd       --当前整改环节代码  
     ,''                                                AS  Curr_Proc_User_Id       --当前处理人用户编号
     ,''                                                AS  Corr_Respon_Prsn        --整改责任人        
     ,''                                                AS  Corr_Appr               --整改审批人        
     ,B.RECTIFY_STATUS                                  AS  Corr_Stat_Cd            --整改状态代码      
     ,B.RECTIFY_RESULT                                  AS  Corr_Rslt_Cd            --整改结果代码      
     ,''                                                AS  Fnsh_Corr_Time          --完成整改时间      
     ,''                                                AS  Busi_Type_Desc          --业务类型描述      
     ,''                                                AS  Rglt_Type_Desc          --规管类型描述      
     ,''                                                AS  Chk_Flag                --检查标志          
     ,''                                                AS  Remark                  --备注              
     ,''                                                AS  Create_User_Id          --创建人用户编号    
     ,B.CREATE_DATE                                     AS  Create_Time             --创建时间          
     ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
     ,'${filename}'                                AS  Task_Name               --任务名
     ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
     ,'${data_day_str}'                            AS  Data_Upt_Date           --数据更新日期
     ,'${data_today}'                              AS  Data_Time               --数据时间
     ,'${src_table}'                               AS  Real_Src_Tbl            --真实源表
FROM (SELECT *  FROM ${src_table} WHERE  Busi_Date='${data_day_str}' )A
LEFT JOIN (SELECT *  FROM ODATA_N_DRC.D_DCAR_RECTIFY_HANDLE WHERE Busi_Date='${data_day_str}' AND enable='t')B
      ON A.ID=B.RECTIFY_ITEM_ID
;
