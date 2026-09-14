-- task_id: 187149
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_CTSD_PRD_NAV_ALR_EVT_CAP020.py
-- observed_at: 2026-09-05T01:07:15.058Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_CTSD_PRD_NAV_ALR_EVT(
         Evt_Id                     STRING COMMENT '事件ID'
        ,Src_Sob_Id                 STRING COMMENT '源账套编号'
        ,Sob_Name                   STRING COMMENT '账套名称'
        ,Ta_Cd                      STRING COMMENT 'ta代码'
        ,Alr_Busi_Date              STRING COMMENT '告警业务日期'
        ,Valu_Date                  STRING COMMENT '估值日期'
        ,Stop_Loss_Date             STRING COMMENT '止损日期'
        ,Clr_Maty_Date              STRING COMMENT '清仓截止日'
        ,Evt_Type_Cd                STRING COMMENT '事件类型代码'
        ,Ltrs_Type_Cd               STRING COMMENT '函件类型代码'
        ,Warn_Line                  STRING COMMENT '预警线'
        ,Stop_Loss_Line             STRING COMMENT '止损线'
        ,Tot                        STRING COMMENT '合计'
        ,New_Add_Flag               STRING COMMENT '新增标志'
        ,Csm_Flag                   STRING COMMENT '代销标志'
        ,Un_Undrl_Mval_Prop         STRING COMMENT '非标市值比例'
        ,Stk_Mval_Prop              STRING COMMENT '股票市值比例'
        ,Mf_Mval_Prop               STRING COMMENT '货币基金市值比例'
        ,Fnd_Mval_Prop              STRING COMMENT '基金市值比例'
        ,Futr_Bail_Prop             STRING COMMENT '期货保证金比例'
        ,Deri_Mval_Prop             STRING COMMENT '衍生品市值比例'
        ,Un_Mf_Mval_Prop            STRING COMMENT '非货币基金市值比例'
        ,Un_Undrl_Equi_Mval_Prop    STRING COMMENT '非标股权市值比例'
        ,Bond_Mval_Prop             STRING COMMENT '债券市值比例'
        ,Mf_Rev_Repo_Mval_Prop      STRING COMMENT '货币基金逆回购市值比例'
        ,Oth_Ivst_Mval_Prop         STRING COMMENT '其他投资市值比例'
        ,Ivst_Liab_Mval_Prop        STRING COMMENT '投资性负债市值比例'
        ,Prd_Nav                    STRING COMMENT '产品资产净值'
        ,Prd_Unit_Nav               STRING COMMENT '产品单位净值'
        ,Prd_Accum_Unit_Nav         STRING COMMENT '产品累计单位净值'
        ,Nav_Cfm_Stat_Cd            STRING COMMENT '净值确认状态代码'
        ,Remark                     STRING COMMENT '备注'
        ,Prd_Contr_Det              STRING COMMENT '产品合同详情'
        ,Del_Flag                   STRING COMMENT '删除标志'
        ,Create_User_Name           STRING COMMENT '创建人姓名'
        ,Create_Time                STRING COMMENT '创建时间'
        ,Upd_User_Name              STRING COMMENT '更新人姓名'
        ,Modif_Time                 STRING COMMENT '修改时间'
        ,Mail_Id                    STRING COMMENT '邮件编号'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
        ,Stati_Flag                 STRING COMMENT '统计标志'
    )COMMENT '托管产品净值告警事件'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_CTSD_PRD_NAV_ALR_EVT PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group1.: Source Table:[ODATA_N_CAP.A_BIZ_VALUEWARN_DETAIL:预警止损明细] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('CAP020-',ID,'-',substr(FDATE,1,10))
                                               AS  Evt_Id                  --事件ID            
        ,PRDNBR                                AS  Src_Sob_Id              --源账套编号        
        ,PRDNAME                               AS  Sob_Name                --账套名称          
        ,TACODE                                AS  Ta_Cd                   --ta代码            
        ,BUS_DATE                              AS  Alr_Busi_Date           --告警业务日期      
        ,FDATE                                 AS  Valu_Date               --估值日期          
        ,ALERTLOSS_DATE                        AS  Stop_Loss_Date          --止损日期          
        ,CLEAR_BEFOREDATE                      AS  Clr_Maty_Date           --清仓截止日        
        ,NVL(B.DW_CD_VAL,STATUS)               AS  Evt_Type_Cd             --事件类型代码      
        ,NVL(C.DW_CD_VAL,BUS_TYPE)             AS  Ltrs_Type_Cd            --函件类型代码      
        ,WARN_LINE                             AS  Warn_Line               --预警线            
        ,LOSS_LINE                             AS  Stop_Loss_Line          --止损线            
        ,STATIC_LINE                           AS  Tot                     --合计              
        ,IF(IF_NEW = '2','0',IF_NEW)           AS  New_Add_Flag            --新增标志          
        ,IF(IF_PROXY = '2','0',IF_PROXY)       AS  Csm_Flag                --代销标志          
        ,FBSZ_RATIO                            AS  Un_Undrl_Mval_Prop      --非标市值比例      
        ,GPSZ_RATIO                            AS  Stk_Mval_Prop           --股票市值比例      
        ,HBJJSZ_RATIO                          AS  Mf_Mval_Prop            --货币基金市值比例  
        ,JJSZ_RATIO                            AS  Fnd_Mval_Prop           --基金市值比例      
        ,QHBZAJ_RATIO                          AS  Futr_Bail_Prop          --期货保证金比例    
        ,YSPSZ_RATIO                           AS  Deri_Mval_Prop          --衍生品市值比例    
        ,FHBJJSZ_RATIO                         AS  Un_Mf_Mval_Prop         --非货币基金市值比例
        ,FBGQSZ_RATIO                          AS  Un_Undrl_Equi_Mval_Prop --非标股权市值比例  
        ,ZQSZ_RATIO                            AS  Bond_Mval_Prop          --债券市值比例      
        ,HBJJNHGSZ_RATIO                       AS  Mf_Rev_Repo_Mval_Prop   --货币基金逆回购市值比例          
        ,QTTZSZ_RATIO                          AS  Oth_Ivst_Mval_Prop      --其他投资市值比例             
        ,TZXFZSZ_RATIO                         AS  Ivst_Liab_Mval_Prop     --投资性负债市值比例            
        ,JJZC_VALUE                            AS  Prd_Nav                 --产品资产净值               
        ,JJDW_VALUE                            AS  Prd_Unit_Nav            --产品单位净值               
        ,JJLJDW_VALUE                          AS  Prd_Accum_Unit_Nav      --产品累计单位净值             
        ,CURRENT_CONFIRM_STATUS                AS  Nav_Cfm_Stat_Cd         --净值确认状态代码            根据映射转码
        ,REMARK                                AS  Remark                  --备注                   
        ,CONTRACT_DEC                          AS  Prd_Contr_Det           --产品合同详情               
        ,IS_DELETED                            AS  Del_Flag                --删除标志                 
        ,CREATE_USER                           AS  Create_User_Name        --创建人姓名                
        ,CREATE_TIME                           AS  Create_Time             --创建时间                 
        ,MODIFY_USER                           AS  Upd_User_Name           --更新人姓名                
        ,MODIFY_TIME                           AS  Modif_Time              --修改时间                 
        ,EMAIL_ID                              AS  Mail_Id                 --邮件编号                 
        ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                    AS  Task_Name               --任务名
        ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                  AS  Data_Time               --数据时间
        ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
        ,STATISTICS                            AS  Stati_Flag              --统计标志
    FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP
             WHERE TGT_TAB_NAME = 'T05_CTSD_PRD_NAV_ALR_EVT'
                AND TGT_TAB_FLD  = 'Evt_Type_Cd'
                AND SRC_TAB_NAME = 'BIZ_VALUEWARN_DETAIL_NEW'
                AND SRC_FLD_NAME = 'STATUS'
                AND SRC_SYS_NAME='CAP')B
       ON      A.STATUS =B.SRC_CD_VAL                  --STATUS 转码
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP
             WHERE TGT_TAB_NAME = 'T05_CTSD_PRD_NAV_ALR_EVT'
                AND TGT_TAB_FLD  = 'Ltrs_Type_Cd'
                AND SRC_TAB_NAME = 'BIZ_VALUEWARN_DETAIL_NEW'
                AND SRC_FLD_NAME = 'BUS_TYPE'
                AND SRC_SYS_NAME='CAP')C
       ON      A.BUS_TYPE =C.SRC_CD_VAL                  --BUS_TYPE 转码

    ;
