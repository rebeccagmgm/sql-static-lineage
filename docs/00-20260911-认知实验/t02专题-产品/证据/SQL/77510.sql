-- task_id: 77510
-- hiveDb: pdata_hk
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-fdm_hk/prd/pdata_hk.t02_prd_gmp.py
-- observed_at: 2026-09-01T13:48:10.068Z

-- createSql
create table if not exists t02_prd_gmp_temp as select concat (
  'm-',
  isin
)
as Prd_Id1 --产品编号 ,legalname as Prd_Name1 --产品名称 ,'m' as Exch_Type_Cd1 --市场 ,isin as Scr_Cd1 --证券代码 ,'F00' as Prd_Type_Cd1 --产品类型代码 ,nvl(b.Dw_Cd_Val,a.pricecurrencyid) as Crrc_Cd1 --币种代码CNH转换为CNY 20200604 modify by hzh ,'99' as Prd_Stat_Cd1 --产品状态代码 ,'' as Brd_Cd1 --市场代码 ,isin as Isin_Cd1 --ISIN代码 ,bb_code as Bbg_Cd1 --彭博代码 ,'' as Sdl_Cd1 --SEDOL代码 ,'' as Sbl_Cd1 --SYMBOL代码 ,nvl(from_unixtime(unix_timestamp(inceptiondate,'dd/MM/yyyy'),'yyyyMMdd'),inceptiondate) as Eff_Date1 --生效日期 ,'' as Exp_Date1 --到期日期 ,'0' as Prd_Pkg1 --产品包标志 ,'GMP' as Data_Src_Cd1 --数据来源代码 ,'odata_hk.gmp_funds' as Src_Tbl1 --源表 ,'pdata_hk.t02_prd_gmp' as Task_Name1 --任务名 from odata_hk.gmp_funds a left join (select Src_Cd_Val,Dw_Cd_Val from pdata_hk.t99_cd_cvt_map where Tgt_Tab_Name='T02_PRD' and tgt_tab_fld='Crrc_Cd' and src_tab_name='GMP_FUNDS' and Src_Fld_Name='Pricecurrencyid') b on a.Pricecurrencyid=b.Src_Cd_Val where trim(isin) !='' and busi_date ='2026-05-22' and not exists ( select 1 from odata_hk.hkdc_v_hisnstkcode c where c.EXCHANGE_TYPE='m' and c.busi_date='2026-05-22' and a.isin=c.STOCK_CODE ) union all select concat('b-',isin) as Prd_Id1 --产品编号 ,issuer as Prd_Name1 --产品名称 ,'b' as Exch_Type_Cd1 --市场 ,isin as Scr_Cd1 --证券代码 ,'B00' as Prd_Type_Cd1 --产品类型代码 ,currency as Crrc_Cd1 --币种代码 ,'99' as Prd_Stat_Cd1 --产品状态代码 ,'' as Brd_Cd1 --市场代码 ,isin as Isin_Cd1 --ISIN代码 ,bloomingBerg_code as Bbg_Cd1 --彭博代码 ,'' as Sdl_Cd1 --SEDOL代码 ,ticker_symbol as Sbl_Cd1 --SYMBOL代码 ,regexp_replace(substr(issue_date,1,10),'-','') as Eff_Date1 --生效日期 ,regexp_replace(substr(maturity,1,10),'-','') as Exp_Date1 --到期日期 ,'0' as Prd_Pkg1 --产品包标志 ,'GMP' as Data_Src_Cd1 --数据来源代码 ,'odata_hk.gmp_bonds' as Src_Tbl1 --源表 ,'pdata_hk.t02_prd_gmp' as Task_Name1 --任务名 from odata_hk.gmp_bonds a where trim(isin) !='' and busi_date ='2026-05-22' and not exists ( select 1 from odata_hk.hkdc_v_hisnstkcode c where c.EXCHANGE_TYPE='b' and c.busi_date='2026-05-22' and a.isin=c.STOCK_CODE ) union all select internal_code as Prd_Id1 --产品编号 , '' as Prd_Name1 --产品名称 , 'OTC' as Exch_Type_Cd1 --市场 ,internal_code as Scr_Cd1 --证券代码 , 'N00' as Prd_Type_Cd1 --产品类型代码 ,currency as Crrc_Cd1 --币种代码 ,'99' as Prd_Stat_Cd1 --产品状态代码 , '' as Brd_Cd1 --市场代码 , '' as Isin_Cd1 --ISIN代码 , '' as Bbg_Cd1 --彭博代码 , '' as Sdl_Cd1 --SEDOL代码 , '' as Sbl_Cd1 --SYMBOL代码 ,regexp_replace(substr(issue_date,1,10),'-','') as Eff_Date1 --生效日期 ,regexp_replace(substr(maturity,1,10),'-','') as Exp_Date1 --到期日期 , '0' as Prd_Pkg1 --产品包标志 ,'GMP' as Data_Src_Cd1 --数据来源代码 ,'ODATA_HK.GMP_NOTES' as Src_Tbl1 --源表 ,'pdata_hk.t02_prd_gmp' as Task_Name1 --任务名 from ODATA_HK.GMP_NOTES a where busi_date ='2026-05-22' union all select concat('D00-',code) as Prd_Id1 --产品编号 ,name as Prd_Name1 --产品名称 ,'OTC' as Exch_Type_Cd1 --市场 ,code as Scr_Cd1 --证券代码 ,'D00' as Prd_Type_Cd1 --产品类型代码 ,currency as Crrc_Cd1 --币种代码 ,coalesce(dw_cd_val,status) as Prd_Stat_Cd1 --产品状态代码 ,'' as Brd_Cd1 --市场代码 ,'' as Isin_Cd1 --ISIN代码 ,'' as Bbg_Cd1 --彭博代码 ,'' as Sdl_Cd1 --SEDOL代码 ,'' as Sbl_Cd1 --SYMBOL代码 ,nvl(from_unixtime(unix_timestamp(inception_at,'yyyy年MM月dd日'),'yyyyMMdd'),inception_at) as Eff_Date1 --生效日期 ,'' as Exp_Date1 --到期日期 ,'0' as Prd_Pkg1 --产品包标志 ,'GMP' as Data_Src_Cd1 --数据来源代码 ,'odata_hk.gmp_model_portfolios' as Src_Tbl1 --源表 ,'pdata_hk.t02_prd_gmp' as Task_Name1 --任务名 from odata_hk.gmp_model_portfolios a left join (select Src_Cd_Val,Dw_Cd_Val from pdata_hk.t99_cd_cvt_map where Tgt_Tab_Name='T02_PRD_STAT_H' and tgt_tab_fld='Prd_Stat_Cd' and src_tab_name='GMP_MODEL_PORTFOLIOS' and Src_Fld_Name='STATUS') b on a.STATUS=b.Src_Cd_Val where busi_date='2026-05-22';

create table if not exists t02_prd_gmp_mid as select a.*,b.*, case when a.Prd_Id is null and b.Prd_Id1 is not null then 'I' --新增 when a.Prd_Id is not null and b.Prd_Id1 is null then 'D' --删除 when a.Prd_Id is not null and b.Prd_Id1 is not null and (
  coalesce(a.Prd_Name ,'') <>coalesce(b.Prd_Name1 ,'') or coalesce(a.EXCH_TYPE_CD ,'') <>coalesce(b.EXCH_TYPE_CD1,'') or coalesce(a.Scr_Cd ,'') <>coalesce(b.Scr_Cd1 ,'') or coalesce(a.Prd_Type_Cd ,'') <>coalesce(b.Prd_Type_Cd1 ,'') or coalesce(a.Crrc_Cd ,'') <>coalesce(b.Crrc_Cd1 ,'') or coalesce(a.Prd_Stat_Cd ,'') <>coalesce(b.Prd_Stat_Cd1 ,'') or coalesce(a.Brd_cd ,'') <>coalesce(b.Brd_cd1 ,'') or coalesce(a.Isin_Cd ,'') <>coalesce(b.Isin_Cd1 ,'') or coalesce(a.Bbg_Cd ,'') <>coalesce(b.Bbg_Cd1 ,'') or coalesce(a.Sdl_Cd ,'') <>coalesce(b.Sdl_Cd1 ,'') or coalesce(a.Sbl_Cd ,'') <>coalesce(b.Sbl_Cd1 ,'') or coalesce(a.Eff_Date ,'') <>coalesce(b.Eff_Date1 ,'') or coalesce(a.Exp_Date ,'') <>coalesce(b.Exp_Date1 ,'') or coalesce(a.Prd_Pkg ,'') <>coalesce(b.Prd_Pkg1 ,'') or coalesce(a.Data_Src_Cd ,'') <>coalesce(b.Data_Src_Cd1 ,'')
)
then 'UP' --变更 else 'S' --无变更 end as data_type from (select * from t02_prd where upper(Data_Src_Cd) ='GMP')a full outer join t02_prd_gmp_temp b on a.Prd_Id=b.Prd_Id1;

-- querySql
insert overwrite table t02_prd
select
busi_date                                --业务日期
,Prd_Id                                   --产品编号
,Prd_Name                                 --产品名称
,EXCH_TYPE_CD                             --市场
,Scr_Cd                                   --证券代码
,Prd_Type_Cd                              --产品类型代码
,Crrc_Cd                                  --币种代码
,Prd_Stat_Cd                              --产品状态代码
,Brd_cd                                   --板块代码
,Isin_Cd                                  --ISIN代码
,Bbg_Cd                                   --彭博代码
,Sdl_Cd                                   --SEDOL代码
,Sbl_Cd                                   --SYMBOL代码
,Eff_Date                                 --生效日期
,Exp_Date                                 --到期日期
,Prd_Pkg                                  --产品包标志
,Del_Flag                                 --删除标志
,Data_Src_Cd                              --数据来源代码
,DATA_TIME                                --数据时间
,Src_Tbl                                  --源表
,Task_Name                                --任务名
from t02_prd where busi_date !='2026-05-22' and upper(Data_Src_Cd) ='GMP'
union all
select
busi_date                                --业务日期
,Prd_Id                                   --产品编号
,Prd_Name                                 --产品名称
,EXCH_TYPE_CD                             --市场
,Scr_Cd                                   --证券代码
,Prd_Type_Cd                              --产品类型代码
,Crrc_Cd                                  --币种代码
,Prd_Stat_Cd                              --产品状态代码
,Brd_cd                                   --板块代码
,Isin_Cd                                  --ISIN代码
,Bbg_Cd                                   --彭博代码
,Sdl_Cd                                   --SEDOL代码
,Sbl_Cd                                   --SYMBOL代码
,Eff_Date                                 --生效日期
,Exp_Date                                 --到期日期
,Prd_Pkg                                  --产品包标志
,Del_Flag                                 --删除标志
,Data_Src_Cd                              --数据来源代码
,DATA_TIME                                --数据时间
,Src_Tbl                                  --源表
,Task_Name                                --任务名
from t02_prd where upper(Data_Src_Cd) !='GMP';

drop table if exists t02_prd_gmp_temp;

drop table if exists t02_prd_gmp_mid;

insert overwrite table t02_prd
select
busi_date                                                 --业务日期
,Prd_Id                                                    --产品编号
,Prd_Name                                                  --产品名称
,EXCH_TYPE_CD                                              --市场
,Scr_Cd                                                    --证券代码
,Prd_Type_Cd                                               --产品类型代码
,Crrc_Cd                                                   --币种代码
,Prd_Stat_Cd                                               --产品状态代码
,Brd_cd                                                    --板块代码
,Isin_Cd                                                   --ISIN代码
,Bbg_Cd                                                    --彭博代码
,Sdl_Cd                                                    --SEDOL代码
,Sbl_Cd                                                    --SYMBOL代码
,Eff_Date                                                  --生效日期
,Exp_Date                                                  --到期日期
,Prd_Pkg                                                   --产品包标志
,'0'                    as Del_Flag                        --删除标志    0否1是
,Data_Src_Cd                                               --数据来源代码
,DATA_TIME                                                 --数据时间
,Src_Tbl                                                   --源表
,Task_Name                                                 --任务名
from t02_prd_gmp_mid where data_type='S'  --插入无变化的数据
union all
select
busi_date                                                --业务日期
,Prd_Id                                                   --产品编号
,Prd_Name1              as Prd_Name                       --产品名称
,EXCH_TYPE_CD1          as EXCH_TYPE_CD                   --市场
,Scr_Cd1                as Scr_Cd                         --证券代码
,Prd_Type_Cd1           as Prd_Type_Cd                    --产品类型代码
,Crrc_Cd1               as Crrc_Cd                        --币种代码
,Prd_Stat_Cd1           as Prd_Stat_Cd                    --产品状态代码
,Brd_cd1                as Brd_cd                         --板块代码
,Isin_Cd1               as Isin_Cd                        --ISIN代码
,Bbg_Cd1                as Bbg_Cd                         --彭博代码
,Sdl_Cd1                as Sdl_Cd                         --SEDOL代码
,Sbl_Cd1                as Sbl_Cd                         --SYMBOL代码
,Eff_Date1              as Eff_Date                       --生效日期
,Exp_Date1              as Exp_Date                       --到期日期
,Prd_Pkg1               as Prd_Pkg                        --产品包标志
,'0'                    as Del_Flag                       --删除标志
,Data_Src_Cd1           as Data_Src_Cd                    --数据来源代码
,'2026-05-23 02:37:09'   as DATA_TIME                      --数据时间
,Src_Tbl1               as Src_Tbl                        --源表
,Task_Name1             as Task_Name                      --任务名
from t02_prd_gmp_mid where data_type='UP'   --有变更的数据取变更的值
union all
select
'2026-05-22' as busi_date                        --业务日期
,Prd_Id1                as Prd_Id                           --产品编号
,Prd_Name1              as Prd_Name                         --产品名称
,EXCH_TYPE_CD1          as EXCH_TYPE_CD                     --市场
,Scr_Cd1                as Scr_Cd                           --证券代码
,Prd_Type_Cd1           as Prd_Type_Cd                      --产品类型代码
,Crrc_Cd1               as Crrc_Cd                          --币种代码
,Prd_Stat_Cd1           as Prd_Stat_Cd                      --产品状态代码
,Brd_cd1                as Brd_cd                           --板块代码
,Isin_Cd1               as Isin_Cd                          --ISIN代码
,Bbg_Cd1                as Bbg_Cd                           --彭博代码
,Sdl_Cd1                as Sdl_Cd                           --SEDOL代码
,Sbl_Cd1                as Sbl_Cd                           --SYMBOL代码
,Eff_Date1              as Eff_Date                         --生效日期
,Exp_Date1              as Exp_Date                         --到期日期
,Prd_Pkg1               as Prd_Pkg                          --产品包标志
,'0'                    as Del_Flag                         --删除标志
,Data_Src_Cd1           as Data_Src_Cd                      --数据来源代码
,'2026-05-23 02:37:09'   as DATA_TIME                        --数据时间
,Src_Tbl1               as Src_Tbl                          --源表
,Task_Name1             as Task_Name                        --任务名
from t02_prd_gmp_mid where data_type='I' --插入新增的数据
union all
select
busi_date                                                  --业务日期
,Prd_Id                                                     --产品编号
,Prd_Name                                                   --产品名称
,EXCH_TYPE_CD                                               --市场
,Scr_Cd                                                     --证券代码
,Prd_Type_Cd                                                --产品类型代码
,Crrc_Cd                                                    --币种代码
,Prd_Stat_Cd                                                --产品状态代码
,Brd_cd                                                     --板块代码
,Isin_Cd                                                    --ISIN代码
,Bbg_Cd                                                     --彭博代码
,Sdl_Cd                                                     --SEDOL代码
,Sbl_Cd                                                     --SYMBOL代码
,Eff_Date                                                   --生效日期
,Exp_Date                                                   --到期日期
,Prd_Pkg                                                    --产品包标志
,'1'                     as Del_Flag                        --删除标志
,Data_Src_Cd                                                --数据来源代码
,DATA_TIME                                                  --数据时间
,Src_Tbl                                                    --源表
,Task_Name                                                  --任务名
from t02_prd_gmp_mid where data_type='D'  --插入删除的数据
union all
select
busi_date                                                  --业务日期
,Prd_Id                                                     --产品编号
,Prd_Name                                                   --产品名称
,EXCH_TYPE_CD                                               --市场
,Scr_Cd                                                     --证券代码
,Prd_Type_Cd                                                --产品类型代码
,Crrc_Cd                                                    --币种代码
,Prd_Stat_Cd                                                --产品状态代码
,Brd_cd                                                     --板块代码
,Isin_Cd                                                    --ISIN代码
,Bbg_Cd                                                     --彭博代码
,Sdl_Cd                                                     --SEDOL代码
,Sbl_Cd                                                     --SYMBOL代码
,Eff_Date                                                   --生效日期
,Exp_Date                                                   --到期日期
,Prd_Pkg                                                    --产品包标志
,Del_Flag                                                   --删除标志
,Data_Src_Cd                                                --数据来源代码
,DATA_TIME                                                  --数据时间
,Src_Tbl                                                    --源表
,Task_Name                                                  --任务名
from t02_prd where upper(Data_Src_Cd) !='GMP'    --插入非gmp系统数据
;
