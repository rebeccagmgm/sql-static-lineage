-- task_id: 62902
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/FIN/PDATA_N.T09_SUBJ_RELA_H_YAV011.py
-- observed_at: 2026-09-05T01:06:20.421Z

-- createSql
CREATE TABLE IF NOT EXISTS T09_SUBJ_RELA_H(
     Sob_Plan_Id              string comment'账套方案编号'
    ,Subj_Id                  string comment'科目编号'
    ,Subj_Rela_Type_Cd        string comment'科目关系类型代码'
    ,Strt_Date                string comment'开始日期'
    ,Rela_Sob_Plan_Id         string comment'关联账套方案编号'
    ,Rela_Subj_Id             string comment'关联科目编号'
    ,End_Date                 string comment'结束日期'
    ,Data_Src_Cd              string comment'数据来源代码'
    ,Task_Name                string comment'任务名'
    ,DATA_TIME                string comment'数据时间'
    ,Sob_Id                   string comment'账套编号'
    ,Subj_Plan_Id             string comment'科目方案编号'
    ,Rela_Sob_Id              string comment'关联账套编号'
    ,Rela_Subj_Plan_Id        string comment'关联科目方案编号'
    ,Real_Src_Tbl             string comment'真实源表'
)COMMENT '科目关系历史'
PARTITIONED BY (Src_Tbl string comment'源表')
STORED AS ORC;

DROP TABLE IF EXISTS T09_SUBJ_RELA_H_GROUP2_TEMP;
CREATE TABLE IF NOT EXISTS T09_SUBJ_RELA_H_GROUP2_TEMP
as
--***************************************************************************************************
--*Group2: Source Table:[ODATA_N_HAV.V_T_F_SC_KM:科目设置表]
--***************************************************************************************************
SELECT
       C_PLAN_CODE                                        as Sob_Plan_Id1           --账套方案编号
      ,C_KM_CODE                                          as Subj_Id1               --科目编号
      ,'01'                                               as Subj_Rela_Type_Cd1     --科目关系类型代码
      ,'${data_day_str}'                             as Strt_Date1             --开始日期
      ,C_PLAN_CODE                                        as Rela_Sob_Plan_Id1      --关联账套方案编号
      ,C_KM_CODE_P                                        as Rela_Subj_Id1          --关联科目编号
      ,'2099-12-31'                                       as End_Date1              --结束日期
      ,'YAV'                                              as Data_Src_Cd1           --数据来源代码
      ,C_PLAN_CODE                                        as Sob_Id1                --账套编号
      ,''                                                 as Subj_Plan_Id1          --科目方案编号
      ,C_PLAN_CODE                                        as Rela_Sob_Id1           --关联账套编号
      ,''                                                 as Rela_Subj_Plan_Id1     --关联科目方案编号
      ,'ODATA_N_HAV.V_T_F_SC_KM'                          as Real_Src_Tbl1          --真实源表
      ,'ODATA_N_HAV.V_T_F_SC_KM'                          as Src_Tbl1               --源表
      ,UPPER('${filename}')                          as Task_Name1             --任务名
FROM  ${src_table_hav}.V_T_F_SC_KM A
WHERE A.BUSI_DATE='${data_day_str}'
;

DROP TABLE IF EXISTS T09_SUBJ_RELA_H_GROUP2_MID;
CREATE TABLE IF NOT EXISTS T09_SUBJ_RELA_H_GROUP2_MID
AS
SELECT
        A.*
       ,B.*
       ,CASE WHEN A.Sob_Plan_Id IS     NULL AND B.Sob_Plan_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
             WHEN A.Sob_Plan_Id IS NOT NULL AND B.Sob_Plan_Id1 IS NULL THEN 'D'               --历史不存在当天的数据为删除
             WHEN A.Sob_Plan_Id IS NOT NULL AND B.Sob_Plan_Id1 IS NOT NULL AND (
                   NVL(A.Rela_Sob_Plan_Id ,'') <> NVL(B.Rela_Sob_Plan_Id1, '')
                OR NVL(A.Rela_Subj_Id ,'')     <> NVL(B.Rela_Subj_Id1, '')
                OR NVL(A.Sob_Id ,'')            <> NVL(B.Sob_Id1, '')
                OR NVL(A.Subj_Plan_Id ,'')      <> NVL(B.Subj_Plan_Id1, '')
                OR NVL(A.Rela_Sob_Id ,'')       <> NVL(B.Rela_Sob_Id1, '')
                OR NVL(A.Rela_Subj_Plan_Id ,'') <> NVL(B.Rela_Subj_Plan_Id1, '')
             ) THEN 'U'                                                                       --当天和历史均存在,除主键外如有字段变更为变更
             ELSE 'S'                                                                         --其他为无变更
             END  AS DATA_TYPE
FROM (SELECT * FROM T09_SUBJ_RELA_H
       WHERE STRT_DATE <= '${data_day_str}'
         AND END_DATE  >  '${data_day_str}'
         AND Src_Tbl   ='ODATA_N_HAV.V_T_F_SC_KM')A    --历史(昨日)开链数据
FULL OUTER JOIN T09_SUBJ_RELA_H_GROUP2_TEMP  B  --当天的数据
ON   A.Sob_Plan_Id  = B.Sob_Plan_Id1
AND  A.Subj_Id     = B.Subj_Id1

;

-- querySql
INSERT OVERWRITE TABLE T09_SUBJ_RELA_H PARTITION (Src_Tbl)
 --剔除当天开链的数据
SELECT
      Sob_Plan_Id                 --账套方案编号
     ,Subj_Id                     --科目编号
     ,Subj_Rela_Type_Cd           --科目关系类型代码
     ,Strt_Date                   --开始日期
     ,Rela_Sob_Plan_Id            --关联账套方案编号
     ,Rela_Subj_Id                --关联科目编号
     ,End_Date                    --结束日期
     ,Data_Src_Cd                 --数据来源代码
     ,Task_Name                   --任务名
     ,DATA_TIME                   --数据时间
     ,Sob_Id                      --账套编号
     ,Subj_Plan_Id                --科目方案编号
     ,Rela_Sob_Id                 --关联账套编号
     ,Rela_Subj_Plan_Id           --关联科目方案编号
     ,Real_Src_Tbl                --真实源表
     ,Src_Tbl                     --源表
FROM T09_SUBJ_RELA_H
WHERE STRT_DATE !='${data_day_str}'
  AND END_DATE  !='${data_day_str}'
  AND Src_Tbl    ='ODATA_N_HAV.V_T_F_SC_KM'
 --当天闭链的数据恢复到原始状态
UNION ALL
SELECT
      Sob_Plan_Id                 --账套方案编号
     ,Subj_Id                     --科目编号
     ,Subj_Rela_Type_Cd           --科目关系类型代码
     ,Strt_Date                   --开始日期
     ,Rela_Sob_Plan_Id            --关联账套方案编号
     ,Rela_Subj_Id                --关联科目编号
     ,'2099-12-31' as End_Date    --结束日期
     ,Data_Src_Cd                 --数据来源代码
     ,Task_Name                   --任务名
     ,DATA_TIME                   --数据时间
     ,Sob_Id                      --账套编号
     ,Subj_Plan_Id                --科目方案编号
     ,Rela_Sob_Id                 --关联账套编号
     ,Rela_Subj_Plan_Id           --关联科目方案编号
     ,Real_Src_Tbl                --真实源表
     ,Src_Tbl                     --源表
FROM T09_SUBJ_RELA_H
WHERE END_DATE  ='${data_day_str}'
 AND  Src_Tbl   ='ODATA_N_HAV.V_T_F_SC_KM'
;

INSERT OVERWRITE TABLE T09_SUBJ_RELA_H PARTITION (Src_Tbl='ODATA_N_HAV.V_T_F_SC_KM')
 --历史闭链的无效数据插回目标表
SELECT
       Sob_Plan_Id                 --账套方案编号
      ,Subj_Id                     --科目编号
      ,Subj_Rela_Type_Cd           --科目关系类型代码
      ,Strt_Date                   --开始日期
      ,Rela_Sob_Plan_Id            --关联账套方案编号
      ,Rela_Subj_Id                --关联科目编号
      ,End_Date                    --结束日期
      ,Data_Src_Cd                 --数据来源代码
      ,Task_Name                   --任务名
      ,DATA_TIME                   --数据时间
      ,Sob_Id                      --账套编号
      ,Subj_Plan_Id                --科目方案编号
      ,Rela_Sob_Id                 --关联账套编号
      ,Rela_Subj_Plan_Id           --关联科目方案编号
      ,Real_Src_Tbl                --真实源表
FROM  T09_SUBJ_RELA_H
WHERE NOT (STRT_DATE <= '${data_day_str}'
  AND END_DATE  >  '${data_day_str}')  --历史无效数据
  AND Src_Tbl='ODATA_N_HAV.V_T_F_SC_KM'
UNION ALL
 --当天有变动和新增的数据开链
SELECT
       Sob_Plan_Id1                 as Sob_Plan_Id         --账套方案编号
      ,Subj_Id1                     as Subj_Id             --科目编号
      ,Subj_Rela_Type_Cd1           as Subj_Rela_Type_Cd   --科目关系类型代码
      ,'${data_day_str}'      as Strt_Date            --开始日期
      ,Rela_Sob_Plan_Id1            as Rela_Sob_Plan_Id    --关联账套方案编号
      ,Rela_Subj_Id1                as Rela_Subj_Id        --关联科目编号
      ,End_Date1                   as End_Date             --结束日期
      ,DATA_SRC_CD1                as DATA_SRC_CD          --数据来源代码
      ,TASK_NAME1                  as TASK_NAME            --任务名
      ,'${data_today}'        AS DATA_TIME            --数据时间
      ,Sob_Id1                     as Sob_Id               --账套编号
      ,Subj_Plan_Id1               as Subj_Plan_Id         --科目方案编号
      ,Rela_Sob_Id1                as Rela_Sob_Id          --关联账套编号
      ,Rela_Subj_Plan_Id1          as Rela_Subj_Plan_Id    --关联科目方案编号
      ,Real_Src_Tbl1               as Real_Src_Tbl         --真实源表
FROM  T09_SUBJ_RELA_H_GROUP2_MID WHERE DATA_TYPE IN ('I','U') --新增-I,变更-U
UNION ALL
 --历史有变动和不存在当天的数据闭链
SELECT
       Sob_Plan_Id                          --账套方案编号
      ,Subj_Id                              --科目编号
      ,Subj_Rela_Type_Cd                    --科目关系类型代码
      ,Strt_Date                            --开始日期
      ,Rela_Sob_Plan_Id                     --关联账套方案编号
      ,Rela_Subj_Id                         --关联科目编号
      ,'${data_day_str}'  AS END_DATE  --结束日期
      ,DATA_SRC_CD                          --数据来源代码
      ,TASK_NAME                            --任务名
      ,'${data_today}'    as DATA_TIME --数据时间
      ,Sob_Id                          --账套编号
      ,Subj_Plan_Id                    --科目方案编号
      ,Rela_Sob_Id                     --关联账套编号
      ,Rela_Subj_Plan_Id               --关联科目方案编号
      ,Real_Src_Tbl                    --真实源表
FROM  T09_SUBJ_RELA_H_GROUP2_MID WHERE DATA_TYPE IN ('D','U')  --变更-U,删除-D
UNION ALL
 --无变动的数据插回目标表
SELECT
       Sob_Plan_Id                          --账套方案编号
      ,Subj_Id                              --科目编号
      ,Subj_Rela_Type_Cd                    --科目关系类型代码
      ,Strt_Date                            --开始日期
      ,Rela_Sob_Plan_Id                     --关联账套方案编号
      ,Rela_Subj_Id                         --关联科目编号
      ,End_Date                             --结束日期
      ,Data_Src_Cd                          --数据来源代码
      ,Task_Name                            --任务名
      ,DATA_TIME                            --数据时间
      ,Sob_Id                               --账套编号
      ,Subj_Plan_Id                         --科目方案编号
      ,Rela_Sob_Id                          --关联账套编号
      ,Rela_Subj_Plan_Id                    --关联科目方案编号
      ,Real_Src_Tbl                         --真实源表
FROM  T09_SUBJ_RELA_H_GROUP2_MID WHERE DATA_TYPE ='S' --无变更-S
;
