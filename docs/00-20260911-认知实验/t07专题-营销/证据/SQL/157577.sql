-- task_id: 157577
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T05:51:45.329Z

-- createSql
create table if not exists wt_shor_vdo_sum (
  end_time string comment '统计截止日期',
  live_id string comment '短视频id',
  title string comment '短视频主题',
  real_ply_time string comment '开播时间',
  real_ply_date string comment '开播日期',
  real_time string comment '短视频起止时间',
  live_times int comment '短视频时长',
  anchor_name string comment '主播姓名',
  anchor_erp string comment '主播erp',
  dept_name string comment '主播所属分支',
  rela_prd string comment '关联产品',
  look_total_pv int comment '浏览量',
  look_eff_uv int comment '有效观看人数',
  look_total_uv int comment '观看人数',
  look_10_uv int comment '10秒观看人数',
  look_avg_time DOUBLE comment '人均观看时长',
  entr_amt_durroom DOUBLE comment '短视频委托金额',
  deli_amt_durroom DOUBLE comment '短视频成交金额',
  entr_num_durroom int comment '短视频委托人数',
  deli_num_durroom int comment '短视频成交人数',
  entr_order_durroom int comment '短视频委托订单数',
  deli_order_durroom int comment '短视频成交订单数',
  entr_amt DOUBLE comment '30天委托金额,无带货默认null',
  deli_amt DOUBLE comment '30天成交金额,无带货默认null',
  entr_cust_num int comment '30天委托人数',
  deli_cust_num int comment '30天成交人数',
  entr_order int comment '30天委托订单数',
  deli_order int comment '30天成交订单数',
  coll_cust_num int comment '加自选人数',
  emp_share_num int comment '员工分享次数',
  prdclick_num int comment '产品点击次数',
  prdclick_cust_num int comment '产品点击人数',
  share_num int comment '分享次数',
  tot_covtrate DOUBLE comment '总转化率'
)
comment '短视频经营看板_短视频维度'
PARTITIONED BY (busi_date string comment '跑数日期')
STORED AS orc;

create table if not exists wt_shor_vdo_cust_sum (
  live_id string comment '直播id',
  title string comment '直播主题',
  real_ply_date string comment '开播日期',
  rela_prd string comment '关联产品',
  cust_name string comment '客户姓名',
  cust_pty_no string comment '客户编号',
  cust_ast_type string comment '客户类型',
  is_emp string comment '是否员工',
  org_name string comment '所在营业部',
  inr_org_id string comment '所在营业部编号',
  dept_name string comment '所在分公司',
  dept_no string comment '所在分公司编号',
  fwgx_empname string comment '服务关系',
  fwgx_empid string comment '服务关系编号',
  kfgx_empname string comment '开发关系',
  kfgx_empid string comment '开发关系编号',
  tggx_empname string comment '投顾关系',
  tggx_empid string comment '投顾关系编号',
  is_eff int comment '是否有效观众',
  is_10_uv string comment '是否10秒观看客户',
  look_time int comment '短视频观看时长',
  is_click int comment '是否点击产品',
  coll_prd_list string comment '加自选产品',
  entr_amt_durroom double comment '短视频委托金额',
  deli_amt_durroom double comment '短视频成交金额',
  entr_amt_durroom_list string comment '短视频委托金额,列表',
  deli_amt_durroom_list string comment '短视频成交金额,列表',
  entr_prd_amt_total double comment '30天委托金额',
  deil_prd_amt_total double comment '30天成交金额',
  entr_prd_amt_list string comment '30天委托金额,列表',
  deil_prd_amt_list string comment '30天成交金额,列表',
  bail double comment '保证金余额',
  total_asset double comment '总资产',
  risk_lvl string comment '风险等级',
  look_pv int comment '浏览量',
  is_uv int comment '是否观看',
  is_half_uv int comment '是否重度参与',
  entr_order_durroom int comment '短视频委托订单数',
  deli_order_durroom int comment '短视频成交订单数',
  is_entr_durroom string comment '是否短视频委托',
  is_deli_durroom string comment '是否短视频成交',
  entr_order int comment '30天委托订单数',
  deli_order int comment '30天成交订单数',
  is_entr string comment '30天是否委托',
  is_deli string comment '30天是否成交',
  is_coll int comment '是否短视频加自选',
  click_num int comment '产品点击次数',
  emp_share_times int comment '员工分享次数',
  share_num int comment '分享次数'
)
comment '短视频经营看板_短视频*客户维度'
PARTITIONED BY (busi_date string comment '跑数日期')
STORED AS orc;

create table wt_shor_vdo_cust_dtl_temp as select t1.log_id ,t1.vdo_id ,t2.real_ply_date ,event ,event_name ,case when length (
  trim(t1.distinct_id)
)
= 12 then t1.distinct_id when length(trim(t4.grp_val)) = 12 then t4.grp_val when length(trim(t1.audience_cust)) = 12 then t1.audience_cust else t1.audience_uuid end as pty_id ,page_name ,button_name ,audience_count ,log_time ,properties ,daily from (select * from dm_index_n.tmp_wos_vdo_shence_v1) t1 inner join (select shor_vdo_id, substr(rels_time,1,10) as real_ply_date from pdata_n.T07_SHOR_VDO_INFO where src_tbl = 'ODATA_N_WOS.T_MEDIA' and substr(rels_time,1,10) <= '2026-05-19' and lbl_name like '%投顾说产品%' and shor_vdo_stat_cd = 'pass' ) t2 on t2.shor_vdo_id = t1.vdo_id left join (select * from dm_index_n.index_grp_gft_id_join --广发通 where busi_date = '2026-05-19' and tag_id = 'tag999999999' ) t3 on t1.audience_gft = t3.index_val left join (select * from dm_index_n.grp_def where grp_type_code in ('INDV_CUST','CORP_CUST') ) t4 on t3.grp_id = t4.grp_id ;

create table wt_shor_vdo_prd_info_temp as select a.shor_vdo_id,prp.grp_prd,prp.grp_name,prd.src_prd_cd from (
  select shor_vdo_id,
  substr(rels_time,1,10) as real_ply_date from pdata_n.T07_SHOR_VDO_INFO where src_tbl = 'ODATA_N_WOS.T_MEDIA' and substr(rels_time,1,10) <= '2026-05-19' and lbl_name like '%投顾说产品%' and shor_vdo_stat_cd = 'pass'
)
a left join (select replace(prom_id,'WOS003-','') as vdo_id,src_prd_cd from PDATA_N.T07_PROM_PRD_RELA_INFO where src_tbl = 'ODATA_N_WOS.T_PRODUCTSALES' ) prd on a.shor_vdo_id = prd.vdo_id left join (select grp_id as grp_prd,scr_cd,grp_name from ( select grp_id,grp_val,grp_name from dm_index_n.grp_def where grp_type_code in ('NEWS_SECU') )a left join ( select distinct secu_id,scr_cd from pdata_news_n.t02_scr_type where src_id = 'PRD' and scr_type_std_cd = 'PRD01' )b on a.grp_val = b.secu_id ) prp on prd.src_prd_cd = prp.scr_cd ;

create table wt_shor_vdo_cust_pv_temp as select vdo_id,pty_id,count (
  distinct evt_id
)
as look_total_pv from ( select evt_id ,t1.grp_val as vdo_id ,case when length(trim(t1.pty_id)) = 12 then t1.pty_id else t4.grp_val end as pty_id from (select evt_id ,prop['page_ob_code'] as grp_val ,pty_id ,regexp_replace(gft_user_id,'CFM001-','') gft_user_id from pdata_n.T05_GF_STRM_PLFM_USER_ACT_EVT where SRC_TBL ='ODATA_N_BSS.F_SENSOR_EVENTLOG' and busi_date <= '2026-05-19' and Src_Evt_Cate = 'user' and Src_Evt_Type = 'user_pageview' and prop['page_name'] = '短视频详情页' and proj != 'ytjtest' ) t1 inner join (select shor_vdo_id, substr(rels_time,1,10) as real_ply_date from pdata_n.T07_SHOR_VDO_INFO where src_tbl = 'ODATA_N_WOS.T_MEDIA' and substr(rels_time,1,10) <= '2026-05-19' and lbl_name like '%投顾说产品%' and shor_vdo_stat_cd = 'pass' ) t1a on t1.grp_val = t1a.shor_vdo_id left join (select * from dm_index_n.index_grp_gft_id_join --广发通 where busi_date = '2026-05-19' and tag_id = 'tag999999999' ) t3 on t1.gft_user_id = t3.index_val left join (select * from dm_index_n.grp_def where grp_type_code in ('INDV_CUST','CORP_CUST') ) t4 on t3.grp_id = t4.grp_id ) a group by vdo_id,pty_id ;

create table wt_shor_vdo_cust_prd_dtl as select t1.vdo_id,t1.pty_id ,t1.grp_cust,t1.prd_name,t1.src_prd_cd ,coalesce (
  t1.entr_num,
  0
)
as entr_num ,coalesce(t1.entr_amt,0) as entr_amt ,coalesce(t2.deli_num,0) as deli_num ,coalesce(t2.deli_amt,0) as deli_amt from (select pty.vdo_id,crp.grp_cust,prd.grp_prd,pty.pty_id,prd.src_prd_cd,prd.grp_name as prd_name ,sum(entr_num) entr_num ,sum(entr_amt) entr_amt from (select vdo_id,real_ply_date,pty_id from wt_shor_vdo_cust_dtl_temp where cast(audience_count as double) > 1 group by vdo_id,real_ply_date,pty_id ) pty inner join (select * from wt_shor_vdo_prd_info_temp where grp_prd is not null ) prd on pty.vdo_id = prd.shor_vdo_id inner join (select grp_id as grp_cust,grp_val,grp_name from dm_index_n.grp_def where grp_type_code in ('INDV_CUST','CORP_CUST') ) crp on pty.pty_id = crp.grp_val left join (select t1.busi_date,t1.grp_id1 as grp_cust,t1.grp_id2 as grp_prd,t1.index_val entr_num,t2.index_val as entr_amt from ( select grp_id1,grp_id2, index_val,busi_date from dm_index_n.index_grp_cust_prd_trusttimes_ostfnd_otcprd_tdy --客户&产品_委托次数_场内基金&场外产品_当日 where busi_date <= '2026-05-19' and tag_id = 'tag999999999' )t1 left join ( select grp_id1,grp_id2, index_val,busi_date from dm_index_n.index_grp_cust_prd_trustamt_ostfnd_otcprd_tdy --客户&产品_委托金额_场内基金&场外产品_当日 where busi_date <= '2026-05-19' and tag_id = 'tag999999999' )t2 on t1.grp_id1 = t2.grp_id1 and t1.grp_id2 = t2.grp_id2 and t1.busi_date = t2.busi_date ) ent on crp.grp_cust = ent.grp_cust and prd.grp_prd = ent.grp_prd where ent.busi_date between pty.real_ply_date and date_add(pty.real_ply_date,30) group by pty.vdo_id,crp.grp_cust,prd.grp_prd,pty.pty_id,prd.src_prd_cd,prd.grp_name ) t1 left join ( select pty.vdo_id,crp.grp_cust,prd.grp_prd,pty.pty_id,prd.src_prd_cd ,sum(deli_num) deli_num ,sum(deli_amt) deli_amt from (select vdo_id,real_ply_date,pty_id from wt_shor_vdo_cust_dtl_temp where cast(audience_count as double) > 1 group by vdo_id,real_ply_date,pty_id ) pty inner join (select * from wt_shor_vdo_prd_info_temp where grp_prd is not null ) prd on pty.vdo_id = prd.shor_vdo_id inner join (select grp_id as grp_cust,grp_val,grp_name from dm_index_n.grp_def where grp_type_code in ('INDV_CUST','CORP_CUST') ) crp on pty.pty_id = crp.grp_val left join (select t1.busi_date,t1.grp_id1 as grp_cust,t1.grp_id2 as grp_prd,t1.index_val deli_num,t2.index_val as deli_amt from ( select grp_id1,grp_id2, index_val,busi_date from dm_index_n.index_grp_cust_prd_delitimes_ostfnd_tdy --客户&产品_交割次数_场内基金_当日_无备注信息 where busi_date <= '2026-05-19' and tag_id = 'tag999999999' )t1 left join ( select grp_id1,grp_id2, index_val,busi_date from dm_index_n.index_grp_cust_prd_deliamt_ostfnd_tdy --客户&产品_交割金额_场内基金_当日_无备注信息 where busi_date <= '2026-05-19' and tag_id = 'tag999999999' )t2 on t1.grp_id1 = t2.grp_id1 and t1.grp_id2 = t2.grp_id2 and t1.busi_date = t2.busi_date ) ent on crp.grp_cust = ent.grp_cust and prd.grp_prd = ent.grp_prd where ent.busi_date between pty.real_ply_date and date_add(pty.real_ply_date,30) group by pty.vdo_id,crp.grp_cust,prd.grp_prd,pty.pty_id,prd.src_prd_cd ) t2 on t1.vdo_id = t2.vdo_id and t1.grp_cust = t2.grp_cust and t1.src_prd_cd = t2.src_prd_cd ;

-- querySql
drop table wt_shor_vdo_cust_dtl_temp;

drop table wt_shor_vdo_prd_info_temp;

drop table wt_shor_vdo_cust_pv_temp;

drop table wt_shor_vdo_cust_prd_dtl;

insert overwrite table wt_shor_vdo_sum partition(busi_date)
select from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm') as end_time --统计截止日期
,a.grp_val as live_id                                             --短视频id
,a.grp_name as title                                              --短视频主题
,b.rels_time as real_ply_time                                     --开播时间
,substr(b.rels_time,1,10) as real_ply_date                        --开播日期
,null as real_time                                                --短视频起止时间
,b.vdo_dura as live_times                                         --短视频时长
,b.anchor_user_name as anchor_name                                --主播姓名
,c.emp_id as anchor_erp                                           --主播erp
,c.dept_name as dept_name                                         --主播所属分支
,k.rela_prd                                                       --关联产品  工银创新动力股票 000893,工银纯债债券A 000402,工银领航三年持有混合 018446
,int(coalesce(i.look_total_pv,0)) as look_total_pv                --浏览量
,int(coalesce(d.look_eff_uv,0)) as look_eff_uv                    --有效观看人数
,int(coalesce(d.look_uv,0)) as look_total_uv                      --观看人数
,int(coalesce(d.look_10_uv,0)) as look_10_uv                      --10秒观看人数
,round(coalesce(d.look_avg_time,0),2) as look_avg_time            --人均观看时长
,0 as entr_amt_durroom                                            --短视频委托金额
,0 as deli_amt_durroom                                            --短视频成交金额
,0 as entr_num_durroom                                            --短视频委托人数
,0 as deli_num_durroom                                            --短视频成交人数
,0 as entr_order_durroom                                          --短视频委托订单数
,0 as deli_order_durroom                                          --短视频成交订单数
,case when k.rela_prd is null then null else round(coalesce(l.entr_amt,0),2) end as entr_amt                      --30天委托金额,无带货默认null
,case when k.rela_prd is null then null else round(coalesce(l.deli_amt,0),2) end as deli_amt                      --30天成交金额,无带货默认null
,int(coalesce(l.entr_cust_num,0)) as entr_cust_num                --30天委托人数
,int(coalesce(l.deli_cust_num,0)) as deli_cust_num                --30天成交人数
,int(coalesce(l.entr_order,0)) as entr_order                      --30天委托订单数
,int(coalesce(l.deli_order,0)) as deli_order                      --30天成交订单数
,0 as coll_cust_num                                               --加自选人数
,0 as emp_share_num                                               --员工分享次数
,0 as prdclick_num                                                --产品点击次数
,0 as prdclick_cust_num                                           --产品点击人数
,int(coalesce(h.share_num,0)) as share_num                        --分享次数
,0 as tot_covtrate                                                --总转化率  产品点击人数/总计人数(look_total_uv)
,'2026-05-19' as busi_date	                              --业务日期
from
(SELECT * FROM dm_index_n.grp_def
WHERE status='1'
AND grp_type_code IN ('WOS_VDO')
) a
inner join
(select * from pdata_n.T07_SHOR_VDO_INFO
where src_tbl = 'ODATA_N_WOS.T_MEDIA'
and substr(rels_time,1,10) <= '2026-05-19'
and lbl_name like '%投顾说产品%'
and shor_vdo_stat_cd = 'pass'
) b on a.grp_val = b.shor_vdo_id
left join
(select emp_id
,case when oa_user_id is null then emp_id else oa_user_id end as oa_user_id
,bel_inr_org_id_len4 as inr_org_id
,bel_inr_org_name as org_name
,brch_bel_div_org_id_len4 as dept_no
,brch_bel_div_org_name as dept_name
from pdata_n.t98_org_emp_base_info
where busi_date = '2026-05-19'
) c on b.anchor_user_id = c.oa_user_id
left join
(select vdo_id
,count(distinct distinct_id) as look_uv
,count(distinct case when cast(audience_count as double) > 1 then distinct_id else null end) look_eff_uv
,count(distinct case when cast(audience_count as double) > 10 then distinct_id else null end) look_10_uv
,sum(distinct case when cast(audience_count as double) > 1 then cast(audience_count as double) else 0 end)
/count(distinct case when cast(audience_count as double) > 1 then distinct_id else null end) as look_avg_time
from dm_index_n.tmp_wos_vdo_shence_v1     --91876   中间表,提取神策数据
where event_name =  'short_video_watch_time' or event = 'user_heartbeat'
group by vdo_id
) d on a.grp_val = d.vdo_id
left join
(select grp_id,sum(index_val) as look_total_uv
from dm_index_n.index_grp1_Wos_Vdo_ViewPrsn_EndTdy   --网店短视频_浏览人数_无限制条件_截至当日
where busi_date = '2026-05-19'
and tag_id in ('tag074440892','tag074440896')    --元始股,易淘金
group by grp_id
) e on a.grp_id = e.grp_id
left join
(select grp_id,sum(index_val) as look_5_uv
from dm_index_n.index_grp_wos_vdo_record_10_times_uv
where busi_date = '2026-05-19'
and tag_id in ('tag510001043','tag510001042')    --元始股5s,易淘金5s
group by grp_id
) f on a.grp_id = f.grp_id
left join
(select grp_id,sum(index_val) as look_absl_uv
from dm_index_n.index_grp_wos_vdo_record_10_times_uv
where busi_date = '2026-05-19'
and tag_id in ('tag510001046','tag510001047')    --观看完_易淘金,观看完_元始股
group by grp_id
) g on a.grp_id = g.grp_id
left join
(select grp_id
,sum(case when tag_id in ('tag510001039','tag510001040','tag074441533') then index_val else 0 end) as share_num
,sum(case when tag_id in ('tag074441532') then index_val else 0 end) as like_num
from dm_index_n.index_grp1_Wos_Vdo_Thup_Shr_User_Num     --网店短视频_点赞分享数（次）_累计
where busi_date = '2026-05-19'
group by grp_id
) h on a.grp_id = h.grp_id
left join
(select grp_id,sum(index_val) as look_total_pv
from dm_index_n.index_grp1_Wos_Vdo_ViewTimes_EndTdy   --网店短视频_浏览次数_截至当日
where tag_id in ('tag074440896','tag074440892')
and busi_date = '2026-05-19'
group by grp_id
) i on a.grp_id = i.grp_id
left join
(select REGEXP_REPLACE(prom_id,'WOS003-','') prom_id
,concat_ws(',',collect_list(rela_prd)) as rela_prd
from
(select t2.prom_id,concat(t2.src_prd_cd,' ',t3.ch_abbr) as rela_prd
from
(select prom_id,prd_id,src_prd_cd
from PDATA_N.T07_PROM_PRD_RELA_INFO
where src_tbl = 'ODATA_N_WOS.T_PRODUCTSALES'
) t2
left join
(select src_sys_prdno,ch_abbr
from pdata_news_n.t02_scr_base_info
where src_id = 'PRD'
) t3 on t2.prd_id = t3.src_sys_prdno
) t group by prom_id
) k on a.grp_val = k.prom_id
left join
(select vdo_id
,sum(entr_amt) as entr_amt
,sum(deli_amt) as deli_amt
,count(distinct case when entr_num * 1 > 0 then pty_id else null end) as entr_cust_num
,count(distinct case when deli_num * 1 > 0 then pty_id else null end) as deli_cust_num
,sum(entr_num) as entr_order
,sum(deli_amt) as deli_order
from wt_shor_vdo_cust_prd_dtl
group by vdo_id
) l on a.grp_val = l.vdo_id
;

insert overwrite table wt_shor_vdo_cust_sum partition(busi_date)
select bas.vdo_id as live_id                                                                          --直播id
,vdo.grp_name as title                                                                            --直播主题
,substr(vfo.rels_time,1,10) as real_ply_date                                                      --开播日期
,prd.rela_prd                                                                                     --关联产品
,pty.grp_name as cust_name                                                                        --客户姓名
,bas.pty_id as cust_pty_no                                                                        --客户编号
,case when pty.grp_type_code = 'CORP_CUST' then '机构客户' else ctp.cust_ast_type end as cust_ast_type   --客户类型
,case when cmp.grp_id is not null then '1' else '0' end  as is_emp                                --是否员工
,org.inr_org_name as org_name                                                                     --所在营业部
,org.inr_org_id                                                                                   --所在营业部编号
,org.brch_bel_div_org_name as dept_name                                                           --所在分公司
,org.brch_bel_div_org_id dept_no                                                                  --所在分公司编号
,rla.fwgx_empname                                                                                 --服务关系
,rla.fwgx_empid                                                                                   --服务关系编号
,rla.kfgx_empname                                                                                 --开发关系
,rla.kfgx_empid                                                                                   --开发关系编号
,rlb.tggx_empname                                                                                 --投顾关系
,rlb.tggx_empid                                                                                   --投顾关系编号
,case when coalesce(lts.look_time,0) > 1 then '1' else '0' end as is_eff                          --是否有效观众
,case when coalesce(lts.look_time,0) >= 10 then '1' else '0' end as is_10_uv                      --是否10秒(含，同直播)观看客户
,coalesce(lts.look_time,0) as look_time                                                           --短视频观看时长
,null as is_click                                                                                 --是否点击产品
,null as coll_prd_list                                                                            --加自选产品
,null as entr_amt_durroom                                                                         --短视频委托金额
,null as deli_amt_durroom                                                                         --短视频成交金额
,null as entr_amt_durroom_list                                                                    --短视频委托金额,列表
,null as deli_amt_durroom_list                                                                    --短视频成交金额,列表
,round(coalesce(sal.entr_prd_amt_total,0),2) as entr_prd_amt_total                                --30天委托金额
,round(coalesce(sal.deil_prd_amt_total,0),2) as deil_prd_amt_total                                --30天成交金额
,sal.entr_prd_amt_list as entr_prd_amt_list                                                       --30天委托金额,列表
,sal.deil_prd_amt_list as deil_prd_amt_list                                                       --30天成交金额,列表
,round(coalesce(bal.bail,0),2) bail                                                               --保证金余额
,round(coalesce(ast.total_asset,0),2) total_asset                                                 --总资产
,rsk.risk_lvl                                                                                     --风险等级
,round(coalesce(lpv.look_total_pv,0)) as look_pv                                                  --浏览量
,case when coalesce(lts.look_time,0) > 0 then '1' else '0' end as is_uv                           --是否观看
,case when coalesce(lts.look_time,0)/vfo.vdo_dura > 0.5 then '1' else '0' end as is_half_uv       --是否重度参与
,null as entr_order_durroom                                                                       --短视频委托订单数
,null as deli_order_durroom	                                                                      --短视频成交订单数
,null as is_entr_durroom		                                                                  --是否短视频委托
,null as is_deli_durroom		                                                                  --是否短视频成交
,int(coalesce(sal.entr_order,0)) as entr_order	                                                  --30天委托订单数
,int(coalesce(sal.deli_order,0)) as deli_order	                                                  --30天成交订单数
,case when coalesce(sal.entr_order,0) >= 1 then '1' else '0' end as is_entr	                      --30天是否委托
,case when coalesce(sal.deli_order,0) >= 1 then '1' else '0' end as is_deli	                      --30天是否成交
,null as is_coll                                                                                  --是否短视频加自选
,null as click_num                                                                                --产品点击次数
,null as emp_share_times                                                                          --员工分享次数
,null as share_num                                                                                --分享次数
,'2026-05-19' as busi_date	                                                              --业务日期
from
(select pty_id,vdo_id
from (
select pty_id,vdo_id from wt_shor_vdo_cust_pv_temp
union all
select pty_id,vdo_id from wt_shor_vdo_cust_dtl_temp
) a group by pty_id,vdo_id
) bas
inner join
(select grp_id,grp_val,grp_name,grp_type_code
from dm_index_n.grp_def
where grp_type_code in ('INDV_CUST','CORP_CUST')
) pty on bas.pty_id = pty.grp_val
inner join
(SELECT * FROM dm_index_n.grp_def
WHERE status='1'
AND grp_type_code IN ('WOS_VDO')
) vdo on bas.vdo_id = vdo.grp_val
left join
(select pty_id
,vdo_id
,sum(case when event_name =  'short_video_watch_time' or event = 'user_heartbeat' then cast(audience_count as double) else 0 end) as look_time
from wt_shor_vdo_cust_dtl_temp
group by pty_id,vdo_id
) lts on bas.pty_id = lts.pty_id and bas.vdo_id = lts.vdo_id
left join wt_shor_vdo_cust_pv_temp lpv on bas.pty_id = lpv.pty_id and bas.vdo_id = lpv.vdo_id
left join
(select * from pdata_n.T07_SHOR_VDO_INFO
where src_tbl = 'ODATA_N_WOS.T_MEDIA'
and substr(rels_time,1,10) <= '2026-05-19'
and lbl_name like '%投顾说产品%'
and shor_vdo_stat_cd = 'pass'
) vfo on vdo.grp_val = vfo.shor_vdo_id
left join
(select pty_id,bel_inr_org_id
from PDATA_N.T98_BROK_INDV_CUST_BASE_INFO
where busi_date = '2026-05-19'
union all
select pty_id,bel_inr_org_id
from PDATA_N.T98_BROK_CORP_CUST_BASE_INFO
where busi_date = '2026-05-19'
) inf on bas.pty_id = inf.pty_id
left join
(select inr_org_id,inr_org_name,brch_bel_div_org_id,brch_bel_div_org_name
from pdata_n.t98_org_brch_div_info
where busi_Date = default.pretradedate(date_add('2026-05-19',1),1)
) org on inf.bel_inr_org_id = org.inr_org_id
left join
(select pty_id
,serv_emp_name as fwgx_empname
,serv_emp_id as fwgx_empid
,normal_dev_emp_name as kfgx_empname
,normal_dev_emp_id as kfgx_empid
from pdata_n.t98_cust_brok_mng_rela_info
where busi_date = '2026-05-19'
) rla on bas.pty_id = rla.pty_id
left join
(select a.pty_id,a.emp_id as tggx_empid,b.emp_name as tggx_empname
from pdata_n.t01_pty_emp_rela a,pdata_n.t98_org_emp_base_info b
where a.emp_id = b.emp_id
and a.pty_emp_rela_type_cd='02'
and a.busi_date = default.pretradedate(date_add('2026-05-19',1),1)
and b.busi_date = '2026-05-19'
and a.emp_id is not null
group by a.pty_id,a.emp_id,b.emp_name
) rlb on bas.pty_id = rlb.pty_id
left join
(select a.grp_id,b.tag_name as risk_lvl
from dm_index_n.grp_tag_client_risk_lvl a                --风险等级
,dm_index_n.tag_def b
where a.tag_id = b.tag_id
and a.busi_date = '2026-05-19'
and a.status = '1'
and b.tag_partition_id = 'tagdim100235'
) rsk on pty.grp_id = rsk.grp_id
left join
(select grp_id
,index_val as total_asset
from dm_index_n.index_grp_total_asset                      --总资产
where busi_date = default.pretradedate(date_add('2026-05-19',1),1)
and tag_id = 'tag999999999'
) ast on pty.grp_id = ast.grp_id
left join
(select grp_id
,index_val as bail
from dm_index_n.index_grp_total_asset                          --现金
where busi_date = default.pretradedate(date_add('2026-05-19',1),1)
and tag_id = 'tag038358862'
) bal on pty.grp_id = bal.grp_id
left join
(select REGEXP_REPLACE(prom_id,'WOS003-','') prom_id
,concat_ws(',',collect_list(rela_prd)) as rela_prd
from
(select t2.prom_id,concat(t2.src_prd_cd,' ',t3.ch_abbr) as rela_prd
from
(select prom_id,prd_id,src_prd_cd
from PDATA_N.T07_PROM_PRD_RELA_INFO
where src_tbl = 'ODATA_N_WOS.T_PRODUCTSALES'
) t2
left join
(select src_sys_prdno,ch_abbr
from pdata_news_n.t02_scr_base_info
where src_id = 'PRD'
) t3 on t2.prd_id = t3.src_sys_prdno
) t group by prom_id
) prd on vdo.grp_val = prd.prom_id
left join
(select grp_id,case when tag_id = 'tag074440187' then '大众客户'
when tag_id = 'tag074440188' then '金管家客户'
when tag_id = 'tag074440189' then '私人银行客户'
end as cust_ast_type
from dm_index_n.grp_tag_client_rich_cust_flag
where busi_mon = substr(add_months('2026-05-19',-1),1,7)
) ctp on pty.grp_id = ctp.grp_id
left join
(select distinct grp_id
from dm_index_n.grp_tag_client_whth_gf_emp                    --是否员工
where busi_date = '2026-05-19' and tag_id = 'tag074440509'
) cmp on pty.grp_id = cmp.grp_id
left join
(select vdo_id,grp_cust
,sum(cast(entr_num as double)) as entr_order
,sum(cast(deli_num as double)) as deli_order
,sum(cast(entr_amt as double)) as entr_prd_amt_total
,sum(cast(deli_amt as double)) as deil_prd_amt_total
,concat_ws(',',collect_list(concat(prd_name,' ',src_prd_cd))) as entr_prd_list
,concat_ws(',',collect_list(cast(round(entr_amt,2) as string))) as entr_prd_amt_list
,concat_ws(',',collect_list(concat(prd_name,' ',src_prd_cd))) as deli_prd_list
,concat_ws(',',collect_list(cast(round(deli_amt,2) as string))) as deil_prd_amt_list
from wt_shor_vdo_cust_prd_dtl a             --客户产品指标临时表_客户*短视频维度
group by vdo_id,grp_cust
) sal on pty.grp_id = sal.grp_cust and vdo.grp_val = sal.vdo_id
;
