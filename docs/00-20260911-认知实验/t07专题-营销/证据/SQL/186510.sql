-- task_id: 186510
-- hiveDb: dm_index_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_index_n/rd_script/dm_smart.sirm_report_recommend_org.py
-- observed_at: 2026-09-04T17:17:52.474Z

-- createSql
CREATE TABLE if not exists stk_base_org as
select scr_cd as stock_code,--'股票代码'
abbr_name as stock_name --'股票名称'
from pdata_news_n.t02_stk_base_info --66042
where src_id = 'WD'
;

CREATE TABLE if not exists wind_report_org as SELECT cc.objid AS user_id --联系人ID ,grf.rpt_title AS wind_report_title --Wind研报标题 ,nvl (
  irt.rpt_id,
  irt2.rpt_id
)
AS report_id --投研研报ID ,grf.rpt_rec_time AS rpt_rec_time --研报记录时间 ,grf.rpt_view_time AS rpt_view_time --研报查看时间 ,concat(grf.rpt_rec_time,'.000000' ) AS busi_time --时分秒 ,'1' AS evt_type --事件类型 ,cc.customerid AS cust_id --客户号 ,grf.encry_flag AS encryption --签名 FROM ( SELECT * ,regexp_replace(auth_name,'，',',') AS ath_name ,row_number() over(partition by rpt_id,view_co_name,view_prsn_name,rpt_rec_time,rpt_view_time ORDER BY 1) AS rn FROM pdata_news_n.t02_rpt_ext_read_rec --108175 WHERE src_id = 'UIP' AND grp_id = '01' ) grf LEFT JOIN ( SELECT MAX(rpt_id) AS rpt_id ,title ,scd_title ,regexp_replace(regexp_replace(author_name,'_+[0-9]+',''),'，',',') AS auth_name FROM pdata_news_n.t02_rd_base_info WHERE rtp_stat = '200' AND secret = '1' AND src_id = 'RMS' GROUP BY title ,scd_title ,author_name )irt ON grf.rpt_title = concat(irt.title, '：', irt.scd_title) --按全标题和研报作者匹配 AND grf.ath_name = irt.auth_name LEFT JOIN ( SELECT MAX(rpt_id) AS rpt_id ,scd_title ,regexp_replace(regexp_replace(author_name,'_+[0-9]+',''),'，',',') AS auth_name FROM pdata_news_n.t02_rd_base_info WHERE rtp_stat = '200' AND secret = '1' AND src_id = 'RMS' GROUP BY scd_title ,author_name )irt2 ON split(grf.rpt_title, '：')[1] = irt2.scd_title --按副标题和研报作者匹配 AND grf.ath_name = irt2.auth_name LEFT JOIN ( SELECT regexp_replace(c.Rela_Pty_Id ,'^[0]+','') AS customerid ,a.co_name ,split(a.lkman_pty_id,'-')[1] AS objid ,b.mobile_encrypt_wind_report ,row_number() over(partition by a.lkman_pty_id,c.Rela_Pty_Id,a.co_name,b.mobile_encrypt_wind_report ORDER BY 1) AS rn FROM ( SELECT * FROM pdata_n.t01_Rms_cust_lkman_adtnl_info WHERE busi_date = '2026-06-17' and Leav_Flag='0' ) a LEFT JOIN ( SELECT * FROM pdata_n.T01_PTY_RELA_H WHERE src_tbl = 'ODATA_N_RMS.N_CRM_CONTACT' AND strt_date <= '2026-06-17' AND end_date > '2026-06-17' ) c ON a.lkman_pty_id = c.pty_id LEFT JOIN ( select lk.pty_id,lk.emp_id, lk.mobile ,ccm.mobile_encrypt_wind_report from ( SELECT distinct lpad(substr(pty_id,8),12,'0') as pty_id , mobile , concat('RMS034-',split(Remark,'OBJID:')[1]) as emp_id FROM pdata_n.T01_PTY_IMP_LKMAN lateral view explode (split(regexp_replace(cont_mobile,'MOBILE_1:|MOBILE_2:',''),',')) ct_mobile as mobile WHERE busi_date = '2026-06-17' AND src_tbl='ODATA_N_RMS.N_CRM_CONTACT' --获取联系人手机信息 )lk join (select mobile_encrypt_wind_report ,regexp_replace(mobile,'（|\(|[\u4e00-\u9fa5]+|\)|）','') as mobile from pdata_nds.n_crm_contact_mobile where busi_date ='2026-06-17' and nvl(remove_tag,'0') ='0' ) ccm on 1=1 where lk.mobile <>'' AND instr(ccm.mobile,lk.mobile) >0 )b ON c.rela_pty_id = b.pty_id and a.lkman_pty_id=b.emp_id WHERE a.Leav_Flag = '0' AND a.Appr_Stat_Cd = '2' AND nvl(a.Del_Flag, '0') = '0' )cc ON grf.encry_flag=cc.mobile_encrypt_wind_report AND cc.rn = 1 WHERE grf.rn = 1 GROUP BY cc.objid ,grf.rpt_title ,nvl(irt.rpt_id,irt2.rpt_id) ,grf.rpt_rec_time ,grf.rpt_view_time ,cc.customerid ,grf.encry_flag ;

create table customer_temp2_org as select user_id,--'联系人ID' user_name, --'联系人姓名' cust_type,--'客户类型' cust_lvl, --'客户等级' org_id,--'客户ID' org_name,--'客户姓名' Lkman_Pos_Cd, Pos_Name from (
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

create table reserveserrelationinfos_temp2_org as select b.objid,--'路演ID' c.evt_id,--'事件编号' c.tag_val --'股票code' from (
  SELECT substr(Evt_Id, 19) as objid,
  Serv_Evt_Id AS evt_id FROM pdata_n.T05_RMS_RD_SHOW_RSRV_EVT --61571 WHERE del_flag = '0' and lower(src_tbl)='odata_n_rms.n_crm_reserveserrelationinfos'
)
b JOIN ( SELECT evt_id, src_prd_cd as tag_val FROM pdata_n.T05_RMS_EVT_PRD_RELA_INFO --66305 WHERE SRC_TBL = 'ODATA_N_RMS.N_SR_STOCKRELATION' and del_flag = '0' and SRC_EXCH_TYPE_CD in ('1','2') ) c ON b.evt_id = c.evt_id ;

create table sirm_report_recommend_org_temp as select rs.report_id, rs.report_name, uo_map.org_id, uo_map.org_name, uo_map.user_id, wind_user.f_info_fundmanager as user_name, '2' as index_id, ch.busi_date as dt, ch.target_name, concat (
  '客户上季度持仓过本研报覆盖股票'
)
as index_desc from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select fund_windcode, split(hold_stock_windcode,'\\\\.')[0] as stock_code, hold_stock_name as target_name, regexp_replace(regexp_replace(fund_comp_name, '（', '('), '）', ')') as org_name, default.datekey2date(end_date) as busi_date from pdata_news_n.tyzx_fund_stock_portfolio t1 --107626 WHERE default.datekey2date(end_date) >= default.add_months('2026-04-01', -3) AND default.datekey2date(end_date) <= default.add_months('2026-06-30', -3) and hold_stock_num > 0 )ch on rs.stock_code = ch.stock_code left join ( select b.in_code as f_info_windcode,--'基金Wind代码' t1.name as f_info_fundmanager --'基金经理name' from ( select scr_cd,--'基金代码' name, -- '姓名' secu_id from pdata_news_n.t02_fnd_mngr_appo_info -- 69845 where src_id = 'WD' and grp_id = '01' and appo_flag = '1' -- 在任基金经理 ) t1 left JOIN ( select * from pdata_news_n.t02_scr_BASE_INFO --59493 科学城 where src_id = 'WD' ) b on t1.secu_id = b.secu_id ) wind_user on ch.fund_windcode = wind_user.f_info_windcode left join ( select user_id, user_name, org_id, regexp_replace(regexp_replace(org_name, '（', '('), '）', ')') as org_name from customer_temp2_org ) uo_map on ch.org_name = uo_map.org_name and wind_user.f_info_fundmanager = uo_map.user_name union all select rs.report_id, --研报id rs.report_name, --研报名称 user1.org_id, --机构id user1.org_name, --机构名称 ch.user_id, --用户id user1.user_name, --用户名称 '3' as index_id, --规则id ch.busi_date as dt, --发生时间 wd.stock_name as target_name, --目标名称 concat(ch.busi_date,'报名了',wd.stock_name,'的策略会',ch.DEMAND_TYPE) as index_desc--文案描述(含指数或量化) from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select substr(Cust_Lkman_Id, 8) as user_id, --联系人id substr(Cust_Id, 8) as org_id, --客户id Enrl_Partic_Co_Stk_Cd as stock_code, --公司股票代码 case when Req_Comnc_Type_Cd = '1' then '一对一交流' when Req_Comnc_Type_Cd = '2' then '小范围交流' else null end as DEMAND_TYPE, --需求交流类型(1一对一交流，2小范围,0默认值) substr(Estb_Time, 1, 10) as busi_date --参会时间 from PDATA_N.T05_RMS_CUST_STRG_MEET_ENRL_EVT -- 190533 where SRC_TBL = 'ODATA_N_RMS.N_CRM_STRATEGY_APPLY' and Req_Comnc_Type_Cd != '0' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Estb_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 365 )ch on rs.stock_code = ch.stock_code left join stk_base_org wd on ch.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, -- 研报ID rs.report_name, --研报名称 user1.org_id, --机构id user1.org_name, --机构名称 ch.user_id, --用户id user1.user_name, --用户名称 '4' as index_id, --规则id ch.busi_date as dt, --发生时间 wd.stock_name as target_name, --目标名称 concat(busi_date,'阅读了',wd.stock_name,'股票的报告') as index_desc --文案描述(含指数或量化) from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select cr.user_id, rs2.report_id, rs2.report_name, rs2.stock_code, cr.busi_date from ( SELECT user_id, report_id, substr(read_evt_time, 1, 10) as busi_date FROM ( select user_id, rpt_id as report_id, read_evt_type, read_evt_time, dura from ( select *, row_number() over(partition by user_id,rpt_id,substr(read_evt_time, 1, 10) order by read_evt_time desc) as rn from pdata_news_n.t02_rpt_read_det_info --102672 科学城模型表 where src_id = 'RMS' and grp_id = '01' AND read_evt_type = '1' --阅读事件类型(0-未知事件,1-查看事件,2-下载事件,3-分享转发事件,4-分享下载事件,5-阅读全文事件,6-播放事件) and read_evt_chnl_type in (1,2,3) --阅读事件渠道类型( 0、未知渠道；1、门户；2、邮件；3、微信小程序；4、浏览器H5；5、机构客户APP；6、微信公众号H5') and cast(from_unixtime(floor((dura -28800000) / 1000), 'mm') as string) >= 1 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (read_evt_time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (read_evt_time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) a where rn = 1 )t1 union all select user_id, --用户id report_id, --研报id substr(rpt_view_time, 1, 10) as busi_date --研报查看时间 from ( select *, row_number() over(partition by user_id,report_id,substr(rpt_view_time, 1, 10) order by rpt_view_time desc) as rn from wind_report_org WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (rpt_view_time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (rpt_view_time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) v where rn = 1 union all select substr(Cust_Lkman_Id,8) as user_id, --用户id Rpt_Id as report_id, --研报id substr(Read_Time, 1, 10) as busi_date --研报查看时间 from ( select *, row_number() over(partition by Cust_Lkman_Id,Rpt_Id,substr(Read_Time,1,10) order by Read_Time desc) as rn from PDATA_N.T05_RMS_CUST_RPT_READ_EVT -- 190534 where SRC_TBL='ODATA_N_RMS.P_PORTAL_STAT_REPORT_ZHIQIU' and Data_Src in ('1','3') --'1'知丘 '2'新财富 '3'同花顺 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Read_Time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Read_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) v where rn=1 )cr join ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' )rs2 on cr.report_id = rs2.report_id )ch on rs.stock_code = ch.stock_code left join stk_base_org wd on ch.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, cs.user_id, user1.user_name, '5' as index_id, cs.busi_date as dt, wd.stock_name as target_name, concat(busi_date,'参加了',wd.stock_name,'股票的会议') as index_desc from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( SELECT objid as user_id, stock_code, busi_date FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 科学城模型表 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '20' --activity_type='2' and Sign_Flag = '1' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60*60*24*30 ) a JOIN ( SELECT id, stock_code FROM PDATA_NDS.n_v_public_actity_day --181695 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE activity_type = '20' ) b ON a.source_id = b.id )cs on rs.stock_code = cs.stock_code left join stk_base_org wd on cs.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on cs.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, cs.user_id, user1.user_name, '5' as index_id, cs.busi_date as dt, wd.stock_name as target_name, concat(busi_date,'参加了',wd.stock_name,'股票的路演') as index_desc from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( SELECT user_id, substr(b.tag_val, 1, 6) as stock_code, busi_date FROM ( SELECT roadshow_id, cust_id, user_id FROM PDATA_NDS.p_v_roadshow_cust_rel --181716 lateral view explode(split(contact_id,',')) contact_id AS user_id where trim(user_id) != '' ) x JOIN ( SELECT roadshow_id, substr(start_time, 1, 10) as busi_date FROM PDATA_NDS.p_v_roadshow_info --181725 WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59'))- unix_timestamp(start_time, 'yyyy-MM-dd HH:mm:ss') < 60*60*24*30 ) a ON x.roadshow_id = a.roadshow_id JOIN ( SELECT * FROM reserveserrelationinfos_temp2_org ) b ON A.roadshow_id = b.objid )cs on rs.stock_code = cs.stock_code left join stk_base_org wd on cs.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on cs.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, cs.user_id, user1.user_name, '5' as index_id, cs.busi_date as dt, wd.stock_name as target_name, concat(busi_date,'参加了',wd.stock_name,'股票的调研') as index_desc from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( SELECT objid as user_id, stock_code, busi_date FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 科学城模型表 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '3' --activity_type = '1' and Sign_Flag = '1' AND unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 ) a JOIN ( SELECT id, stock_code FROM PDATA_NDS.n_v_public_actity_day --181695 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE activity_type = '3' ) b ON a.source_id = b.id )cs on rs.stock_code = cs.stock_code left join stk_base_org wd on cs.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on cs.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, ch.user_id, user1.user_name, '6' as index_id, ch.create_time as dt, wd.stock_name as target_name, concat(create_time,'订阅了',wd.stock_name,'股票') as index_desc from ( SELECT id as report_id, title as report_name, stock_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(trading_codes,',')) trading_codes AS stock_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select distinct split(a.pty_id, '-') [1] as user_id, a.src_scrp_info as stock_code, substr(a.scrp_time, 1, 10) as create_time from ( select * from pdata_n.t01_pty_scrp_info --94136 科学城 where busi_date = '2026-06-17' and scrp_type_cd = '03' and src_tbl = 'ODATA_N_RMS.P_PORTAL_CONCERN' ) a join ( select * from pdata_news_n.t02_scr_base_info --70101 科学城 where src_id = 'RMS' and mkt_cd in ('SSE', 'SZSE') ) b on a.src_scrp_info = b.scr_cd ) ch on rs.stock_code = ch.stock_code left join stk_base_org wd on ch.stock_code = wd.stock_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, ch.user_id, user1.user_name, '6' as index_id, ch.create_time as dt, ind.ind_name as target_name, concat(create_time,'订阅了',ind.ind_name,'行业') as index_desc from ( SELECT id as report_id, title as report_name, ind_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select distinct split(a.pty_id, '-') [1] as user_id, --用户ID Src_Scrp_Info as ind_code, --订阅信息 substr(a.scrp_time, 1, 10) as create_time --订阅时间 from ( select * from pdata_n.t01_pty_scrp_info --94136 科学城 where busi_date = '2026-06-17' and scrp_type_cd = '02' and src_tbl = 'ODATA_N_RMS.P_PORTAL_CONCERN' ) a ) ch on rs.ind_code = ch.ind_code left join ( select indt_code as ind_code, -- 行业通用代码 indt_ch_name as ind_name -- 行业中文名称 from pdata_news_n.t02_co_indt --141732 where src_id = 'RMS' and grp_id = '02' )ind on ch.ind_code = ind.ind_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, ch.user_id, user1.user_name, '6' as index_id, ch.create_time as dt, rs.author_name as target_name, concat(create_time,'订阅了',rs.author_name,'分析师') as index_desc from ( SELECT id as report_id, title as report_name, split(author_name,'_')[0] as author_name, split(author_name,'_')[1] as author_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(author_names,',')) author_names AS author_name WHERE column_name = '公司研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select distinct split(a.pty_id, '-') [1] as user_id, --用户ID a.Src_Scrp_Info as author_code, --源订阅信息 substr(a.scrp_time, 1, 10) as create_time from ( select * from pdata_n.t01_pty_scrp_info --94136 科学城 94236 马场 where busi_date = '2026-06-17' and scrp_type_cd = '04' and src_tbl = 'ODATA_N_RMS.P_PORTAL_CONCERN' ) a ) ch on rs.author_code = ch.author_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, ch.user_id, user1.user_name, '7' as index_id, ch.busi_date as dt, ind.ind_name as target_name, concat(busi_date,'阅读了',ind.ind_name,'行业的报告') as index_desc from ( SELECT id as report_id, title as report_name, ind_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE column_name = '行业研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( select cr.user_id, rs2.report_id, rs2.report_name, rs2.ind_code, cr.busi_date from ( SELECT user_id, report_id, substr(read_evt_time, 1, 10) as busi_date FROM ( select user_id, rpt_id as report_id, read_evt_type, read_evt_time, dura from ( select *, row_number() over(partition by user_id,rpt_id,substr(read_evt_time, 1, 10) order by read_evt_time desc) as rn from pdata_news_n.t02_rpt_read_det_info --102672 科学城模型表 where src_id = 'RMS' and grp_id = '01' AND read_evt_type = '1' --阅读事件类型(0-未知事件,1-查看事件,2-下载事件,3-分享转发事件,4-分享下载事件,5-阅读全文事件,6-播放事件) and read_evt_chnl_type in (1,2,3) --阅读事件渠道类型( 0、未知渠道；1、门户；2、邮件；3、微信小程序；4、浏览器H5；5、机构客户APP；6、微信公众号H5') and cast(from_unixtime(floor((dura -28800000) / 1000), 'mm') as string) >= 1 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (read_evt_time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (read_evt_time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) a where rn = 1 )t1 union all select user_id, --用户id report_id, --研报id substr(rpt_view_time, 1, 10) as busi_date --研报查看时间 from ( select *, row_number() over(partition by user_id,report_id,substr(rpt_view_time, 1, 10) order by rpt_view_time desc) as rn from wind_report_org WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (rpt_view_time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (rpt_view_time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) v where rn = 1 union all select substr(Cust_Lkman_Id,8) as user_id, --用户id Rpt_Id as report_id, --研报id substr(Read_Time, 1, 10) as busi_date --研报查看时间 from ( select *, row_number() over(partition by Cust_Lkman_Id,Rpt_Id,substr(Read_Time,1,10) order by Read_Time desc) as rn from PDATA_N.T05_RMS_CUST_RPT_READ_EVT -- 190534 where SRC_TBL='ODATA_N_RMS.P_PORTAL_STAT_REPORT_ZHIQIU' and Data_Src in ('1','3') --'1'知丘 '2'新财富 '3'同花顺 and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Read_Time, 'yyyy-MM-dd HH:mm:ss') < (60 * 60 * 24 * 30) and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Read_Time, 'yyyy-MM-dd HH:mm:ss') >= 0 ) v where rn=1 )cr join ( SELECT id as report_id, title as report_name, ind_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE column_name = '行业研究' )rs2 on cr.report_id = rs2.report_id )ch on rs.ind_code = ch.ind_code left join ( select indt_code as ind_code, -- 行业通用代码 indt_ch_name as ind_name -- 行业中文名称 from pdata_news_n.t02_co_indt --141732 where src_id = 'RMS' and grp_id = '02' )ind on ch.ind_code = ind.ind_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, ch.user_id, user1.user_name, '8' as index_id, ch.busi_date as dt, ind.ind_name as target_name, concat(busi_date,'参加了',ind.ind_name,'行业的会议') as index_desc from ( SELECT id as report_id, title as report_name, ind_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE column_name = '行业研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( SELECT objid as user_id, ind_code, busi_date FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137科学城模型表 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '20' -- activity_type='2' and Sign_Flag = '1' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 ) a JOIN ( SELECT id as report_id, ind_code FROM PDATA_NDS.n_v_public_actity_day --181695 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE activity_type = '20' ) b ON a.source_id = b.report_id )ch on rs.ind_code = ch.ind_code left join ( select indt_code as ind_code, -- 行业通用代码 indt_ch_name as ind_name -- 行业中文名称 from pdata_news_n.t02_co_indt --141732 where src_id = 'RMS' and grp_id = '02' )ind on ch.ind_code = ind.ind_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, ch.user_id, user1.user_name, '8' as index_id, ch.busi_date as dt, ind.ind_name as target_name, concat(busi_date,'参加了',ind.ind_name,'行业的调研') as index_desc from ( SELECT id as report_id, title as report_name, ind_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE column_name = '行业研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( SELECT objid as user_id, ind_code, busi_date FROM ( SELECT substr(Pty_Id, 8) as objid, substr(Prom_Id, 12) as source_id, substr(Sign_Time, 1, 10) AS busi_date FROM PDATA_N.T07_PROM_ENRL_INFO --94137 科学城模型表 where lower(src_tbl) = 'odata_n_rms.p_portal_enroll' and Serv_Type_Cd = '3' --activity_type = '1' and Sign_Flag = '1' AND unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp (Sign_Time, 'yyyy-MM-dd HH:mm:ss') < 60 * 60 * 24 * 30 ) a JOIN ( SELECT id as report_id, ind_code FROM PDATA_NDS.n_v_public_actity_day --181695 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE activity_type = '3' ) b ON a.source_id = b.report_id )ch on rs.ind_code = ch.ind_code left join ( select indt_code as ind_code, -- 行业通用代码 indt_ch_name as ind_name -- 行业中文名称 from pdata_news_n.t02_co_indt --141732 where src_id = 'RMS' and grp_id = '02' )ind on ch.ind_code = ind.ind_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on ch.user_id = user1.user_id union all select rs.report_id, rs.report_name, user1.org_id, user1.org_name, cs.user_id, user1.user_name, '8' as index_id, cs.busi_date as dt, ind.ind_name as target_name, concat(busi_date,'参加了',ind.ind_name,'行业的路演') as index_desc from ( SELECT id as report_id, title as report_name, ind_code FROM PDATA_NDS.n_v_public_report_day --181671 lateral view explode(split(ind_codes,',')) trading_codes AS ind_code WHERE column_name = '行业研究' and unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(archive_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*365 )rs join ( SELECT user_id, d.ind_code, busi_date FROM ( SELECT roadshow_id, cust_id, user_id FROM PDATA_NDS.p_v_roadshow_cust_rel --181716 lateral view explode(split(contact_id,',')) contact_id AS user_id where trim(user_id) != '' ) x JOIN ( SELECT roadshow_id, substr(start_time, 1, 10) as busi_date, group_code FROM PDATA_NDS.p_v_roadshow_info --181725 WHERE unix_timestamp(concat('2026-06-17', ' 23:59:59')) - unix_timestamp(start_time,'yyyy-MM-dd HH:mm:ss') < 60*60*24*30 ) a ON x.roadshow_id = a.roadshow_id JOIN ( SELECT * FROM reserveserrelationinfos_temp2_org ) b ON A.roadshow_id = b.objid LEFT JOIN ( select distinct Emp_Grp_Id as group_code, --员工组编号 Stati_Cont_Desc as ind_code --统计内容描述 from PDATA_N.T04_EMP_GRP_STATI_INFO_H --157822 where SRC_TBL ='ODATA_N_RMS.P_ANL_GROUP_REPORT_REL' and data_src_cd = 'RMS' AND strt_date <= '2026-06-17' AND end_date > '2026-06-17' ) d ON A.group_code = d.group_code )cs on rs.ind_code = cs.ind_code left join ( select indt_code as ind_code, -- 行业通用代码 indt_ch_name as ind_name -- 行业中文名称 from pdata_news_n.t02_co_indt --141732 where src_id = 'RMS' and grp_id = '02' )ind on cs.ind_code = ind.ind_code left join ( select user_id, user_name, org_id, org_name from customer_temp2_org ) user1 on cs.user_id = user1.user_id;

create table sirm_report_recommend_org_temp2 as
select
distinct
report_id
,report_name
,org_id
,org_name
,user_id
,user_name
,index_id
,dt
,target_name
,index_desc
from sirm_report_recommend_org_temp
where report_id is not null;

create table sirm_report_recommend_org_temp3 as select report_id ,report_name ,org_id ,org_name ,user_id ,user_name ,index_id ,dt ,target_name ,index_desc from (
  select report_id,
  report_name,
  user_id,
  user_name,
  org_id,
  org_name,
  index_id,
  dt,
  target_name,
  index_desc,
  row_number() over(partition by report_id,user_id,org_id,index_id,nvl(user_name,'') order by dt desc,index_desc) as rn from sirm_report_recommend_org_temp2
)
t where rn = 1;

create table sirm_report_recommend_org_temp4 as select report_id ,report_name ,org_id ,org_name ,user_id ,user_name ,index_id ,dt ,target_name ,concat (
  index_id,
  ':',
  index_desc
)
as index_desc ,(9 - index_id) * 0.6 as rule_score ,case when index_id = '2' then (30 - datediff('2026-06-17', dt) / 6.2) * 0.25 * 0.4 when index_id = '3' then (365 - datediff('2026-06-17', dt)) * 0.25 * 0.4 else (30 - datediff('2026-06-17', dt)) * 0.25 * 0.4 end as dt_score from sirm_report_recommend_org_temp3;

create table if not exists sirm_report_recommend_org_type (
  report_id string comment '研报id',
  report_name string comment '研报名称',
  org_id string comment '机构id',
  org_name string comment '机构名称',
  custlevel string comment '客户等级',
  custtype string comment '客户类型',
  user_id string comment '用户id',
  user_name string comment '用户名称',
  index_id string comment '规则id',
  index_desc string comment '文案描述',
  index_score string comment '总分'
)
comment '研报客户推荐'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS orc ;

-- querySql
DROP TABLE IF EXISTS stk_base_org;

DROP TABLE IF EXISTS wind_report_org;

drop table if exists customer_temp2_org;

drop table if exists reserveserrelationinfos_temp2_org;

drop table if exists sirm_report_recommend_org_temp;

drop table if exists sirm_report_recommend_org_temp2;

drop table if exists sirm_report_recommend_org_temp3;

drop table if exists sirm_report_recommend_org_temp4 ;

insert overwrite table sirm_report_recommend_org_type partition(busi_date = '2026-06-17')
select
t1.report_id
,t1.report_name
,t1.org_id
,t1.org_name
,org.custlevel
,org.custtype
,t1.user_id
,t1.user_name
,t1.index_id
,t1.index_desc
,t1.index_score
from(
select
report_id
,report_name
,user_id
,user_name
,org_id
,org_name
,concat_ws(',', sort_array(collect_set(index_id))) as index_id
,concat_ws(',', sort_array(collect_set(index_desc))) as index_desc
,sum(rule_score) + sum(dt_score) as index_score
from sirm_report_recommend_org_temp4
group by report_id,report_name,user_id,user_name,org_id,org_name
)t1
left join
(
select distinct
org_id,
cust_lvl as  custlevel,
cust_type as custtype
from customer_temp2_org
) org
on t1.org_id = org.org_id
left join
(
select distinct user_id,
rpt_id as report_id
from ( select
*,
row_number() over( partition by user_id, rpt_id,substr(read_evt_time, 1, 10) order by read_evt_time desc ) as rn
from pdata_news_n.t02_rpt_read_det_info --102672
where src_id = 'RMS'
and grp_id = '01'
) a
where rn = 1
union all
select  distinct user_id,--用户id
report_id --研报id
from ( select *,
row_number() over(partition by user_id,report_id,substr(rpt_view_time, 1, 10)order by rpt_view_time desc) as rn
from wind_report_org
) v
where rn = 1
union all
select distinct
substr(Cust_Lkman_Id,8) as user_id,         --用户id
Rpt_Id  as report_id                       --研报id
from
(
select
*,
row_number() over(partition by Cust_Lkman_Id,Rpt_Id,substr(Read_Time,1,10) order by Read_Time desc) as rn
from PDATA_N.T05_RMS_CUST_RPT_READ_EVT  --	190534
where SRC_TBL='ODATA_N_RMS.P_PORTAL_STAT_REPORT_ZHIQIU'
and Data_Src in ('1','3') --'1'知丘 '2'新财富 '3'同花顺
) v where rn=1
)t2
on t1.report_id = t2.report_id and t1.user_id = t2.user_id
where t2.report_id is null  --过滤已读本报告的客户;
