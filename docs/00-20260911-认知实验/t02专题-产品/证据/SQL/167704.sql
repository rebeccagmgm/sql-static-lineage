-- task_id: 167704
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_fnd_base_info_ext_WD_chinamutualfunddescription
-- observed_at: 2026-09-05T01:07:07.913Z

-- createSql
create table if not exists t02_fnd_base_info_ext
(  
     busi_date              string comment '数据日期'
    ,rec_id                 string comment '记录编号'
    ,secu_id                string comment '统一证券编号'
    ,src_sys_prdno          string comment '源系统产品编号'
    ,etf_flag               string comment '是否ETF'
    ,lof_flag               string comment '是否LOF'
    ,fof_flag               string comment '是否FOF'
    ,perf_compr_bm_en       string comment '业绩比较基准英文'
    ,reg_place              string comment '注册地'
    ,divd_plcy              string comment '分红政策'
    ,indv_scrp_way          string comment '个人投资者认购方式'
    ,clos_org_scrp_way      string comment '封闭期机构投资者认购方式'
    ,cstd_end_dt            string comment '托管终止日期'
    ,overseas_trste         string comment '境外托管人'
    ,cont_stat              string comment '存续状态'
    ,fnd_clas_prd           string comment '基金分类产品用（QDII及商品型）代码'
    ,fnd_form               string comment '基金形式'
    ,coll_type              string comment '募集方式'
    ,admin_type             string comment '管理类型'
    ,assm_prd_char          string comment '券商资管产品特点'
    ,idx_secu_id            string comment '指数id'
    ,open_dt_desc           string comment '开放日（说明）'
    ,redp_dt_desc           string comment '赎回日（说明）'
    ,ast_plac_prop          string comment '资产配置比例'
    ,ivst_lmt_restr         string comment '投资限制'
    ,ivst_advs_corp_id      string comment '投资顾问编号'
    ,issr_corp_id           string comment '发行人编号'
    ,brok_id                string comment '证券经纪人ID'
    ,futr_brok_id           string comment '期货经纪人ID'
    ,oserv_org_id           string comment '外包机构ID'
    ,adm_mngr_id            string comment '行政管理人ID'
    ,law_advs_id            string comment '法律顾问ID'
    ,audi_org_id            string comment '审计机构id'
    ,nav_disc_freq          string comment '净值披露频率'
    ,perf_disc_ind          string comment '产品业绩披露标识'
    ,perf_disc_desc         string comment '产品业绩披露描述'
    ,perf_disc_type         string comment '产品业绩披露方式'
    ,vld_flag               string comment '记录的有效性'
    ,rgst_cd                string comment '备案编码'
    ,rgst_dt                string comment '备案日期'
    ,amac_sugg              string comment '基金协会特别提示'
    ,stru_fnd_flag          string comment '是否分级'
    ,clos_pd_unit           string comment '封闭期单位'
    ,lock_pd                string comment '锁定期（-1-不确定，0-无锁定期）'
    ,lock_pd_unit           string comment '锁定期单位'
    ,ctrc_rgst_cd           string comment '中信登备案编码'
    ,dect_perf_rwd          string comment '是否扣除业绩报酬'
    ,bef_dof_flag           string comment '是否费前（1-是，0-否，-1-不详）'
    ,fnd_feat_cd_tx5        string comment '天相基金风格代码（五级分类）'
    ,fnd_feat_tx5           string comment '天相基金风格名称（五级分类）'
    ,create_time            string comment '创建时间'
    ,remark                 string comment '备注'
    ,src_tbl                string comment '来源表'
    ,src_rec_id             string comment '来源记录'
    ,rec_upd_time           string comment '记录修改时间'
    ,rec_down_time          string comment '记录创建时间'
    ,fnd_var_id             string comment '基金品种ID' -- 20241219 added by wxxuguib
    ,sale_serv_fee_rate     string comment '销售服务费率' -- 20250922 added by wxzhaohongji
) comment '基金基础信息表拓展表'
partitioned by (src_id string comment '来源标识')
stored as ORC
;

-- querySql
set hive.merge.mapfiles = true ;
    set hive.merge.mapredfiles = true;
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
    
    insert overwrite table t02_fnd_base_info_ext partition (src_id = 'WD')
    -- WD 数据
    select
         '${data_day_str}'                                         as busi_date                  -- 数据日期
        ,a.object_id                                                    as rec_id                     -- 记录编号
        ,b.secu_id                                                      as secu_id                    -- 统一证券编号
        ,b.src_sys_prdno                                                as src_sys_prdno              -- 源系统产品编号
        ,''                                                             as etf_flag                   -- 是否ETF
        ,''                                                             as lof_flag                   -- 是否LOF
        ,''                                                             as fof_flag                   -- 是否FOF
        ,''                                                             as perf_compr_bm_en           -- 业绩比较基准英文
        ,''                                                             as reg_place                  -- 注册地
        ,''                                                             as divd_plcy                  -- 分红政策
        ,a.F_PERSONAL_SUBTYPE                                           as indv_scrp_way              -- 个人投资者认购方式
        ,a.CLOSE_INSTITU_SUBTYPE                                        as clos_org_scrp_way          -- 封闭期机构投资者认购方式
        ,a.CUSTODY_ENDDATE                                              as cstd_end_dt                -- 托管终止日期
        ,a.FORINS_CUSTODIAN                                             as overseas_trste             -- 境外托管人
        ,b.scr_stat                                                     as cont_stat                  -- 存续状态                     
        ,''                                                             as fnd_clas_prd               -- 基金分类产品用（QDII及商品型）代码
        ,''                                                             as fnd_form                   -- 基金形式
        ,''                                                             as coll_type                  -- 募集方式
        ,''                                                             as admin_type                 -- 管理类型
        ,''                                                             as assm_prd_char              -- 券商资管产品特点
        ,''                                                             as idx_secu_id                -- 指数id
        ,''                                                             as open_dt_desc               -- 开放日（说明）
        ,''                                                             as redp_dt_desc               -- 赎回日（说明）
        ,''                                                             as ast_plac_prop              -- 资产配置比例
        ,''                                                             as ivst_lmt_restr             -- 投资限制
        ,''                                                             as ivst_advs_corp_id          -- 投资顾问编号
        ,''                                                             as issr_corp_id               -- 发行人编号
        ,''                                                             as brok_id                    -- 证券经纪人ID
        ,''                                                             as futr_brok_id               -- 期货经纪人ID
        ,''                                                             as oserv_org_id               -- 外包机构ID
        ,''                                                             as adm_mngr_id                -- 行政管理人ID
        ,''                                                             as law_advs_id                -- 法律顾问ID
        ,''                                                             as audi_org_id                -- 审计机构id
        ,''                                                             as nav_disc_freq              -- 净值披露频率
        ,''                                                             as perf_disc_ind              -- 产品业绩披露标识
        ,''                                                             as perf_disc_desc             -- 产品业绩披露描述
        ,''                                                             as perf_disc_type             -- 产品业绩披露方式
        ,''                                                             as vld_flag                   -- 记录的有效性
        ,''                                                             as rgst_cd                    -- 备案编码
        ,''                                                             as rgst_dt                    -- 备案日期
        ,''                                                             as amac_sugg                  -- 基金协会特别提示
        ,''                                                             as stru_fnd_flag              -- 是否分级
        ,''                                                             as clos_pd_unit               -- 封闭期单位
        ,''                                                             as lock_pd                    -- 锁定期（-1-不确定，0-无锁定期）
        ,''                                                             as lock_pd_unit               -- 锁定期单位
        ,''                                                             as ctrc_rgst_cd               -- 中信登备案编码
        ,''                                                             as dect_perf_rwd              -- 是否扣除业绩报酬
        ,''                                                             as bef_dof_flag               -- 是否费前（1-是，0-否，-1-不详）
        ,''                                                             as fnd_feat_cd_tx5            -- 天相基金风格代码（五级分类）
        ,''                                                             as fnd_feat_tx5               -- 天相基金风格名称（五级分类）
        ,''                                                             as create_time                -- 创建时间
        ,concat('{\\"src_crrc_cd\\":\\"', coalesce(a.CRNY_CODE,''),'\\",'
                '\\"src_fnd_mngr_id\\":\\"', coalesce(a.F_INFO_CORP_FUNDMANAGEMENTID,''),'\\",'
                '\\"src_trste_id\\":\\"', coalesce(a.F_INFO_CUSTODIANBANKID,''),'\\"}')    
                                                                        as remark     -- 备注 20250922 modified by wxzhaohongji
        ,'odata_n_uip.w_chinamutualfunddescription'                     as src_tbl                    -- 来源表
        ,a.object_id                                                    as src_rec_id                 -- 来源记录
        ,from_unixtime(unix_timestamp(a.opdate), 'yyyy-MM-dd HH:mm:ss') as rec_upd_time               -- 记录修改时间
        ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')         as rec_down_time              -- 记录创建时间
        ,a.f_info_fund_id                                               as fnd_var_id                 -- 基金品种ID 20241216 added by wxxuguib
        ,a.F_SALES_SERVICE_RATE                                         as sale_serv_fee_rate     -- 销售服务费率 20250922 added by wxzhaohongji
    from odata_n_uip.w_chinamutualfunddescription a
    left join (
        select * from t02_scr_base_info 
        where src_id = 'WD'
    ) b 
    ON a.f_info_windcode = b.in_code
    left join (
        select * from t02_pub_covt_const 
        where const_type_cd = 'fin00001' and  src_id = 'WD'
    ) co 
    ON a.crny_code = co.src_const_cd --WD货币代码转码
    left join (
        select * from odata_n_uip.w_chinamutualfundissue
    ) c 
    ON a.f_info_windcode = c.S_INFO_WINDCODE
    left join (
        select * from T02_CO_BASE_INFO 
        where src_id = 'WD'
    ) d 
    on a.f_info_corp_fundmanagementid = d.src_corp_id
    left join (
        select * from T02_CO_BASE_INFO 
        where src_id = 'WD'
    ) e
    on a.f_info_custodianbankid = e.src_corp_id
    ;
