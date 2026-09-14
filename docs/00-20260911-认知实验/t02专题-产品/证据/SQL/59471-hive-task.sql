-- task_id: 59471
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_co_base_info_WD_kxc
-- observed_at: 2026-09-05T01:06:18.559Z

-- createSql
create table if not exists t02_co_base_info(
   busi_date          string    comment'数据日期',
   rec_id             string    comment'记录编号',
   Corp_Id            string    comment'企业ID',
   src_sys_prdno      string    comment'源系统产品编码',
   src_corp_id         string    comment'源企业ID',
   Corp_Name           string    comment'企业名称',
   Zh_Shor              string    comment'中文简称',
   En_Name           string    comment'英文名称',
   En_Shor            string    comment'英文简称',
   Lcrrc_Cd          string    comment'货币代码',
   Corp_City          string    comment'办公城市',
   Corp_City_Cd          string    comment'办公城市代码',
   Corp_Addr           string    comment'办公地址',
   Corp_Prov          string    comment'办公省份',
   Corp_Prov_Cd          string    comment'办公省份代码',
   Rep           string    comment'法人代表',
   Setp_Date           string    comment'成立日期',
   Fax                string    comment'传真',
   Lkman_Tel                string    comment'联系电话',
   Email              string    comment'电子邮箱',
   Corp_Econ_Prop          string    comment'企业经济性质',
   USCC            string    comment'统一社会信用代码',
   Corp_Prop          string    comment'企业性质',
   Web           string    comment'网址',
   Canc_Time            string    comment'注销时间',
   Reg_Nationality       string    comment'注册国家',
   Reg_Cty_Cd       string    comment'注册国家代码',
   svc_Lkman_Tel            string    comment'客服电话',
   Zip               string    comment'邮政编码',
   Emp_Tot      string    comment'员工总数(人)',
   Reg_Addr           string    comment'注册地址',
   Reg_Cptl           string    comment'注册资本',
   General_Mag                 string    comment'总经理',
   Corp_Intro           string    comment'公司简介',
   Corp_Clas_cd      string comment '工商行政管理总局规定的企业类型代码',  -- 20210702 yuankh 增加列
   Corp_Clas           string    comment'工商行政管理总局规定的企业类型',  --20210702 yuankh 修改comment
   Corp_Clas_src      string    comment'企业类型_源信息',-- 20210716 yuankh 增加列
   Reg_City           string    comment'注册城市',
   Reg_Prov           string    comment'注册省市',
   Canc_Pr          string    comment'注销说明',
   Canc_Fctr           string    comment'注销原因',
   Host_Prd_Busi      string    comment'主要产品及业务',
   Grp_Org_Cd           string    comment'组织机构代码',
   Board_sectry          string    comment'董事会秘书',
   Icbc_Jour_No        string    comment'工商登记号',
   Is_exit_cd           string    comment'企业经营状态代码', --20210712 yuankh 修改comment
   Is_exit           string    comment'企业经营状态中文', --20210702 yuankh 修改comment
   Is_exit_src       string  comment'企业经营状态_源信息', -- 20210702 yuankh 增加列
   Is_List          string    comment'是否上市公司',
   Bat_Reg_Jour       string    comment'首次注册登记日',
   Tax_Jour_No        string    comment'税务登记号',
   Last_Co_Id         string    comment'新公司编码',
   Chg_Reg_Jour         string    comment'变更注册登记日',
   Info_Disc_Lp          string    comment'信息披露人',
   Reg_No              string    comment'注册号',
   Subor_Corp_Host_Id            string    comment'隶属企业主体身份代码',
   Indt_Clas        string    comment'行业门类',
   Indt_Cd         string    comment'行业代码',
   Indt_Clas_Zh   string    comment'行业门类中文字段',
   Indt_Cd_Zh    string    comment'行业代码中文字段',
   Econ_Term_Begn             string    comment'经营(驻在)期限自',
   Econ_Term_End               string    comment'经营(驻在)期限至',
   Chk_Date           string    comment'核准日期',
   Paid_In_Cptl             string    comment'实收资本',
   Reg_Org_Zh        string    comment'登记机关中文',
   county      string    comment'县',
   Clos_Date            string    comment'吊销日期',
    Bel_org_cd string	comment'登记机关区域代码',     -- 20210702 yuankh 增加列
    Bel_org_ch string	comment'登记机关区域中文',     -- 20210702 yuankh 增加列
    Cate_qx string		comment'企业分类_启信宝',     -- 20210702 yuankh 增加列
    Cate_new_qx string		comment'企业分类_新_启信宝',     -- 20210702 yuankh 增加列
    econ_kind_cd string		comment'企业类型_启信宝',     -- 20210702 yuankh 增加列
    Cred_area_cd string		comment'社会信用代码区域代码',     -- 20210702 yuankh 增加列
    Dept string		comment'社会组织业务主管单位',     -- 20210702 yuankh 增加列
    Dist_cd string		comment'最优区域码',     -- 20210702 yuankh 增加列
    Grp_abbr string		comment'集团简称',     -- 20210702 yuankh 增加列
    Grp_name string		comment'集团名称',     -- 20210702 yuankh 增加列
    bd_lati string		comment'百度纬度',     -- 20210702 yuankh 增加列
    bd_longitu string		comment'百度经度',     -- 20210702 yuankh 增加列
    gd_lati string		comment'高德纬度',     -- 20210702 yuankh 增加列
    gd_longitu string		comment'高德经度',     -- 20210702 yuankh 增加列
    logo_url string		comment'公司logo',     -- 20210702 yuankh 增加列
    oper_name_id_qx string		comment'启信宝法定代表人ID',     -- 20210702 yuankh 增加列
    oper_type string		comment'法定代表人类型',     -- 20210702 yuankh 增加列
    org_type_qx string		comment'社会组织类型标签_启信宝,内部字段，"0"学校 "1"医院 ',     -- 20210702 yuankh 增加列
    clos_Rsn string		comment'吊销原因',     -- 20210702 yuankh 增加列
    clos_Cert string		comment'吊销凭证',     -- 20210702 yuankh 增加列
    Indc_url string		comment'工商快照信息url',     -- 20210702 yuankh 增加列
    corp_type_qx string		comment'企业一级分类_启信宝',     -- 20210702 yuankh 增加列
    Rep_title string		comment'公司代表人职务',     -- 20210702 yuankh 增加列   
   src_tbl            string    comment'来源表',
   src_rec_id         string    comment'来源记录',
   Remark             string    comment'备注',
   rec_upd_time         string    comment'记录修改时间',
   rec_down_time        string    comment'记录创建时间'
)
partitioned by (src_id string comment'数据来源')
stored as ORC;
;

-- querySql
set hive.support.concurrency=false;
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

insert overwrite table t02_co_base_info partition(src_id='WD')
select 
   '${data_day_str}' as busi_date,
   object_id     as   rec_id,
   case when a.registernumber is not null and regexp_replace(a.registernumber,' ', '') <>'' then a.registernumber else a.comp_id end as   Corp_Id,
   concat('WD-',a.comp_id)  as src_sys_prdno,--'源系统产品编码'
   a.comp_id     as   src_corp_id, --源企业ID
   comp_name     as   Corp_Name, --'企业名称'
   comp_sname    as   Zh_Shor, --'中文简称'
   comp_name_eng as   En_Name, --'英文名称'
   comp_snameeng  as  En_Shor, --'英文简称'
   b.const_cd     as  Lcrrc_Cd, --'货币代码'
   city           as  Corp_City, --'办公城市'
   c.const_cd     as  Corp_City_Cd, --'办公城市代码'
   office         as  Corp_Addr,--'办公地址'
   province       as  Corp_Prov, --'办公省份'
   d.const_cd     as  Corp_Prov_Cd,  --'办公省份代码'
   chairman       as  Rep, --'法人代表'
   case when length(founddate) = 8 then  from_unixtime( unix_timestamp(founddate, 'yyyyMMdd'), 'yyyy-MM-dd')    
        when length(founddate) = 6 then  from_unixtime( unix_timestamp(founddate, 'yyyyMM'), 'yyyy-MM')
    else null end as  Setp_Date,--'成立日期',
   fax            as  Fax,--'传真'
   phone          as  Lkman_Tel,--'联系电话'
   email          as  Email,--'电子邮箱'
   comp_property  as  Corp_Econ_Prop,--'企业经济性质'
   registernumber as  USCC,--'统一社会信用代码'
   case when e.const_cd is null then e2.const_cd else e.const_cd end as  Corp_Prop,--'企业性质'
   --s_info_comptype  as Corp_Prop,--'企业性质'
   website        as  Web,--'网址'
    case when length(enddate) = 8 then  from_unixtime( unix_timestamp(enddate, 'yyyyMMdd'), 'yyyy-MM-dd')    
         when length(enddate) = 6 then  from_unixtime( unix_timestamp(enddate, 'yyyyMM'), 'yyyy-MM')
    else null end      as  Canc_Time,--'注销时间'
   country        as  Reg_Nationality, --'注册国家'
   f.const_cd     as  Reg_Cty_Cd,--'注册国家代码'
   ''             as  svc_Lkman_Tel,--'客服电话'
   zipcode        as  Zip,--'邮政编码'
   s_info_totalemployees   as   Emp_Tot,--'员工总数(人)'
   address        as  Reg_Addr,--'注册地址'
   regcapital     as  Reg_Cptl,--'注册资本'
   president      as  General_Mag,--'总经理'
   briefing       as  Corp_Intro,--'公司简介'
   ''             as  Corp_Clas_code,      -- '工商行政管理总局规定的企业类型代码'
   ''   as  Corp_Clas,--'公司类别'   --为国家工商行政管理总局规定的市场主体登记注册类型的代码。遵守标准为：中华人民共和国工商行政管理行业标准GS 14——2014，CA16 市场主体类型代码, WD该表无此数据
   a.company_type as  Corp_Clas_src,  --企业类型_源信息(万得自定义的用来识别公司类别的编码: 1一般,2金融公司,3基金)  20230823 wxxuguib 补充数据
   ''             as  Reg_City, --'注册城市'
   ''             as  Reg_Prov,--'注册省市'
   ''             as  Canc_Pr,--'注销说明'
   ''             as  Canc_Fctr,--'注销原因'
   businessscope  as  Host_Prd_Busi,--'主要产品及业务'
   s_info_org_code   as   Grp_Org_Cd,--'组织机构代码'
   ''             as  Board_sectry,--'董事会秘书'
   ''             as  Icbc_Jour_No,--'工商登记号'
   ''             as  is_exit_cd, --企业经营状态代码
   ''             as  Is_exit,--'企业经营状态' --统一枚举标准， 遵守标准为：中华人民共和国工商行政管理行业标准GS 14——2014CA19登记状态代码版本:V1.2,说明:市场主体的经营状态代码。WD该表无此数据
   ''             as  Is_exit_src,   ---企业经营状态_源信息
   is_listed      as  Is_List,--'是否上市公司'
   ''             as  Bat_Reg_Jour,--'首次注册登记日'
   ''             as  Tax_Jour_No,--'税务登记号'
   ''             as  Last_Co_Id,--'新公司编码'
   ''             as  Chg_Reg_Jour,--'变更注册登记日'
   discloser      as  Info_Disc_Lp,--'信息披露人'
   ''             as  Reg_No,--'注册号'
   ''             as  Subor_Corp_Host_Id,--'隶属企业主体身份代码'
   ''             as  Indt_Clas,--'行业门类'
   ''             as  Indt_Cd,--'行业代码'
   ''             as  Indt_Clas_Zh,--'行业门类中文字段'
   ''             as  Indt_Cd_Zh,--'行业代码中文字段'
   ''             as  Econ_Term_Begn,--'经营(驻在)期限自'
   ''             as  Econ_Term_End,--'经营(驻在)期限至'
   ''             as  Chk_Date,--'核准日期'
   ''             as  Paid_In_Cptl,--'实收资本'
   ''             as  Reg_Org_Zh,--'登记机关中文'
   ''             as  county,--'县'
   ''             as  Clos_Date,--'吊销日期'
     '' as Bel_org_cd,		--登记机关区域代码
     '' as Bel_org_ch,		--登记机关区域中文
     '' as Cate_qx,		--企业分类_启信宝
     '' as Cate_new_qx,		--企业分类_新_启信宝
     '' as econ_kind_code,		--企业类型_启信宝
     '' as Cred_area_cd,		--社会信用代码区域代码
     '' as Dept,		--社会组织业务主管单位
     '' as Dist_cd,		--最优区域码,
     '' as Grp_abbr,		--集团简称
     '' as Grp_name,		--集团名称
     '' as bd_lati,		--百度纬度
     '' as bd_longitu,		--百度经度
     '' as gd_lati,		--高德纬度
     '' as gd_longitu,		--高德经度
     '' as logo_url,		--公司logo,
     '' as oper_name_id_qx,		--启信宝法定代表人ID
     '' as oper_type,		--法定代表人类型
     '' as org_type_qx,		--社会组织类型标签_启信宝,内部字段，"0"学校 "1"医院 
     '' as clos_Rsn,		--吊销原因
     '' as clos_Cert,		--吊销凭证
     '' as Indc_url,		--工商快照信息url
     '' as corp_type_qx,		--企业一级分类_启信宝
     '' as Rep_title,		--公司代表人职务
   'odata_msg.wfd_w_CompIntroduction' as src_tbl,--'来源表'
   ''             as  src_rec_id,--'来源记录'
   concat('{\\"MAIN_BUSINESS\\":\\"', coalesce(MAIN_BUSINESS, ''), '\\",', '\\"COMP_TYPE\\":\\"', coalesce(COMP_TYPE, '') , '\\"}') as  Remark,--'备注'
    a.opdate as rec_upd_time,
'' as rec_down_time
 from (select * from odata_n_uip.w_compintroduction_p where busi_date = 'h16')  a
 left join 
 (select const_cd,const_cn_desc,src_const_cd,src_const_cn_desc  from t02_pub_covt_const WHERE const_type_cd = 'fin00001'  and src_id = 'WD')b ON a.currencycode = b.src_const_cd  --币种转码
  left join 
 (select const_cd,const_cn_desc,src_const_cd,src_const_cn_desc  from t02_pub_covt_const WHERE const_type_cd = 'pty00017'  and src_id = 'WD')c ON a.city = c.src_const_cd  --城市转码
   left join 
 (select const_cd,const_cn_desc,src_const_cd,src_const_cn_desc  from t02_pub_covt_const WHERE const_type_cd = 'pty00017'  and src_id = 'WD')d ON a.province = d.src_const_cd  --省份转码
    left join
 (select a1.comp_id as comp_id,b1.const_cd as const_cd from 
    (select * from odata_n_uip.w_compintroduction_p where busi_date = 'h16' and s_info_comptype is not null) a1
        left join 
    (select distinct const_cd,const_cn_desc,src_const_cd,src_const_cn_desc,src_eng_desc,match_type_cd  from t02_pub_covt_const WHERE const_type_cd = 'pty00019'  and src_id = 'WD' and match_type_cd='10016') b1 
        on a1.s_info_comptype = b1.src_const_cd 
  )e ON a.comp_id = e.comp_id  --公司类型转码 
 left join
 (select a1.comp_id as comp_id,b1.const_cd as const_cd from 
    (select * from odata_n_uip.w_compintroduction_p where busi_date = 'h16' and  s_info_comptype is not null) a1
        left join 
    (select distinct const_cd,const_cn_desc,src_const_cd,src_const_cn_desc,src_eng_desc,match_type_cd  from t02_pub_covt_const WHERE const_type_cd = 'pty00019'  and src_id = 'WD' and match_type_cd='10016') b1 
        on  a1.s_info_comptype = b1.SRC_ENG_DESC  --由于HIVE不支持JOIN的ON条件里使用OR，所以多关联一次。
  )e2 ON a.comp_id = e2.comp_id  --公司类型转码  
    left join 
 (select const_cd,const_cn_desc,src_const_cd,src_const_cn_desc  from t02_pub_covt_const WHERE const_type_cd = 'pty00022'  and src_id = 'WD')f ON a.country = f.src_const_cn_desc  --国家转码

;
