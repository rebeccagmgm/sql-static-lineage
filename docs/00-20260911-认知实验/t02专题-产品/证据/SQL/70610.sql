-- task_id: 70610
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_co_stkhold_WD
-- observed_at: 2026-09-05T01:06:31.589Z

-- createSql
create table if not exists t02_co_stkhold(
rec_id                   string comment '记录编号',
busi_date                string comment '数据日期',
src_sys_prdno            string comment '源系统产品编号',
corp_id                  string comment '统一公司编号',
src_corp_id              string comment '源系统公司编号',
Info_Src                 string comment '信息来源',
Iss_Date                 string comment '发布日期',
end_Date                 string comment '截止日期',
Mkthold_Clas             string comment '股东类别',
stkholder_type           string comment '股东类型',
Stkhold_Seq              string comment '股东序号',
Stkhold_Name             string comment '股东名称',
Corp_Mkthold_id          string comment '公司股东id',
Mkthold_Prop             string comment '股东性质',
Hold_Cnt                 string comment '持有数量（股）',
Occp_Tot_Equi_Rati       string comment '占总股本比例（%）',
Hold_A_Equi_Amt          string comment '持有A股数量（股）',
A_Res_Equi_Amt           string comment '有限售A股数量（股）',
Occp_A_Res_Equi_Amt      string comment '占有限售A股数量（%）',
un_A_Res_Equi_Rati       string comment '无限售A股数量（股）',
Occp_un_A_Rse_Equi_Rati  string comment '占无限售A股比例（%）',
Hold_B_Equi_Amt          string comment '持有B股数量（股）',
Hold_H_Equi_Amt          string comment '持有H股数量（股）',
Hold_Oth_Stk_Amt         string comment '持有其它股数量（股）',
Rpt_Time_Hold_Chg_Amt    string comment '报告期内持股数增减（股）',
Rpt_Time_Hold_Chg_Rati   string comment '报告期内持股数增减幅度（%）',
YoY_Hold_Chg_Amt         string comment '与上期末相比持股数增减（股）',
YoY_Hold_Chg_Rati        string comment '与上期末相比持股数增减幅度（%）',
Equi_Prop                string comment '股本性质',
Mkthold_Rela             string comment '股东关联关系',
Stkhold_Rela_intro       string comment '股东关联关系说明',
Equi_Stat                string comment '股权状态',
Plg_Frz_Amt              string comment '质押或冻结数量',
Plg_Frz_intro            string comment '股权质押冻结情况说明',
Mkthold_Type_Cd          string comment '股东类型代码',
Mkthold_Act_intro        string comment '股东一致行动关系的说明',
Indv_Mkthold_id          string comment '个人股东id',
Res_Equi_Amt             string comment '有限售数量合计（股）',
un_Res_Equi_Amt          string comment '无限售数量合计（股）',
shr_ntlc_rat             string comment '占流通股比例',
BEN_SHR_DT               string comment '股本基准日',
Join_id                  string comment '关联方序号',
Hold_Prop                string comment '持股性质',
Stkhold_intro            string comment '股东说明',
Vchr_Type                string comment '证照类型',
Cfm_Fnd                  string comment '认缴出资额',
Actl_Fndr                string comment '实缴出资额',
Fnd_Date                 string comment '出资日期',
Crrc                     string comment '币种',
remark                   string comment '备注',
src_tbl                  string comment '来源表',
src_rec_id               string comment '来源记录',
rec_upd_time             string comment '记录修改时间',
rec_down_time            string comment '记录创建时间'
)comment '公司股东表'
partitioned by (src_id string comment '来源标识',grp_id string comment'并行标识')
stored as ORC
;

-- querySql
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
set hive.optimize.sort.dynamic.partition=true;
set hive.map.aggr = true;
set hive.groupby.skewindata=true;
set hive.support.concurrency=false;

insert overwrite table t02_co_stkhold partition (src_id='WD',grp_id='01')
select
 a.object_id                  as   rec_id                   
,a.busi_date                  as   busi_date                
,b.src_sys_prdno              as   src_sys_prdno            
,b.corp_id                    as   corp_id                  
,c.src_corp_id                as   src_corp_id              
,''                           as   Info_Src                 
,a.ann_dt                     as   Iss_Date                 
,a.S_HOLDER_ENDDATE           as   end_Date                 
,'十大股东'                   as   Mkthold_Clas             
,case when a.S_HOLDER_HOLDERCATEGORY ='1' then '个人' 
    when a.S_HOLDER_HOLDERCATEGORY ='2' then '公司' 
    else a.S_HOLDER_HOLDERCATEGORY end as  stkholder_type 
          
,''                           as   Stkhold_Seq              
,a.s_holder_aname             as   Stkhold_Name             
,d.corp_id                    as   Corp_Mkthold_id          
,''                           as   Mkthold_Prop             
,a.s_holder_quantity          as   Hold_Cnt                 
,a.s_holder_pct               as   Occp_Tot_Equi_Rati       
,''                           as   Hold_A_Equi_Amt          
,''                           as   A_Res_Equi_Amt           
,''                           as   Occp_A_Res_Equi_Amt      
,''                           as   un_A_Res_Equi_Rati       
,''                           as   Occp_un_A_Rse_Equi_Rati  
,''                           as   Hold_B_Equi_Amt          
,''                           as   Hold_H_Equi_Amt          
,''                           as   Hold_Oth_Stk_Amt         
,''                           as   Rpt_Time_Hold_Chg_Amt    
,''                           as   Rpt_Time_Hold_Chg_Rati   
,''                           as   YoY_Hold_Chg_Amt         
,''                           as   YoY_Hold_Chg_Rati        
,''                           as   Equi_Prop                
,''                           as   Mkthold_Rela             
,''                           as   Stkhold_Rela_intro       
,''                           as   Equi_Stat                
,''                           as   Plg_Frz_Amt              
,''                           as   Plg_Frz_intro            
,''                           as   Mkthold_Type_Cd          
,''                           as   Mkthold_Act_intro        
,''                           as   Indv_Mkthold_id          
,''                           as   Res_Equi_Amt             
,''                           as   un_Res_Equi_Amt          
,''                           as   shr_ntlc_rat             
,''                           as   BEN_SHR_DT               
,a.s_holder_sequence          as   Join_id                  
,a.s_holder_sharecategoryname as   Hold_Prop                
,a.s_holder_memo              as   Stkhold_intro            
,''                           as   Vchr_Type                
,''                           as   Cfm_Fnd                  
,''                           as   Actl_Fndr                
,''                           as   Fnd_Date                 
,''                           as   Crrc                     
,CONCAT('WD-S_HOLDER_NAME:',   S_HOLDER_NAME)                       as   remark                   
,'odata_msg.wfd_w_AShareInsideHolder' as   src_tbl                  
,a.object_id                          as   src_rec_id   
,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')	as	rec_upd_time
,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')	as	rec_down_time                 
from (select * from odata_n_uip.w_ashareinsideholder where busi_date='${data_day_str}' ) a  
left join (select * from t02_scr_base_info where src_id = 'WD')b on a.s_info_windcode= b.in_code
left join (select * from t02_co_base_info where src_id = 'WD') c on b.corp_id=c.corp_id
left join (select * from t02_co_base_info where src_id = 'WD') d on a.s_info_compcode=d.src_corp_id

;
