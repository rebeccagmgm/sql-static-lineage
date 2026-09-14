-- task_id: 61612
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/ORG/PDATA_N.T04_USER_EMP_RELA_H_IOA004.py
-- observed_at: 2026-09-05T01:06:19.479Z

-- createSql
CREATE TABLE IF NOT EXISTS  T04_USER_EMP_RELA_H(
     User_Id                   string comment '用户编号'
    ,User_Emp_Rela_Type_Cd     string comment '用户员工关系类型代码'
    ,Emp_Id                    string comment '员工编号'
    ,Strt_Date                 string comment '开始日期'
    ,End_Date                  string comment '结束日期'
    ,Del_Flag                  string comment '删除标志'
    ,Del_Date                  string comment '删除日期'
    ,Data_Src_Cd               string comment '数据来源代码'
    ,Task_Name                 string comment '任务名'
    ,Data_Etl_Date             string comment '数据加载日期'
    ,Data_Upt_Date             string comment '数据更新日期'
    ,Data_Time                 string comment '数据时间'
)COMMENT '用户员工关系历史'
PARTITIONED BY (Src_Tbl   string comment '源表')
STORED AS ORC;

DROP TABLE IF EXISTS TEMP.T04_USER_EMP_RELA_H_IOA004_TEMP;
CREATE TABLE TEMP.T04_USER_EMP_RELA_H_IOA004_TEMP
AS
--***************************************************************************************************
--*Group1: Source Table:[ODATA_N_IOA.I_GF_USER：员工表] MAIN_DEPARTMENT='true' and ERP_ID is not null
--***************************************************************************************************
SELECT
        TT.LOGIN_ID                   AS User_Id1
       ,'10'                          AS User_Emp_Rela_Type_Cd1
       ,TT.CODE                       AS Emp_Id1
       ,TT.EMPLOYED_DATE              AS Strt_Date1
       ,TT.DIMISSION_DATE             AS End_Date1
       ,'OAS'                         AS Data_Src_Cd1
       ,'ODATA_N_OAS.P_GF_USER'       AS Src_Tbl1
       ,UPPER('${filename}')     AS Task_Name1
       ,'${data_day_str}'        AS Data_Etl_Date1
       ,'${data_today_str}'      AS Data_Upt_Date1
FROM (
      SELECT  LOGIN_ID
             ,CODE 
             ,EMPLOYED_DATE
             ,DIMISSION_DATE
             ,ROW_NUMBER()OVER(PARTITION BY CODE ORDER BY FLAG DESC ,DIMISSION_DATE DESC, EMPLOYED_DATE DESC) RN  --ps:以code唯一入仓，如一个员工多个oa,以DIMISSION_DATE 离职日期倒叙取最新的一条
        FROM (
            SELECT LOGIN_ID
                  ,CODE  --智慧人力营销人员新入职的数据可能会有延迟，无对应关系传给OA，需等到员工入职后才有对应的CODE
                  ,EMPLOYED_DATE
                  ,DIMISSION_DATE
                  ,'1' AS FLAG
              FROM ODATA_N_IOA.I_GF_USER 
             WHERE BUSI_DATE='${data_day_str}'
               AND MAIN_DEPARTMENT='true' 
             UNION ALL 
            SELECT LOGIN_ID
                  ,CASE WHEN TRIM(NVL(ERP_ID,''))<>''  AND STAFF_TYPE='staff'   THEN ERP_ID   --erpid不为空，且员工类型为定职级取erp_id
                        WHEN TRIM(NVL(SALES_CODE,''))<>'' AND STAFF_TYPE='sales' THEN SALES_CODE   --sales_code不为空，且员工类型为营销取sales_code
                        WHEN TRIM(NVL(SALES_CODE,''))='' AND STAFF_TYPE='sales' THEN LOGIN_ID   --sales_code为空，且员工类型为营销取login_id
                        WHEN TRIM(NVL(ERP_ID,''))<>'' THEN ERP_ID  --兜底逻辑
                        END AS CODE
                  ,EMPLOYED_DATE
                  ,DIMISSION_DATE
                  ,'0' AS FLAG
              FROM ODATA_N_IOA.I_GF_USER_DEL 
             WHERE BUSI_DATE='${data_day_str}'
               AND MAIN_DEPARTMENT='true'
              )T WHERE TRIM(NVL(CODE,'')) <>'' --工号不为空
                 )TT
     WHERE TT.RN=1
----***************************************************************************************************
----*Group2: Source Table:[ODATA_N_IOA.I_GF_USER：员工表] MAIN_DEPARTMENT='true' and STAFF_TYPE='sales'
----***************************************************************************************************
--
--UNION ALL
--SELECT
--        B.LOGIN_ID                    AS User_Id1
--       ,'10'                          AS User_Emp_Rela_Type_Cd1
--       ,B.LOGIN_ID                    AS Emp_Id1
--       ,B.EMPLOYED_DATE               AS Strt_Date1
--       ,B.DIMISSION_DATE              AS End_Date1
--       ,'OAS'                         AS Data_Src_Cd1
--       ,'ODATA_N_OAS.P_GF_USER'       AS Src_Tbl1
--       ,UPPER('${filename}')     AS Task_Name1
--       ,'${data_day_str}'        AS Data_Etl_Date1
--       ,'${data_today_str}'      AS Data_Upt_Date1
--FROM (
--      SELECT
--              NVL(UR.LOGIN_ID,UD.LOGIN_ID)             AS LOGIN_ID
--             ,NVL(UR.ERP_ID ,UD.ERP_ID)                AS ERP_ID
--             ,NVL(UR.EMPLOYED_DATE,UD.EMPLOYED_DATE)   AS EMPLOYED_DATE
--             ,NVL(UR.DIMISSION_DATE,UD.DIMISSION_DATE) AS DIMISSION_DATE
--             ,ROW_NUMBER() OVER(PARTITION BY NVL(UR.LOGIN_ID,UD.LOGIN_ID) ORDER BY NVL(UR.EMPLOYED_DATE,UD.EMPLOYED_DATE),NVL(UR.DIMISSION_DATE,UD.DIMISSION_DATE) DESC) AS RN
--        FROM (SELECT * FROM ODATA_N_IOA.I_GF_USER
--                WHERE BUSI_DATE='${data_day_str}'
--                  AND STAFF_TYPE='sales'
--                  AND UPPER(MAIN_DEPARTMENT) = 'TRUE'
--        )  UR
--      FULL OUTER JOIN (SELECT * FROM ODATA_N_IOA.I_GF_USER_DEL
--                        WHERE BUSI_DATE='${data_day_str}'
--                        AND STAFF_TYPE='sales'
--                        AND UPPER(MAIN_DEPARTMENT) = 'TRUE')UD
--      ON UR.USER_ID=UD.USER_ID
--     ) B  --当天的数据
--WHERE RN=1
;

DROP TABLE IF EXISTS TEMP.T04_USER_EMP_RELA_H_IOA004_MID;
CREATE TABLE IF NOT EXISTS TEMP.T04_USER_EMP_RELA_H_IOA004_MID
AS
SELECT
       A.*
      ,B.*
      ,CASE WHEN A.User_Id IS NULL     AND B.User_Id1 IS NOT NULL THEN 'I' --新增
            WHEN A.User_Id IS NOT NULL AND B.User_Id1 IS     NULL THEN 'D' --删除
            WHEN A.User_Id IS NOT NULL AND B.User_Id1 IS NOT NULL AND (
               COALESCE(A.Strt_Date            ,'') <> COALESCE(B.Strt_Date1             ,'')
            OR COALESCE(A.End_Date             ,'') <> COALESCE(B.End_Date1              ,'')
             ) THEN 'U' --变更
            ELSE  'S' --无变更
            END AS DATA_TYPE
FROM  (SELECT * FROM T04_USER_EMP_RELA_H  WHERE SRC_TBL='ODATA_N_OAS.P_GF_USER')A --拆分后只对比该表的数据
FULL OUTER JOIN TEMP.T04_USER_EMP_RELA_H_IOA004_TEMP B
ON    A.User_Id=B.User_Id1
AND   A.Emp_Id =B.Emp_Id1
;

-- querySql
INSERT OVERWRITE TABLE T04_USER_EMP_RELA_H PARTITION (Src_Tbl)
 --剔除当日新增的数据
SELECT
*
FROM T04_USER_EMP_RELA_H
WHERE DATA_ETL_DATE !='${data_day_str}'
AND SRC_TBL='ODATA_N_OAS.P_GF_USER'
;

INSERT OVERWRITE TABLE T04_USER_EMP_RELA_H PARTITION(Src_Tbl)
SELECT
      User_Id                                           --用户编号
     ,User_Emp_Rela_Type_Cd                             --用户员工关系类型代码
     ,Emp_Id                                            --员工编号
     ,Strt_Date                                         --入职日期
     ,End_Date                                          --离职日期
     ,'0'                    AS Del_Flag                --删除标志
     ,''                     AS Del_Date                --删除日期
     ,Data_Src_Cd                                       --数据来源代码
     ,Task_Name                                         --任务名
     ,Data_Etl_Date                                     --数据加载日期
     ,Data_Upt_Date                                     --数据更新日期
     ,Data_Time                                         --数据时间
     ,Src_Tbl                                           --源表
FROM TEMP.T04_USER_EMP_RELA_H_IOA004_MID WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
      User_Id1                  AS User_Id               --用户编号
     ,User_Emp_Rela_Type_Cd1    AS User_Emp_Rela_Type_Cd --用户员工关系类型代码
     ,Emp_Id1                   AS Emp_Id                --员工编号
     ,Strt_Date1                AS Strt_Date             --入职日期
     ,End_Date1                 AS End_Date              --离职日期
     ,'0'                       As Del_Flag              --删除标志
     ,''                        As Del_Date              --删除日期
     ,Data_Src_Cd1              As Data_Src_Cd           --数据来源代码
     ,Task_Name1                As Task_Name             --任务名
     ,Data_Etl_Date1            As Data_Etl_Date         --数据加载日期
     ,Data_Upt_Date1            As Data_Upt_Date         --数据更新日期
     ,'${data_today}'      AS Data_Time             --数据时间
     ,Src_Tbl1                  AS Src_Tbl               --源表
FROM TEMP.T04_USER_EMP_RELA_H_IOA004_MID WHERE DATA_TYPE IN ('I','U') --插入新增的数据和有变更的值
UNION ALL
SELECT
      User_Id                                           --用户编号
     ,User_Emp_Rela_Type_Cd                             --用户员工关系类型代码
     ,Emp_Id                                            --员工编号
     ,Strt_Date                                         --入职日期
     ,End_Date                                          --离职日期
     ,'1' Del_Flag                                      --删除标志
     ,CASE WHEN DEL_DATE !=''
           THEN DEL_DATE
           ELSE '${data_day_str}'
           END                AS   Del_Date             --删除日期
     ,Data_Src_Cd                                       --数据来源代码
     ,Task_Name                                         --任务名
     ,Data_Etl_Date                                     --数据加载日期
     ,CASE WHEN Del_Date !=''
           THEN Data_Upt_Date
           ELSE '${data_day_str}'
           END               AS Data_Upt_Date           --数据更新日期
     ,CASE WHEN Del_Date !=''
           THEN Data_Time
           ELSE '${data_today}'
           END               AS Data_Time               --数据时间
     ,Src_Tbl                                           --源表
FROM TEMP.T04_USER_EMP_RELA_H_IOA004_MID WHERE DATA_TYPE='D'  --插入删除的数据
;
