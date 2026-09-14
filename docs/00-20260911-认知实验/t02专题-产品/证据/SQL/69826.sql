-- task_id: 69826
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_fnd_base_info_TL_fund
-- observed_at: 2026-09-05T01:06:29.147Z

-- createSql
create table if not exists t02_fnd_base_info
(  
     busi_date                                   string    comment'数据日期'
    ,rec_id                                      string    comment'记录编号'
    ,secu_id                                     string    comment'统一证券编号'
    ,src_sys_prdno                               string    comment'源系统产品编号'
    ,scr_cd                                      string    comment'交易代码'
    ,Frnt_Cd                                     string    comment'前端代码'
    ,Bk_Cd                                       string    comment'后端代码'
    ,Full_Name                                   string    comment'名称'
    ,abbr_name                                   string    comment'简称'
    ,Mgmt_Corp_Cd                                string    comment'基金管理公司编码'
    ,Mng_Prtc                                    string    comment'管理人'
    ,Cstd_id                                     string    comment'基金托管人编码'
    ,Cstd_Name                                   string    comment'托管人'
    ,Ivst_Type_WD                                string    comment'投资类型_万得'
    ,Setp_Date                                   string    comment'成立日期'
    ,Exp_Date                                    string    comment'到期日期'
    ,Issue_Scal                                  string    comment'发行规模（份）'
    ,Last_Scal                                   string    comment'最新规模（份）'
    ,List_Scal                                   string    comment'上市时规模（元）'
    ,f_List_Scal                                 string    comment'首次上市规模（元）'  
    ,mgnt_fee_rate                               string    comment'管理费'
    ,Cstd_fee_rate                               string    comment'托管费'
    ,Crrc_Cd                                     string    comment'货币代码'
    ,Cont_Date                                   string    comment'存续期'
    ,Org_Ivst_Scrp_begain_Date                   string    comment'机构投资者认购起始日'
    ,issue_ins_Exp_Date                          string    comment'机构投资者认购终止日'
    ,Par_val                                     string    comment'面值'
    ,Trust_Type                                  string    comment'信托类别'
    ,Csnr                                        string    comment'受托人'
    ,Purch_Begn_Date                             string    comment'日常申购起始日'
    ,Redem_Begn_Date                             string    comment'日常赎回起始日'
    ,Ori_Amt                                     string    comment'起点金额'
    ,Expe_Ror                                    string    comment'预期收益率'
    ,Issue_Place                                 string    comment'发行地'
    ,Perf_Compr_Bm                               string    comment'业绩比较基准'
    ,Cont_Stat                                   string    comment'存续状态'
    ,Lmt_Type                                    string    comment'限定类型'
    ,Stru_Prd_Flag                               string    comment'是否结构化产品'
    ,mkt_cd                                      string    comment'交易所'
    ,Ivst_Feat                                   string    comment'投资风格'
    ,Issue_Date                                  string    comment'发行日期'
    ,Fnd_Type_WD                                 string    comment'基金类型_万得'
    ,Ori_Fnd_Flag                                string    comment'是否为初始基金'
    ,abbr_pinyin                                 string    comment'简称拼音'
    ,Ivst_Domain                                 string    comment'投资范围'
    ,Ivst_Tgt                                    string    comment'投资目标'
    ,Ivst_Sys                                    string    comment'投资理念'
    ,Rely_on                                     string    comment'决策依据'
    ,delist_Date                                 string    comment'退市日期'
    ,Sngl_Ivstr_Hold_Up                          string    comment'单一投资者持有份额上限(亿份)'
    ,Clos_Tgt_Up                                 string    comment'封闭期目标募集数量上限(亿份)'
    ,Ivst_Strg                                   string    comment'投资策略'
    ,Fnd_Risk_Yield_Feat                         string    comment'基金风险收益特征'
    ,Low_Purch_Am_Outter                         string    comment'每次最低申购金额(场外)(万元)'
    ,Low_Purch_Am_Inner                          string    comment'每次最低申购金额(场内) (万元)'
    ,List_Time                                   string    comment'上市时间'
    ,ann_Date                                    string    comment'公告日期'
    ,Clos_Oper_Date                              string    comment'封闭运作期'
    ,Clos_Oper_Act_Intrv                         string    comment'封闭运作期满开放日间隔'
    ,Fnd_Reg_Cd                                  string    comment'基金注册与过户登记人id'
    ,Indv_Ivstr_Scrp_Begn_Val_Date               string    comment'个人投资者认购起始日'
    ,Indv_Ivstr_Scrp_Trmt_Val_Date               string    comment'个人投资者认购终止日'
    ,Fnd_Var_Cd                                  string    comment'基金品种id'
    ,Sale_Fare                                   string    comment'销售服务费率'
    ,Ivst_Loc                                    string    comment'投资区域'
    ,Clos_Date_Org_Ivstr_Down                    string    comment'封闭期机构投资者认购下限(万元)'
    ,Clos_Dura_Org_Ivstr_Up                      string    comment'封闭期机构投资者认购上限(万元)'
    ,Isin_cd                                     string    comment'Isin_cd代码'
    ,Prft_Fnd_Flag                               string    comment'是否是保本基金'
    ,QDII_Flag                                   string    comment'是否qdii'
    ,Exch_Deal_Flag                              string    comment'是否在交易所交易'
    ,Ext_Purch_Redem_Flag                        string    comment'是否可在场外申购赎回'
    ,Vir_Fnd_Flag                                string    comment'是否是虚拟基金'
    ,Purch_Stat                                  string    comment'申购状态'
    ,Redem_Stat                                  string    comment'赎回状态'
    ,Fnd_Ivst_Type_Df                            string    comment'基金投资类型_自定义'
    ,Fnd_Ivst_Type_BG                            string    comment'基金投资类型_贝格'
    ,Ivst_Strgyl_bd                              string    comment'基金投资风格（贝格）'
    ,Now_General_Mag                             string    comment'现任基金经理'
    ,Ytd_Fnd_General_Mag                         string    comment'历史基金经理'
    ,Earn_Type                                   string    comment'收益类型'
    ,Ivst_Strgyl_com                             string    comment'自定义投资风格_贝格'
    ,Clos_Type                                   string    comment'封闭期类型'
    ,Fnd_Oth_Nature                              string    comment'基金其他属性'
    ,Fnd_Oper_Pd                                 string    comment'基金运作周期'
    ,Shr_Turn_Date                               string    comment'份额结转日'
    ,Shr_Turn_Date_Type                          string    comment'份额结转日类型'
    ,Max_Ext_Purch_charge                        string    comment'最大前端申购费率'
    ,Ivst_Perp                                   string    comment'投资地'
    ,Fnd_Type_Cd_TX                              string    comment'天相基金类型id'
    ,Fnd_Type_TX                                 string    comment'天相基金类型'
    ,Fnd_Feat_CD_TX                              string    comment'天相基金风格代码'
    ,Fnd_Feat_TX                                 string    comment'天相基金风格'
    ,Fnd_Feat_CD_TX4                             string    comment'天相基金风格代码(四级分类)'
    ,Fnd_Feat_TX4                                string    comment'天相基金风格名称(四级分类)'
    ,Fnd_Sort_Ind_TX                             string    comment'天相基金分类标识'
    ,Fnd_Clas_intro_TX                           string    comment'天相基金分类说明'
    ,Ip_Fnd_Flag                                 string    comment'是否联接基金'
    ,Ip_Fnd_Tgt_Cd                               string    comment'联接基金目标etf基金代码'
    ,Ori_Launch_Flag                             string    comment'是否发起式基金'
    ,Idx_fnd_flag                                string    comment'是否指数基金'
    ,Fnd_Fnd_Same_Idx_Cd                         string    comment'etf基金对应指数代码'
    ,Vir_Fnd_Flagtual                            string    comment'是否虚拟母基金'
    ,Pri_Fnd_Cd                                  string    comment'父基金id'
    ,Quan_Fnd_Flag                               string    comment'是否为量化基金' 
    ,Rai_Term                                    string    comment '设立募集期(月)'
    ,Vldt_Purch_Amt                              string    comment '总有效申购户数'
    ,src_tbl                                     string    comment'来源表'
    ,src_rec_id                                  string    comment'来源记录'
    ,rec_upd_time                                string    comment'记录修改时间'
    ,rec_down_time                               string    comment'记录创建时间'    
) comment '基金基础信息表'
partitioned by (src_id string comment '来源标识')
stored as ORC
;

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
insert overwrite table t02_fnd_base_info partition (src_id = 'TL')
-- TL 数据
select
 '${data_day_str}'                                         as busi_date                     -- 数据日期
,a.id                                                           as rec_id                        -- 记录编号
,c.secu_id                                                      as secu_id                       -- 统一证券编号
,c.src_sys_prdno                                                as src_sys_prdno                 -- 源系统产品编号
,b.ticker_symbol                                                as scr_cd                        -- 交易代码
,b.ticker_symbol_f                                              as frnt_cd                       -- 前端代码
,b.ticker_symbol_b                                              as bk_cd                         -- 后端代码
,a.sec_full_name                                                as full_name                     -- 名称
,a.sec_short_name                                               as abbr_name                     -- 简称
,d.corp_id                                                      as mgmt_corp_cd                  -- 基金管理公司编码
,e.party_full_name                                              as mng_prtc                      -- 管理人
,f.corp_id                                                      as cstd_id                       -- 基金托管人编码
,g.party_full_name                                              as cstd_name                     -- 托管人
,''                                                             as ivst_type_wd                  -- 投资类型_万得
,default.date2datekey(a.establish_date)                         as setp_date                     -- 成立日期
,''                                                             as exp_date                      -- 到期日期
,h.total_share                                                  as issue_scal                    -- 发行规模（份）
,''                                                             as last_scal                     -- 最新规模（份）
,''                                                             as list_scal                     -- 上市时规模（元）
,''                                                             as f_list_scal                   -- 首次上市规模（元）
,i.min_char_rate                                                as mgnt_fee_rate                 -- 管理费
,j.min_char_rate                                                as cstd_fee_rate                 -- 托管费
,''                                                             as crrc_cd                       -- 货币代码
,''                                                             as cont_date                     -- 存续期
,''                                                             as org_ivst_scrp_begain_date     -- 机构投资者认购起始日
,''                                                             as issue_ins_exp_date            -- 机构投资者认购终止日
,h.par_val                                                      as par_val                       -- 面值
,''                                                             as trust_type                    -- 信托类别
,''                                                             as csnr                          -- 受托人
,default.date2datekey(h.app_open_date)                          as purch_begn_date               -- 日常申购起始日
,default.date2datekey(h.red_open_date)                          as redem_begn_date               -- 日常赎回起始日
,''                                                             as ori_amt                       -- 起点金额
,''                                                             as expe_ror                      -- 预期收益率
,''                                                             as issue_place                   -- 发行地
,a.perf_benchmark                                               as perf_compr_bm                 -- 业绩比较基准
,  case     when b.CLASS_STATUS = 'A' then '1'    --有效
            when b.CLASS_STATUS = 'E' then '3'    --到期
            when b.CLASS_STATUS IS NULL then '5'  --未上市
            end                                                 as Cont_Stat                     -- 存续状态
,''                                                             as lmt_type                      -- 限定类型
,''                                                             as stru_prd_flag                 -- 是否结构化产品
,l.const_cd                                                     as mkt_cd                        -- 交易所
,case a.category when 'B' then '债券型'
                 when 'E' then '股票型'
                 when 'H' then '混合型'
                 when 'M' then '货币型'
                 when 'O' then '其他'
                 when 'SB' then '短期理财债券型' end            as ivst_feat                     -- 投资风格
,default.date2datekey(h.iss_start_date)                         as issue_date                    -- 发行日期
,''                                                             as fnd_type_wd                   -- 基金类型_万得
,''                                                             as ori_fnd_flag                  -- 是否为初始基金
,''                                                             as abbr_pinyin                   -- 简称拼音
,a.invest_field                                                 as ivst_domain                   -- 投资范围
,a.invest_target                                                as ivst_tgt                      -- 投资目标
,a.invest_idea                                                  as ivst_sys                      -- 投资理念
,''                                                             as rely_on                       -- 决策依据
,''                                                             as delist_date                   -- 退市日期
,''                                                             as sngl_ivstr_hold_up            -- 单一投资者持有份额上限
,''                                                             as clos_tgt_up                   -- 封闭期目标募集数量上限
,a.invest_strategy                                              as ivst_strg                     -- 投资策略
,a.risk_yield_desc                                              as fnd_risk_yield_feat           -- 基金风险收益特征
,''                                                             as low_purch_am_outter           -- 每次最低申购金额(场外)(万元)
,''                                                             as low_purch_am_inner            -- 每次最低申购金额(场内)(万元)
,default.date2datekey(h.list_date)                              as list_time                     -- 上市时间
,''                                                             as ann_date                      -- 公告日期
,''                                                             as clos_oper_date                -- 封闭运作期
,''                                                             as clos_oper_act_intrv           -- 封闭运作期满开放日间隔
,''                                                             as fnd_reg_cd                    -- 基金注册与过户登记人id
,''                                                             as indv_ivstr_scrp_begn_val_date -- 个人投资者认购起始日
,''                                                             as indv_ivstr_scrp_trmt_val_date -- 个人投资者认购终止日
,''                                                             as fnd_var_cd                    -- 基金品种id
,''                                                             as sale_fare                     -- 销售服务费率
,''                                                             as ivst_loc                      -- 投资区域
,''                                                             as clos_date_org_ivstr_down      -- 封闭期机构投资者认购下限(万元)
,''                                                             as clos_dura_org_ivstr_up        -- 封闭期机构投资者认购上限(万元)
,''                                                             as isin_cd                       -- Isin_cd代码
,''                                                             as prft_fnd_flag                 -- 是否是保本基金
,a.is_qdii                                                      as qdii_flag                     -- 是否qdii
,''                                                             as exch_deal_flag                -- 是否在交易所交易
,''                                                             as ext_purch_redem_flag          -- 是否可在场外申购赎回
,''                                                             as vir_fnd_flag                  -- 是否是虚拟基金
,''                                                             as purch_stat                    -- 申购状态
,''                                                             as redem_stat                    -- 赎回状态
,''                                                             as fnd_ivst_type_df              -- 基金投资类型_自定义
,''                                                             as fnd_ivst_type_bg              -- 基金投资类型_贝格
,''                                                             as ivst_strgyl_bd                -- 基金投资风格（贝格）
,''                                                             as now_general_mag               -- 现任基金经理
,''                                                             as ytd_fnd_general_mag           -- 历史基金经理
,''                                                             as earn_type                     -- 收益类型
,''                                                             as ivst_strgyl_com               -- 自定义投资风格_贝格
,''                                                             as clos_type                     -- 封闭期类型
,''                                                             as fnd_oth_nature                -- 基金其他属性
,''                                                             as fnd_oper_pd                   -- 基金运作周期
,''                                                             as shr_turn_date                 -- 份额结转日
,''                                                             as shr_turn_date_type            -- 份额结转日类型
,''                                                             as max_ext_purch_charge          -- 最大前端申购费率
,''                                                             as ivst_perp                     -- 投资地
,''                                                             as fnd_type_cd_tx                -- 天相基金类型id
,''                                                             as fnd_type_tx                   -- 天相基金类型
,''                                                             as fnd_feat_cd_tx                -- 天相基金风格代码
,''                                                             as fnd_feat_tx                   -- 天相基金风格
,''                                                             as fnd_feat_cd_tx4               -- 天相基金风格代码(四级分类)
,''                                                             as fnd_feat_tx4                  -- 天相基金风格名称(四级分类)
,''                                                             as fnd_sort_ind_tx               -- 天相基金分类标识
,''                                                             as fnd_clas_intro_tx             -- 天相基金分类说明
,''                                                             as ip_fnd_flag                   -- 是否联接基金
,''                                                             as ip_fnd_tgt_cd                 -- 联接基金目标etf基金代码
,''                                                             as ori_launch_flag               -- 是否发起式基金
,''                                                             as idx_fnd_flag                  -- 是否指数基金
,''                                                             as fnd_fnd_same_idx_cd           -- etf基金对应指数代码
,''                                                             as vir_fnd_flagtual              -- 是否虚拟母基金
,''                                                             as pri_fnd_cd                    -- 父基金id
,''                                                             as quan_fnd_flag                 -- 是否为量化基金
,''                                                             as rai_term                      -- 设立募集期(月)
,h.v_app_accts_total                                            as vldt_purch_amt                -- 总有效申购户数
,'odata_n_uip.q_fund'                                           as src_tbl                       -- 来源表
,a.id                                                           as src_rec_id                    -- 来源记录
,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')         as rec_upd_time                  -- 记录修改时间
,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')         as rec_down_time                 -- 记录创建时间
from (select * from odata_n_uip.q_fund where busi_date = '${data_day_str}') a
left join (select * from odata_n_uip.q_fund_class where busi_date = '${data_day_str}') b
on a.fund_id = b.fund_id
left join (select * from t02_scr_base_info where src_id = 'TL') c
on b.security_id = c.in_code
left join (select * from t02_co_base_info where src_id = 'TL') d
on a.management_company = d.src_corp_id
left join (select * from odata_n_uip.q_md_institution where busi_date = '${data_day_str}') e
on a.management_company = e.party_id
left join (select * from t02_co_base_info where src_id = 'TL') f
on a.custodian = f.src_corp_id
left join (select * from odata_n_uip.q_md_institution where busi_date = '${data_day_str}') g
on a.custodian = g.party_id
left join odata_n_uip.q_fund_issue h
on b.security_id = h.security_id
left join (select * ,row_number()over(partition by security_id order by BEGIN_DATE desc) rn from odata_n_uip.q_fund_fee where charge_type = '15') i
on b.security_id = i.security_id and i.rn=1
left join (select *,row_number()over(partition by security_id order by BEGIN_DATE desc) rn from odata_n_uip.q_fund_fee where charge_type = '16') j
on b.security_id = j.security_id and j.rn=1
left join (select * from odata_n_uip.q_md_security where busi_date = '${data_day_str}') k
on b.security_id = k.security_id
left join (select * from t02_pub_covt_const where const_type_cd='chn00001' and src_id = 'TL') l
on k.exchange_cd = l.src_const_cd

;
