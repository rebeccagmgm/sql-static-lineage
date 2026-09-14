-- task_id: 145620
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_SEED_FND_PROJ_ADTNL_INFO_ECR069.py
-- observed_at: 2026-09-05T01:06:58.336Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_SEED_FND_PROJ_ADTNL_INFO(
         Proj_Id                    STRING COMMENT '项目编号'
        ,Mgmt_Pty_Id                STRING COMMENT '管理人当事人编号'
        ,Ivst_Strg                  STRING COMMENT '投资策略'
        ,Perf_Sys_Mngr_Id           STRING COMMENT '绩效系统管理人编号'
        ,Lkman                      STRING COMMENT '联系人'
        ,Lkman_Tel                  STRING COMMENT '联系人电话'
        ,Curr_Step_Cd               STRING COMMENT '当前步骤代码'
        ,Proj_Stat_Cd               STRING COMMENT '项目状态代码'
        ,Proj_Sub_Stat_Cd           STRING COMMENT '项目子状态代码'
        ,Bsp_Stat_Cd                STRING COMMENT 'BSP状态代码'
        ,End_Step_Cd                STRING COMMENT '结束步骤代码'
        ,Mngr_Cfm_Flag              STRING COMMENT '管理人确认标志'
        ,Mngr_Cfm_Time              STRING COMMENT '管理人确认时间'
        ,In_Obsv_Db_Time            STRING COMMENT '进入观察库时间'
        ,In_Prep_Ivst_Db_Time       STRING COMMENT '进入备投库时间'
        ,Ivst_Stat_Cd               STRING COMMENT '投资状态代码'
        ,In_Ivst_Db_Time            STRING COMMENT '进入投资库时间'
        ,In_Redp_Db_Time            STRING COMMENT '进入赎回库时间'
        ,Ivst_Appr_Proc_Url         STRING COMMENT '投资审核流程URL'
        ,Land_Cnsdr_Trc_Info        STRING COMMENT '落地对价跟踪信息'
        ,Estb_Time                  STRING COMMENT '创建时间'
        ,Estb_User_Id               STRING COMMENT '创建用户编号'
        ,Upd_Time                   STRING COMMENT '更新时间'
        ,Upd_User_Id                STRING COMMENT '更新用户编号'
        ,Del_Flag                   STRING COMMENT '删除标志'
        ,Del_Date                   STRING COMMENT '删除日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
    )COMMENT '种子基金项目附加信息'
    PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_TEMP_ECR069;
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_TEMP_ECR069
    AS
    -----------------------------------------------------------------------------------------------------
    --GROUP1: SOURCE TABLE:[ODATA_N_ECR.S_CX_SEED_FUND: 种子基金]
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('ECR069-',ROW_ID)                 AS  Proj_Id                 --项目编号          
        ,ACC_ID                                   AS  Mgmt_Pty_Id             --管理人当事人编号  
        ,STRATEGY_NAME                            AS  Ivst_Strg               --投资策略          
        ,ORG_ID                                   AS  Perf_Sys_Mngr_Id        --绩效系统管理人编号
        ,CONTACT                                  AS  Lkman                   --联系人            
        ,CONTACT_PHONE                            AS  Lkman_Tel               --联系人电话        
        ,STEP                                     AS  Curr_Step_Cd            --当前步骤代码      
        ,NVL(DW_CD_VAL,STATUS)                    AS  Proj_Stat_Cd            --项目状态代码      
        ,SUB_STATUS                               AS  Proj_Sub_Stat_Cd        --项目子状态代码    
        ,BSP_STATUS                               AS  Bsp_Stat_Cd             --BSP状态代码       
        ,END_STEP                                 AS  End_Step_Cd             --结束步骤代码      
        ,CASE WHEN IS_CONFIRM = 'Y'  THEN '1' 
              WHEN IS_CONFIRM = 'N'  THEN '0'
              ELSE '' END                         AS  Mngr_Cfm_Flag           --管理人确认标志    
        ,CONFIRM_DATE                             AS  Mngr_Cfm_Time           --管理人确认时间    
        ,ENTER_OB_LIB_DATE                        AS  In_Obsv_Db_Time         --进入观察库时间    
        ,ENTER_PRE_INVEST_LIB_DATE                 AS  In_Prep_Ivst_Db_Time    --进入备投库时间   
        ,INVESTMENT_STATUS                        AS  Ivst_Stat_Cd            --投资状态代码      
        ,INVESTMENT_DATE                          AS  In_Ivst_Db_Time         --进入投资库时间    
        ,REDEMPTION_DATE                          AS  In_Redp_Db_Time         --进入赎回库时间    
        ,INVESTMENT_AUDIT_URL                     AS  Ivst_Appr_Proc_Url      --投资审核流程URL   
        ,B.STATEMENT                              AS  Land_Cnsdr_Trc_Info     --落地对价跟踪信息  
        ,CREATED                                  AS  Estb_Time               --创建时间          
        ,CREATED_BY                               AS  Estb_User_Id            --创建用户编号      
        ,LAST_UPD                                 AS  Upd_Time                --更新时间          
        ,LAST_UPD_BY                              AS  Upd_User_Id             --更新用户编号      
        ,'${data_src_cd}'                    AS  Data_Src_Cd             --数据来源代码
        ,'${src_table}'                      AS  Src_Tbl                 --源表
        ,'${filename}'                       AS  Task_Name               --任务名
        ,'${data_day_str}'                   AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                   AS  Data_Upt_Date           --数据更新日期
    FROM  (SELECT * FROM ${src_table}  WHERE BUSI_DATE='${data_day_str}' )A
    LEFT JOIN (SELECT SEED_FUND_ID,STATEMENT FROM ODATA_N_ECR.S_CX_SEED_FUND_LAND_PRICE WHERE BUSI_DATE='${data_day_str}' )B
           ON A.ROW_ID=B.SEED_FUND_ID
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
              FROM PDATA_N.REF_CD_CVT_MAP
              WHERE TGT_TAB_NAME = 'T00_SEED_FND_PROJ_ADTNL_INFO'
                 AND TGT_TAB_FLD  = 'Proj_Stat_Cd'
                 AND SRC_TAB_NAME = 'CX_SEED_FUND'
                 AND SRC_FLD_NAME = 'STATUS'
                 AND SRC_SYS_NAME='ECR')C
          ON      A.STATUS =C.SRC_CD_VAL                  --STATUS 转码
    ;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_MID_ECR069;
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_MID_ECR069
    AS
    SELECT
             A.*
            ,B.Proj_Id                    AS Proj_Id1                  --项目编号
            ,B.Mgmt_Pty_Id                AS Mgmt_Pty_Id1              --管理人当事人编号
            ,B.Ivst_Strg                  AS Ivst_Strg1                --投资策略
            ,B.Perf_Sys_Mngr_Id           AS Perf_Sys_Mngr_Id1         --绩效系统管理人编号
            ,B.Lkman                      AS Lkman1                    --联系人
            ,B.Lkman_Tel                  AS Lkman_Tel1                --联系人电话
            ,B.Curr_Step_Cd               AS Curr_Step_Cd1             --当前步骤代码
            ,B.Proj_Stat_Cd               AS Proj_Stat_Cd1             --项目状态代码
            ,B.Proj_Sub_Stat_Cd           AS Proj_Sub_Stat_Cd1         --项目子状态代码
            ,B.Bsp_Stat_Cd                AS Bsp_Stat_Cd1              --BSP状态代码
            ,B.End_Step_Cd                AS End_Step_Cd1              --结束步骤代码
            ,B.Mngr_Cfm_Flag              AS Mngr_Cfm_Flag1            --管理人确认标志
            ,B.Mngr_Cfm_Time              AS Mngr_Cfm_Time1            --管理人确认时间
            ,B.In_Obsv_Db_Time            AS In_Obsv_Db_Time1          --进入观察库时间
            ,B.In_Prep_Ivst_Db_Time       AS In_Prep_Ivst_Db_Time1     --进入备投库时间
            ,B.Ivst_Stat_Cd               AS Ivst_Stat_Cd1             --投资状态代码
            ,B.In_Ivst_Db_Time            AS In_Ivst_Db_Time1          --进入投资库时间
            ,B.In_Redp_Db_Time            AS In_Redp_Db_Time1          --进入赎回库时间
            ,B.Ivst_Appr_Proc_Url         AS Ivst_Appr_Proc_Url1       --投资审核流程URL
            ,B.Land_Cnsdr_Trc_Info        AS Land_Cnsdr_Trc_Info1      --落地对价跟踪信息
            ,B.Estb_Time                  AS Estb_Time1                --创建时间
            ,B.Estb_User_Id               AS Estb_User_Id1             --创建用户编号
            ,B.Upd_Time                   AS Upd_Time1                 --更新时间
            ,B.Upd_User_Id                AS Upd_User_Id1              --更新用户编号
            ,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
            ,B.SRC_TBL                    AS SRC_TBL1                  --源表
            ,B.TASK_NAME                  AS TASK_NAME1                --任务名
            ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
            ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
            ,CASE WHEN A.Proj_Id IS NULL     AND B.Proj_Id IS NOT NULL THEN 'I' --新增
                  WHEN A.Proj_Id IS NOT NULL AND B.Proj_Id IS NULL THEN 'D' --删除
                  WHEN A.Proj_Id IS NOT NULL AND B.Proj_Id IS NOT NULL AND (
                     COALESCE(A.Mgmt_Pty_Id             ,'') <> COALESCE(B.Mgmt_Pty_Id             ,'')
                  OR COALESCE(A.Ivst_Strg               ,'') <> COALESCE(B.Ivst_Strg               ,'')
                  OR COALESCE(A.Perf_Sys_Mngr_Id        ,'') <> COALESCE(B.Perf_Sys_Mngr_Id        ,'')
                  OR COALESCE(A.Lkman                   ,'') <> COALESCE(B.Lkman                   ,'')
                  OR COALESCE(A.Lkman_Tel               ,'') <> COALESCE(B.Lkman_Tel               ,'')
                  OR COALESCE(A.Curr_Step_Cd            ,'') <> COALESCE(B.Curr_Step_Cd            ,'')
                  OR COALESCE(A.Proj_Stat_Cd            ,'') <> COALESCE(B.Proj_Stat_Cd            ,'')
                  OR COALESCE(A.Proj_Sub_Stat_Cd        ,'') <> COALESCE(B.Proj_Sub_Stat_Cd        ,'')
                  OR COALESCE(A.Bsp_Stat_Cd             ,'') <> COALESCE(B.Bsp_Stat_Cd             ,'')
                  OR COALESCE(A.End_Step_Cd             ,'') <> COALESCE(B.End_Step_Cd             ,'')
                  OR COALESCE(A.Mngr_Cfm_Flag           ,'') <> COALESCE(B.Mngr_Cfm_Flag           ,'')
                  OR COALESCE(A.Mngr_Cfm_Time           ,'') <> COALESCE(B.Mngr_Cfm_Time           ,'')
                  OR COALESCE(A.In_Obsv_Db_Time         ,'') <> COALESCE(B.In_Obsv_Db_Time         ,'')
                  OR COALESCE(A.In_Prep_Ivst_Db_Time    ,'') <> COALESCE(B.In_Prep_Ivst_Db_Time    ,'')
                  OR COALESCE(A.Ivst_Stat_Cd            ,'') <> COALESCE(B.Ivst_Stat_Cd            ,'')
                  OR COALESCE(A.In_Ivst_Db_Time         ,'') <> COALESCE(B.In_Ivst_Db_Time         ,'')
                  OR COALESCE(A.In_Redp_Db_Time         ,'') <> COALESCE(B.In_Redp_Db_Time         ,'')
                  OR COALESCE(A.Ivst_Appr_Proc_Url      ,'') <> COALESCE(B.Ivst_Appr_Proc_Url      ,'')
                  OR COALESCE(A.Land_Cnsdr_Trc_Info     ,'') <> COALESCE(B.Land_Cnsdr_Trc_Info     ,'')
                  OR COALESCE(A.Estb_Time               ,'') <> COALESCE(B.Estb_Time               ,'')
                  OR COALESCE(A.Estb_User_Id            ,'') <> COALESCE(B.Estb_User_Id            ,'')
                  OR COALESCE(A.Upd_Time                ,'') <> COALESCE(B.Upd_Time                ,'')
                  OR COALESCE(A.Upd_User_Id             ,'') <> COALESCE(B.Upd_User_Id             ,'')
             ) THEN 'U' --变更
                 ELSE 'S' --无变更
                 END                 AS DATA_TYPE              --数据类型
    FROM  (SELECT * FROM T00_SEED_FND_PROJ_ADTNL_INFO 
                    WHERE SRC_TBL='ODATA_N_ECR.S_CX_SEED_FUND')A
    FULL OUTER JOIN ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_TEMP_ECR069 B
    ON    A.Proj_Id=B.Proj_Id
    ;

-- querySql
INSERT OVERWRITE TABLE T00_SEED_FND_PROJ_ADTNL_INFO PARTITION(SRC_TBL)
     --剔除当日新增的数据
    SELECT
          *
      FROM T00_SEED_FND_PROJ_ADTNL_INFO
      WHERE DATA_ETL_DATE !='${data_day_str}' 
        AND SRC_TBL = 'ODATA_N_ECR.S_CX_SEED_FUND'
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
    
    INSERT OVERWRITE TABLE T00_SEED_FND_PROJ_ADTNL_INFO PARTITION(SRC_TBL)
    SELECT
         Proj_Id                                       --项目编号
        ,Mgmt_Pty_Id                                   --管理人当事人编号
        ,Ivst_Strg                                     --投资策略
        ,Perf_Sys_Mngr_Id                              --绩效系统管理人编号
        ,Lkman                                         --联系人
        ,Lkman_Tel                                     --联系人电话
        ,Curr_Step_Cd                                  --当前步骤代码
        ,Proj_Stat_Cd                                  --项目状态代码
        ,Proj_Sub_Stat_Cd                              --项目子状态代码
        ,Bsp_Stat_Cd                                   --BSP状态代码
        ,End_Step_Cd                                   --结束步骤代码
        ,Mngr_Cfm_Flag                                 --管理人确认标志
        ,Mngr_Cfm_Time                                 --管理人确认时间
        ,In_Obsv_Db_Time                               --进入观察库时间
        ,In_Prep_Ivst_Db_Time                          --进入备投库时间
        ,Ivst_Stat_Cd                                  --投资状态代码
        ,In_Ivst_Db_Time                               --进入投资库时间
        ,In_Redp_Db_Time                               --进入赎回库时间
        ,Ivst_Appr_Proc_Url                            --投资审核流程URL
        ,Land_Cnsdr_Trc_Info                           --落地对价跟踪信息
        ,Estb_Time                                     --创建时间
        ,Estb_User_Id                                  --创建用户编号
        ,Upd_Time                                      --更新时间
        ,Upd_User_Id                                   --更新用户编号
        ,'0'                     AS Del_Flag           --删除标志
        ,''                      AS Del_Date           --删除日期
        ,Data_Src_Cd                                   --数据来源代码
        ,Task_Name                                     --任务名
        ,Data_Etl_Date                                 --数据加载日期
        ,Data_Upt_Date                                 --数据更新日期
        ,Data_Time                                     --数据时间
        ,Src_Tbl                                       --源表
    FROM ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_MID_ECR069 WHERE DATA_TYPE='S'  --插入无变化的数据
    UNION ALL
    SELECT
         Proj_Id1                                     AS Proj_Id                  --项目编号
        ,Mgmt_Pty_Id1                                 AS Mgmt_Pty_Id              --管理人当事人编号
        ,Ivst_Strg1                                   AS Ivst_Strg                --投资策略
        ,Perf_Sys_Mngr_Id1                            AS Perf_Sys_Mngr_Id         --绩效系统管理人编号
        ,Lkman1                                       AS Lkman                    --联系人
        ,Lkman_Tel1                                   AS Lkman_Tel                --联系人电话
        ,Curr_Step_Cd1                                AS Curr_Step_Cd             --当前步骤代码
        ,Proj_Stat_Cd1                                AS Proj_Stat_Cd             --项目状态代码
        ,Proj_Sub_Stat_Cd1                            AS Proj_Sub_Stat_Cd         --项目子状态代码
        ,Bsp_Stat_Cd1                                 AS Bsp_Stat_Cd              --BSP状态代码
        ,End_Step_Cd1                                 AS End_Step_Cd              --结束步骤代码
        ,Mngr_Cfm_Flag1                               AS Mngr_Cfm_Flag            --管理人确认标志
        ,Mngr_Cfm_Time1                               AS Mngr_Cfm_Time            --管理人确认时间
        ,In_Obsv_Db_Time1                             AS In_Obsv_Db_Time          --进入观察库时间
        ,In_Prep_Ivst_Db_Time1                        AS In_Prep_Ivst_Db_Time     --进入备投库时间
        ,Ivst_Stat_Cd1                                AS Ivst_Stat_Cd             --投资状态代码
        ,In_Ivst_Db_Time1                             AS In_Ivst_Db_Time          --进入投资库时间
        ,In_Redp_Db_Time1                             AS In_Redp_Db_Time          --进入赎回库时间
        ,Ivst_Appr_Proc_Url1                          AS Ivst_Appr_Proc_Url       --投资审核流程URL
        ,Land_Cnsdr_Trc_Info1                         AS Land_Cnsdr_Trc_Info      --落地对价跟踪信息
        ,Estb_Time1                                   AS Estb_Time                --创建时间
        ,Estb_User_Id1                                AS Estb_User_Id             --创建用户编号
        ,Upd_Time1                                    AS Upd_Time                 --更新时间
        ,Upd_User_Id1                                 AS Upd_User_Id              --更新用户编号
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   AS Task_Name                --任务名
        ,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'${data_today}'                         AS Data_Time                --数据时间
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_MID_ECR069  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
    UNION ALL
    SELECT
         Proj_Id1                                     AS Proj_Id                  --项目编号
        ,Mgmt_Pty_Id1                                 AS Mgmt_Pty_Id              --管理人当事人编号
        ,Ivst_Strg1                                   AS Ivst_Strg                --投资策略
        ,Perf_Sys_Mngr_Id1                            AS Perf_Sys_Mngr_Id         --绩效系统管理人编号
        ,Lkman1                                       AS Lkman                    --联系人
        ,Lkman_Tel1                                   AS Lkman_Tel                --联系人电话
        ,Curr_Step_Cd1                                AS Curr_Step_Cd             --当前步骤代码
        ,Proj_Stat_Cd1                                AS Proj_Stat_Cd             --项目状态代码
        ,Proj_Sub_Stat_Cd1                            AS Proj_Sub_Stat_Cd         --项目子状态代码
        ,Bsp_Stat_Cd1                                 AS Bsp_Stat_Cd              --BSP状态代码
        ,End_Step_Cd1                                 AS End_Step_Cd              --结束步骤代码
        ,Mngr_Cfm_Flag1                               AS Mngr_Cfm_Flag            --管理人确认标志
        ,Mngr_Cfm_Time1                               AS Mngr_Cfm_Time            --管理人确认时间
        ,In_Obsv_Db_Time1                             AS In_Obsv_Db_Time          --进入观察库时间
        ,In_Prep_Ivst_Db_Time1                        AS In_Prep_Ivst_Db_Time     --进入备投库时间
        ,Ivst_Stat_Cd1                                AS Ivst_Stat_Cd             --投资状态代码
        ,In_Ivst_Db_Time1                             AS In_Ivst_Db_Time          --进入投资库时间
        ,In_Redp_Db_Time1                             AS In_Redp_Db_Time          --进入赎回库时间
        ,Ivst_Appr_Proc_Url1                          AS Ivst_Appr_Proc_Url       --投资审核流程URL
        ,Land_Cnsdr_Trc_Info1                         AS Land_Cnsdr_Trc_Info      --落地对价跟踪信息
        ,Estb_Time1                                   AS Estb_Time                --创建时间
        ,Estb_User_Id1                                AS Estb_User_Id             --创建用户编号
        ,Upd_Time1                                    AS Upd_Time                 --更新时间
        ,Upd_User_Id1                                 AS Upd_User_Id              --更新用户编号
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   As Task_Name                --任务名
        ,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'${data_today}'                         AS Data_Time                --数据时间
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_MID_ECR069  WHERE DATA_TYPE='I'   --插入新增的数据
    UNION ALL
    SELECT
         Proj_Id                                                 --项目编号
        ,Mgmt_Pty_Id                                             --管理人当事人编号
        ,Ivst_Strg                                               --投资策略
        ,Perf_Sys_Mngr_Id                                        --绩效系统管理人编号
        ,Lkman                                                   --联系人
        ,Lkman_Tel                                               --联系人电话
        ,Curr_Step_Cd                                            --当前步骤代码
        ,Proj_Stat_Cd                                            --项目状态代码
        ,Proj_Sub_Stat_Cd                                        --项目子状态代码
        ,Bsp_Stat_Cd                                             --BSP状态代码
        ,End_Step_Cd                                             --结束步骤代码
        ,Mngr_Cfm_Flag                                           --管理人确认标志
        ,Mngr_Cfm_Time                                           --管理人确认时间
        ,In_Obsv_Db_Time                                         --进入观察库时间
        ,In_Prep_Ivst_Db_Time                                    --进入备投库时间
        ,Ivst_Stat_Cd                                            --投资状态代码
        ,In_Ivst_Db_Time                                         --进入投资库时间
        ,In_Redp_Db_Time                                         --进入赎回库时间
        ,Ivst_Appr_Proc_Url                                      --投资审核流程URL
        ,Land_Cnsdr_Trc_Info                                     --落地对价跟踪信息
        ,Estb_Time                                               --创建时间
        ,Estb_User_Id                                            --创建用户编号
        ,Upd_Time                                                --更新时间
        ,Upd_User_Id                                             --更新用户编号
        ,'1'                              AS Del_Flag            --删除标志
        ,CASE WHEN Del_Date !=''
                THEN Del_Date
              ELSE '${data_day_str}'
              END                         AS Del_Date            --删除日期
         ,Data_Src_Cd                                            --数据来源代码
         ,Task_Name                                              --任务名
         ,Data_Etl_Date                                          --数据加载日期
         ,CASE WHEN Del_Date !=''
               THEN Data_Upt_Date
               ELSE '${data_day_str}'
              END                         AS Data_Upt_Date       --数据更新日期
        ,CASE WHEN Del_Date !=''
                THEN Data_Time
              ELSE '${data_today}'
              END                         AS Data_Time           --数据时间
        ,Src_Tbl                                                 --源表
    FROM ${DB_TEMP}.T00_SEED_FND_PROJ_ADTNL_INFO_MID_ECR069 WHERE DATA_TYPE='D'  --插入删除的数据
    ;
