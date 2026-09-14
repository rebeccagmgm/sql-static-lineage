-- task_id: 113573
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_TASK_BASE_INFO_BDP034.py
-- observed_at: 2026-09-05T01:06:47.363Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_TASK_BASE_INFO(
     Task_Id                    STRING COMMENT '任务编号'
    ,Task_Cate_Cd               STRING COMMENT '任务类别代码'
    ,Schd_Task_Name             STRING COMMENT '任务名称'
    ,Prior_Cd                   STRING COMMENT '优先级代码'
    ,Schd_Pd                    STRING COMMENT '调度周期'
    ,Step_Len                   STRING COMMENT '步长'
    ,Vld_Time                   STRING COMMENT '生效时间'
    ,Run_Ovtm_Alr               STRING COMMENT '运行超时预警'
    ,Dependence_Schd_Task_Id    STRING COMMENT '依赖调度任务'
    ,Creator_User_Id            STRING COMMENT '创建人用户编号'
    ,Create_Time                STRING COMMENT '创建时间'
    ,Upd_Time                   STRING COMMENT '更新时间'
    ,Day_Task_Type_Cd           STRING COMMENT '日任务类型代码'
    ,Day_Task_Data_Time_Para_Cd   STRING COMMENT '日任务数据时间参数'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Task_Type_Cd               STRING COMMENT '任务类型代码'
    ,Task_Type_Name             STRING COMMENT '任务类型名称'
    ,Upd_User_Id                STRING COMMENT '更新用户编号'
    ,Task_Stat_Cd               STRING COMMENT '任务状态代码'
    ,In_Charge_User_Id          STRING COMMENT '负责人用户编号'
)COMMENT '任务基本信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_TASK_BASE_INFO PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group3: Source Table:[ODATA_N_BDP.L_LB_TASK:HORAE调度任务类型] 
-----------------------------------------------------------------------------------------------------
SELECT
     A.TASK_ID                               AS  Task_Id                 --任务编号
    ,'HORAE_TASK'                            AS  Task_Cate_Cd            --任务类别代码    --调度平台
    ,A.TASK_NAME                             AS  Schd_Task_Name          --任务名称
    ,NVL(DW_CD_VAL,A.TASK_PRIORITY)          AS  Prior_Cd                --优先级代码
    ,A.CYCLE_UNIT                            AS  Schd_Pd                 --调度周期
    ,A.CYCLE_NUM                             AS  Step_Len                --步长
    ,A.START_DATE                            AS  Vld_Time                --生效时间
    ,A.RUNOVERTIME                           AS  Run_Ovtm_Alr            --运行超时预警
    ,C.DEPENDENCE_SCHD_TASK_ID               AS  Dependence_Schd_Task_Id --依赖调度任务
    ,''                                      AS  Creator_User_Id         --创建人用户编号
    ,A.CREATE_TIME                           AS  Create_Time             --创建时间
    ,A.LAST_UPDATE                           AS  Upd_Time                --更新时间
    ,nvl(A.SCHEDULE_TYPE,'')                 AS  Day_Task_Type_Cd        --日任务类型代码
    ,nvl(A.DATA_TYPE,'')                     AS  Day_Task_Data_Time_Para_Cd--日任务数据时间参数
    ,'${data_src_cd}'                   AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                      AS  Task_Name               --任务名
    ,'${data_day_str}'                  AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                    AS  Data_Time               --数据时间
    ,B.TYPE_ID                               AS  Task_Type_Cd            --任务类型代码
    ,B.TYPE_DESC                             AS  Task_Type_Name          --任务类型名称
    ,A.UPDATE_BY                             AS  Upd_User_Id             --更新用户编号
    ,A.STATUS                                AS  Task_Stat_Cd            --任务状态代码
    ,A.IN_CHARGE                             AS  In_Charge_User_Id       --负责人用户编号
FROM   ODATA_N_BDP.L_LB_TASK  A
LEFT JOIN ODATA_N_BDP.L_LB_TASK_TYPE B
       ON A.task_type=B.type_id
LEFT JOIN (SELECT T1.TASK_TO AS TASK_ID
                 ,CONCAT_WS(',',COLLECT_SET(T1.TASK_FROM)) AS DEPENDENCE_SCHD_TASK_ID
             FROM ODATA_N_BDP.L_LB_TASK_LINK T1
            INNER JOIN ODATA_N_BDP.L_LB_TASK T2 ON T1.TASK_TO=T2.TASK_ID AND T2.STATUS<>'N'---排除下游任务删除的依赖
            INNER JOIN ODATA_N_BDP.L_LB_TASK T3 ON T1.TASK_FROM=T3.TASK_ID AND T3.STATUS<>'N'---排除上游删除的依赖
            WHERE T1.STATUS='Y'
             GROUP BY TASK_TO
)C ON A.TASK_ID=C.TASK_ID
LEFT JOIN (
          SELECT SRC_CD_VAL,DW_CD_VAL
          FROM PDATA_N.REF_CD_CVT_MAP
          WHERE TGT_TAB_NAME = 'T00_TASK_BASE_INFO'
            AND TGT_TAB_FLD  = 'Prior_Cd'
            AND SRC_TAB_NAME = 'L_LB_TASK'
            AND SRC_FLD_NAME = 'TASK_PRIORITY'
            AND SRC_SYS_NAME='BDP') D
ON        A.TASK_PRIORITY = D.SRC_CD_VAL                  --TASK_PRIORITY 转码

;
