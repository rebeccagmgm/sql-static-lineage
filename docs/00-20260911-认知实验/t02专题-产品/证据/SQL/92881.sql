-- task_id: 92881
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm02/pdata_news_n.t02_bnd_income_vchr_ois_OIS_incomecertificate_grp01
-- observed_at: 2026-09-05T01:06:39.881Z

-- createSql
create table if not exists  t02_bnd_income_vchr_ois
(
     busi_date			string comment '数据日期'
    ,rec_id				string comment '记录编号'
    ,secu_id			string comment '统一证券编码'
    ,src_sys_prdno		string comment '源系统产品编号'
    ,corp_id			string comment '公司id'
    ,sav_cash			string comment '存量本金'
    ,low_ror			string comment '最低收益率'
    ,expe_ror			string comment '预期收益率'
    ,prd_strt_dt		string comment '产品开始日期'
    ,prd_val_dt			string comment '产品起息日期'
    ,prd_maty_dt		string comment '产品到期日期'
    ,pay_dt				string comment '兑付日期'
    ,inta_days			string comment '计息天数'
    ,prd_type			string comment '产品类型'
    ,prd_stru			string comment '产品结构'
    ,dept				string comment '部门'
    ,iss_site			string comment '发行场所'
    ,intrt_ulmt			string comment '利率上限'
    ,pay_intrt			string comment '兑付利率'
    ,pay_amt			string comment '兑付金额'
    ,bren_flag			string comment '是否保本'
    ,preterm_flag		string comment '是否提前终止'
    ,preterm_date		string comment '提前终止日期'
    ,last_upd_prsn_id	string comment '最后更新人id'
    ,cost_ulmt          string comment '特定成本上限'
    ,inta_regu          string comment '计息规则'
    ,itpy_regu          string comment '付息规则'
    ,ori_pay_dt         string comment '原始兑付日'
    ,actl_ivstr         string comment '实际投资人'
    ,fnd_type_cd        string comment '资金类型代码'    
    ,fnd_type_name      string comment '资金类型名称'    
    ,fwd_rela_flag      string comment '是否挂钩远期'    
    ,tot_cost           string comment '总成本'
    ,remark1			string comment '备注1'
    ,remark				string comment '备注'
    ,src_tbl			string comment '来源表'
    ,src_rec_id			string comment '来源记录'
    ,rec_upd_time		string comment '记录更新时间'
    ,rec_down_time		string comment '记录创建时间'
)
partitioned by (src_id string comment '数据来源',grp_id string comment '并行分组标识')
stored as ORC;

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

with t02_bnd_income_vchr_ois_temp AS (
    select
         '${data_day_str}'										as busi_date			--数据日期
        ,a.prd_no													as rec_id				--记录编号
        ,b.secu_id													as secu_id				--统一证券编码
        ,b.src_sys_prdno											as src_sys_prdno		--源系统产品编号
        ,''															as corp_id				--公司id
        ,a.clbj														as sav_cash				--存量本金
        ,a.zdsyl													as low_ror				--最低收益率
        ,a.yqsyl													as expe_ror				--预期收益率
        ,regexp_replace(a.cpqsr,'-','')								as prd_strt_dt			--产品开始日期
        ,regexp_replace(a.cpqxr,'-','')								as prd_val_dt			--产品起息日期
        ,regexp_replace(a.cpdqr,'-','')								as prd_maty_dt			--产品到期日期
        ,regexp_replace(a.dfr,'-','')								as pay_dt				--兑付日期
        ,a.jxts														as inta_days			--计息天数
        ,a.lx														as prd_type				--产品类型
        ,a.cpjg														as prd_stru				--产品结构
        ,a.bm														as dept					--部门
        ,a.fxcs														as iss_site				--发行场所
        ,a.llsx														as intrt_ulmt			--利率上限
        ,a.dfll														as pay_intrt			--兑付利率
        ,a.dfje														as pay_amt				--兑付金额
        ,a.is_baoben												as bren_flag			--是否保本
        ,a.is_tqzz													as preterm_flag			--是否提前终止
        ,substr(a.pre_termination_date,1,19) 						as preterm_date			--提前终止日期
        ,a.lastmodify_by											as last_upd_prsn_id		--最后更新人id
        ,a.specific_cost_max                                        as cost_ulmt            --特定成本上限  
        ,a.interest_calc_rules                                      as inta_regu            --计息规则
        ,case a.interest_payment_rules when 'BALLOON_PAYMENT' then '一次性到期还本' 
                                        when 'AMORTIZED_PAYMENT' then '分期付息到期还本' 
                                        end                         as itpy_regu            --付息规则
        ,default.date2datekey(a.original_maturity_date)             as ori_pay_dt           --原始兑付日
        ,a.actual_investor                                          as actl_ivstr           --实际投资人    
        ,c.const_cd                                                 as fnd_type_cd          --资金类型代码
        ,c.const_cn_desc                                            as fnd_type_name        --资金类型名称    
        ,case a.forward_linkage_flag when 'true' then '1' 
                                        when 'false' then '0' 
                                        end                         as fwd_rela_flag        --是否挂钩远期    
        ,''                                                         as tot_cost             --总成本
        ,a.bz														as remark1				--备注1
        ,''															as remark				--备注
        ,'odata_n_ois.o_otc_incomecertificate'						as src_tbl				--来源表
        ,a.prd_no													as src_rec_id			--来源记录
        ,substr(a.lastmodify_time,1,19) 							as rec_upd_time			--记录更新时间
        ,from_unixtime(unix_timestamp(),'yyyy-mm-dd hh:mm:ss')		as rec_down_time		--记录创建时间
    from (
        select 
            * 
        from odata_n_ois.o_otc_incomecertificate 
        where busi_date = '${data_day_str}'
        ) a
    left join 
        (
        select 
             busi_date
            ,rec_id
            ,secu_id
            ,src_sys_prdno
            ,crrc_cd
            ,crrc_name
            ,cty_cd
            ,cty_name
            ,corp_id
            ,scr_stat
            ,min_pric_chg_unit
            ,peru
            ,scr_type
            ,ch_abbr
            ,scr_cd
            ,ch_abbr_pinyin
            ,ch_name
            ,en_name
            ,ch_abbr_l
            ,en_abbr
            ,mkt_cd
            ,mkt_ch_name
            ,in_code
            ,remark
            ,src_tbl
            ,src_rec_id
            ,rec_upd_time
            ,rec_down_time
            ,src_id
        from t02_scr_base_info 
        where src_id = 'OTC' 
        ) b 
    on a.prd_no = b.scr_cd
    left join (
        select *
        from t02_pub_covt_const 
        where src_id = 'OIS' and const_type_cd = 'var00512'
        ) c
    on a.fund_type = c.src_const_cd

)
    INSERT OVERWRITE TABLE t02_bnd_income_vchr_ois PARTITION(src_id = 'OIS',grp_id = '01')
 select 
         busi_date
        ,rec_id
        ,secu_id
        ,src_sys_prdno
        ,corp_id
        ,sav_cash
        ,low_ror
        ,expe_ror
        ,prd_strt_dt
        ,prd_val_dt
        ,prd_maty_dt
        ,pay_dt
        ,inta_days
        ,prd_type
        ,prd_stru
        ,dept
        ,iss_site
        ,intrt_ulmt
        ,pay_intrt
        ,pay_amt
        ,bren_flag
        ,preterm_flag
        ,preterm_date
        ,last_upd_prsn_id
        ,cost_ulmt
        ,inta_regu
        ,itpy_regu
        ,ori_pay_dt
        ,actl_ivstr
        ,fnd_type_cd
        ,fnd_type_name
        ,fwd_rela_flag
        ,tot_cost
        ,remark1
        ,remark
        ,src_tbl
        ,src_rec_id
        ,rec_upd_time
        ,rec_down_time
    from t02_bnd_income_vchr_ois_temp
    where secu_id is not null;

    ;
