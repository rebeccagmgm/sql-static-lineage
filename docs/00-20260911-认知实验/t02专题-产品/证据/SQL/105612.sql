-- task_id: 105612
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_fut_base_info_TIT_ref_future_properties_grp01
-- observed_at: 2026-09-05T01:06:44.850Z

-- createSql
CREATE TABLE  IF NOT EXISTS t02_fut_base_info(
	busi_date				string comment '数据日期'
	,rec_id					string comment '记录编号'
	,secu_id				string comment '统一证券编号'
	,src_sys_prdno			string comment '源系统产品编号'
	,std_contr_cd			string comment '标准合约代码'
	,std_contr_name			string comment '标准合约名称'
	,deal_unit				string comment '交易计量单位'
	,deal_unit_peru			string comment '交易单位(每手)'
	,sml_chg_pric			string comment '最小变动价位'
	,low_trd_marg			string comment '最低交易保证金'
	,contr_mth_intro		string comment '合约月份说明'
	,deal_time_intro		string comment '交易时间说明'
	,last_trd_date			string comment '最后交易日说明'
	,deli_date_intro		string comment '交割日期说明'
	,contr_mulplr			string comment '合约乘数'
	,contr_list_date		string comment '合约上市日期'
	,delist_date			string comment '退市日期'
	,exch_abbr				string comment '交易所简称'
	,deli_method_intro		string comment '交割方式说明'
	,deli_site_intro		string comment '交割地点说明'
	,last_trd_time_intro	string comment '最后交易日交易时间说明'
	,contr_val_intro		string comment '合约价值说明'
	,max_pric_vola_intro	string comment '最大价格波动说明'
	,ms_lmt_intro			string comment '头寸限制说明'
	,undrl_scr_cd			string comment '标的证券代码'
	,offr_unit				string comment '报价单位'
	,avg_pric_val			string comment '均价计算使用值'
	,var_det_cd				string comment '品种细类代码'
	,contr_id				string comment '合约ID'
	,futr_type_cd			string comment '期货类型代码'
	,undrl_secu_id			string comment '标的证券Wind代码'
	,remark					string comment '备注'
	,src_tbl				string comment '来源表'
	,src_rec_id				string comment '来源记录'
	,rec_upd_time			string comment '记录修改时间'
	,rec_down_time			string comment '记录创建时间'
 )COMMENT '证券-期货信息表'
PARTITIONED BY 
(
src_id                  string  comment '来源标识'
,grp_id                 string  comment '并行标识'
)
stored as orc;

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



    INSERT OVERWRITE TABLE t02_fut_base_info PARTITION(src_id='TIT' ,grp_id = '01' )
    SELECT
        '${data_day_str}'                                  AS busi_date              	-- 数据日期
		,'' 													AS rec_id				-- 记录编号
		,b.secu_id		 					AS secu_id				-- 统一证券编号
		,b.src_sys_prdno	 			AS src_sys_prdno			-- 源系统产品编号
		,a.SCCODE_WITH_SUFFIX 			AS std_contr_cd			-- 标准合约代码
		,a.NAME 						AS std_contr_name			-- 标准合约名称
		,'' 											AS deal_unit				-- 交易计量单位
		,'' 											AS deal_unit_peru			-- 交易单位(每手)
		,'' 											AS sml_chg_pric			-- 最小变动价位
		,'' 											AS low_trd_marg			-- 最低交易保证金
		,'' 											AS contr_mth_intro		-- 合约月份说明
		,'' 											AS deal_time_intro		-- 交易时间说明
		,regexp_replace(substr(a.DELISTDATE,1,10),'-','') 			AS last_trd_date			-- 最后交易日说明
		,regexp_replace(substr(a.LTDLDATE,1,10),'-','') 			AS deli_date_intro		-- 交割日期说明
		,a.CONTRACT_MULTIPLIER 							AS contr_mulplr			-- 合约乘数
		,regexp_replace(substr(a.LISTDATE,1,10),'-','') 			AS contr_list_date		-- 合约上市日期
		,'' 													AS delist_date			-- 退市日期
		,a.EXCHMARKET 											AS exch_abbr				-- 交易所简称
		,'' 													AS deli_method_intro		-- 交割方式说明
		,'' 													AS deli_site_intro		-- 交割地点说明
		,'' 													AS last_trd_time_intro	-- 最后交易日交易时间说明
		,'' 													AS contr_val_intro		-- 合约价值说明
		,a.PRICE_LIMIT 											AS max_pric_vola_intro	-- 最大价格波动说明
		,'' 													AS ms_lmt_intro			-- 头寸限制说明
		,a.UNDERLYING_INS_ID 									AS undrl_scr_cd			-- 标的证券代码
		,'' 													AS offr_unit				-- 报价单位
		,'' 													AS avg_pric_val			-- 均价计算使用值
		,'' 													AS var_det_cd				-- 品种细类代码
		,'' 													AS contr_id				-- 合约ID
		,c.const_cd 											AS futr_type_cd			-- 期货类型代码
		,'' 													AS undrl_secu_id			-- 标的证券Wind代码
		,concat('{\\"DELI_MTH\\":\\"',coalesce(a.DLMONTH,''),'\\" ,'
            ,'\\"SRC_CREATE_TIME\\":\\"',coalesce(a.CREATED_DATETIME,''),'\\" ,'
            ,'\\"SRC_DATA_SOURCE\\":\\"',coalesce(a.DATA_SOURCE,''),'\\" ,'
            ,'\\"TRD_CD\\":\\"',coalesce(a.CODE,''),'\\",'
            ,'\\"CCTYPE\\":\\"',coalesce(a.cctype,''),'\\",'
            ,'\\"TYPE\\":\\"',coalesce(a.type,''),'\\",'
            ,'\\"STD_CONTR_ENAME\\":\\"',coalesce(a.ENAME,''),'\\"}')													AS remark				-- 备注
		,'odata_n_tit.d_ref_future_properties' 					AS src_tbl				-- 来源表
		,'' 													AS src_rec_id			-- 来源记录
		,substr(a.UPDATED_DATETIME, 1,19)  AS rec_upd_time			-- 记录修改时间
		,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss') AS rec_down_time		-- 记录创建时间
    FROM
    (select * from odata_n_tit.d_ref_future_properties where busi_date = '${data_day_str}' ) a 
    left join
    (select * from t02_scr_base_info where src_id = 'TIT') b 
    on a.key_instrument_id = b.in_code
    left join
    (select * from t02_pub_covt_const where const_type_cd = 'var00001' and src_id = 'TIT') c
    on a.FUTURE_TYPE = c.src_const_cd
    where b.secu_id is not null
