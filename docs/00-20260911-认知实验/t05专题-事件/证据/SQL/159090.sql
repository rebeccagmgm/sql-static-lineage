-- task_id: 159090
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_RMS_EMP_GRP_PERF_PUSH_EVT_RMS097.py
-- observed_at: 2026-09-05T01:07:04.267Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_RMS_EMP_GRP_PERF_PUSH_EVT(
         Evt_Id                     STRING COMMENT '事件编号'
        ,Src_Id                     STRING COMMENT '源编号'
        ,Scor_Year                  STRING COMMENT '派点年份'
        ,Scor_Qtr                   STRING COMMENT '派点季度'
        ,Emp_Grp_Id                 STRING COMMENT '员工组编号'
        ,Emp_Grp_Full_Name_Ch       STRING COMMENT '员工组中文名称'
        ,Evt_Type_Cd                STRING COMMENT '事件类型代码'
        ,Push_Stat_Cd               STRING COMMENT '推送状态代码'
        ,Push_Time                  STRING COMMENT '推送时间'
        ,Canc_Time                  STRING COMMENT '撤回时间'
        ,Oper_Emp_Id                STRING COMMENT '操作人员工编号'
        ,Create_Time                STRING COMMENT '创建时间'
        ,Upd_Time                   STRING COMMENT '更新时间'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
    )COMMENT '投研员工组业绩推送事件'
    PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_RMS_EMP_GRP_PERF_PUSH_EVT PARTITION(SRC_TBL='${src_table}')
    -----------------------------------------------------------------------------------------------------
    --Group1.: Source Table:[ODATA_N_RMS.N_ACHIEVEMENT_PUSH_TASK:绩效推送主表] 
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT( 'RMS097-',A.YEAR,'-',A.QUARTER,'-',A.GROUP_CODE)
                                                 AS  Evt_Id                  --事件编号      
        ,A.ID                                    AS  Src_Id                  --源编号        
        ,A.YEAR                                  AS  Scor_Year               --派点年份      
        ,A.QUARTER                               AS  Scor_Qtr                --派点季度      
        ,A.GROUP_CODE                            AS  Emp_Grp_Id              --员工组编号    
        ,B.GROUP_NAME                            AS  Emp_Grp_Full_Name_Ch    --员工组中文名称
        ,NVL(F.DW_CD_VAL,A.PUSH_TYPE)            AS  Evt_Type_Cd             --事件类型代码  
        ,A.PUSH_STATUS                           AS  Push_Stat_Cd            --推送状态代码  
        ,A.PUSH_TIME                             AS  Push_Time               --推送时间      
        ,A.CANCEL_TIME                           AS  Canc_Time               --撤回时间      
        ,NVL(E.ERP_ID,D.USERNAME)                AS  Oper_Emp_Id             --操作人员工编号
        ,A.CREATE_TIME                           AS  Create_Time             --创建时间      
        ,A.UPDATE_TIME                           AS  Upd_Time                --更新时间      
        ,'${data_src_cd}'                   AS  Data_Src_Cd             --数据来源代码
        ,'${filename}'                      AS  Task_Name               --任务名
        ,'${data_day_str}'                  AS  Data_Etl_Date           --数据加载日期
        ,'${data_today_str}'                AS  Data_Upt_Date           --数据更新日期
        ,'${data_today}'                    AS  Data_Time               --数据时间
        ,'${src_table}'                     AS  Real_Src_Tbl            --真实源表
    FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' AND REMOVE_TAG<>'1')A
    LEFT JOIN(SELECT * FROM ODATA_N_RMS.N_ANL_GROUP WHERE BUSI_DATE='${data_day_str}' AND REMOVE_TAG <> '1')B
           ON A.GROUP_CODE=B.GROUP_CODE
    LEFT JOIN (SELECT  USERID,ORGID FROM ODATA_N_RMS.N_SPRT_ORGOBJECT WHERE BUSI_DATE ='${data_day_str}') C
           ON A.OPERATOR_ID =C.ORGID
    LEFT JOIN (SELECT * FROM ODATA_N_RMS.N_UM_USERINFO WHERE BUSI_DATE='${data_day_str}') D
           ON C.USERID=D.USERID
    LEFT JOIN (SELECT DISTINCT ERP_ID,LOGIN_ID FROM ODATA_N_IOA.I_GF_USER WHERE BUSI_DATE='${data_day_str}'
                         AND MAIN_DEPARTMENT = 'true' AND ERP_ID IS NOT NULL
               UNION ALL
               SELECT DISTINCT ERP_ID,LOGIN_ID FROM ODATA_N_IOA.I_GF_USER_DEL WHERE BUSI_DATE='${data_day_str}'
                        AND MAIN_DEPARTMENT = 'true' AND ERP_ID IS NOT NULL) E
    ON trim(D.USERNAME)= E.LOGIN_ID
    LEFT JOIN (
             SELECT SRC_CD_VAL,DW_CD_VAL
               FROM PDATA_N.REF_CD_CVT_MAP
             WHERE TGT_TAB_NAME = 'T05_RMS_EMP_GRP_PERF_PUSH_EVT'
                AND TGT_TAB_FLD  = 'Evt_Type_Cd'
                AND TRIM(SRC_TAB_NAME) = 'ACHIEVEMENT_PUSH_TASK'
                AND SRC_FLD_NAME = 'PUSH_TYPE'
                AND SRC_SYS_NAME='RMS')F
       ON      A.PUSH_TYPE =F.SRC_CD_VAL                  --PUSH_TYPE 转码
    ;
