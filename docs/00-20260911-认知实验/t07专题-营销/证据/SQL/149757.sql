-- task_id: 149757
-- hiveDb: dm_mast_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_mast_n/user/dm_mast_n.user_id_anlz.py
-- observed_at: 2026-09-01T14:06:36.833Z

-- createSql
CREATE TABLE IF NOT EXISTS user_id_anlz (
  project string comment '项目',
  event string comment '事件',
  event_type string comment '事件类型',
  type string comment '类型',
  trade_id string comment '交易ID',
  user_id string comment '神策id',
  cust_pty_no string comment '客户号',
  gft_id string comment '广发通ID',
  mobile_no string comment '手机号',
  device_id string comment '设备号',
  distinct_id string comment '去重ID',
  log_date string comment '登录日期',
  log_time string comment '登录时间',
  origin_time string comment '登录时间格式',
  openId string comment '微信号',
  app_version string comment 'APP版本',
  gfmiaoda_action string comment '秒答功能',
  gfmiaoda_terminal string comment '秒答终端',
  heartbeat_ob_type string comment '直播类型',
  room_id string comment '直播ID',
  page_ob_code string comment '直播编码',
  src_tbl string comment '数据来源表',
  chan_cd string comment '渠道编码',
  data_time string comment '数据时间',
  del_flag string comment '删除标记'
)
COMMENT '用户ID分析表' PARTITIONED BY(Busi_Date String comment '业务日期')
STORED AS ORC ;

create table temp_n.temp_user_id_anlz_shence_001 as select project ,--项目 event ,--事件 event_type ,--事件类型 type ,--类型 trade_id ,--交易ID user_id ,--神策id case when coalesce (
  trim(cust_pty_no),
  ''
)
='' and coalesce(trim(distinct_id),'')<>'' and distinct_id rlike '^[0-9]{12}$' then distinct_id else cust_pty_no end as cust_pty_no,--客户号 case when coalesce(trim(gft_id),'')<>'' then gft_id when coalesce(trim(properties['gft_id']),'')<>'' then properties['gft_id'] when coalesce(trim(properties['portal_id']),'')<>'' then properties['portal_id'] else gft_id end as gft_id,--广发通ID case when coalesce(trim(mobile_no),'')='' and coalesce(trim(distinct_id),'')<>'' and distinct_id rlike '^1[0-9]{10}$' then distinct_id else mobile_no end as mobile_no ,--手机号 case when coalesce(trim(device_id),'')='' and coalesce(trim(distinct_id),'')<>'' and distinct_id not rlike '^[0-9]{5,64}$' and length(distinct_id)>5 then distinct_id else device_id end as device_id ,--设备号 distinct_id ,--去重ID log_date ,--登录日期 log_time ,--登录时间 origin_time ,--登录时间格式 properties['openId'] as openid ,--微信号 properties['app_version'] as app_version ,--APP版本 properties['GfMiaoDa_action'] as gfmiaoda_action ,--秒答功能 properties['GfMiaoDa_terminal'] as gfmiaoda_terminal ,--秒答终端 properties['heartbeat_ob_type'] as heartbeat_ob_type ,--直播类型 properties['room_id'] as room_id ,--直播ID properties['page_ob_code'] as page_ob_code ,--直播编码 'PDATA_N.T05_VIEW_SHENCE_LOG_RETAIL' as src_tbl ,--数据来源表 case when project='default' and event_type in('shence','phone','deal') then '109' when project='miaoda' and event_type = 'GfMiaoDa' and event = 'GfMiaoDa_PageView' then '104' when event_type = 'Wechat' and project = 'sni' and event = 'Wechat_PageView' and coalesce(trim(properties['openId']),'')<>'' then '107' when (event_type in ('event_type','GFLive','GFHK','GFShortVideo','shence') --旧口径保留是因为还在替换过度期中 or ( event = 'user_heartbeat' and event_type = 'user' and properties['heartbeat_ob_type'] not in ('直播回放片尾','直播预告视频','直播回放片头') and project != 'ytjtest')) and coalesce(trim(properties['room_id']),'')<>'' then '103' when project='miaoda' and event_type='applet' and event='applet_card_page' then '106' end as chan_cd ,--渠道编码 daily from pdata_n.t05_view_shence_log_retail where daily>=date_add('2026-07-25',-5) and daily<='2026-07-25' and event_type in ('shence','GfMiaoDa','event_type','GFlive','GFHK','GFShortVideo','user','applet','Wechat','phone','deal') ;

create table temp_n.temp_user_id_anlz_shence_002 as select * from temp_n.temp_user_id_anlz_shence_001 where coalesce (
  trim(chan_cd),
  ''
)
<>'' ;

create table temp_n.temp_user_id_anlz_kh_001 as select *,'101' as chan_cd, 'PDATA_N.T05_GKS_OACT_RSRV_EVT' as src_tbl from (
  select mobile as mobile_no,
  Rsrv_Time as log_time,
  busi_date,
  row_number() over(partition by mobile,busi_date order by Rsrv_Time desc) rn from (select distinct mobile,busi_date,Rsrv_Time from pdata_n.T05_GKS_OACT_RSRV_EVT where src_tbl='ODATA_N_GKS.J_RECOMMENDRELATIONLOG' and mobile rlike '^1[0-9]{10}$' ) t
)
a1 where rn=1 ;

create table temp_n.temp_user_id_anlz_kh_002 as select user_id,mobile_no,log_time,'102' as chan_cd, 'PDATA_N.T05_OAO_APPLIES_EVT' as src_tbl from (
  select User_Id as user_id,
  mobile as mobile_no,
  Create_Time as log_time,
  row_number() over(partition by User_Id,mobile order by Create_Time desc) rn from PDATA_N.T05_OAO_APPLIES_EVT where src_tbl='ODATA_N_OAO.C_APPLIES' and mobile rlike '^1[0-9]{10}$'
)
t1 where rn=1 ;

create table temp_n.temp_user_id_anlz_jdtx_001 as select * from (
  select a.user_id uuid,
  b.mobile,
  a.upt_date,
  a.channel,
  a.channel_no,
  a.src_tbl,
  row_number() over(partition by a.channel,b.mobile order by a.upt_date desc) rn from ( select distinct substring(user_id, 8) user_id, data_upt_date upt_date,'腾讯' channel,'111' as channel_no,src_tbl from pdata_n.t04_tsc_oact_user_adtnl_info where src_tbl = 'ODATA_N_TSC.T_TX_OPEN_ORDER' and data_upt_date <='2026-07-25' union all select distinct substring(user_id, 8) user_id, ord_create_time upt_date,'京东' channel,'112' as channel_no,src_tbl from pdata_n.t04_jd_oact_user_adtnl_info where src_tbl = 'ODATA_N_OAO.C_JD_OPEN_ORDER' and substr(ord_create_time,1,10)<='2026-07-25' ) a join ( select regexp_replace(user_id ,'TSC002-','') user_id ,mobile from pdata_n.T04_USER_ADDR_H where src_tbl ='ODATA_N_TSC.T_TX_OPEN_ORDER' union all select regexp_replace(user_id,'OAO027-','') user_id,mobile from pdata_n.T04_USER_ADDR_H where src_tbl ='ODATA_N_OAO.C_JD_OPEN_ORDER' ) b on a.user_id = b.user_id
)
tt where rn =1 ;

create table temp_n.temp_user_id_anlz_mf_001 as select case when Cust_Id rlike '^[0-9]{12}$' then Cust_Id end as cust_pty_no, case when Cust_Type_Cd='2' and coalesce (
  trim(Cust_Id),
  ''
)
<>'' then substr(Cust_Id,8) end as gft_id, mobile_no, Creat_Time as log_time, '108' as chan_cd, 'PDATA_N.T07_PROM_CUST_LIST_M' as src_tbl from PDATA_N.T07_PROM_CUST_LIST lateral view json_tuple(Cust_Info,'手机号码') m as mobile_no where busi_date='2026-07-25' and SRC_TBL='ODATA_N_MMP.M_USER_FORM_RECORD' union all select case when length(split(Cust_Id,'-')[1]) = 12 then split(Cust_Id,'-')[1] else '' end cust_pty_no, case when length(split(Cust_Id,'-')[1]) != 12 then split(Cust_Id,'-')[1] else '' end gft_id, mobile_no, Creat_Time as log_time, '108' as chan_cd, 'PDATA_N.T07_PROM_CUST_LIST_T' as src_tbl from pdata_n.T07_PROM_CUST_LIST lateral view json_tuple(split(Cust_Info,'-')[1],'手机号') t as mobile_no where busi_date='2026-07-25' and src_tbl = 'ODATA_N_MMP.T_USER_FORM_RECORD' ;

create table temp_n.temp_user_id_anlz_bd_001
as
select case when client_id rlike '^[0-9]{12}$' then client_id end  as cust_pty_no,
client_id as distinct_id,
case when client_id rlike '^1[0-9]{10}$' then client_id end  as mobile_no,
case when client_id not rlike '^[0-9]{12}$' and client_id not rlike '^1[0-9]{10}$' then client_id end as openId,
'105' as chan_cd,
busi_date as log_time,
'PDATA_NDS.GKS_CHAT_MSG_SERV_REC' as src_tbl
from pdata_nds.gks_chat_msg_serv_rec
where busi_date= '2026-07-25'
;

create table temp_n.temp_user_id_anlz_gft_001 as select distinct a.user_id as user_id, substr (
  a.user_id,
  8
)
as gft_id, a.mobile as mobile_no, b.Oact_Date as log_date , --create_date a.last_logn_time as log_time , a.del_flag, '110' as chan_cd, 'PDATA_N.T04_GFT_USER_ADTNL_INFO' as src_tbl from (select * from PDATA_N.T04_GFT_USER_ADTNL_INFO where SRC_TBL='ODATA_N_CFM.G_T_SYSTEM_WEBUSER' ) a left join (select * from PDATA_N.T04_USER where SRC_TBL ='ODATA_N_CFM.G_T_SYSTEM_WEBUSER') b on a.User_Id=b.User_Id ;

create table temp_n.temp_user_id_anlz_shence_003 as select *,row_number (
)
over(partition by project,event,event_type,type,trade_id,user_id,cust_pty_no,gft_id,mobile_no,device_id,distinct_id,openId,app_version,gfmiaoda_action,gfmiaoda_terminal,heartbeat_ob_type,room_id,page_ob_code,chan_cd order by origin_time desc) rn from temp_n.temp_user_id_anlz_shence_002 ;

-- querySql
drop table  if exists temp_n.temp_user_id_anlz_shence_001;

drop table  if exists temp_n.temp_user_id_anlz_shence_002;

drop table  if exists temp_n.temp_user_id_anlz_kh_001;

drop table  if exists temp_n.temp_user_id_anlz_kh_002;

drop table  if exists temp_n.temp_user_id_anlz_jdtx_001;

drop table  if exists temp_n.temp_user_id_anlz_mf_001;

drop table  if exists temp_n.temp_user_id_anlz_bd_001;

drop table  if exists temp_n.temp_user_id_anlz_gft_001;

drop table  if exists temp_n.temp_user_id_anlz_shence_003;

INSERT OVERWRITE TABLE user_id_anlz PARTITION(Busi_Date='2026-07-25')
select project           ,--项目
event             ,--事件
event_type        ,--事件类型
type              ,--类型
trade_id          ,--交易ID
user_id           ,--神策id
cust_pty_no       ,--客户号
gft_id            ,--广发通ID
mobile_no         ,--手机号
device_id         ,--设备号
distinct_id       ,--去重ID
log_date          ,--登录日期
log_time          ,--登录时间
origin_time       ,--登录时间格式
openId            ,--微信号
app_version	     ,--APP版本
gfmiaoda_action	 ,--秒答功能
gfmiaoda_terminal ,--秒答终端
heartbeat_ob_type ,--直播类型
room_id	         ,--直播ID
page_ob_code      ,--直播编码
src_tbl           ,--数据来源表
chan_cd           ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
'0' as del_flag
from temp_n.temp_user_id_anlz_shence_003 where rn = 1
;

INSERT into TABLE user_id_anlz PARTITION(Busi_Date='2026-07-25')
select '' as project           ,--项目
'' as event             ,--事件
'' as event_type        ,--事件类型
'' as type              ,--类型
'' as trade_id          ,--交易ID
user_id                 ,--神策id
'' as cust_pty_no       ,--客户号
gft_id                  ,--广发通ID
mobile_no               ,--手机号
'' as device_id         ,--设备号
'' as distinct_id       ,--去重ID
log_date                ,--登录日期(create_date)
log_time                ,--登录时间
'' as origin_time       ,--登录时间格式
'' as openId            ,--微信号
'' as app_version	   ,--APP版本
'' as gfmiaoda_action   ,--秒答功能
'' as gfmiaoda_terminal ,--秒答终端
'' as heartbeat_ob_type ,--直播类型
'' as room_id	       ,--直播ID
'' as page_ob_code      ,--直播编码
src_tbl                 ,--数据来源表
chan_cd                 ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
del_flag
from temp_n.temp_user_id_anlz_gft_001
union all
select '' as project           ,--项目
'' as event             ,--事件
'' as event_type        ,--事件类型
'' as type              ,--类型
'' as trade_id          ,--交易ID
uuid as user_id         ,--神策id
'' as cust_pty_no       ,--客户号
'' as gft_id            ,--广发通ID
mobile as mobile_no     ,--手机号
'' as device_id         ,--设备号
'' as distinct_id       ,--去重ID
upt_date as log_date    ,--登录日期(create_date)
'' as log_time          ,--登录时间
'' as origin_time       ,--登录时间格式
'' as openId            ,--微信号
'' as app_version	   ,--APP版本
'' as gfmiaoda_action   ,--秒答功能
'' as gfmiaoda_terminal ,--秒答终端
'' as heartbeat_ob_type ,--直播类型
'' as room_id	       ,--直播ID
'' as page_ob_code      ,--直播编码
src_tbl                 ,--数据来源表
channel_no as chan_cd                 ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
'0' as del_flag
from temp_n.temp_user_id_anlz_jdtx_001
where coalesce(trim(mobile),'')<>''
union all
select '' as project           ,--项目
'' as event             ,--事件
'' as event_type        ,--事件类型
'' as type              ,--类型
'' as trade_id          ,--交易ID
'' as user_id           ,--神策id
cust_pty_no             ,--客户号
'' as gft_id            ,--广发通ID
mobile_no               ,--手机号
'' as device_id         ,--设备号
distinct_id             ,--去重ID
'' as log_date          ,--登录日期
log_time                ,--登录时间
'' as origin_time       ,--登录时间格式
openId                  ,--微信号
'' as app_version	   ,--APP版本
'' as gfmiaoda_action   ,--秒答功能
'' as gfmiaoda_terminal ,--秒答终端
'' as heartbeat_ob_type ,--直播类型
'' as room_id	       ,--直播ID
'' as page_ob_code      ,--直播编码
src_tbl                 ,--数据来源表
chan_cd                 ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
'0' as del_flag
from temp_n.temp_user_id_anlz_bd_001
union all
select '' as project           ,--项目
'' as event             ,--事件
'' as event_type        ,--事件类型
'' as type              ,--类型
'' as trade_id          ,--交易ID
'' as user_id           ,--神策id
a.cust_pty_no             ,--客户号
case when coalesce(trim(b.gft_id),'')<>'' then b.gft_id else '' end as gft_id ,--广发通ID
a.mobile_no               ,--手机号
'' as device_id         ,--设备号
'' as distinct_id       ,--去重ID
'' as log_date          ,--登录日期
a.log_time                ,--登录时间
'' as origin_time       ,--登录时间格式
'' as openId            ,--微信号
'' as app_version	   ,--APP版本
'' as gfmiaoda_action   ,--秒答功能
'' as gfmiaoda_terminal ,--秒答终端
'' as heartbeat_ob_type ,--直播类型
'' as room_id	       ,--直播ID
'' as page_ob_code      ,--直播编码
a.src_tbl                 ,--数据来源表
a.chan_cd                 ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
'0' as del_flag
from (select * from temp_n.temp_user_id_anlz_mf_001
where coalesce(trim(mobile_no),'')<>'' or  coalesce(trim(gft_id),'')<>'' or  coalesce(trim(cust_pty_no),'')<>'') a
left join (select *,substr(user_id,8) as gft_id from PDATA_N.T04_GFT_USER_ADTNL_INFO where SRC_TBL='ODATA_N_CFM.G_T_SYSTEM_WEBUSER') b
on a.gft_id=b.gft_id
where coalesce(trim(a.cust_pty_no),'')<>'' or coalesce(trim(a.mobile_no),'')<>'' or coalesce(trim(b.gft_id),'')<>''
union all
select '' as project           ,--项目
'' as event             ,--事件
'' as event_type        ,--事件类型
'' as type              ,--类型
'' as trade_id          ,--交易ID
user_id                 ,--神策id
'' as cust_pty_no       ,--客户号
'' as gft_id            ,--广发通ID
mobile_no as mobile_no  ,--手机号
'' as device_id         ,--设备号
'' as distinct_id       ,--去重ID
'' as log_date          ,--登录日期
log_time                ,--登录时间
'' as origin_time       ,--登录时间格式
'' as openId            ,--微信号
'' as app_version	   ,--APP版本
'' as gfmiaoda_action   ,--秒答功能
'' as gfmiaoda_terminal ,--秒答终端
'' as heartbeat_ob_type ,--直播类型
'' as room_id	       ,--直播ID
'' as page_ob_code      ,--直播编码
src_tbl                 ,--数据来源表
chan_cd                 ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
'0' as del_flag
from temp_n.temp_user_id_anlz_kh_002
union all
select '' as project           ,--项目
'' as event             ,--事件
'' as event_type        ,--事件类型
'' as type              ,--类型
'' as trade_id          ,--交易ID
'' as user_id           ,--神策id
'' as cust_pty_no       ,--客户号
'' as gft_id            ,--广发通ID
mobile_no               ,--手机号
'' as device_id         ,--设备号
'' as distinct_id       ,--去重ID
'' as log_date          ,--登录日期
log_time                ,--登录时间
'' as origin_time       ,--登录时间格式
'' as openId            ,--微信号
'' as app_version	   ,--APP版本
'' as gfmiaoda_action   ,--秒答功能
'' as gfmiaoda_terminal ,--秒答终端
'' as heartbeat_ob_type ,--直播类型
'' as room_id	       ,--直播ID
'' as page_ob_code      ,--直播编码
src_tbl                 ,--数据来源表
chan_cd                 ,--渠道编码
'2026-07-26 02:24:09' as data_time, --数据时间
'0' as del_flag
from temp_n.temp_user_id_anlz_kh_001 where coalesce(trim(mobile_no),'')<>''
;

drop table  if exists temp_n.temp_user_id_anlz_shence_001;

drop table  if exists temp_n.temp_user_id_anlz_shence_002;

drop table  if exists temp_n.temp_user_id_anlz_kh_001;

drop table  if exists temp_n.temp_user_id_anlz_kh_002;

drop table  if exists temp_n.temp_user_id_anlz_mf_001;

drop table  if exists temp_n.temp_user_id_anlz_bd_001;

drop table  if exists temp_n.temp_user_id_anlz_gft_001;

drop table  if exists temp_n.temp_user_id_anlz_shence_003;

drop table  if exists temp_n.temp_user_id_anlz_jdtx_001;
