-- task_id: 61606
-- hiveDb: PDATA_N
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/ORG/PDATA_N.T04_INR_ORG_RELA_H_ERP011.py
-- observed_at: 2026-09-08T05:32:17.598Z

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

CREATE TABLE IF NOT EXISTS T04_INR_ORG_RELA_H_ERP011_TEMP 
as 
SELECT 
       concat('ERP-',ORG_ID)                     as Inr_Org_Id1            --内部机构编号 
      ,'11'                                      as Inr_Org_Rela_Type_Cd1  --内部机构关系类型代码 
      ,'2024-03-21'                    as Strt_Date1             --开始日期 
      ,'2'                                       as Inr_Org_Cate_Cd1       --内部机构类别代码 
      ,substr(ORG_CODE,-4)                       as Rela_Inr_Org_Id1       --关联内部机构编号 
      ,'2099-12-31'                              as End_Date1              --结束日期 
      ,'ERP'                                     as Data_Src_Cd1           --数据来源代码 
      ,'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'   as Src_Tbl1               --源表 
      ,UPPER('PDATA_N.T04_INR_ORG_RELA_H_ERP011')                 as Task_Name1             --任务名 
      ,'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'   AS Real_Src_Tbl1          --真实源表 
FROM  ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V 
WHERE Busi_Date='2024-03-21' 
  AND (TYPE_CODE IN ('07SUB_SECT','07SUB_SECT2','07SUB_SECT3','05SUB') OR ORG_ID IN ('505','1131','4534','4533','559','414','660','2551','3632','1191','387','503','504','5358','591','656'))   --modify by hzh 20230412 添加6个总部直属营业部特殊处理  
UNION ALL 
SELECT 
       concat('ERP-',ORG_ID)                      as Inr_Org_Id1            --内部机构编号 
      ,'12'                                       as Inr_Org_Rela_Type_Cd1  --内部机构关系类型代码 
      ,'2024-03-21'                     as Strt_Date1             --开始日期 
      ,'2'                                        as Inr_Org_Cate_Cd1       --内部机构类别代码 
      ,concat('LPS-',XINYI_CODE)                  as Rela_Inr_Org_Id1       --关联内部机构编号 
      ,'2099-12-31'                               as End_Date1              --结束日期 
      ,'ERP'                                      as Data_Src_Cd1           --数据来源代码 
      ,'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'    as Src_Tbl1               --源表 
      ,UPPER('PDATA_N.T04_INR_ORG_RELA_H_ERP011')                  as Task_Name1             --任务名 
      ,'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'    AS Real_Src_Tbl1          --真实源表 
FROM  ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V 
WHERE Busi_Date='2024-03-21' 
;

create table T04_INR_ORG_RELA_H_ERP011_MID 
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
              WHERE strt_date<='2024-03-21' and end_date >'2024-03-21' 
                AND Src_Tbl ='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V')a 
FULL OUTER JOIN T04_INR_ORG_RELA_H_ERP011_TEMP b 
  on a.Inr_Org_Id  =  b.Inr_Org_Id1 
 and a.Inr_Org_Rela_Type_Cd=b.Inr_Org_Rela_Type_Cd1 
 and a.Inr_Org_Cate_Cd=b.Inr_Org_Cate_Cd1 ;

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
WHERE STRT_DATE !='2024-03-21' 
  AND END_DATE  !='2024-03-21' 
  AND Src_Tbl ='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V' 
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
WHERE END_DATE ='2024-03-21' 
  AND Src_Tbl ='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V' 
;

DROP TABLE IF EXISTS T04_INR_ORG_RELA_H_ERP011_TEMP;

DROP TABLE IF EXISTS T04_INR_ORG_RELA_H_ERP011_MID;

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
WHERE not (strt_date<='2024-03-21' and end_date >'2024-03-21') --插入没有对比的数据 
  AND Src_Tbl ='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V' 
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
FROM  T04_INR_ORG_RELA_H_ERP011_MID  WHERE data_type in ('S') --当天对比无变化的数据 
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
      ,'2024-03-22 20:01:37'      as data_time              --数据时间 
      ,Real_Src_Tbl1             AS Real_Src_Tbl           --真实源表 
      ,Src_Tbl1                  as Src_Tbl                --源表 
FROM  T04_INR_ORG_RELA_H_ERP011_MID  WHERE data_type in ('I','UP') --当天新增/变更的数据开链 
UNION ALL 
SELECT 
       Inr_Org_Id                           --内部机构编号 
      ,Inr_Org_Rela_Type_Cd                 --内部机构关系类型代码 
      ,Strt_Date                            --开始日期 
      ,Inr_Org_Cate_Cd                      --内部机构类别代码 
      ,Rela_Inr_Org_Id                      --关联内部机构编号 
      ,'2024-03-21' as End_Date   --结束日期 
      ,Data_Src_Cd                          --数据来源代码 
      ,Task_Name                            --任务名 
     ,'2024-03-22 20:01:37'    as data_time  --数据时间 
     ,Real_Src_Tbl                          --真实源表 
      ,Src_Tbl                              --源表 
FROM T04_INR_ORG_RELA_H_ERP011_MID  WHERE data_type in ('D','UP') --历史不存在当天的数据,删除/变更状态闭链 ;
