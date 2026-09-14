-- task_id: 181018
-- hiveDb: dm_index_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_index_n/rd_script/dm_index_n.Stock_latent_customer_recommend2_type_score.py
-- observed_at: 2026-09-01T14:26:03.706Z

-- createSql
CREATE TABLE if not exists stk_base as select scr_cd as stock_code,--'股票代码' abbr_name as stock_name --'股票名称' from pdata_news_n.t02_stk_base_info --66042 where src_id = 'WD' and grp_id in (
  '01',
  '04'
)
;

CREATE TABLE if not exists rd_stock_info as select a.stock_code as stock_code,--'股票代码' b.stock_name as stock_name --'股票名称' from (
  select scr_cd as stock_code from pdata_news_n.t02_stk_base_info --66042 科学城模型表 where src_id = 'WD' and grp_id in ('01', '04') group by scr_cd having count(*) = 1
)
a inner join stk_base b on a.stock_code = b.stock_code ;

create table customer_temp2 as select user_id,--'联系人ID' user_name, --'联系人姓名' cust_type,--'客户类型' cust_lvl, --'客户等级' org_id,--'客户ID' org_name,--'客户姓名' Lkman_Pos_Cd, Pos_Name from (
  select substr(t2.Lkman_Pty_Id, 8) as user_id,
  --'联系人ID' t2.Pty_Name as user_name,
  --'联系人姓名' t1.cust_type as cust_type,
  --'客户类型' t1.cust_lvl as cust_lvl,
  --'客户等级' t1.org_id as org_id,
  --'客户ID' regexp_replace(regexp_replace(t1.org_name, '（', '('), '）', ')') as org_name,
  --'客户姓名' t2.Lkman_Pos_Cd as Lkman_Pos_Cd,
  t2.Pos_Name as Pos_Name,
  row_number() over(partition by nvl(t2.Pty_Name,''),t1.org_id,nvl(t2.Pos_Name,'') ORDER BY t2.Lkman_Pty_Id desc ) AS rn from ( select A.Rms_Cust_Type_Cd as cust_type,--'投研客户类型代码' A.Rms_Cust_Lvl_Cd as cust_lvl,--'投研客户等级代码' A.Pty_Name as org_name,--'当事人名称（机构名称）' regexp_replace(B.Rela_Pty_Id, '^[0]+', '') as org_id,--'当事人编号（机构id）' B.Pty_Id from ( select * from PDATA_N.T01_RMS_CORP_CUST --63203 WHERE SRC_TBL = 'ODATA_N_RMS.N_CRM_CUSTOMER' and busi_date = '2026-06-17' AND del_flag = '0' ) A left join ( SELECT * FROM pdata_n.T01_PTY_RELA_H --95053 WHERE src_tbl = 'ODATA_N_RMS.N_CRM_CONTACT' AND strt_date <= '2026-06-17' AND end_date > '2026-06-17' ) B ON substr(A.Pty_Id, 8) = regexp_replace(B.Rela_Pty_Id, '^[0]+', '') ) t1 left join ( select a.Lkman_Pty_Id,--'联系人ID' b.Pty_Name, --'联系人姓名' a.Lkman_Pos_Cd, a.Pos_Name from ( select * from PDATA_N.T01_RMS_CUST_LKMAN_ADTNL_INFO --95054 WHERE SRC_TBL = 'ODATA_N_RMS.N_CRM_CONTACT' and busi_date = '2026-06-17' and NVL(Leav_Flag, '0') = '0' and NVL(del_flag, '0') = '0' ) a left join ( SELECT * FROM pdata_n.t01_pty --94978 WHERE src_tbl = 'ODATA_N_RMS.N_CRM_CONTACT' and NVL(del_flag, '0') = '0' ) b on a.Lkman_Pty_Id = b.pty_id ) t2 on t1.Pty_Id = t2.Lkman_Pty_Id
)
tt1 where rn = 1 ;

create table if not exists rd_cust_info_wide (
  user_id string comment '联系人ID',
  user_name string comment '联系人姓名',
  cust_type string comment '客户类型',
  cust_lvl string comment '客户等级',
  cust_lvl_name string comment '客户等级名称',
  org_id string comment '客户ID',
  org_name string comment '客户姓名',
  position string comment '职位',
  tot_amt_scal string comment '总资金规模',
  state string comment '客户状态位，默认全部置为1'
)
comment '客户信息宽表' partitioned by(busi_date string comment '数据日期')
STORED AS orc;

create table reserveserrelationinfos_temp2 as select b.objid,--'路演ID' c.evt_id,--'事件编号' c.tag_val --'股票code' from (
  SELECT substr(Evt_Id, 19) as objid,
  Serv_Evt_Id AS evt_id FROM pdata_n.T05_RMS_RD_SHOW_RSRV_EVT --61571 WHERE del_flag = '0' and lower(src_tbl)='odata_n_rms.n_crm_reserveserrelationinfos'
)
b JOIN ( SELECT evt_id, src_prd_cd as tag_val FROM pdata_n.T05_RMS_EVT_PRD_RELA_INFO --66305 WHERE SRC_TBL = 'ODATA_N_RMS.N_SR_STOCKRELATION' and del_flag = '0' ) c ON b.evt_id = c.evt_id ;

CREATE TABLE if not exists wind_report as SELECT cc.objid AS user_id --联系人ID ,grf.rpt_title AS wind_report_title --Wind研报标题 ,nvl (
  irt.rpt_id,
  irt2.rpt_id
)
AS report_id --投研研报ID ,grf.rpt_rec_time AS rpt_rec_time --研报记录时间 ,grf.rpt_view_time AS rpt_view_time --研报查看时间 ,concat(grf.rpt_rec_time,'.000000' ) AS busi_time --时分秒 ,'1' AS evt_type --事件类型 ,cc.customerid AS cust_id --客户号 ,grf.encry_flag AS encryption --签名 FROM ( SELECT * ,regexp_replace(auth_name,'，',',') AS ath_name ,row_number() over(partition by rpt_id,view_co_name,view_prsn_name,rpt_rec_time,rpt_view_time ORDER BY 1) AS rn FROM pdata_news_n.t02_rpt_ext_read_rec --108175 WHERE src_id = 'UIP' AND grp_id = '01' ) grf LEFT JOIN ( SELECT MAX(rpt_id) AS rpt_id ,title ,scd_title ,regexp_replace(regexp_replace(author_name,'_+[0-9]+',''),'，',',') AS auth_name FROM pdata_news_n.t02_rd_base_info WHERE rtp_stat = '200' AND secret = '1' AND src_id = 'RMS' GROUP BY title ,scd_title ,author_name )irt ON grf.rpt_title = concat(irt.title, '：', irt.scd_title) --按全标题和研报作者匹配 AND grf.ath_name = irt.auth_name LEFT JOIN ( SELECT MAX(rpt_id) AS rpt_id ,scd_title ,regexp_replace(regexp_replace(author_name,'_+[0-9]+',''),'，',',') AS auth_name FROM pdata_news_n.t02_rd_base_info WHERE rtp_stat = '200' AND secret = '1' AND src_id = 'RMS' GROUP BY scd_title ,author_name )irt2 ON split(grf.rpt_title, '：')[1] = irt2.scd_title --按副标题和研报作者匹配 AND grf.ath_name = irt2.auth_name LEFT JOIN ( SELECT regexp_replace(c.Rela_Pty_Id ,'^[0]+','') AS customerid ,a.co_name ,split(a.lkman_pty_id,'-')[1] AS objid ,b.mobile_encrypt_wind_report ,row_number() over(partition by a.lkman_pty_id,c.Rela_Pty_Id,a.co_name,b.mobile_encrypt_wind_report ORDER BY 1) AS rn FROM ( SELECT * FROM pdata_n.t01_Rms_cust_lkman_adtnl_info WHERE busi_date = '2026-06-17' and Leav_Flag='0' ) a LEFT JOIN ( SELECT * FROM pdata_n.T01_PTY_RELA_H WHERE src_tbl = 'ODATA_N_RMS.N_CRM_CONTACT' AND strt_date <= '2026-06-17' AND end_date > '2026-06-17' ) c ON a.lkman_pty_id = c.pty_id LEFT JOIN ( select lk.pty_id,lk.emp_id, lk.mobile ,ccm.mobile_encrypt_wind_report from ( SELECT distinct lpad(substr(pty_id,8),12,'0') as pty_id , mobile , concat('RMS034-',split(Remark,'OBJID:')[1]) as emp_id FROM pdata_n.T01_PTY_IMP_LKMAN lateral view explode (split(regexp_replace(cont_mobile,'MOBILE_1:|MOBILE_2:',''),',')) ct_mobile as mobile WHERE busi_date = '2026-06-17' AND src_tbl='ODATA_N_RMS.N_CRM_CONTACT' --获取联系人手机信息 )lk join (select mobile_encrypt_wind_report ,regexp_replace(mobile,'（|\(|[\u4e00-\u9fa5]+|\)|）','') as mobile from pdata_nds.n_crm_contact_mobile where busi_date ='2026-06-17' and nvl(remove_tag,'0') ='0' ) ccm on 1=1 where lk.mobile <>'' AND instr(ccm.mobile,lk.mobile) >0 )b ON c.rela_pty_id = b.pty_id and a.lkman_pty_id=b.emp_id WHERE a.Leav_Flag = '0' AND a.Appr_Stat_Cd = '2' AND nvl(a.Del_Flag, '0') = '0' )cc ON grf.encry_flag=cc.mobile_encrypt_wind_report AND cc.rn = 1 WHERE grf.rn = 1 GROUP BY cc.objid ,grf.rpt_title ,nvl(irt.rpt_id,irt2.rpt_id) ,grf.rpt_rec_time ,grf.rpt_view_time ,cc.customerid ,grf.encry_flag ;

create table rule5_temp as SELECT cr.user_id as user_id, -- '用户id' cr.report_id, --'研报ID' substr (
  cr.read_evt_time,
  1,
  10
)
as busi_date, --'参加活动时间' cast(from_unixtime(floor((dura -28800000) / 1000), 'mm') as string) as duration, --'阅读时长' '个股投研' as type FROM ( select user_id, rpt_id as report_id, read_evt_type, read_evt_time, read_evt_chnl_type, dura from ( select *, row_number() over(partition by user_id,rpt_id,substr(read_evt_time, 1, 10) order by read_evt_time desc) as rn from pdata_news_n.t02_rpt_read_det_info --102672 科学城模型表 where src_id = 'RMS' and grp_id = '01' AND read_evt_type = '1' --阅读事件类型(0-未知事件,1-查看事件,2-下载事件,3-分享转发事件,4-分享下载事件,5-阅读全文事件,6-播放事件) and read_evt_chnl_type in (1,2,3) --阅读事件渠道类型( 0、未知渠道；1、门户；2、邮件；3、微信小程序；4、浏览器H5；5、机构客户APP；6、微信公众号H5') and cast(from_unixtime(floor((dura -28800000) / 1000), 'mm') as string) >= 1 ) v where rn = 1 ) cr WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.read_evt_time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.read_evt_time, 'yyyy-MM-dd HH:mm:ss') >= 0 union all SELECT cr.user_id as user_id, --'用户id' cr.report_id, --'研报ID' substr(rpt_view_time, 1, 10) as busi_date, --'参加活动时间' '2' as duration, --'阅读时长' '个股万得' as type FROM ( select user_id, --用户id report_id, --研报id rpt_view_time --研报查看时间 from ( select *, row_number() over(partition by user_id,report_id,substr(rpt_view_time, 1, 10) order by rpt_view_time desc) as rn from wind_report ) v where rn = 1 ) cr WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.rpt_view_time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.rpt_view_time, 'yyyy-MM-dd HH:mm:ss') >= 0 union all SELECT cr.user_id as user_id, --'用户id' cr.report_id, --'研报ID' substr(Read_Time , 1, 10) as busi_date, --'参加活动时间' '2' as duration, --'阅读时长' '个股携宁同花顺' as type FROM ( select substr(Cust_Lkman_Id,8) as user_id, --用户id Rpt_Id as report_id, --研报id Read_Time --研报查看时间 from ( select *, row_number() over(partition by Cust_Lkman_Id,Rpt_Id,substr(Read_Time,1,10) order by Read_Time desc) as rn from PDATA_N.T05_RMS_CUST_RPT_READ_EVT -- 190534 where SRC_TBL='ODATA_N_RMS.P_PORTAL_STAT_REPORT_ZHIQIU' and Data_Src in ('1','3') --'1'知丘 '2'新财富 '3'同花顺 ) v where rn=1 ) cr WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.Read_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.Read_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ;

create table rule7_temp as SELECT cr.user_id, -- '用户id' cr.report_id, -- '研报ID' rs.stock_code, --'股票代码' rd.group_code, --'研究方向code' rd.group_name, --'研究方向name' title, --'研报title' substr (
  read_evt_time,
  1,
  10
)
as busi_date, --'参加活动时间' cast(from_unixtime(floor((dura -28800000) / 1000), 'mm') as string) as duration, --'阅读时长' '行业投研' as type FROM ( select user_id, rpt_id as report_id, read_evt_type, read_evt_time, read_evt_chnl_type, dura from ( select *, row_number() over(partition by user_id,rpt_id,substr(read_evt_time, 1, 10) order by read_evt_time desc) as rn from pdata_news_n.t02_rpt_read_det_info --102672 科学城模型表 where src_id = 'RMS' and grp_id = '01' AND read_evt_type = '1' and read_evt_chnl_type in (1,2,3) --阅读事件渠道类型( 0、未知渠道；1、门户；2、邮件；3、微信小程序；4、浏览器H5；5、机构客户APP；6、微信公众号H5') and cast(from_unixtime(floor((dura -28800000) / 1000), 'mm') as string) >= 1 ) a where rn = 1 ) cr join ( SELECT id as report_id, stock_code, title FROM ( select * from ( select *, row_number() over(partition by trading_codes order by archive_time desc ) rn from PDATA_NDS.n_v_public_report_day --181671 ) a where rn = 1 ) a lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs on cr.report_id = rs.report_id join ( select report_id, group_code from ( select *, rank() over(partition by report_id order by upd_time desc) as rn from ( select rpt_id as report_id, grp_cd as group_code, substr(upd_time, 1, 10) as upd_time from pdata_news_n.t02_rd_grp_rel --66249科学城模型表 where src_id = 'RMS' and src_tbl = 'odata_rd.rd_ir_report_group_rel' ) a ) a where rn = 1 ) re on rs.report_id = re.report_id join ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 科学城模型表 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) rd on re.group_code = rd.group_code WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.read_evt_time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.read_evt_time, 'yyyy-MM-dd HH:mm:ss') >= 0 union all SELECT cr.user_id, -- '用户id' cr.report_id, -- '研报ID' rs.stock_code, --'股票代码' rd.group_code, --'研究方向code' rd.group_name, --'研究方向name' title, --'研报title' substr(rpt_view_time, 1, 10) as busi_date, --'参加活动时间' '2' as duration, --'阅读时长' '行业万得' as type FROM ( select user_id, --用户id report_id, --研报id rpt_view_time --研报查看时间 from ( select *, row_number() over(partition by user_id,report_id,substr(rpt_view_time, 1, 10) order by rpt_view_time desc) as rn from wind_report ) v where rn = 1 )cr join ( SELECT id as report_id, stock_code, title FROM ( select * from ( select *, row_number() over(partition by trading_codes order by archive_time desc ) rn from PDATA_NDS.n_v_public_report_day --181671 ) a where rn = 1 ) a lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs on cr.report_id = rs.report_id join ( select report_id, group_code from ( select *, rank() over(partition by report_id order by upd_time desc) as rn from ( select rpt_id as report_id, grp_cd as group_code, substr(upd_time, 1, 10) as upd_time from pdata_news_n.t02_rd_grp_rel --66249科学城模型表 where src_id = 'RMS' and src_tbl = 'odata_rd.rd_ir_report_group_rel' ) a ) a where rn = 1 ) re on rs.report_id = re.report_id join ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 科学城模型表 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) rd on re.group_code = rd.group_code WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.rpt_view_time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.rpt_view_time, 'yyyy-MM-dd HH:mm:ss') >= 0 union all SELECT cr.user_id, -- '用户id' cr.report_id, -- '研报ID' rs.stock_code, --'股票代码' rd.group_code, --'研究方向code' rd.group_name, --'研究方向name' title, --'研报title' substr(Read_Time , 1, 10) as busi_date, --'参加活动时间' '2' as duration, --'阅读时长' '行业携宁同花顺' as type FROM ( select substr(Cust_Lkman_Id,8) as user_id, --用户id Rpt_Id as report_id, --研报id Read_Time --研报查看时间 from ( select *, row_number() over(partition by Cust_Lkman_Id,Rpt_Id,substr(Read_Time,1,10) order by Read_Time desc) as rn from PDATA_N.T05_RMS_CUST_RPT_READ_EVT -- 190534 where SRC_TBL='ODATA_N_RMS.P_PORTAL_STAT_REPORT_ZHIQIU' and Data_Src in ('1','3') --'1'知丘 '2'新财富 '3'同花顺 ) v where rn=1 ) cr join ( SELECT id as report_id, stock_code, title FROM ( select * from ( select *, row_number() over(partition by trading_codes order by archive_time desc ) rn from PDATA_NDS.n_v_public_report_day --181671 ) a where rn = 1 ) a lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs on cr.report_id = rs.report_id join ( select report_id, group_code from ( select *, rank() over(partition by report_id order by upd_time desc) as rn from ( select rpt_id as report_id, grp_cd as group_code, substr(upd_time, 1, 10) as upd_time from pdata_news_n.t02_rd_grp_rel --66249 where src_id = 'RMS' and src_tbl = 'odata_rd.rd_ir_report_group_rel' ) a ) a where rn = 1 ) re on rs.report_id = re.report_id join ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) rd on re.group_code = rd.group_code WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.Read_Time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (cr.Read_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ;

create table rule8_temp as SELECT objid AS user_id, --'用户id' b.stock_code, --'股票代码' rd.group_code, --'研究方向code' rd.group_name, --'研究方向name' busi_date, --'参加活动时间' '会议' AS actity --'活动' FROM (
  SELECT substr(Pty_Id, 8) as objid,
  substr(Prom_Id, 12) as source_id,
  substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '20' -- activity_type='2' and Sign_Flag = '1' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(Sign_Time, 'yyyy-MM-dd HH:mm:ss') >= 0
)
A JOIN ( SELECT ID, stock_code FROM PDATA_NDS.n_v_public_actity_day --181695 LATERAL VIEW explode (split (trading_codes, ',')) trading_codes AS stock_code WHERE activity_type = '20' ) b ON A.source_id = b.ID JOIN ( SELECT distinct id, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs on b.stock_code = rs.stock_code join ( select report_id, group_code from ( select *, rank() over(partition by report_id order by upd_time desc) as rn from ( select rpt_id as report_id, grp_cd as group_code, substr(upd_time, 1, 10) as upd_time from pdata_news_n.t02_rd_grp_rel --66249 where src_id = 'RMS' and src_tbl = 'odata_rd.rd_ir_report_group_rel' ) a ) a where rn = 1 ) re ON rs.ID = re.report_id JOIN ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) rd ON re.group_code = rd.group_code UNION ALL SELECT a.objid AS user_id, scode as stock_code, rd.group_code, rd.group_name, a.busi_date, '调研' AS actity FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '3' --activity_type = '1' and Sign_Flag = '1' AND unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) A JOIN ( select *,substr(Sched_Id,8) as OBJID,substr(Prom_Id,12) as sourceid,Src_Prd_Cd as scode from PDATA_N.T07_PROM_SCHED_INFO --99330 where SRC_TBL = 'ODATA_N_RMS.N_CRM_SCHEDULE' and del_flag='0' ) b on a.source_id = b.objid join ( SELECT distinct ID FROM PDATA_NDS.n_v_public_actity_day --181695 WHERE activity_type = '3' ) c ON b.sourceid = c.ID JOIN ( SELECT distinct id, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs on b.scode = rs.stock_code JOIN ( select report_id, group_code from ( select *, rank() over(partition by report_id order by upd_time desc) as rn from ( select rpt_id as report_id, grp_cd as group_code, substr(upd_time, 1, 10) as upd_time from pdata_news_n.t02_rd_grp_rel --66249 where src_id = 'RMS' and src_tbl = 'odata_rd.rd_ir_report_group_rel' ) a ) a where rn = 1 ) re ON rs.ID = re.report_id JOIN ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) rd ON re.group_code = rd.group_code UNION ALL SELECT user_id, split(b.tag_val, '\\\\.') [0] AS stock_code, A.group_code, group_name, busi_date, '路演' AS actity FROM ( SELECT roadshow_id, cust_id, user_id FROM PDATA_NDS.p_v_roadshow_cust_rel --181716 LATERAL VIEW explode (split (contact_id, ',')) contact_id AS user_id WHERE TRIM (user_id) != '' ) x JOIN ( SELECT roadshow_id, substr(start_time, 1, 10) AS busi_date, group_code FROM PDATA_NDS.p_v_roadshow_info --181725 WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (start_time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 AND unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (start_time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) A ON x.roadshow_id = A.roadshow_id JOIN ( SELECT * FROM reserveserrelationinfos_temp2 ) b ON A.roadshow_id = b.objid LEFT JOIN ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) d ON A.group_code = d.group_code WHERE b.evt_id IS NOT NULL ;

create table Stock_latent_customer_recommend2_temp as select stockcode,-- '股票代码' stockname,--'股票名称' org_id,--'机构id' org_name,--'机构名称' user_id, --'用户id' user_name,--'用户名称' type, action, index_id,--'规则id' dt,-- '发生时间' hold_stock_val,-- '持股金额 (
  含指数或量化
)
' hold_stock_val - COALESCE(hold_stock_val_zl, 0) as hold_stock_val_other,--'持股金额(不含指数或量化)' hold_stock_val_zl,--'持股金额(只含指数或量化)' case when hold_stock_val is null or hold_stock_val = '0' or hold_stock_val_ = '0' then concat('客户当前披露持仓', stockname) else concat('客户当前披露持仓', stockname, hold_stock_val_) end as index_desc,-- '文案描述(含指数或量化)' case when hold_stock_val_zl_ = '0' then concat('客户当前披露持仓', stockname) when hold_stock_val_zl_ is null then null else concat('客户当前披露持仓', stockname, hold_stock_val_zl_) end as index_desc_other, --'文案描述(不含指数或量化)' score,--'分数' score_other --'（除指数基金、量化基金以外）分数' from ( select distinct stockcode,-- '股票代码' stockname, --'股票名称' org_id,--'机构id' org_name,--'机构名称' user_id,--'用户id' user_name,--'用户名称' type, action, index_id,--'规则id' dt, -- '发生时间' hold_stock_val, -- '持股金额(含指数或量化)' hold_stock_val_zl,--'持股金额(不含指数或量化)' score, --'分数' score_other,-- 包含指数或者量化 case when length(split(hold_stock_val, '\\\\.') [0]) < 5 then concat(round(cast(hold_stock_val as decimal(20, 2)), 2), '元') when length(split(hold_stock_val, '\\\\.') [0]) > 8 then concat(round(cast(hold_stock_val as decimal(20, 2)) / 100000000,2),'亿') else concat(round(cast(hold_stock_val as decimal(20, 2)) / 10000,2),'万') end as hold_stock_val_, -- 不包含指数或者量化，hold_stock_val != hold_stock_val_zl case when (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) != 0 and COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0) = 0 then '0' when (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) = 0 and COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0) != 0 then null when (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) = 0 and COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0) = 0 then null when length(split((hold_stock_val - COALESCE(hold_stock_val_zl, 0)), '\\\\.') [0]) < 5 and (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) != 0 and COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0) != 0 then concat(round(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20,2)),2),'元') when length(split((hold_stock_val - COALESCE(hold_stock_val_zl, 0)),'\\\\.' ) [0]) > 8 and ( COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) != 0 then concat(round(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2) ) / 100000000,2),'亿') else concat(round(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2)) / 10000,2),'万') end as hold_stock_val_zl_ from ( select stockcode, stockname, org_id, org_name, user_id, user_name, '个股' as type, '当前持仓' as action, '1' as index_id, dt, sum(cast(hold_stock_val as decimal(20, 4))) over(partition by stockcode, org_id, user_id, dt) as hold_stock_val, sum(cast(hold_stock_val_zl as decimal(20, 4))) over(partition by stockcode, org_id, user_id, dt) as hold_stock_val_zl, sum(cast(hold_stock_num as decimal(20, 4))) over(partition by stockcode, org_id, user_id, dt) as hold_stock_num, sum(cast(hold_stock_num_zl as decimal(20, 4))) over(partition by stockcode, org_id, user_id, dt) as hold_stock_num_zl, '' as score, '' as score_other from ( select ch.stockcode, wd.stock_name as stockname, uo_map.org_id, uo_map.org_name, uo_map.user_id, wind_user.f_info_fundmanager as user_name, ch.busi_date as dt, hold_stock_val, hold_stock_val_zl, hold_stock_num, hold_stock_num_zl from ( select fund_windcode, case when split(hold_stock_windcode, '\\\\.') [1] = 'HK' and length(split(hold_stock_windcode, '\\\\.') [0]) = '4' then concat('0', split(hold_stock_windcode, '\\\\.') [0]) else split(hold_stock_windcode, '\\\\.') [0] end as stockcode, hold_stock_name as stockname, hold_stock_val, hold_stock_num, regexp_replace(regexp_replace(fund_comp_name, '\\（', '('),'\\）', ')') as org_name, end_date, concat(substr(end_date, 1, 4),'Q',int((int(substr(end_date, 5, 2)) - 1) / 3) + 1) as busi_date from ( select *, case when lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0) in ('03', '12') then to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-31')) else to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-30')) end as date_ql, to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3 -2,2,0),'-01')) as date_qf from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 left join ( select max(end_date) as ndate from pdata_news_n.tyzx_fund_stock_portfolio --107626 where default.datekey2date(end_date) < '2026-04-01') t2 on 1 = 1) t where default.datekey2date(end_date) >= date_qf AND default.datekey2date(end_date) <= date_ql and hold_stock_num > 0 ) ch left join ( select fund_windcode, fund_windcode_zl, case when split(hold_stock_windcode, '\\\\.') [1] = 'HK' and length(split(hold_stock_windcode, '\\\\.') [0]) = '4' then concat('0', split(hold_stock_windcode, '\\\\.') [0]) else split(hold_stock_windcode, '\\\\.') [0] end as stockcode, hold_stock_name as stockname, hold_stock_num as hold_stock_num_zl, hold_stock_val as hold_stock_val_zl, regexp_replace(regexp_replace(fund_comp_name, '\\（', '('),'\\）', ')') as org_name, concat(substr(end_date, 1, 4),'Q',int((int(substr(end_date, 5, 2)) - 1) / 3) + 1) as busi_date from ( select t1.*, split(t3.src_sys_prdno, '-') [1] as fund_windcode_zl, case when lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0) in ('03', '12') then to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-31')) else to_date(concat(year(default.datekey2date(ndate)), '-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-30')) end as date_ql, to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3 -2,2,0),'-01')) as date_qf from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 left join ( SELECT distinct src_sys_prdno from pdata_news_n.t02_co_indt --170647 where src_id = 'WD' and grp_id = '13' and indt_ch_name rlike '指数|量化' ) t3 on t1.fund_windcode = split(t3.src_sys_prdno, '-') [1] left join ( select max(end_date) as ndate from pdata_news_n.tyzx_fund_stock_portfolio --107626 where default.datekey2date(end_date) < '2026-04-01') t2 on 1 = 1 ) t where default.datekey2date(end_date) >= date_qf AND default.datekey2date(end_date) <= date_ql and hold_stock_num > 0 ) zl on ch.fund_windcode = zl.fund_windcode_zl and ch.stockcode = zl.stockcode and ch.org_name = zl.org_name and ch.busi_date = zl.busi_date left join ( select b.in_code as f_info_windcode,--'基金Wind代码' t1.name as f_info_fundmanager --'基金经理name' from ( select scr_cd,--'基金代码' name, -- '姓名' secu_id from pdata_news_n.t02_fnd_mngr_appo_info --69845 where src_id = 'WD' and grp_id = '01' and appo_flag = '1' -- 在任基金经理 ) t1 left JOIN ( select * from pdata_news_n.t02_scr_BASE_INFO --59493 where src_id = 'WD' ) b on t1.secu_id = b.secu_id ) wind_user on ch.fund_windcode = wind_user.f_info_windcode left join stk_base wd on ch.stockcode = wd.stock_code left join ( select user_id, user_name, org_id, regexp_replace(regexp_replace(org_name, '（', '('), '）', ')') as org_name from customer_temp2 ) uo_map on ch.org_name = uo_map.org_name and wind_user.f_info_fundmanager = uo_map.user_name ) v where hold_stock_val = hold_stock_val_zl or hold_stock_val_zl is null ) v ) v union all select stockcode,--'股票代码' stockname,--'股票名称' org_id,--'机构id' org_name,--'机构名称' user_id,--'用户id' user_name,--'用户名称' '个股' as type, '上2-4季持仓' as action, '2' as index_id,--'规则id' dt, --'发生时间' hold_stock_val,--'持股金额(含指数或量化)' hold_stock_val_other,--'持股金额(不含指数或量化)' hold_stock_val_zl,--'持股金额(只含指数或量化)' index_desc,--'文案描述(含指数或量化)' case when index_desc_other like '%万、999' then regexp_replace(index_desc_other, '万、999', '万') when index_desc_other like '%元、999' then regexp_replace(index_desc_other, '元、999', '元') when index_desc_other like '%亿、999' then regexp_replace(index_desc_other, '亿、999', '亿') else index_desc_other end as index_desc_other,--'文案描述(不含指数或量化)' score,--'分数' score_other --'（除指数基金、量化基金以外）分数' from ( select stockcode,--'股票代码' stockname,--'股票名称' org_id,--'机构id' org_name,--'机构名称' user_id,--'用户id' user_name,--'用户名称' '个股' as type, '上2-4季持仓' as action, '2' as index_id,--'规则id' dt,--'发生时间' cast(hold_stock_val as decimal(20, 4)) as hold_stock_val,--'持股金额(含指数或量化)' cast(hold_stock_val_other as decimal(20, 4)) as hold_stock_val_other,--'持股金额(不含指数或量化)' cast(hold_stock_val_zl as decimal(20, 4)) as hold_stock_val_zl,--'持股金额(只含指数或量化)' index_desc,--'文案描述(含指数或量化)' case when index_desc_other like '%:999、999、%' then regexp_replace(index_desc_other, ':999、999、', ':') when index_desc_other like '%万、999、999' then regexp_replace(index_desc_other, '万、999、999', '万') when index_desc_other like '%元、999、999' then regexp_replace(index_desc_other, '元、999、999', '元') when index_desc_other like '%亿、999、999' then regexp_replace(index_desc_other, '亿、999、999', '亿') when index_desc_other like '%:999、%' and (index_desc_other not like '%万、999' or index_desc_other not like '%元、999' or index_desc_other not like '%亿、999') then regexp_replace(index_desc_other, ':999、', ':') when index_desc_other not like '%:999、%' and index_desc_other like '%万、999、%' then regexp_replace(index_desc_other, '万、999', '万') when index_desc_other not like '%:999、%' and index_desc_other like '%元、999、%' then regexp_replace(index_desc_other, '元、999', '元') when index_desc_other not like '%:999、%' and index_desc_other like '%亿、999、%' then regexp_replace(index_desc_other, '亿、999', '亿') when index_desc_other like '%万、999、%' then regexp_replace(index_desc_other, '万、999、', '万、') when index_desc_other like '%万、999、%' then regexp_replace(index_desc_other, '元、999、', '元、') when index_desc_other like '%万、999、%' then regexp_replace(index_desc_other, '亿、999、', '亿、') else index_desc_other end as index_desc_other,--'文案描述(不含指数或量化)' score, --'分数' score_other --'（除指数基金、量化基金以外）分数' from ( select stockcode, stockname, org_id, org_name, user_id, user_name, busi_date as dt, case when split(hold_stock_val, '-') [0] = 'null' then null else split(hold_stock_val, '-') [0] end as hold_stock_val,-- 持仓金额（含指数或量化） case when split(hold_stock_val_other, '-') [0] = 'null' then null else split(hold_stock_val_other, '-') [0] end as hold_stock_val_other,-- 持仓金额（不含指数或量化） case when split(hold_stock_val_zl, '-') [0] = 'null' then null else split(hold_stock_val_zl, '-') [0] end as hold_stock_val_zl,-- 持仓金额（只含指数或量化） concat('客户近一年披露持仓', stockname, ':', hold_stock_val_) as index_desc, case when hold_stock_val_zl_ like '%Q%' then concat('客户近一年披露持仓', stockname, ':', hold_stock_val_zl_) else null end as index_desc_other, cast(score as string) as score, cast(score_other as string) as score_other from ( select stockcode, stockname, org_id, org_name, user_id, user_name, score1 as score, score1_other as score_other, regexp_replace(concat_ws('-',sort_array(collect_set(concat('!', 1 -1 / rn, '!', hold_stock_val )))),'!(.*?)!','') as hold_stock_val, regexp_replace(concat_ws('-',sort_array(collect_set(concat('!', 1 -1 / rn, '!', hold_stock_val_zl)))),'!(.*?)!','') as hold_stock_val_zl, regexp_replace(concat_ws('-',sort_array(collect_set(concat('!', 1 -1 / rn, '!', hold_stock_val_other)))),'!(.*?)!','') as hold_stock_val_other, regexp_replace(concat_ws('/',sort_array(collect_set(concat('!', 1 -1 / rn, '!', busi_date )))),'!(.*?)!','') as busi_date, regexp_replace(concat_ws( '、',sort_array(collect_set(concat('!', 1 -1 / rn, '!', hold_stock_val_ )))),'!(.*?)!','') as hold_stock_val_, regexp_replace(concat_ws('、',sort_array(collect_set(concat('!', 1 -1 / rn, '!', hold_stock_val_zl_ )))),'!(.*?)!','') as hold_stock_val_zl_ from ( select *, sum(score) over(partition by stockcode, org_id, user_id) as score1, sum(score_other) over(partition by stockcode, org_id, user_id) as score1_other, row_number() over(partition by stockcode,org_id,user_id order by busi_date desc) as rn from ( select distinct stockcode, stockname, org_id, org_name, user_id, user_name, case when default.datekey2date(end_date) >= default.add_months(date_qf, -3) AND default.datekey2date(end_date) <= default.add_months(date_ql, -3) and COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0) != '0' then '30.00' when default.datekey2date(end_date) >= default.add_months(date_qf, -6) AND default.datekey2date(end_date) <= default.add_months(date_ql, -6) and COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0) != '0' then '20.00' when COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0) = '0' then '' else '10.00' end as score_other,-- 得分（除指数基金、量化基金以外） case when hold_stock_val is null then 'null'else hold_stock_val end as hold_stock_val, score, busi_date, case when COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0) = '0' then 'null' else hold_stock_val - COALESCE(hold_stock_val_zl, 0) end as hold_stock_val_other, case when hold_stock_val_zl is null then 'null' else hold_stock_val_zl end as hold_stock_val_zl, case when length(split(hold_stock_val, '\\\\.') [0]) < 5 and hold_stock_val != '0' then concat(busi_date,'-',round(cast(hold_stock_val as decimal(20, 2)), 2),'元') when length(split(hold_stock_val, '\\\\.') [0]) > 8 then concat(busi_date,'-',round(cast(hold_stock_val as decimal(20, 2)) / 100000000,2),'亿') when length(split(hold_stock_val, '\\\\.') [0]) is null or hold_stock_val = '0' then busi_date else concat(busi_date,'-',round(cast(hold_stock_val as decimal(20, 2)) / 10000,2),'万') end as hold_stock_val_,-- 包含指数或者量化 case when (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) != 0 and (COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0)) = '0' then busi_date when (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) = 0 and (COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0)) != '0' then '999' when (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) = 0 and (COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0)) = '0' then '999' when length(split(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2)),'\\\\.') [0]) < 5 and (COALESCE(hold_stock_num, 0) - COALESCE(hold_stock_num_zl, 0)) != 0 and (COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0)) != '0' then concat(busi_date,'-',round(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2)),2),'元') when length(split(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2)),'\\\\.') [0]) > 8 and (COALESCE(hold_stock_val, 0) - COALESCE(hold_stock_val_zl, 0)) != '0' then concat(busi_date,'-',round(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2)) / 100000000,2),'亿') else concat(busi_date,'-',round(cast((hold_stock_val - COALESCE(hold_stock_val_zl, 0)) as decimal(20, 2)) / 10000,2),'万') end as hold_stock_val_zl_ -- 不包含指数或者量化 from ( select stockcode, stockname, org_id, org_name, user_id, user_name, score, end_date, date_ql, date_qf, busi_date, sum(cast(hold_stock_val as decimal(20, 4))) over(partition by stockcode,org_id,user_id,busi_date) as hold_stock_val, sum(cast(hold_stock_val_zl as decimal(20, 4))) over(partition by stockcode,org_id,user_id,busi_date) as hold_stock_val_zl, sum(cast(hold_stock_num as decimal(20, 4))) over(partition by stockcode,org_id,user_id,busi_date) as hold_stock_num, sum(cast(hold_stock_num_zl as decimal(20, 4))) over(partition by stockcode,org_id,user_id,busi_date) as hold_stock_num_zl from ( select ch.stockcode, wd.stock_name as stockname, uo_map.org_id, uo_map.org_name, uo_map.user_id, wind_user.f_info_fundmanager as user_name, ch.score, ch.end_date, ch.date_ql, ch.date_qf, hold_stock_val, hold_stock_val_zl, hold_stock_num, hold_stock_num_zl, ch.busi_date from ( select fund_windcode, case when split(hold_stock_windcode, '\\\\.') [1] = 'HK'and length(split(hold_stock_windcode, '\\\\.') [0]) = '4' then concat('0', split(hold_stock_windcode, '\\\\.') [0]) else split(hold_stock_windcode, '\\\\.') [0] end as stockcode, hold_stock_name as stockname, hold_stock_val, hold_stock_num, case when default.datekey2date(end_date) >= default.add_months(date_qf, -3) AND default.datekey2date(end_date) <= default.add_months(date_ql, -3) then '30.00' when default.datekey2date(end_date) >= default.add_months(date_qf, -6) AND default.datekey2date(end_date) <= default.add_months(date_ql, -6) then '20.00' else '10.00' end as score, end_date, date_ql, date_qf, regexp_replace(regexp_replace(fund_comp_name, '\\（', '('),'\\）',')') as org_name, concat(substr(end_date, 1, 4), 'Q',int((int(substr(end_date, 5, 2)) - 1) / 3) + 1) as busi_date from ( select *, case when lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0) in ('03', '12') then to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-31')) else to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-30')) end as date_ql, to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3 -2,2,0),'-01')) as date_qf from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 left join ( select max(end_date) as ndate from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 where default.datekey2date(end_date) < '2026-04-01') t2 on 1 = 1 ) t where default.datekey2date(end_date) >= default.add_months(date_qf, -9) AND default.datekey2date(end_date) <= default.add_months(date_ql, -3) and hold_stock_num > 0 ) ch left join ( select fund_windcode, fund_windcode_zl, hold_stock_num as hold_stock_num_zl, case when split(hold_stock_windcode, '\\\\.') [1] = 'HK'and length(split(hold_stock_windcode, '\\\\.') [0]) = '4' then concat('0', split(hold_stock_windcode, '\\\\.') [0]) else split(hold_stock_windcode, '\\\\.') [0] end as stockcode, hold_stock_val as hold_stock_val_zl, regexp_replace(regexp_replace(fund_comp_name, '\\（', '('),'\\）',')') as org_name, concat(substr(end_date, 1, 4),'Q',int((int(substr(end_date, 5, 2)) - 1) / 3) + 1) as busi_date from ( select t1.*, split(t3.src_sys_prdno, '-') [1] as fund_windcode_zl, case when lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3, 2,0) in ('03', '12') then to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-31')) else to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3,2,0),'-30')) end as date_ql, to_date(concat(year(default.datekey2date(ndate)),'-',lpad(ceil(month(default.datekey2date(ndate)) / 3) * 3 -2,2,0),'-01')) as date_qf from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 left join ( SELECT distinct src_sys_prdno from pdata_news_n.t02_co_indt --170647 where src_id = 'WD' and grp_id = '13' and indt_ch_name rlike '指数|量化' ) t3 on t1.fund_windcode = split(t3.src_sys_prdno, '-') [1] left join ( select max(end_date) as ndate from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 where default.datekey2date(end_date) < '2026-04-01') t2 on 1 = 1 ) t where default.datekey2date(end_date) >= default.add_months(date_qf, -9) AND default.datekey2date(end_date) <= default.add_months(date_ql, -3) and hold_stock_num > 0 ) zl on ch.fund_windcode = zl.fund_windcode_zl and ch.stockcode = zl.stockcode and ch.org_name = zl.org_name and ch.busi_date = zl.busi_date left join ( select b.in_code as f_info_windcode,--'基金Wind代码' t1.name as f_info_fundmanager --'基金经理name' from ( select scr_cd,--'基金代码' name, -- '姓名' secu_id from pdata_news_n.t02_fnd_mngr_appo_info --69845 where src_id = 'WD' and grp_id = '01' and appo_flag = '1' -- 在任基金经理 ) t1 left JOIN ( select * from pdata_news_n.t02_scr_BASE_INFO --59493 where src_id = 'WD' ) b on t1.secu_id = b.secu_id ) wind_user on ch.fund_windcode = wind_user.f_info_windcode left join stk_base wd on ch.stockcode = wd.stock_code left join ( select user_id, user_name, org_id, regexp_replace(regexp_replace(org_name, '（', '('), '）', ')') as org_name from customer_temp2 ) uo_map on ch.org_name = uo_map.org_name and wind_user.f_info_fundmanager = uo_map.user_name ) v where hold_stock_val = hold_stock_val_zl or hold_stock_val_zl is null ) v ) v ) v group by stockcode, stockname, org_id, org_name, user_id, user_name, score1, score1_other ) ch ) tt ) tmp union all select ch.stock_code as stockcode, --'股票代码' wd.stock_name as stockname,--'股票名称' user1.org_id,--'机构id' user1.org_name,--'机构名称' ch.user_id,--'用户id' user1.user_name, --'用户名称' '个股' as type, actity as action, '3' as index_id,--'规则id' ch.busi_date as dt,--'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' --合并的时候还原成null null as hold_stock_val_other,--'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' concat(substr(busi_date, 6, 5),'报名了',wd.stock_name,'的策略会',actity) as index_desc,--'文案描述(含指数或量化)' null as index_desc_other,--'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' from ( select substr(Cust_Lkman_Id, 8) as user_id, --联系人id substr(Cust_Id, 8) as org_id, --客户id Enrl_Partic_Co_Stk_Cd as stock_code, --公司股票代码 case when Req_Comnc_Type_Cd = '1' then '一对一交流' else '小范围交流' end as actity, --需求交流类型(1一对一交流，2小范围,0默认值) substr(Estb_Time, 1, 10) as busi_date --参会时间 from PDATA_N.T05_RMS_CUST_STRG_MEET_ENRL_EVT -- 190533 where SRC_TBL = 'ODATA_N_RMS.N_CRM_STRATEGY_APPLY' and Req_Comnc_Type_Cd != '0' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Estb_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 365 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Estb_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 )ch left join stk_base wd on ch.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2 ) user1 on ch.user_id = user1.user_id union all select cs.stock_code as stockcode, wd.stock_name as stockname, user1.org_id, user1.org_name, cs.user_id, user1.user_name, '个股' as type, actity as action, '4' as index_id, cs.busi_date as dt, null as hold_stock_val, null as hold_stock_val_other, null as hold_stock_val_zl, concat(substr(busi_date,6,5),'参加了',wd.stock_name,'的',actity) as index_desc, null as index_desc_other, '' as score, '' as score_other from ( SELECT objid as user_id, stock_code, busi_date, '会议' as actity FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '20' -- activity_type='2' and Sign_Flag = '1' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(Sign_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) A JOIN ( SELECT ID, stock_code FROM PDATA_NDS.n_v_public_actity_day --181695 LATERAL VIEW explode (split (trading_codes, ',')) trading_codes AS stock_code WHERE activity_type = '20' ) b ON A.source_id = b.ID union all SELECT user_id, split(b.tag_val,'\\\\.')[0] as stock_code, busi_date, '路演' as actity FROM ( SELECT roadshow_id, cust_id, user_id FROM PDATA_NDS.p_v_roadshow_cust_rel --181716 LATERAL VIEW explode (split (contact_id, ',')) contact_id AS user_id WHERE TRIM (user_id) != '' ) x JOIN ( SELECT roadshow_id, substr(start_time, 1, 10) as busi_date FROM PDATA_NDS.p_v_roadshow_info --181725 WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (start_time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 AND unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (start_time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) a ON x.roadshow_id = a.roadshow_id JOIN (SELECT * FROM reserveserrelationinfos_temp2 ) b ON a.roadshow_id = b.objid WHERE b.evt_id IS NOT NULL union all SELECT a.objid as user_id, scode as stock_code, a.busi_date, '调研' as actity FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '3' --activity_type = '1' and Sign_Flag = '1' AND unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) a JOIN ( select *,substr(Sched_Id,8) as OBJID,substr(Prom_Id,12) as sourceid,Src_Prd_Cd as scode from PDATA_N.T07_PROM_SCHED_INFO --99330 where SRC_TBL = 'ODATA_N_RMS.N_CRM_SCHEDULE' and del_flag='0' ) b on a.source_id=b.objid join ( SELECT distinct id FROM PDATA_NDS.n_v_public_actity_day --181695 WHERE activity_type = '3' ) c ON b.sourceid = c.id )cs left join stk_base wd on cs.stock_code = wd.stock_code left join (select user_id,user_name,org_id,org_name from customer_temp2 )user1 on cs.user_id = user1.user_id union all SELECT ch.stock_code AS stockcode,--'股票名称' wd.stock_name AS stockname,--'股票名称' USER1.org_id,--'机构id' USER1.org_name, --'机构名称' ch.user_id,-- '用户id' USER1.user_name,--'用户名称' type, ch.report_id as action, '5' AS index_id, --'规则id' ch.busi_date AS dt,--'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' null as hold_stock_val_other,--'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' case when ch.type ='个股携宁同花顺' then concat(substr(busi_date, 6, 5),'阅读了',wd.stock_name,'的《',ch.title,'》报告','（携宁/同花顺）') when ch.type ='个股万得' then concat(substr(busi_date, 6, 5),'阅读了',wd.stock_name,'的《',ch.title,'》报告','（万得）') else concat(substr(busi_date, 6, 5),'阅读了',wd.stock_name,'的《',ch.title,'》报告',ch.duration,'分钟') end AS index_desc,--'文案描述(含指数或量化)' null as index_desc_other,--'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' FROM (select cr.user_id as user_id, -- '用户id' rs2.stock_code, --'股票代码' rs2.title, --'研报title' cr.report_id, --'研报ID' cr.busi_date, --'参加活动时间' cr.duration, --'阅读时长' cr.type from rule5_temp cr join ( SELECT id as report_id, stock_code, title FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs2 on cr.report_id = rs2.report_id )ch LEFT JOIN stk_base wd ON ch.stock_code = wd.stock_code LEFT JOIN ( SELECT user_id, user_name, org_id, org_name FROM customer_temp2 ) USER1 ON ch.user_id = USER1.user_id union all select ch.stock_code as stockcode,--'股票代码' wd.stock_name as stockname,--'股票名称' user1.org_id,--'机构id' user1.org_name,--'机构名称' ch.user_id,--'用户id' user1.user_name,--'用户名称' '个股' as type, '关注' as action, '6' as index_id, --'规则id' ch.dt,--'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' null as hold_stock_val_other,--'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' concat(substr(ch.dt, 6, 5), '关注了', wd.stock_name) as index_desc,--'文案描述(含指数或量化)' null as index_desc_other,--'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' from ( select distinct split(a.pty_id, '-') [1] as user_id, a.src_scrp_info as stock_code, substr(a.scrp_time, 1, 10) as dt from ( select * from pdata_n.t01_pty_scrp_info --94136 where busi_date = '2026-06-17' and scrp_type_cd = '03' and src_tbl = 'ODATA_N_RMS.P_PORTAL_CONCERN' ) a left join ( select * from pdata_news_n.t02_scr_base_info --70101 where src_id = 'RMS' and mkt_cd in ('SSE', 'SZSE', 'HKEX') ) b on a.src_scrp_info = b.scr_cd ) ch left join stk_base wd on ch.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2 ) user1 on ch.user_id = user1.user_id union all select ch.stock_code as stockcode, --'股票代码' wd.stock_name as stockname, --'股票名称' user1.org_id,--'机构id' user1.org_name,--'机构名称' ch.user_id,--'用户id' user1.user_name,--'用户名称' '行业' as type, rd.group_code as action, '6' as index_id,--'规则id' gc.dt, --'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' null as hold_stock_val_other,--'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' concat(substr(gc.dt, 6, 5), '关注了', rd.group_name) as index_desc,--'文案描述(含指数或量化)' null as index_desc_other, --'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' from ( select distinct split(a.pty_id, '-') [1] as user_id, a.src_scrp_info as stock_code, substr(a.scrp_time, 1, 10) as dt from ( select * from pdata_n.t01_pty_scrp_info --94136 where busi_date = '2026-06-17' and scrp_type_cd = '03' and src_tbl = 'ODATA_N_RMS.P_PORTAL_CONCERN' ) a left join ( select * from pdata_news_n.t02_scr_base_info --70101 where src_id = 'RMS' and mkt_cd in ('SSE', 'SZSE', 'HKEX') ) b on a.src_scrp_info = b.scr_cd ) ch join ( SELECT id as report_id, title as report_name, stock_code FROM ( select * from ( select *, row_number() over(partition by trading_codes order by archive_time desc) rn from PDATA_NDS.n_v_public_report_day --181671 ) a where rn = 1 ) a lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) rs on ch.stock_code = rs.stock_code join ( select report_id, group_code from ( select *, rank() over(partition by report_id order by upd_time desc) as rn from ( select rpt_id as report_id, grp_cd as group_code, substr(upd_time, 1, 10) as upd_time from pdata_news_n.t02_rd_grp_rel --66249 where src_id ='RMS' and src_tbl='odata_rd.rd_ir_report_group_rel' ) a ) a where rn = 1 ) re on rs.report_id = re.report_id join ( select Emp_Grp_Id as group_code, Emp_Grp_Full_Name_Ch as group_name from PDATA_N.T04_EMP_GRP --61639 WHERE SRC_TBL = 'ODATA_N_RMS.N_ANL_GROUP' and Del_Flag = '0' and data_src_cd = 'RMS' ) rd on re.group_code = rd.group_code join ( SELECT split(pty_id, '-') [1] as user_id, src_scrp_info as group_code, substr(scrp_time, 1, 10) as dt FROM PDATA_N.T01_PTY_SCRP_INFO --94136 WHERE busi_date = '2026-06-17' AND scrp_type_cd = '05' ) gc on gc.group_code = rd.group_code and ch.user_id = gc.user_id left join stk_base wd on ch.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2 ) user1 on ch.user_id = user1.user_id union all select sc.stock_code as stockcode,--'股票代码' wd.stock_name as stockname,--'股票名称' user1.org_id, --'机构id' user1.org_name,--'机构名称' sc.user_id,--'用户id' user1.user_name,--'用户名称' '分析师' as type, an.author_code as action, '6' as index_id,--'规则id' ch.dt,--'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' null as hold_stock_val_other,--'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' concat(substr(ch.dt, 6, 5),'关注了覆盖的分析师—',an.author_name) as index_desc,--'文案描述(含指数或量化)' null as index_desc_other,--'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' from ( select distinct split(a.pty_id, '-') [1] as user_id, a.src_scrp_info as stock_code, substr(a.scrp_time, 1, 10) as dt from ( select * from pdata_n.t01_pty_scrp_info --94136 where busi_date = '2026-06-17' and scrp_type_cd = '03' and src_tbl = 'ODATA_N_RMS.P_PORTAL_CONCERN' ) a left join ( select * from pdata_news_n.t02_scr_base_info --70101 where src_id = 'RMS' and mkt_cd in ('SSE', 'SZSE', 'HKEX') ) b on a.src_scrp_info = b.scr_cd ) sc join ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes, ',')) trading_codes AS stock_code WHERE column_name = '公司研究' ) tc on sc.stock_code = tc.stock_code join ( SELECT id as report_id, title as report_name, split(author_name, '_') [0] as author_name, split(author_name, '_') [1] as author_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(author_names, ',')) author_names AS author_name WHERE column_name = '公司研究' ) an on tc.report_id = an.report_id join ( SELECT split(pty_id, '-') [1] as user_id, src_scrp_info as author_code, substr(scrp_time, 1, 10) as dt FROM PDATA_N.T01_PTY_SCRP_INFO --94136 WHERE busi_date = '2026-06-17' AND scrp_type_cd = '04' ) ch on an.author_code = ch.author_code and ch.user_id = sc.user_id left join stk_base wd on sc.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2 ) user1 on sc.user_id = user1.user_id union all SELECT ch.stock_code AS stockcode,--'股票名称' wd.stock_name AS stockname,--'股票名称' USER1.org_id,--'机构id' USER1.org_name, --'机构名称' ch.user_id,-- '用户id' USER1.user_name,--'用户名称' ch.type as type, qr.report_id as action, '7' AS index_id, --'规则id' qr.busi_date AS dt,--'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' null as hold_stock_val_other,--'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' case when ch.type ='行业携宁同花顺' then concat (substr(qr.busi_date, 6, 5),'阅读了',ch.group_name,'的《',qr.title,'》报告','（携宁/同花顺）') when ch.type ='行业万得' then concat (substr(qr.busi_date, 6, 5),'阅读了',ch.group_name,'的《',qr.title,'》报告','（万得）') else concat (substr(qr.busi_date, 6, 5),'阅读了',ch.group_name,'的《',qr.title,'》报告',qr.duration,'分钟') end AS index_desc,--'文案描述(含指数或量化)' null as index_desc_other,--'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' FROM rule7_temp ch JOIN rule7_temp qr ON ch.group_code = qr.group_code AND ch.user_id = qr.user_id LEFT JOIN stk_base wd ON ch.stock_code = wd.stock_code LEFT JOIN ( SELECT user_id, user_name, org_id, org_name FROM customer_temp2 ) USER1 ON ch.user_id = USER1.user_id WHERE ch.stock_code != qr.stock_code union all SELECT cs.stock_code AS stockcode,--'股票代码' wd.stock_name AS stockname,--'股票名称' USER1.org_id,--'机构id' USER1.org_name,--'机构名称' cs.user_id,--'用户id' USER1.user_name,--'用户名称' cs.actity as type, cs.group_code as action, '8' AS index_id,--'规则id' cs.busi_date AS dt,--'发生时间' null as hold_stock_val,--'持股金额(含指数或量化)' null as hold_stock_val_other, --'持股金额(不含指数或量化)' null as hold_stock_val_zl,--'持股金额(只含指数或量化)' concat (substr(cs.busi_date, 6, 5),'参加了',cs.group_name,'的',cs.actity) AS index_desc,--'文案描述(含指数或量化)' null AS index_desc_other,--'文案描述(不含指数或量化)' '' as score,--'分数' '' as score_other --'（除指数基金、量化基金以外）分数' FROM ( SELECT DISTINCT aa.user_id, aa.stock_code, aa.group_code, aa.group_name, bb.busi_date, bb.actity FROM rule8_temp aa LEFT JOIN rule8_temp bb ON aa.user_id = bb.user_id AND aa.group_code = bb.group_code WHERE aa.stock_code != bb.stock_code ) cs LEFT JOIN stk_base wd ON cs.stock_code = wd.stock_code LEFT JOIN ( SELECT user_id, user_name, org_id, org_name FROM customer_temp2 ) USER1 ON cs.user_id = USER1.user_id ;

create table Stock_latent_customer_recommend2_temp2 as select distinct stockcode --'股票代码' ,stockname --'股票名称' ,org_id --'机构id' ,org_name --'机构名称' ,user_id --'用户id' ,user_name --'用户名称' ,type ,action ,index_id --'规则id' ,dt --'发生时间' ,hold_stock_val --'持股金额 (
  含指数或量化
)
' ,hold_stock_val_other --'持股金额(不含指数或量化)' ,hold_stock_val_zl --'持股金额(只含指数或量化)' ,index_desc --'文案描述(含指数或量化)' ,index_desc_other --'文案描述(不含指数或量化)' ,score --'分数' ,score_other --'（除指数基金、量化基金以外）分数' from Stock_latent_customer_recommend2_temp where stockcode is not null ;

create table Stock_latent_customer_recommend2_temp3 as select stockcode --'股票代码' ,stockname --'股票名称' ,org_id --'机构id' ,org_name --'机构名称' ,user_id --'用户id' ,user_name --'用户名称' ,type ,action ,index_id --'规则id' ,dt --'发生时间' ,case when hold_stock_val = '0' then null else hold_stock_val end as hold_stock_val --'持股金额 (
  含指数或量化
)
' ,case when hold_stock_val_other = '0' then null else hold_stock_val_other end as hold_stock_val_other --'持股金额(不含指数或量化)' ,case when hold_stock_val_zl = '0' then null else hold_stock_val_zl end as hold_stock_val_zl --'持股金额(只含指数或量化)' ,index_desc --'文案描述(含指数或量化)' ,index_desc_other --'文案描述(不含指数或量化)' ,case when score = '' then index_score else score end as score --'分数' ,sum(round(score_12, 2)) over(partition by stockcode, org_id, user_id) as score_12 --'规则1、2分数' ,sum(round(score_other, 2)) over(partition by stockcode, org_id, user_id) as score_other --'（除指数基金、量化基金以外）分数' ,sum(round(index_score, 2)) over(partition by stockcode, org_id, user_id) as index_score --'总分' from ( select stockcode, stockname, org_id, org_name, user_id, user_name, type, action, index_id, dt, hold_stock_val, hold_stock_val_other, hold_stock_val_zl, index_desc, index_desc_other, score, case when index_id = '1' then '50.00' when index_id = '2' then score else '' end as score_12, case when index_id = '1' and index_desc_other is null then '' when index_id = '1' and index_desc_other is not null then '50.00' when index_id = '2' then score_other else '' end as score_other, case when index_id = '1' then '50.00' when index_id = '3' and action = '一对一交流' then round(20.00 - cast(datediff('2026-06-17', dt) *(20.00 -10.00) as decimal(20, 4)) / 365.00,2) when index_id = '3' and action = '小范围交流' then round(10.00 - cast(datediff('2026-06-17', dt) *(10.00 -5.00) as decimal(20, 4)) / 365.00,2) when index_id = '4' then round(10.00 - cast(datediff('2026-06-17', dt) *(10.00 -3.00) as decimal(20, 4)) / 30.00,2) when index_id = '5' and round(10.00 -((datediff('2026-06-17', dt) - 1.00) * (10.00 - 3.00) / 29.00 + nvl(int(regexp_extract(index_desc, '报告([0-9]+)分钟', 1)),2) / 60.00),1) >= 10.00 then '10.00' when index_id = '5' and round(10.00 -((datediff('2026-06-17', dt) - 1.00) * (10.00 - 3.00) / 29.00 + nvl(int(regexp_extract(index_desc, '报告([0-9]+)分钟', 1)),2) / 60.00),1) < 3.00 then '3.00' when index_id = '5' and round(10.00 -((datediff('2026-06-17', dt) - 1.00) * (10.00 - 3.00) / 29.00 + nvl(int(regexp_extract(index_desc, '报告([0-9]+)分钟', 1)),2) / 60.00),1) >= 3.00 and round(10.00 -((datediff('2026-06-17', dt) - 1) * (10.00 - 3.00) / 29.00 + nvl(int(regexp_extract(index_desc, '报告([0-9]+)分钟', 1)),2) / 60.00),1) < 10.00 then round (round(10.00 -(cast(datediff('2026-06-17', dt) as decimal(20, 4)) - 1.00) * (10.00 - 3.00) / 29.00 + nvl(cast(regexp_extract(index_desc, '报告([0-9]+)分钟', 1) as decimal(20, 4)),2) / 60.00,1),2) when index_id = '6' and type = '行业' then '3.00' when index_id = '6' and type = '个股' then '10.00' when index_id = '6' and type = '分析师' then '10.00' when index_id = '7' then '1.00' when index_id = '8' then '2.00' else score end as index_score from Stock_latent_customer_recommend2_temp2 ) t ;

create table if not exists Stock_latent_customer_recommend2_type_score (
  stockcode string comment '股票代码',
  stockname string comment '股票名称',
  org_id string comment '机构id',
  org_name string comment '机构名称',
  user_id string comment '用户id',
  user_name string comment '用户名称',
  positionname string comment '用户职位',
  capital_scale string comment '资金规模',
  custlevel string comment '客户等级',
  custtype string comment '客户类型',
  type string comment '',
  action string comment '',
  index_id string comment '规则id',
  dt string comment '发生时间',
  hold_stock_val string comment '持股金额(含指数或量化)',
  hold_stock_val_other string comment '持股金额(不含指数或量化)',
  hold_stock_val_zl string comment '持股金额(只含指数或量化)',
  index_desc string comment '文案描述(含指数或量化)',
  index_desc_other string comment '文案描述(不含指数或量化)',
  score string comment '分数',
  score_zl string comment '指数或量化分数',
  index_score string comment '总分',
  state string comment '',
  rules string comment '唯一性规则拼接'
)
comment '研报客户推荐'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS orc ;

create table if not exists Stock_latent_customer_recommend2_type_score_total (
  stockcode string comment '股票代码',
  stockname string comment '股票名称',
  org_id string comment '机构id',
  org_name string comment '机构名称',
  user_id string comment '用户id',
  user_name string comment '用户名称',
  positionname string comment '用户职位',
  capital_scale string comment '资金规模',
  custlevel string comment '客户等级',
  custtype string comment '客户类型',
  total_score string comment '总分',
  total_score_zl string comment '规则1、2总分'
)
comment '潜客评分总分表'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS orc ;

-- querySql
DROP TABLE IF EXISTS stk_base;

DROP TABLE IF EXISTS rd_stock_info;

drop table if exists customer_temp2;

drop table if exists rd_cust_info_wide;

insert overwrite table rd_cust_info_wide partition (busi_date = '2026-06-17')
select t.user_id,     --'联系人ID'
t.user_name,   --'联系人姓名'
t.cust_type,   --'客户类型'
t.cust_lvl,    --'客户等级'
t3.Dw_Cd_Val_Desc as cust_lvl_name,  --'客户等级名称'
t.org_id,      --'客户ID'
t.org_name,    --'客户姓名'
case
when (t.Lkman_Pos_Cd = '-1'or t.Lkman_Pos_Cd is null)
then t.Pos_Name
else en.Dw_Cd_Val_Desc
end as position,--'职位'
cast(t5.tot_mnge_amt as decimal(20, 4)) as tot_amt_scal,--'总资金规模'
'1' as state --'客户状态位，默认全部置为1'
from customer_temp2 t
inner join (
select *
from PDATA_N.REF_DW_CD_VAL                --118136
where dw_cd_id = 'CD627'
) t3 on (t.cust_lvl = t3.Dw_Cd_Val)
left join (
select *
from PDATA_N.REF_DW_CD_VAL                --118136
where dw_cd_id = 'CD586'
) en on t.Lkman_Pos_Cd = en.Dw_Cd_Val
left join (
select
mngr_id --基金经理id
,mngr_name --基金经理姓名
,sum(mnge_amt / mngr_amt) as avg_mnge_amt --管理规模（平均）
,sum(mnge_amt) as tot_mnge_amt --管理规模（总体）
,count(1) as sec_num --管理基金只数
,concat_ws(',', collect_set(scr_cd)) as fund_list --管理基金清单
,credit_no --统一社会信用证
,comp_name --基金公司名称
from (
select distinct
mngr.src_mngr_id as mngr_id, --基金经理id
mngr.name as mngr_name, --基金经理姓名
fund.scr_cd as scr_cd,
fund.mnge_amt as mnge_amt,
fund.mngr_amt as mngr_amt,
fund.mgmt_corp_cd as credit_no, --统一社会信用证
regexp_replace(regexp_replace(fund.mng_prtc, '（', '('), '）', ')') as comp_name --基金公司名称
from (
select a1.secu_id,
a1.mgmt_corp_cd,
a1.mng_prtc,
a1.issue_scal,
a3.mngr_amt as mngr_amt, -- 关联不到的默认分母为1
nvl(a2.nav, a1.issue_scal) AS mnge_amt, -- 不公布最新规模的使用发行规模
a1.scr_cd
from (
select secu_id,
scr_cd,
mgmt_corp_cd,
mng_prtc,
issue_scal
from pdata_news_n.t02_fnd_base_info --69826
where src_id = 'TL'
) a1 -- 剔除货币型基金和ETF基金
left join (
select b.scr_cd as securitycode,
c.src_const_cd as reporttype,
a.ann_dt as noticedate,--'公布日期'
a.nav as nav, --'期末基金资产净值'
rank() over (partition by b.scr_cd order by a.ann_dt desc, a.end_dt desc,a.rec_upd_time desc) as rk1
from (
select *
from pdata_news_n.t02_fnd_fin_idx --69714
where nav is not null
and ann_dt is not null
and src_id = 'DC'
and grp_id = '01'
) a
left join (
select *
from pdata_news_n.t02_scr_BASE_INFO --59493
where src_id = 'DC'
) b on a.rec_id = b.in_code
left join (
select *
from pdata_news_n.t02_pub_covt_const --74850
where src_id = 'DC'
and const_type_cd = 'inf00007'
and match_type_cd = '93001'
) c on a.rpt_type = c.const_cd
) a2 on a2.securitycode = a1.scr_cd
left join (
select scr_cd,
count(1) as mngr_amt
from pdata_news_n.t02_fnd_mngr_appo_info --69845
where src_id = 'WD'
and grp_id = '01'
and appo_strt_date <= '2026-06-17'
and nvl(appo_end_date, '2099-12-31') >= '2026-06-17'
group by scr_cd
) a3 on a1.scr_cd = a3.scr_cd
where a2.rk1 = 1
or a2.rk1 is null
) fund --基金粒度管理规模
inner join (
select src_mngr_id,
name,
scr_cd
from pdata_news_n.t02_fnd_mngr_appo_info --69845
where src_id = 'WD'
and grp_id = '01'
and appo_strt_date <='2026-06-17'
and nvl(appo_end_date, '2099-12-31') >= '2026-06-17'
) mngr --快照当天基金经理任职情况
on fund.scr_cd = mngr.scr_cd
left join (
select secu_id
from pdata_news_n.t02_co_indt --69871
where src_id = 'WD'
and grp_id = '13'
and curr_flag = '1'
and indt_code in ('20010202', '20010104')
group by secu_id
) ty -- 剔除货币型基金和ETF基金
on fund.secu_id = ty.secu_id
where ty.secu_id is null
and mngr.name is not null
) tt1
group by mngr_id,
mngr_name,
credit_no,
comp_name --按照基金经理维度汇总
) t5 on t.user_name = t5.mngr_name
and t.org_name = t5.comp_name
order by t.org_id,
t.user_id
;

drop table if exists reserveserrelationinfos_temp2;

DROP TABLE IF EXISTS wind_report;

drop table if exists rule5_temp;

drop table if exists rule7_temp;

drop table if exists rule8_temp;

drop table if exists Stock_latent_customer_recommend2_temp;

drop table if exists Stock_latent_customer_recommend2_temp2;

drop table if exists Stock_latent_customer_recommend2_temp3;

insert overwrite table Stock_latent_customer_recommend2_type_score  partition(busi_date = '2026-06-17')
select   t1.stockcode                        --'股票代码'
,t1.stockname                       --'股票名称'
,t1.org_id                          --'机构id'
,t1.org_name                        --'机构名称'
,t1.user_id                         --'用户id'
,t1.user_name                       --'用户名称'
,t2.position as positionname        --'用户职位'
,t2.tot_amt_scal as capital_scale   --'资金规模'
,t2.cust_lvl as custlevel           --'客户等级'
,t2.cust_type as custtype           --'客户类型'
,t1.type
,t1.action
,t1.index_id                        --'规则id'
,t1.dt                              --'发生时间'
,t1.hold_stock_val                  --'持股金额(含指数或量化)'
,t1.hold_stock_val_other            --'持股金额(不含指数或量化)'
,t1.hold_stock_val_zl               --'持股金额(只含指数或量化)'
,t1.index_desc                      --'文案描述(含指数或量化)'
,t1.index_desc_other                --'文案描述(不含指数或量化)'
,round(t1.score, 1)                 --'分数'
,round(COALESCE(t1.score_12, 0) - COALESCE(t1.score_other, 0),1) as score_zl --'指数或量化分数'
,round(t1.index_score, 1) as index_score --'总分'
,'1' as state
,concat(t1.stockcode,t1.user_id,t1.type,t1.action,t1.index_id,t1.dt,'1') as rules --'唯一性规则拼接'
from
(
select *
from
Stock_latent_customer_recommend2_temp3
) t1
inner join
(
select *
from rd_cust_info_wide
where busi_date = '2026-06-17'
) t2
on t1.user_id = t2.user_id
;

insert overwrite table Stock_latent_customer_recommend2_type_score_total  partition(busi_date = '2026-06-17')
select   stockcode --'股票代码'
,stockname --'股票名称'
,org_id --'机构id'
,org_name --'机构名称'
,user_id --'用户id'
,user_name --'用户名称'
,positionname --'用户职位'
,capital_scale --'资金规模'
,custlevel --'客户等级'
,custtype --'客户类型'
,index_score as total_score --'总分'
,score_zl as total_score_zl --'指数或量化分数'
from (
select *,
row_number() over(partition by stockcode,stockname,user_id order by index_score desc) rn
from Stock_latent_customer_recommend2_type_score
where busi_date = '2026-06-17'
) stc
where stc.rn = 1
;
