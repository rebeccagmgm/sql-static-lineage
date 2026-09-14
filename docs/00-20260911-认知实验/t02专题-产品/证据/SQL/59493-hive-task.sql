-- task_id: 59493
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_scr_base_info_WD
-- observed_at: 2026-09-05T01:06:18.576Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_scr_base_info(
 busi_date            string  comment  '数据日期'
,rec_id               string  comment  '记录编号'
,secu_id              string  comment  '统一证券编码'
,src_sys_prdno        string  comment  '源系统产品编号'
,Crrc_cd              string  comment  '货币代码'
,Crrc_name            string  comment  '货币名称'
,Cty_cd               string  comment  '国家代码'
,Cty_name             string  comment  '国家名称'
,corp_id              string  comment  '公司id'
,scr_stat             string  comment  '当前状态'
,min_pric_chg_unit    string  comment  '最小价格变动单位'
,Peru                 string  comment  '每手数量'
,scr_type             string  comment  '证券类别'
,ch_abbr              string  comment  '证券简称'
,scr_cd               string  comment  '证券代码'
,ch_abbr_pinyin       string  comment  '中文拼音简称'
,ch_name              string  comment  '证券中文名称'
,en_name              string  comment  '证券英文名称'
,ch_abbr_l            string  comment  '证券简称(长)'
,en_abbr              string  comment  '英文简称'
,mkt_cd               string  comment  '交易市场代码'
,mkt_ch_name          string  comment  '交易市场中文名称'
,in_code              string  comment  '源内部编码'
,remark               string  comment  '备注'
,src_tbl              string  comment  '来源表'
,src_rec_id           string  comment  '来源记录'
,rec_upd_time         string  comment  '数据更新时间'
,rec_down_time        string  comment  '数据进表时间'
)
partitioned by (src_id string comment '数据来源')
stored as orc;

DROP TABLE IF EXISTS t02_scr_base_info_newest_WD_TMP;
CREATE TABLE IF NOT EXISTS t02_scr_base_info_newest_WD_TMP(
    rec_id              string comment '记录编号'
   ,src_sys_prdno       string comment '源系统产品编号'
   ,crncy_code          string comment '货币代码'
   ,crncy_name          string comment '货币名称'
   ,country_code        string comment '国家代码'
   ,country_name        string comment '国家名称'
   ,comp_code           string comment '公司id'
   ,security_status     string comment '当前状态'
   ,min_price_chg_unit  string comment '最小价格变动单位'
   ,lot_size            string comment '每手数量'   
   ,secu_type           string comment '证券类别大类'
   ,scr_type            string comment '证券类别中类'
   ,sname               string comment '证券简称'
   ,secu_code           string comment '证券代码'
   ,name_py             string comment '中文拼音简称'
   ,name_cn             string comment '证券中文名称'
   ,name_en             string comment '证券英文名称'
   ,sname_l             string comment '证券简称(长)'
   ,ename               string comment '英文简称'
   ,mkt_code            string comment '交易市场代码'
   ,mkt_cn_name         string comment '交易市场中文名称'
   ,in_code             string comment '源内部编码'
   ,remark               string  comment  '备注'
   ,src_tbl             string comment '来源表'
   ,src_rec_id          string comment '来源记录'
   ,rec_upd_tm          string comment '数据更新时间'
   ,rec_down_tm         string comment '数据进表时间'
);

CREATE TABLE IF NOT EXISTS t02_scr_base_info_newest_wd_tmp_b(
 busi_date            string  comment  '数据日期'
,rec_id               string  comment  '记录编号'
,secu_id              string  comment  '统一证券编码'
,src_sys_prdno        string  comment  '源系统产品编号'
,Crrc_cd              string  comment  '货币代码'
,Crrc_name            string  comment  '货币名称'
,Cty_cd               string  comment  '国家代码'
,Cty_name             string  comment  '国家名称'
,corp_id              string  comment  '公司id'
,scr_stat             string  comment  '当前状态'
,min_pric_chg_unit    string  comment  '最小价格变动单位'
,Peru                 string  comment  '每手数量'
,scr_type             string  comment  '证券类别'
,ch_abbr              string  comment  '证券简称'
,scr_cd               string  comment  '证券代码'
,ch_abbr_pinyin       string  comment  '中文拼音简称'
,ch_name              string  comment  '证券中文名称'
,en_name              string  comment  '证券英文名称'
,ch_abbr_l            string  comment  '证券简称(长)'
,en_abbr              string  comment  '英文简称'
,mkt_cd               string  comment  '交易市场代码'
,mkt_ch_name          string  comment  '交易市场中文名称'
,in_code              string  comment  '源内部编码'
,remark               string  comment  '备注'
,src_tbl              string  comment  '来源表'
,src_rec_id           string  comment  '来源记录'
,rec_upd_time         string  comment  '数据更新时间'
,rec_down_time        string  comment  '数据进表时间'
)
partitioned by (src_id string comment '数据来源')
stored as orc;

-- querySql
set hive.support.concurrency=false;
INSERT OVERWRITE TABLE t02_scr_base_info_newest_WD_TMP
SELECT 
        T.object_id                    as rec_id,              --记录编号
        concat('WD', '-', T.s_info_windcode) as src_sys_prdno, --源系统产品编号
        C.const_cd                     as crncy_code,          --货币代码
        C.const_cn_desc                as crncy_name,          --货币名称   
        G.const_cd                     as country_code,        --国家代码
        G.const_cn_desc                as country_name,        --国家名称        
        E.comp_id                      as comp_code,           --公司ID,根据t02_co_base_info获取
        case when T.security_status = '101001000' then '1'  --上市交易
             when T.security_status = '101002000' then '3'  --终止上市(摘牌)
             when T.security_status = '101003000' then '5'  --已发行待上市（或发行中) 
             else  '9'     --其他
             end  as security_status,     --当前状态
        T.s_info_min_price_chg_unit    as min_price_chg_unit,  --最小变动价格单位
        T.s_info_lot_size              as lot_size,            --每手数量
        nvl(P.const_cd, 'OTH')          as secu_type,           --证券类别大类 
        nvl(P.rmk_desc, 'OT')           as scr_type,  --证券中类
        T.s_info_name                  as sname,               --证券简称
        case when length(s_info_code) = 4 and exchmarket = 'HKEX'  and s_info_sectypebcode  IN ( '100001000','100002000')  then concat('0',s_info_code) 
             when s_info_sectypebcode in ('100009000','100010000','100011000','100012000') and CS.s_code is not null then CS.s_code --存在基金业协会备案号的，用备案号
            else s_info_code end      as secu_code,           --证券代码
        T.s_info_pinyin                as name_py,             --中文拼音简称
        ''                             as name_cn,             --证券中文名称
        ''                             as name_en,             --证券英文名称
        ''                             as SNAME_L,             --证券简称(长)
        s_info_ename                   as ename,               --英文简称
        case when exchmarket IN ('HKEX','SGX') and T.s_info_windcode like '%.OF' then '99' 
             when exchmarket is not null  then exchmarket
             when exchmarket is  null and  s_info_sectypebcode in ('100009000','100010000','100011000','100012000') and CS.s_code is  null then '98' 
             else '99' end             as mkt_code,            --交易市场代码
        case when exchmarket IN ('HKEX','SGX') and  T.s_info_windcode like '%.OF' then '其他999'
             when M.s_typname is null then '其他999' 
             else m.s_typname end      as mkt_cn_name,
        T.s_info_windcode              as in_code,             --源内部编码
        T.s_info_sectypename   as remark , --备注
        T.src_tbl               as src_tbl,             --来源表
        T.object_id                    as src_rec_id,          --来源记录
        from_unixtime(unix_timestamp(T.opdate), 'yyyy-MM-dd HH:mm:ss')  as rec_upd_tm, --记录修改时间
        from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')  as rec_down_tm --记录进表时间
from
(
select    
	 H.object_id
	,H.s_info_windcode
	,H.s_info_asharecode
	,H.s_info_compcode
	,H.s_info_securitiestypes
	,H.s_info_sectypename
	,H.s_info_countryname
	,H.s_info_countrycode
	,H.s_info_exchmarketname
	,H.s_info_exchmarket
	,H.crncy_name
	,H.crncy_code
	,H.s_info_isincode
	,H.s_info_code
	,H.s_info_name
	,H.exchmarket
	,H.security_status
	,H.s_info_org_code
	,H.s_info_typecode
	,H.s_info_min_price_chg_unit
	,H.s_info_lot_size
	,H.s_info_ename
	,H.trading_hours_code
	,H.s_info_sectypebcode
	,H.s_info_sectypescode
	,H.s_info_pinyin
	,H.opdate
	,H.opmode
	,'odata_n_uip.w_windcustomcode' as src_tbl --数据对应的来源表
 from ODATA_N_UIP.W_WINDCUSTOMCODE H 

   
 UNION ALL
 
 select  -- 合并取美股市场的数据
	 a.object_id
	,a.s_info_windcode
	,a.s_info_asharecode
	,a.s_info_compcode
	,a.s_info_securitiestypes
	,a.s_info_sectypename
	,a.s_info_countryname
	,a.s_info_countrycode
	,a.s_info_exchmarketname
	,a.s_info_exchmarket
	,a.crncy_name
	,a.crncy_code
	,a.s_info_isincode
	,a.s_info_code
	,a.s_info_name
	,a.exchmarket
	,a.security_status
	,a.s_info_org_code
	,a.s_info_typecode
	,a.s_info_min_price_chg_unit
	,a.s_info_lot_size
	,a.s_info_ename
	,NULL as trading_hours_code
	,NULL as s_info_sectypebcode
	,NULL as s_info_sectypescode
	,NULL as s_info_pinyin
	,a.opdate
	,a.opmode 
	,'odata_n_uip.w_ussharewindcustomcode' as src_tbl --数据对应的来源表
 from 
 odata_n_uip.w_ussharewindcustomcode a --美股市场的证券数据
 left join
 ODATA_N_UIP.W_WINDCUSTOMCODE b on a.s_info_windcode = b.s_info_windcode
 where b.s_info_windcode is null       --过滤万得兼容代码表已经存在的数据
)T
LEFT OUTER JOIN (select * from t02_pub_covt_const where const_type_cd  = 'var90000' and src_id = 'WD')P ON T.s_info_sectypebcode = P.src_const_cd
LEFT OUTER JOIN (select s_typcode,s_typname from odata_n_uip.w_asharetypecode where busi_date = '${data_day_str}'  and s_classification = '交易所' )M ON T.exchmarket  =  M.S_typcode 
LEFT OUTER JOIN 
  (select const_cd,const_cn_desc,src_const_cd,src_const_cn_desc  from t02_pub_covt_const WHERE const_type_cd = 'fin00001'  and src_id = 'WD')C ON T.crncy_code = C.src_const_cd  --币种转码
LEFT OUTER JOIN 
  (select const_cd,const_cn_desc,src_const_cd,src_const_cn_desc  from t02_pub_covt_const WHERE const_type_cd = 'pty00022'  and src_id = 'WD')G ON T.s_info_countryname = G.src_const_cn_desc  --国别转码 --映射编码国家代码存在2位3位问题用名称匹配
LEFT OUTER JOIN 
  (select b.s_info_windcode as s_code,b.s_info_windcode,b.type_code 
 from
 (select s_code,count(s_code) --可能有重复记录，已反馈万得(正常不该有)
from odata_n_uip.w_codeandsname
 where type_code = '111015000'
group by s_code
having count(s_code)>1
)a
inner join 
(select s_code,s_info_windcode,type_code --可能有重复记录，已反馈万得(正常不该有)
from odata_n_uip.w_codeandsname
 where type_code = '111015000') b
 on a.s_code=b.s_code
 
 union all
 
 select c.s_code,d.s_info_windcode,d.type_code 
 from
 (select s_code,count(s_code) --可能有重复记录，已反馈万得(正常不该有)
from odata_n_uip.w_codeandsname
 where type_code = '111015000'
group by s_code
having count(s_code)=1
)c
inner join 
(select s_code,s_info_windcode,type_code --可能有重复记录，已反馈万得(正常不该有)
from odata_n_uip.w_codeandsname
 where type_code = '111015000') d
 on c.s_code=d.s_code  --- 111015000 基金业协会编码, s_code为私募(包括资管，银行理财，信托，私募基金等)基金在基金业协会的备案登记号
  )CS ON T.s_info_windcode = CS.s_info_windcode
LEFT OUTER JOIN 
  (select   corp_id as comp_id, src_corp_id as src_com_id from t02_co_base_info where src_Id  ='WD')E ON T.s_info_compcode = E.src_com_id;

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
set hive.support.concurrency=false;

WITH WD_REC_DOWN_TM AS
(
  select distinct  src_sys_prdno, corp_id as comp_code, scr_cd as secu_code, rec_down_time as rec_down_tm from t02_scr_base_info where src_id = 'WD' --取落地时间
)

INSERT OVERWRITE TABLE t02_scr_base_info_newest_wd_tmp_b  partition (src_id = 'WD')
SELECT  
      '${data_day_str}' as busi_date,          --数据日期
      N.rec_id               as rec_id,
      concat(N.secu_type, '.',  N.id, '.', N.secu_code, '.', N.mkt_code)    as secu_id,             --统一证券编号
      N.src_sys_prdno        as src_sys_prdno,                              --源系统产品编号
      N.crncy_code           as Crrc_cd,                                 --币种代码
      N.crncy_name           as Crrc_name,                                 --币种名称
      N.country_code         as Cty_cd,                               --国家代码
      N.country_name         as Cty_name,                              --国家名称
      N.comp_code            as corp_id,                                  --公司ID
      N.security_status      as scr_stat,                            --当前状态
      N.min_price_chg_unit   as min_pric_chg_unit,                         --最小变动价格单位
      N.lot_size             as Peru,                                   --每手数量
      N.scr_type             as scr_type,                               --证券类别
      N.sname                as ch_abbr,                                --证券简称
      N.secu_code            as scr_cd,
      N.name_py              as ch_abbr_pinyin,
      N.name_cn              as ch_name,
      N.name_en              as en_name,
      N.sname_l              as ch_abbr_l,
      N.ename                as en_abbr, 
      N.mkt_code             as mkt_cd,
      N.mkt_cn_name          as mkt_ch_name,
      N.in_code              as in_code,                                    --源内部编码
      N.remark                     as remark,
      'odata_n_uip.w_windcustomcode'       as src_tbl,
      N.rec_id               as src_rec_id,
      N.rec_upd_tm                        as rec_upd_time, --记录最新更新时间
      nvl(S.rec_down_tm, from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss'))    as rec_down_time --记录落地时间，取原来的
from 
( select *, cast(row_number() over(partition by secu_type, mkt_code, secu_code order by in_code) as bigint) + 100000000 as ID from t02_scr_base_info_newest_WD_TMP) N 
LEFT OUTER JOIN 
WD_REC_DOWN_TM S ON N.src_sys_prdno = S.src_sys_prdno and N.secu_code = S.secu_code and N.comp_Code =   S.comp_code

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
set hive.support.concurrency=false;


with tb1 as
(
    select 
        a.busi_date
        ,a.rec_id
        ,coalesce(b.secu_id,a.secu_id)  as secu_id
        ,a.src_sys_prdno
        ,a.crrc_cd
        ,a.crrc_name
        ,a.cty_cd
        ,a.cty_name
        ,a.corp_id
        ,a.scr_stat
        ,a.min_pric_chg_unit
        ,a.peru
        ,a.scr_type
        ,a.ch_abbr
        ,a.scr_cd
        ,a.ch_abbr_pinyin
        ,a.ch_name
        ,a.en_name
        ,a.ch_abbr_l
        ,a.en_abbr
        ,a.mkt_cd
        ,a.mkt_ch_name
        ,a.in_code
        ,a.remark
        ,a.src_tbl
        ,a.src_rec_id
        ,a.rec_upd_time
        ,a.rec_down_time 
    from (
        select * from t02_scr_base_info_newest_wd_tmp_b  WHERE Src_Id = 'WD' 
    ) a left join  t02_scr_cd_rplc_info b 
        on  a.scr_cd = b.scr_cd 
        and a.scr_type = b.scr_type 
        and a.mkt_cd = b.mkt_cd 
        and a.src_id = b.src_id
)
INSERT OVERWRITE TABLE t02_scr_base_info PARTITION (Src_Id = 'WD')
select 
   res.Busi_Date
  ,res.Rec_Id
  ,res.Secu_Id
  ,res.Src_Sys_Prdno
  ,res.Crrc_cd
  ,res.Crrc_name
  ,res.Cty_cd
  ,res.Cty_name
  ,res.corp_id
  ,res.scr_stat
  ,res.min_pric_chg_unit
  ,res.Peru
  ,res.scr_type
  ,res.ch_abbr
  ,res.scr_cd
  ,res.ch_abbr_pinyin
  ,res.ch_name
  ,res.en_name
  ,res.ch_abbr_l
  ,res.en_abbr
  ,res.mkt_cd
  ,res.mkt_ch_name
  ,res.In_Code
  ,res.Remark
  ,res.Src_Tbl
  ,res.Src_Rec_Id
  ,res.rec_upd_time
  ,res.rec_down_time
 from (
    select * from 
        (
            SELECT *,row_number() over(partition by secu_id,src_sys_prdno,scr_type,scr_cd,mkt_cd,ch_name order by in_code , src_tbl desc ) as rn  
            from tb1 
        ) t where t.rn=1
) res
