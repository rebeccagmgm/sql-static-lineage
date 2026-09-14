-- task_id: 61490
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_rd_base_info_RMS
-- observed_at: 2026-09-05T01:06:18.808Z

-- createSql
create table if not exists t02_rd_base_info
(  
     busi_date             string comment '业务日期'
    ,secu_id               string comment '统一产品编号'
    ,src_sys_prdno         string comment '源系统产品编号'
    ,rpt_id                string comment '研报ID'
    ,summary               string comment '报告摘要'
    ,sms_cont              string comment '报告短信内容'
    ,wrt_time              string comment '报告编写时间'
    ,subm_time             string comment '报告提交时间'
    ,rpt_inpt_time         string comment '报告入库时间'
    ,corp_id               string comment '撰写机构代码'
    ,corp_name             string comment '撰写机构名称'
    ,pub_date              string comment '发布日期'
    ,rpt_type_cd           string comment '报告类型ID'
    ,send_flag             string comment '是否发送'
    ,basi_year             string comment '预测基准年'
    ,read_times            string comment '阅读次数'
    ,rat_type              string comment '评级类型'
    ,bond_type             string comment '债券类型'
    ,rat_val               string comment '评级值'
    ,author_name           string comment '作者名称'
    ,title                 string comment '报告标题'
    ,scd_title             string comment '报告副标题'
    ,rpt_subm_psn_id       string comment '报告提交人ID'
    ,keyword               string comment '关键字'
    ,rtp_stat              string comment '报告状态'
    ,rpt_ver_no            string comment '报告版本号'
    ,secret                string comment '报告密级'
    ,rpt_imp_lvl           string comment '报告重要程度'
    ,att_flag              string comment '附件标识'
    ,rpt_cmnt_flag         string comment '报告评论标识'
    ,create_time           string comment '创建时间戳'
    ,upd_time              string comment '更新时间戳'
    ,version               string comment '乐观锁'
    ,enty_name             string comment '实体名称'
    ,sms_context           string comment 'smscontext'
    ,scodeinfo             string comment '股票信息'
    ,summary_explain       string comment '内容修改说明'
    ,rpt_tplt_id           string comment '报告解析模板id'
    ,doc_words             string comment '报告字数'
    ,sms_team              string comment '团队'
    ,sms_researcher        string comment '研究员'
    ,delay_send_time       string comment '入库延时发送时间'
    ,elite                 string comment '报告精华'
    ,summary_last          string comment '原文'
    ,scodeindo             string comment 'scodeindo'
    ,send_rslt             string comment '外发结果'
    ,ind_righ_flag         string comment '独立权限标识'
    ,pri_rpt               string comment '关键报告'
    ,pub_no                string comment '是否发送到公众号'
    ,en_rpt_flag           string comment '是否为英文报告'
    ,rela_rpt_id           string comment '关联中文或者英文报告id'
    ,exptn_flag            string comment '是否豁免批准'
    ,exptn_link            string comment '豁免批准链接'
    ,send_way              string comment '报告推送形式'
    ,unlistedreport        string comment '未上市公司'
    ,equi_disc             string comment '权益披露数据'
    ,pri_rpt_msg           string comment '关键报告原因'
    ,pri_rpt_modif_remark  string comment '关键报告修改说明'
    ,oversea_his           string comment '海外历史报告字段'
    ,wechat_title          string comment '微信分享标题'
    ,redirect_rptid        string comment '全文翻译报告id'
    ,rpt_big_clas          string comment '报告大类'
    ,obj_cd                string comment '报告涉及对象'
    ,area_cd               string comment '区域'
    ,exch_type_cd          string comment '交易场所编码'
    ,lang_type             string comment '语言类别'
    ,is_wtr_mark           string comment '是否有水印'
    ,sect_cd               string comment '主题板块编码'
    ,subj_cd               string comment '专题系列'
    ,remark                string comment '备注'
    ,src_tbl               string comment '来源表'
    ,src_rec_id            string comment '来源记录'
    ,rec_upd_time          string comment '记录修改时间'
    ,rec_down_time         string comment '记录创建时间'
    ,rpt_date              string comment '报告日期'  --20230309新增字段
    ,rpt_page              string comment '页码数量'   --2023-10-25 新增字段
    ,del_flag              string comment  '删除标识(1是0否)' --2023-11-13 新增字段
    ,dpth_rpt_flag         string comment '是否深度研报(1是0否)'      --20241208 新增字段
)
comment '研报基本信息'
partitioned by (src_id string comment '来源标识')
stored as orc
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

insert overwrite table t02_rd_base_info partition (src_id = 'RMS')

select  
     '${data_day_str}'                     as busi_date                    -- 业务日期    
     ,concat('RRT.100000001.',a.objid,'.99')    as secu_id                      -- 统一产品编号
     ,concat('RMS-',a.objid)                    as src_sys_prdno                -- 源系统产品编号        
     ,a.objid                                   as rpt_id                       -- 研报ID
     ,a.summary                                 as summary                      -- 报告摘要
     ,a.smscontent                              as sms_cont                     -- 报告短信内容
     ,a.writetime                               as wrt_time                     -- 报告编写时间
     ,a.submittime                              as subm_time                    -- 报告提交时间    
     ,a.archivetime                             as rpt_inpt_time                -- 报告入库时间        
     ,''                                        as corp_id                      -- 撰写机构代码
     ,''                                        as corp_name                    -- 撰写机构名称    
     ,''                                        as pub_date                     -- 发布日期
     ,a.reporttypeid                            as rpt_type_cd                  -- 报告类型ID    
     ,a.sendflag                                as send_flag                    -- 是否发送    
     ,a.yeare                                   as basi_year                    -- 预测基准年    
     ,a.readcount                               as read_times                   -- 阅读次数    
     ,a.ratingtype                              as rat_type                     -- 评级类型
     ,a.bondtype                                as bond_type                    -- 债券类型    
     ,a.ratingvalue                             as rat_val                      -- 评级值
     ,a.authornames                             as author_name                  -- 作者名称    
     ,a.title                                   as title                        -- 报告标题
     ,a.secondtitle                             as scd_title                    -- 报告副标题    
     ,a.inputid                                 as rpt_subm_psn_id              -- 报告提交人ID        
     ,a.keyword                                 as keyword                      -- 关键字
     ,a.status                                  as rtp_stat                     -- 报告状态
     ,a.docversion                              as rpt_ver_no                   -- 报告版本号    
     ,a.secret                                  as secret                       -- 报告密级
     ,a.importance                              as rpt_imp_lvl                  -- 报告重要程度    
     ,a.attachmentflag                          as att_flag                     -- 附件标识
     ,a.commentflag                             as rpt_cmnt_flag                -- 报告评论标识        
     ,a.createtimestamp                         as create_time                  -- 创建时间戳    
     ,a.updatetimestamp                         as upd_time                     -- 更新时间戳
     ,a.version                                 as version                      -- 乐观锁
     ,a.entityname                              as enty_name                    -- 实体名称    
     ,a.smscontext                              as sms_context                  -- smscontext    
     ,a.scodeinfo                               as scodeinfo                    -- 股票信息    
     ,a.summary_explain                         as summary_explain              -- 内容修改说明        
     ,a.reporttypetemplateid                    as rpt_tplt_id                  -- 报告解析模板id    
     ,a.docwords                                as doc_words                    -- 报告字数    
     ,a.smsteam                                 as sms_team                     -- 团队
     ,a.smsresearcher                           as sms_researcher               -- 研究员        
     ,a.delayedsendtime                         as delay_send_time              -- 入库延时发送时间        
     ,a.elite                                   as elite                        -- 报告精华
     ,a.summary_last                            as summary_last                 -- 原文    
     ,a.scodeindo                               as scodeindo                    -- scodeindo    
     ,a.sendresult                              as send_rslt                    -- 外发结果    
     ,a.independentpower                        as ind_righ_flag                -- 独立权限标识        
     ,a.keyreport                               as pri_rpt                      -- 关键报告
     ,a.publicnumber                            as pub_no                       -- 是否发送到公众号
     ,a.englishreportflag                       as en_rpt_flag                  -- 是否为英文报告    
     ,a.relationrptid                           as rela_rpt_id                  -- 关联中文或者英文报告id    
     ,a.exemptionflag                           as exptn_flag                   -- 是否豁免批准    
     ,a.exemptionlink                           as exptn_link                   -- 豁免批准链接    
     ,a.sendstyle                               as send_way                     -- 报告推送形式
     ,a.unlistedreport                          as unlistedreport               -- 未上市公司        
     ,a.disclosure                              as equi_disc                    -- 权益披露数据    
     ,a.keyreportmsg                            as pri_rpt_msg                  -- 关键报告原因    
     ,a.keyreportstatusremark                   as pri_rpt_modif_remark         -- 关键报告修改说明            
     ,a.overseahis                              as oversea_his                  -- 海外历史报告字段    
     ,a.wxtitle                                 as wechat_title                 -- 微信分享标题    
     ,a.redirect_rptid                          as redirect_rptid               -- 全文翻译报告id        
     ,a.bigclass                                as rpt_big_clas                 -- 报告大类    
     ,''                                        as obj_cd                       -- 报告涉及对象
     ,''                                        as area_cd                      -- 区域
     ,''                                        as exch_type_cd                 -- 交易场所编码    
     ,''                                        as lang_type                    -- 语言类别    
     ,''                                        as is_wtr_mark                  -- 是否有水印    
     ,''                                        as sect_cd                      -- 主题板块编码
     ,''                                        as subj_cd                      -- 专题系列
     ,concat('{\\"orgname\\":\\"',d.orgname,'\\"}')          as remark                       -- 备注   --2025-08-18新增字段
     --,'odata_rd.rd_ir_report'                 as src_tbl                      
     ,'odata_n_rms.n_ir_report'                 as src_tbl                      -- 来源表
     ,a.objid                                   as src_rec_id                   -- 来源记录
     ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')    as rec_upd_tm
     ,from_unixtime(unix_timestamp(), 'yyyy-MM-dd HH:mm:ss')    as rec_down_tm
     ,default.date2datekey(b.value)             as rpt_date   --20230309新增字段
     ,c.pagecount                                        as rpt_page     -- 页码数量     --2023-10-25 新增字段
     ,''                                        as del_flag     -- 删除标识 2023-11-13 新增字段 by wxxuguib
     ,a.indepth                                 as  dpth_rpt_flag    -- 是否深度研报(1是0否)       20241208 新增字段 
from ( select * from odata_n_rms.n_ir_report where busi_date = '${data_day_str}' ) a 
left join 
(select * from odata_n_rms.n_sirm_entitysetting where busi_date = '${data_day_str}' and name = 'reportdate') b 
on a.objid=b.sourceid

left join (select * from 
            (select * ,row_number() over(partition by sourceid   order by objid desc  ) as rn
                from odata_n_rms.n_sirm_attachment
                where  filetype='pdf' 
                and type not in ('1','4') 
                and convertstatus='1' 
                and sourceentity='REPORT'
            ) t where rn=1         
          )  c 
on a.objid  = c.sourceid
left join (    -- 新增提交人
select orgid,orgname from odata_n_rms.n_sprt_orgobject where busi_date='${data_day_str}'
)d
on a.inputid = d.orgid


;
