-- task_id: 61607
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/ORG/PDATA_N.T04_INR_ORG_RELA_H_RCC001.py
-- observed_at: 2026-09-05T01:06:19.443Z

-- createSql
CREATE TABLE IF NOT EXISTS T04_INR_ORG_RELA_H
(
Inr_Org_Id           string comment'内部机构编号',
Inr_Org_Rela_Type_Cd string comment'内部机构关系类型代码',
Strt_Date            string comment'开始日期',
Inr_Org_Cate_Cd      string comment'内部机构类别代码',
Rela_Inr_Org_Id      string comment'关联内部机构编号',
End_Date             string comment'结束日期',
Data_Src_Cd          string comment'数据来源代码',
Task_Name            string comment'任务名',
Data_Time            string comment'数据时间',
Real_Src_Tbl         STRING COMMENT '真实源表'
)comment'内部机构关系历史'
PARTITIONED BY(Src_Tbl  string comment'源表')
stored as orc;

DROP TABLE IF EXISTS T04_INR_ORG_RELA_H_RCC001_temp;
CREATE TABLE IF NOT EXISTS T04_INR_ORG_RELA_H_RCC001_temp
as
--***************************************************************************************************
--*Group1: Source Table:[ODATA_N_RCC.U_ALLBRANCH:券商机构表]
--***************************************************************************************************
SELECT
       lpad(BRANCH_NO,4,'0')                  as Inr_Org_Id1            --内部机构编号
      ,'10'                                   as Inr_Org_Rela_Type_Cd1  --内部机构关系类型代码
      ,'${data_day_str}'                 as Strt_Date1             --开始日期
      ,'1'                                    as Inr_Org_Cate_Cd1       --内部机构类别代码
      ,lpad(UP_BRANCH_NO,4,'0')               as Rela_Inr_Org_Id1       --关联内部机构编号
      ,'2099-12-31'                           as End_Date1              --结束日期
      ,'RCC'                                  as Data_Src_Cd1           --数据来源代码
      ,'ODATA_N_RCC.U_ALLBRANCH'              as Src_Tbl1               --源表
      ,UPPER('${filename}')              as Task_Name1             --任务名
      ,'ODATA_N_RCC.U_ALLBRANCH'              as Real_Src_Tbl1          --真实源表
FROM  ${src_table_rcc}.U_ALLBRANCH
WHERE Busi_Date='${data_day_str}'
;

DROP TABLE IF EXISTS T04_INR_ORG_RELA_H_RCC001_mid;
create table T04_INR_ORG_RELA_H_RCC001_mid
as
SELECT
 a.*
,b.*
,case when a.Inr_Org_Id is     null and b.Inr_Org_Id1 is not null then 'I'  --新增
      when a.Inr_Org_Id is not null and b.Inr_Org_Id1 is     null then 'D'  --删除
      when a.Inr_Org_Id is not null and b.Inr_Org_Id1 is not null and
            (    nvl(a.Rela_Inr_Org_Id, '')<> nvl(b.Rela_Inr_Org_Id1,'')
            ) then 'UP'  --变更
       else 'S'  --无变更
       end as data_type --数据类型
FROM (SELECT * FROM T04_INR_ORG_RELA_H
              WHERE strt_date<='${data_day_str}' and end_date >'${data_day_str}'
                AND Src_Tbl ='ODATA_N_RCC.U_ALLBRANCH')a
FULL OUTER JOIN T04_INR_ORG_RELA_H_RCC001_temp b
  on a.Inr_Org_Id  =  b.Inr_Org_Id1
 and a.Inr_Org_Rela_Type_Cd=b.Inr_Org_Rela_Type_Cd1
 and a.Inr_Org_Cate_Cd=b.Inr_Org_Cate_Cd1

-- querySql
INSERT OVERWRITE TABLE T04_INR_ORG_RELA_H PARTITION(Src_Tbl)
SELECT
       Inr_Org_Id             --内部机构编号
      ,Inr_Org_Rela_Type_Cd   --内部机构关系类型代码
      ,Strt_Date              --开始日期
      ,Inr_Org_Cate_Cd        --内部机构类别代码
      ,Rela_Inr_Org_Id        --关联内部机构编号
      ,End_Date               --结束日期
      ,Data_Src_Cd            --数据来源代码
      ,Task_Name              --任务名
      ,DATA_TIME              --数据时间
      ,Real_Src_Tbl           --真实源表
      ,Src_Tbl                --源表
FROM  T04_INR_ORG_RELA_H
WHERE STRT_DATE !='${data_day_str}'
  AND END_DATE  !='${data_day_str}'
  AND Src_Tbl ='ODATA_N_RCC.U_ALLBRANCH'
UNION ALL
SELECT
       Inr_Org_Id             --内部机构编号
      ,Inr_Org_Rela_Type_Cd   --内部机构关系类型代码
      ,Strt_Date              --开始日期
      ,Inr_Org_Cate_Cd        --内部机构类别代码
      ,Rela_Inr_Org_Id        --关联内部机构编号
      ,'2099-12-31' as End_Date --结束日期
      ,Data_Src_Cd            --数据来源代码
      ,Task_Name              --任务名
      ,DATA_TIME              --数据时间
      ,Real_Src_Tbl           --真实源表
      ,Src_Tbl                --源表
FROM  T04_INR_ORG_RELA_H
WHERE END_DATE ='${data_day_str}'
  AND Src_Tbl ='ODATA_N_RCC.U_ALLBRANCH'
;

INSERT OVERWRITE TABLE T04_INR_ORG_RELA_H PARTITION(Src_Tbl)
SELECT
       Inr_Org_Id             --内部机构编号
      ,Inr_Org_Rela_Type_Cd   --内部机构关系类型代码
      ,Strt_Date              --开始日期
      ,Inr_Org_Cate_Cd        --内部机构类别代码
      ,Rela_Inr_Org_Id        --关联内部机构编号
      ,End_Date               --结束日期
      ,Data_Src_Cd            --数据来源代码
      ,Task_Name              --任务名
      ,DATA_TIME              --数据时间
      ,Real_Src_Tbl           --真实源表
      ,Src_Tbl                --源表
FROM  T04_INR_ORG_RELA_H
WHERE not (strt_date<='${data_day_str}' and end_date >'${data_day_str}') --插入没有对比的数据
  AND Src_Tbl ='ODATA_N_RCC.U_ALLBRANCH'
UNION ALL
SELECT
       Inr_Org_Id             --内部机构编号
      ,Inr_Org_Rela_Type_Cd   --内部机构关系类型代码
      ,Strt_Date              --开始日期
      ,Inr_Org_Cate_Cd        --内部机构类别代码
      ,Rela_Inr_Org_Id        --关联内部机构编号
      ,End_Date               --结束日期
      ,Data_Src_Cd            --数据来源代码
      ,Task_Name              --任务名
      ,DATA_TIME              --数据时间
      ,Real_Src_Tbl           --真实源表
      ,Src_Tbl                --源表
FROM  T04_INR_ORG_RELA_H_RCC001_mid  WHERE data_type in ('S') --当天对比无变化的数据
UNION ALL
SELECT
       Inr_Org_Id1               as Inr_Org_Id             --内部机构编号
      ,Inr_Org_Rela_Type_Cd1     as Inr_Org_Rela_Type_Cd   --内部机构关系类型代码
      ,Strt_Date1                as Strt_Date              --开始日期
      ,Inr_Org_Cate_Cd1          as Inr_Org_Cate_Cd        --内部机构类别代码
      ,Rela_Inr_Org_Id1          as Rela_Inr_Org_Id        --关联内部机构编号
      ,End_Date1                 as End_Date               --结束日期
      ,Data_Src_Cd1              as Data_Src_Cd            --数据来源代码
      ,Task_Name1                as Task_Name              --任务名
      ,'${data_today}'      as data_time              --数据时间
      ,Real_Src_Tbl1             as Real_Src_Tbl           --真实源表
      ,Src_Tbl1                  as Src_Tbl                --源表
FROM  T04_INR_ORG_RELA_H_RCC001_mid  WHERE data_type in ('I','UP') --当天新增/变更的数据开链
UNION ALL
SELECT
       Inr_Org_Id                           --内部机构编号
      ,Inr_Org_Rela_Type_Cd                 --内部机构关系类型代码
      ,Strt_Date                            --开始日期
      ,Inr_Org_Cate_Cd                      --内部机构类别代码
      ,Rela_Inr_Org_Id                      --关联内部机构编号
      ,'${data_day_str}' as End_Date   --结束日期
      ,Data_Src_Cd                          --数据来源代码
      ,Task_Name                            --任务名
     ,'${data_today}'    as data_time  --数据时间
     ,Real_Src_Tbl                         --真实源表
      ,Src_Tbl                              --源表
FROM T04_INR_ORG_RELA_H_RCC001_mid  WHERE data_type in ('D','UP') --历史不存在当天的数据,删除/变更状态闭链
