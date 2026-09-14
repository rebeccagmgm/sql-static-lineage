-- task_id: 77545
-- hiveDb: pdata_hk
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-fdm_hk/prd/pdata_hk.t02_prd_name_h_gmp.py
-- observed_at: 2026-09-04T01:39:02.562Z

-- createSql
create table if not exists t02_prd_name_h_gmp_temp as select concat (
  'D00-',
  code
)
as Prd_Id1 --产品编号 ,'19' as Name_Type_Cd1 --名称类型代码 ,name as Name1 --名称 ,'GMP' as Data_Src_Cd1 --数据来源代码 ,'odata_hk.gmp_model_portfolios' as Src_Tbl1 --源表 ,'pdata_hk.t02_prd_name_h_gmp' as Task_Name1 --任务名 from odata_hk.gmp_model_portfolios where busi_date='2026-05-21';

create table if not exists t02_prd_name_h_gmp_mid as select a.*,b.*, case when a.Prd_Id is null and b.Prd_Id1 is not null then 'I' --新增 when a.Prd_Id is not null and b.Prd_Id1 is null then 'D' --删除 when a.Prd_Id is not null and b.Prd_Id1 is not null and (
  nvl(a.Name,'') <> nvl(b.Name1,'')
)
then 'OP' --变更 else 'S' --无变更 end as data_type from (select * from t02_prd_name_h where Strt_Date <='2026-05-21' and end_date >'2026-05-21' and upper(Data_Src_Cd)='GMP') a full outer join t02_prd_name_h_gmp_temp b on a.Prd_Id =b.Prd_Id1 and a.Name_Type_Cd =b.Name_Type_Cd1;

-- querySql
insert overwrite table t02_prd_name_h
select
busi_date                            --业务日期
,Prd_Id                               --产品编号
,Name_Type_Cd                         --名称类型代码
,Strt_Date                            --开始日期
,Name                                 --名称
,End_Date                             --结束日期
,DATA_TIME                            --数据时间
,Data_Src_Cd                          --数据来源代码
,Src_Tbl                              --源表
,Task_Name                            --任务名
from t02_prd_name_h
where Strt_Date !='2026-05-21' and End_Date !='2026-05-21' and upper(Data_Src_Cd)='GMP'
union all
select
busi_date                             --业务日期
,Prd_Id                                --产品编号
,Name_Type_Cd                          --名称类型代码
,Strt_Date                             --开始日期
,Name                                  --名称
,'2099-12-31'  as end_date             --结束日期
,DATA_TIME                             --数据时间
,Data_Src_Cd                           --数据来源代码
,Src_Tbl                               --源表
,Task_Name                             --任务名
from t02_prd_name_h where End_Date ='2026-05-21' and upper(Data_Src_Cd)='GMP'
union all
select
busi_date                              --业务日期
,Prd_Id                                 --产品编号
,Name_Type_Cd                           --名称类型代码
,Strt_Date                              --开始日期
,Name                                   --名称
,end_date                               --结束日期
,DATA_TIME                              --数据时间
,Data_Src_Cd                            --数据来源代码
,Src_Tbl                                --源表
,Task_Name                              --任务名
from t02_prd_name_h where upper(Data_Src_Cd) !='GMP';

drop table if exists t02_prd_name_h_gmp_temp;

drop table if exists t02_prd_name_h_gmp_mid;

insert overwrite table t02_prd_name_h
select
busi_date                                      --业务日期
,Prd_Id                                         --产品编号
,Name_Type_Cd                                   --名称类型代码
,Strt_Date                                      --开始日期
,Name                                           --名称
,end_date                                       --结束日期
,DATA_TIME                                      --数据时间
,Data_Src_Cd                                    --数据来源代码
,Src_Tbl                                        --源表
,Task_Name                                      --任务名
from  t02_prd_name_h
where not (Strt_Date <='2026-05-21'  and end_date >'2026-05-21' and upper(Data_Src_Cd)='GMP')
union all
select
'2026-05-21' as busi_date           --业务日期
,Prd_Id1                as Prd_Id              --产品编号
,Name_Type_Cd1          as Name_Type_Cd        --名称类型代码
,'2026-05-21' as Strt_Date           --开始日期
,Name1                  as Name                --名称
,'2099-12-31'           as end_date            --结束日期
,'2026-05-22 02:54:44'   as DATA_TIME           --数据时间
,Data_Src_Cd1           as Data_Src_Cd         --数据来源代码
,Src_Tbl1               as Src_Tbl             --源表
,Task_Name1             as Task_Name           --任务名
from t02_prd_name_h_gmp_mid where data_type in ('I','OP')
union all
select
busi_date                                      --业务日期
,Prd_Id                                         --产品编号
,Name_Type_Cd                                   --名称类型代码
,Strt_Date                                      --开始日期
,Name                                           --名称
,'2026-05-21' as end_date             --结束日期
,'2026-05-22 02:54:44'   as DATA_TIME            --数据时间
,Data_Src_Cd                                    --数据来源代码
,Src_Tbl                                        --源表
,Task_Name                                      --任务名
from t02_prd_name_h_gmp_mid where data_type in ('D','OP')
union all
select
busi_date                                      --业务日期
,Prd_Id                                         --产品编号
,Name_Type_Cd                                   --名称类型代码
,Strt_Date                                      --开始日期
,Name                                           --名称
,End_Date                                       --结束日期
,DATA_TIME                                      --数据时间
,Data_Src_Cd                                    --数据来源代码
,Src_Tbl                                        --源表
,Task_Name                                      --任务名
from  t02_prd_name_h_gmp_mid where data_type ='S';
