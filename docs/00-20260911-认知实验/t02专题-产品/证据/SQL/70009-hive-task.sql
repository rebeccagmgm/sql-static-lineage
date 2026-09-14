-- task_id: 70009
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_scr_rela_WD
-- observed_at: 2026-09-05T01:06:29.570Z

-- createSql
create table if not exists t02_Scr_rela
(  
    busi_date                      string	comment '日期'
    ,rec_id                        string	comment '记录编号'
    ,secu_id                       string	comment '统一证券编号'
    ,src_sys_prdno                 string   comment '源系统产品编号'
    ,scr_cd                     string	comment '证券代码'
    ,rela_scr_id                 string	comment '关联统一证券编号'
    ,rela_src_sys_prdno           string   comment '关联源系统产品编号'
    ,rela_scr_cd               string	comment '关联证券代码'
    ,rela_type_cd               string	comment '关系类型代码'
    ,valid_date                        string	comment '生效日期'
    ,end_date                        string	comment '失效日期'
    ,src_tbl                       string	comment '来源表'
    ,src_rec_id                    string	comment '来源记录'
    ,rec_upd_time                    string	comment '记录修改时间'
    ,rec_down_time                   string	comment '记录创建时间'
      
) comment '证券关系表'
partitioned by (src_id string comment '来源标识')
stored as ORC;
;

-- querySql
--secu_id、reltn_secu_id存在空值
with tmp_a as 
(
    select * 
    from t02_scr_BASE_INFO 
    where src_id='WD'
)

insert overwrite table t02_Scr_rela partition (src_id='WD')

select  
    '{data_today}'                                                    as		busi_date
    ,a.object_id                                                      as		rec_id
    ,b.secu_id                                                        as		secu_id
    ,b.src_sys_prdno                                                  as        src_sys_prdno
    ,b.scr_cd                                                         as		scr_cd
    ,c.secu_id                                                        as		rela_scr_id
    ,c.src_sys_prdno                                                  as        rela_src_sys_prdno
    ,c.scr_cd                                                         as		rela_scr_cd
    ,a.s_relation_typcode                                             as		rela_type_cd
    ,a.s_info_effective_dt                                            as		valid_date
    ,a.s_info_invalid_dt                                              as		end_date
    ,'ralatedsecuritiescode'                                          as		src_tbl
    ,a.object_id                                                      as		src_rec_id
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')           as		rec_upd_time
    ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')           as		rec_down_time

from odata_n_uip.w_ralatedsecuritiescode a
left join tmp_a b
on a.s_info_windcode=b.in_code
left join tmp_a c
on a.s_info_ralatedcode=c.in_code
;
