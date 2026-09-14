-- task_id: 137827
-- hiveDb: dm_hr_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-02T06:51:59.038Z

-- createSql
CREATE TABLE IF NOT EXISTS dm_hr_n.search_bdp_table_info (
  table_id string COMMENT '表id',
  qualifiedname string COMMENT '表业务ID',
  chinese_name string COMMENT 'chinese_name',
  english_name string COMMENT '表名英文',
  description string COMMENT '表描述',
  data_range string COMMENT '数据范围',
  type string COMMENT '表类型',
  database_name string COMMENT '所属库',
  database_type string COMMENT '数据库类型',
  business_system string COMMENT 'business_system',
  createtime string COMMENT '创建时间',
  updatetime string COMMENT '最后更新时间',
  status string COMMENT '状态',
  credit_status string COMMENT '认证状态',
  business_manager string COMMENT '业务负责人',
  tech_principal string COMMENT '技术负责人',
  security_level string COMMENT '安全等级',
  data_classify string COMMENT '数据分类',
  field_name string COMMENT '字段名称',
  field_chinese_name string COMMENT '字段中文名',
  instructions_for_use string COMMENT '使用说明',
  feedback string COMMENT '用户反馈',
  task_name string COMMENT '任务名称',
  task_id string COMMENT 'task_id',
  hits string COMMENT '点击量',
  rec_status string COMMENT '2新增，3删除',
  original_system_order string COMMENT '40:非hive',
  data_classify_all string COMMENT '，用于筛选',
  table_field_relate string COMMENT '字段业务备注',
  table_tag string COMMENT '标签，多个用英文字符隔开',
  score_sort string COMMENT '评分排序',
  feedback_sort string COMMENT '反馈排序',
  collect_sort string COMMENT '收藏排序',
  hive_updatetime string COMMENT '数据生成时间',
  upstream_system string COMMENT '上游系统',
  classification string COMMENT '分类',
  grade string COMMENT '分级',
  tag string COMMENT '标签',
  data_level string COMMENT '数据层级'
)
COMMENT '数综搜索-表数据'
PARTITIONED BY ( busi_date string COMMENT '业务日期' )
STORED AS ORC;

-- querySql
SELECT table_id,
	qualifiedname,
	chinese_name,
	english_name,
	description,
	data_range,
	type,
	database_name,
	database_type,
	business_system,
	createtime,
	updatetime,
	status,
	credit_status,
	business_manager,
	tech_principal,
	security_level,
	data_classify,
	field_name,
	field_chinese_name,
	instructions_for_use,
	feedback,
	task_name,
	task_id,
	hits,
	rec_status,
	original_system_order,
	data_classify_all,
	table_field_relate,
	table_tag,
	score_sort,
	feedback_sort,
	collect_sort,
	hive_updatetime,
	upstream_system,
	classification,
	grade,
	tag,
	data_level,
	busi_date FROM (
	 select t1.table_id --表id
     ,t1.qualifiedname  --表业务ID
    ,t1.chinese_name --表名中文
    ,t1.english_name --表名英文
    ,t1.description --表描述
    ,t1.data_range --数据范围
    ,t1.type --表类型
    ,t1.database_name --所属库
    ,t1.database_type --数据库类型
    ,t1.business_system --来源系统
    ,t1.createtime --创建时间
    ,t1.updatetime --最后更新时间
    ,case when t1.business_status='ACTIVE' or t1.business_status='' or t1.business_status is null then 'ACTIVE' 
        else t1.business_status end as status --状态
    ,t1.credit_status --认证状态
    ,t1.business_manager --业务负责人
    ,t1.tech_principal	--技术负责人
    ,t1.security_level	--安全等级
    ,t1.data_classify	--数据分类
    ,t2.field_name	--字段名称
    ,t2.field_chinese_name	--字段中文名
    ,t3.instructions_for_use	--使用说明
    ,t4.feedback	--用户反馈
    ,'' as task_name	--任务名称
    ,'' as task_id --任务id
    ,nvl(t7.hits,'0') as hits	--点击量
    ,'0' rec_status	--0无变更，1更新， 2新增，3删除
    ,case when t1.database_type<>'hive' then 2000 
      when t1.database_name like 'odata_n%' then 1030 
      when t1.database_name in ('pdata_n','pdata_news_n','spdata_n','pdata_hk','pdata_pcav_n') then 1020 
      when t1.database_name = 'dm_index_n' and lower(t1.english_name) like 'index_%' then 1010
		  when t1.database_name like 'dm_%' and lower(t1.english_name) like 'wt_%' then 1000
      else 1040 end as original_system_order --数据来源排序（将排序字段备注好）10000:宽表 1010:hive-指标 1020:hive-模型 1030:hive-贴源 1040:hive-其他 2000:非hive
    ,t5.data_classify_all as  data_classify_all --数据分类全部，传code值，用英文逗号分隔,，用于筛选
    ,t2.field_business_remark as  table_field_relate --字段业务备注
    ,t6.table_tag as  table_tag	--标签，多个用英文字符隔开
    ,'' score_sort --评分排序
    ,'' feedback_sort --反馈排序
    ,'' collect_sort --收藏排序
    ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') as hive_updatetime	--数据生成时间
    ,t1.upstream_system as upstream_system --上游系统
    ,t1.classification as classification --分类
    ,t1.grade as grade --分级
    ,t1.tag as tag --标签
    ,CASE WHEN t1.database_name LIKE 'odata_n_%' THEN 'COLLECTION'
        WHEN t1.database_name LIKE 'pdata_%' OR t1.database_name LIKE 'spdata_%' THEN 'MODELING'
        WHEN t1.database_name = 'dm_index_n' THEN 'INDICATOR_TAG'
        WHEN ((t1.database_name LIKE 'dm\_%\_n' AND t1.database_name NOT IN ('dm_index_n','dm_mast_n','dm_engin_n')))
            OR ((t1.database_name LIKE 'dm\_%\_test' AND t1.database_name NOT IN ('dm_mast_test','dm_engin_test'))) THEN 'MARKET' 
        ELSE NULL end as data_level --数据层级
    ,'${yyyy-MM-dd}' busi_date --业务日期
from 
--表信息
(select  
    a.Tbl_Id as table_id --表id
    ,a.Tbl_Cmnt as chinese_name --,nvl(Tbl_Cmnt, uercomment) as chinese_name --表名中文
    ,a.Tbl_Name as english_name --表名英文
    ,nvl(b.Desc,b.Pdef_Desc) as description --表描述
    ,b.Busi_Data_Rng as data_range --数据范围
    ,a.Tbl_Type as type --表类型
    ,split(b.Busi_Uniq_Name,'\\.')[0] as database_name --所属库
    ,'hive' as database_type --数据库类型
    ,b.Sys_Busi_Uniq_Name as business_system --,systemid as business_system --来源系统
    ,a.Estb_Time as createtime --创建时间
    ,a.Upd_time as updatetime --最后更新时间
   -- ,'已认证' as credit_status --,case when business_iscertified='1' then '已认证' else '未认证' end as credit_status --认证状态
    ,case when b.Auth_Flag='1' then '已认证' else '未认证' end as credit_status --认证状态
    ,b.Busi_Prin as business_manager--业务负责人
    ,concat_ws(',',array_sort(array_intersect(
        array_remove(split(regexp_replace(b.Tech_Prin_User_Id,'\\|',','),','),''),
        split(regexp_replace(b.Tech_Prin_User_Id,'\\|',','),',')))) as tech_principal	--技术负责人
    ,regexp_extract(concat_ws(',',sort_array(split(b.Cls_name,','),false)),'分级_[0-9]',0) as security_level	--安全等级
    ,b.Cls_name as data_classify	--数据分类
    ,b.Busi_Uniq_Name as qualifiedname
    ,c.upstream_system as upstream_system --上游系统
    ,d.classification as classification --分类
    ,e.grade as grade --分级
    ,f.tag as tag --标签
    ,b.Data_Ast_Stat as business_status
from PDATA_N.T00_TBL_INFO a --表信息 --113440
left join PDATA_N.T00_HIVE_TBL_ADTNL_INFO b --HIVE表附加信息 --132904
on a.Tbl_Id=b.Tbl_Id and b.src_tbl = 'ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE'
left join 
(select Tbl_Id,concat_ws(',',collect_list(nvl(Busi_Uniq_Name,''))) as upstream_system from PDATA_N.T00_TBL_SYS_RELA_H --200743
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE' and End_Date='2099-12-31' 
and Tbl_Sys_Rela_Type_Cd='01'
group by Tbl_Id) c 
on a.Tbl_Id=c.Tbl_Id
left join
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(db_obj_clas_cd,''))) as classification from PDATA_N.T00_DB_OBJ_CLAS_INFO --200741
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE' and db_obj_type_cd='001' and db_obj_clas_type_cd='001'
group by Obj_Id) d 
on a.Tbl_Id=d.Tbl_Id
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(db_obj_clas_cd,''))) as grade from PDATA_N.T00_DB_OBJ_CLAS_INFO --200741
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE' and db_obj_type_cd='001' and db_obj_clas_type_cd='002'
group by Obj_Id) e 
on a.Tbl_Id=e.Tbl_Id
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(Lbl_Id,''))) as tag from PDATA_N.T00_DB_OBJ_LBL_INFO --200742
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE' and db_obj_type_cd='001' and Lbl_Cate_Cd='DB_OBJ_LBL'
group by Obj_Id) f 
on a.Tbl_Id=f.Tbl_Id
where a.src_tbl = 'ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE'  --HIVE表信息
union all
select 
     a.Tbl_Id as table_id --表id
    ,nvl(a.Tbl_Cmnt, b.Pdef_Name_Ch) as chinese_name --表名中文
    ,a.Tbl_Name as english_name --表名英文
    ,b.Desc as description  --,nvl(description,userdescription) as description --表描述
    ,b.Data_Scop as data_range --数据范围
    ,a.Tbl_Type as type --表类型
    ,split(b.Tbl_Busi_Uniq_Name,'\\.')[0] as database_name --所属库
    ,regexp_extract(b.Tbl_Busi_Uniq_Name,'(@gf)(.*?)(_)',2) as database_type --数据库类型
    ,b.Sys_Busi_Uniq_Name as business_system --来源系统
    ,a.Estb_Time as createtime --创建时间
    ,a.Upd_time as updatetime --最后更新时间
    ,case when b.Auth_Flag='1' then '已认证' else '未认证' end as credit_status --认证状态
    ,b.Busi_Prin as business_manager --业务负责人
    ,concat_ws(',',array_sort(array_intersect(
        array_remove(split(regexp_replace(b.Tech_Prin,'\\|',','),','),''),
        split(regexp_replace(b.Tech_Prin,'\\|',','),',')))) as tech_principal	--技术负责人
    ,regexp_extract(concat_ws(',',sort_array(split(b.Cls_Name,','),false)),'分级_[0-9]',0) as security_level	--安全等级
    ,b.Cls_Name as data_classify	--数据分类
    ,b.Tbl_Busi_Uniq_Name as qualifiedname
    ,'' as upstream_system --上游系统
    ,c.classification as classification --分类
    ,d.grade as grade --分级
    ,e.tag as tag --标签
    ,b.Data_Ast_Stat as business_status
from PDATA_N.T00_TBL_INFO a --表信息 --135313
left join PDATA_N.T00_RDBMS_TBL_ADTNL_INFO b --广发关系型数据表 --135315
on a.Tbl_Id=b.Tbl_Id and b.src_tbl = 'ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_TABLE'
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(DB_Obj_Clas_Cd,''))) as CLASSIFICATION from PDATA_N.T00_DB_OBJ_CLAS_INFO --200738
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_TABLE' and DB_Obj_Type_Cd='001' and DB_Obj_Clas_Type_Cd='001'
group by Obj_Id) c 
on a.Tbl_Id=c.Tbl_Id
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(DB_Obj_Clas_Cd,''))) as grade from PDATA_N.T00_DB_OBJ_CLAS_INFO --200738
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_TABLE' and DB_Obj_Type_Cd='001' and DB_Obj_Clas_Type_Cd='002'
group by Obj_Id) d 
on a.Tbl_Id=d.Tbl_Id
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(Lbl_Id,''))) as tag from PDATA_N.T00_DB_OBJ_LBL_INFO --200739
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_TABLE' and DB_Obj_Type_Cd='001' and Lbl_Cate_Cd='DB_OBJ_LBL'
group by Obj_Id) e 
on a.Tbl_Id=e.Tbl_Id
where a.src_tbl = 'ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_TABLE'
union all 
select 
    a.Tbl_Id as table_id --表id
    ,b.Tbl_Cmnt as chinese_name --,nvl(comment, uercomment) as chinese_name --表名中文
    ,b.Tbl_Name as english_name --表名英文
    ,a.Desc as description --表描述
    ,'' as data_range --数据范围
    ,'' as type --表类型
    ,'' as database_name --所属库
    ,'kafka' as database_type --数据库类型
    ,a.Own_Sys as business_system --,b.Sys_Busi_Uniq_Name as business_system --来源系统
    ,b.Estb_Time as createtime --创建时间
    ,b.Upd_time as updatetime --最后更新时间
    ,case when a.Auth_Flag='1' then '已认证' else '未认证' end as credit_status --认证状态
    ,a.Busi_Chrg_User as business_manager--业务负责人
    --,concat_ws(',',array_sort(array_intersect(
    --    array_remove(split(regexp_replace(techPrincipal,'\\|',','),','),''),
    --    split(regexp_replace(techPrincipal,'\\|',','),',')))) as tech_principal	--技术负责人
    ,'' as tech_principal
    ,regexp_extract(concat_ws(',',sort_array(split(a.Cls_name,','),false)),'分级_[0-9]',0) as security_level	--安全等级
    ,a.Cls_name as data_classify	--数据分类
    ,a.Busi_Uniq_Name as qualifiedname
    ,'' as upstream_system --上游系统
    ,c.classification as classification --分类
    ,d.grade as grade --分级
    ,e.tag as tag --标签
    ,a.Busi_Prin as business_status
from PDATA_N.T00_KAFKA_TBL_ADTNL_INFO a inner join PDATA_N.T00_TBL_INFO b --191459,191457
on a.Tbl_Id=b.Tbl_Id
and a.SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC'
and b.SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC'
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(DB_Obj_Clas_Cd,''))) as classification from PDATA_N.T00_DB_OBJ_CLAS_INFO --200072
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC' and DB_Obj_Type_Cd='001' and DB_Obj_Clas_Type_Cd='001'
group by Obj_Id) c 
on a.Tbl_Id=c.Tbl_Id
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(DB_Obj_Clas_Cd,''))) as grade from PDATA_N.T00_DB_OBJ_CLAS_INFO --200072
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC' and DB_Obj_Type_Cd='001' and DB_Obj_Clas_Type_Cd='002'
group by Obj_Id) d 
on a.Tbl_Id=d.Tbl_Id
left join 
(select Obj_Id as Tbl_Id,concat_ws(',',collect_list(nvl(Lbl_Id,''))) as tag from PDATA_N.T00_DB_OBJ_LBL_INFO --200074
where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC' and DB_Obj_Type_Cd='001' and Lbl_Cate_Cd='DB_OBJ_LBL'
group by Obj_Id) e 
on a.Tbl_Id=e.Tbl_Id
) t1 
--关联字段信息
left join 
    (select 
    Tbl_Fld_Id as table_id
    ,concat_ws(',', collect_list(Fld_Name)) as field_name
    ,concat_ws(',', collect_list(Fld_Cmnt)) as field_chinese_name
	  ,concat('[',concat_ws(',', collect_list(field_business_remark)),']') as field_business_remark 
    from  
      (select 
      Tbl_Fld_Id,
      Fld_Name,
      Fld_Cmnt,
      Fld_Seq,
	    concat('{"fieldName":"',Fld_Name,'","fieldChineseName":"',nvl(Fld_Cmnt,''),'","fieldBusinessRemark":" "}') as field_business_remark
      from PDATA_N.T00_FLD_INFO --表字段信息 113442
      where src_tbl in ('ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_COLUMN','ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_RDBMS_COLUMN')
      order by Tbl_Fld_Id,cast(Fld_Seq as int)) t 
    group by Tbl_Fld_Id 
    union all
    select a.table_id,
    concat_ws(',', collect_list(b.name)) as field_name,
    concat_ws(',', collect_list(b.usercomment)) as field_chinese_name,
    concat('[',concat_ws(',', collect_list(b.field_business_remark)),']') as field_business_remark
    from
      (select Tbl_Id as table_id from PDATA_N.T00_TBL_INFO --191457
      where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC') as a
      inner join
      (select Tbl_Fld_Id as TOPIC,Fld_Name as name,Fld_Cmnt as usercomment,
      concat('{"fieldName":"',Fld_Name,'","fieldChineseName":"',nvl(Fld_Cmnt,''),'","fieldBusinessRemark":" "}') as field_business_remark
      from PDATA_N.T00_FLD_INFO where SRC_TBL='ODATA_N_BDP.FILE_ATLAS_EXPORT_KAFKA_TOPIC_FIELD') as b --191458
    on a.table_id=b.TOPIC group by a.table_id
    ) t2
on t1.table_id = t2.table_id
--关联元数据使用说明信息
left join 
    (select 
    meta_id
    ,use_desc_cont as instructions_for_use
    ,row_number() over(partition by meta_id order by ver_no desc) rn
    from PDATA_N.T00_META_USE_INFO --元数据使用说明信息 135316 
    where src_tbl = 'ODATA_N_BDP.P_T_META_INSTRUCTIONS'--内部数据使用说明信息表
    ) t3
on t1.table_id = t3.meta_id and t3.rn=1
--关联评论
left join
    (select meta_busi_uniq_name as qualifiedname
    ,concat_ws(',', collect_list(feedback)) as feedback
    from 
      (select meta_busi_uniq_name,
      concat(estb_user_name,'：“',cmnt_cont,'”') as feedback
      from PDATA_N.T00_META_USER_CMNT --元数据用户评论 135317
      where src_tbl = 'ODATA_N_BDP.P_T_PRODUCT_COMMENT' --产品评论表
      and nvl(meta_busi_uniq_name,'')<>'' and del_flag<>'1'
      order by meta_busi_uniq_name, estb_time asc) t 
    group by meta_busi_uniq_name) t4
on t1.qualifiedname=t4.qualifiedname 
left join 
    (select tbl_id,
    concat_ws(',', collect_set(Cls_Name_a)) as data_classify_all
    from 
      (select tbl_id,Cls_Name_a from temp_n.Cls_Name_table where Cls_Name_type='分类'  order by tbl_id,Cls_Name_a) t51
			group by tbl_id
		  ) t5
		on t1.table_id=t5.tbl_id
left join (select tbl_id,concat_ws(',', collect_set(Cls_Name_a)) as table_tag
             from (select tbl_id,Cls_Name_a from temp_n.Cls_Name_table where Cls_Name_type='标签'  order by tbl_id,Cls_Name_a) t61
			group by tbl_id
		  ) t6
		on t1.table_id=t6.tbl_id
left join (select t74.Tbl_Id,t71.database_name, t71.table_name, count(t71.id) as hits
            from 
            (select Db_Name as database_name,Tbl_Name as table_name,substr(Evt_Id,8) as id 
                from PDATA_N.T05_BDP_BASE_DATA_OPER_LOG --189908
                where Qry_Oper_Type_Cd = '1' -- 自助查询SELECT
                and Src_Tbl='ODATA_N_BDP.P_T_DATABASE_OPERATE_LOG' --and busi_date='${yyyy-MM-dd}' 
                and Src_Cluster_Id != '00000000000000000000000000000000' -- 排除掉马场的，需要替换成生产环境马场集群id
            ) as t71
            inner join 
            (select t72.Tbl_Id,t73.database_name,t72.table_name
                from 
                (select Tbl_Id,Tbl_Name as table_name from PDATA_N.T00_TBL_INFO where src_tbl='ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE') as t72
                inner join 
                (select Tbl_Id,SUBSTRing_index(Busi_Uniq_Name,'.',1) as database_name from PDATA_N.T00_HIVE_TBL_ADTNL_INFO 
                where src_tbl='ODATA_N_BDP.FILE_ATLAS_EXPORT_HIVE_TABLE') as t73
            on t72.Tbl_Id=t73.Tbl_Id
            ) as t74
          on t71.database_name=t74.database_name and t71.table_name=t74.table_name
          group by t74.Tbl_Id,t71.database_name,t71.table_name) t7
on t1.table_id=t7.Tbl_Id 
	) castTable
