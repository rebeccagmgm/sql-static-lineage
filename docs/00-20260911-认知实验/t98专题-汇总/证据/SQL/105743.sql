-- task_id: 105743
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/SUM/PDATA_N.T98_OTC_COMP_MNG_RELA_INFO.py
-- observed_at: 2026-09-05T01:06:44.879Z

-- createSql
--drop TABLE if exists otc_div_temp;
CREATE TABLE if not exists otc_div_temp(
    Contract_Code string comment '合约编号',
    client_id string comment '交易对手客户编号',
    Inr_Org_Id_1 string comment '引入部门ID_1',
    Inr_Org_Name_1 string comment '引入部门名称_1',
    Div_Org_Id_1 string comment '所属分公司ID_1',
    Div_Org_Name_1 string comment '所属分公司名称_1',
    Cust_Mngr_Id_1 string comment '客户经理ID_1',
    Cust_Mngr_Name_1 string comment '客户经理姓名_1',
    Cust_Mngr_Emp_Id_1 string comment '客户经理员工编号_1',
    Allo_Prop_1 string comment '分配比例_1',
    Inr_Org_Id_2 string comment '引入部门ID_2',
    Inr_Org_Name_2 string comment '引入部门名称_2',
    Div_Org_Id_2 string comment '所属分公司ID_2',
    Div_Org_Name_2 string comment '所属分公司名称_2',
    Cust_Mngr_Id_2 string comment '客户经理ID_2',
    Cust_Mngr_Name_2 string comment '客户经理姓名_2',
    Cust_Mngr_Emp_Id_2 string comment '客户经理员工编号_2',
    Allo_Prop_2 string comment '分配比例_2',
    Inr_Org_Id_3 string comment '引入部门ID_3',
    Inr_Org_Name_3 string comment '引入部门名称_3',
    Div_Org_Id_3 string comment '所属分公司ID_3',
    Div_Org_Name_3 string comment '所属分公司名称_3',
    Cust_Mngr_Id_3 string comment '客户经理ID_3',
    Cust_Mngr_Name_3 string comment '客户经理姓名_3',
    Cust_Mngr_Emp_Id_3 string comment '客户经理员工编号_3',
    Allo_Prop_3 string comment '分配比例_3',
    Cust_Mngr_Emp_Stat_Cd_1 string comment '客户经理员工状态代码_1',
    Cust_Mngr_Emp_Stat_Desc_1 string comment '客户经理员工状态描述_1',
    Cust_Mngr_Emp_Stat_Cd_2 string comment '客户经理员工状态代码_2',
    Cust_Mngr_Emp_Stat_Desc_2 string comment '客户经理员工状态描述_2',
    Cust_Mngr_Emp_Stat_Cd_3 string comment '客户经理员工状态代码_3',
    Cust_Mngr_Emp_Stat_Desc_3 string comment '客户经理员工状态描述_3'
    )
COMMENT '临时表'
STORED AS ORC
;

--drop TABLE if exists T98_OTC_COMP_MNG_RELA_INFO;
CREATE TABLE if not exists T98_OTC_COMP_MNG_RELA_INFO(
    agt_id string comment '合约编号',
    pty_id string comment '客户编号',
    Inr_Org_Id_1 string comment '引入部门ID_1',
    Inr_Org_Name_1 string comment '引入部门名称_1',
    Div_Org_Id_1 string comment '所属分公司ID_1',
    Div_Org_Name_1 string comment '所属分公司名称_1',
    Cust_Mngr_User_Id_1 string comment '客户经理USER_ID_1',
    Cust_Mngr_Name_1 string comment '客户经理姓名_1',
    Cust_Mngr_Emp_Id_1 string comment '客户经理员工编号_1',
    Allo_Prop_1 string comment '分配比例_1',
    Inr_Org_Id_2 string comment '引入部门ID_2',
    Inr_Org_Name_2 string comment '引入部门名称_2',
    Div_Org_Id_2 string comment '所属分公司ID_2',
    Div_Org_Name_2 string comment '所属分公司名称_2',
    Cust_Mngr_User_Id_2 string comment '客户经理USER_ID_2',
    Cust_Mngr_Name_2 string comment '客户经理姓名_2',
    Cust_Mngr_Emp_Id_2 string comment '客户经理员工编号_2',
    Allo_Prop_2 string comment '分配比例_2',
    Inr_Org_Id_3 string comment '引入部门ID_3',
    Inr_Org_Name_3 string comment '引入部门名称_3',
    Div_Org_Id_3 string comment '所属分公司ID_3',
    Div_Org_Name_3 string comment '所属分公司名称_3',
    Cust_Mngr_User_Id_3 string comment '客户经理USER_ID_3',
    Cust_Mngr_Name_3 string comment '客户经理姓名_3',
    Cust_Mngr_Emp_Id_3 string comment '客户经理员工编号_3',
    Allo_Prop_3 string comment '分配比例_3',
    Main_Oper_User_Id string comment '主经办人ID',
    Main_Oper_Name string comment '主经办人姓名',
    Main_Oper_Emp_Id string comment '主经办人员工编号',
    Intro_Oper_User_Id string comment '引入经办人ID',
    Intro_Oper_Name string comment '引入经办人姓名',
    Intro_Oper_Emp_Id string comment '引入经办人员工编号',
    Data_Src_Cd string comment '数据来源代码',
    Task_Name string comment '任务名',
    Data_Etl_Date string comment '数据加载日期',
    Data_Upt_Date string comment '数据更新日期',
    Data_Time string comment '数据时间',
    Inr_Main_Oper_User_Id string comment '内部主经办人ID',
    Inr_Main_Oper_Name string comment '内部主经办人姓名',
    Inr_Main_Oper_Emp_Id string comment '内部主经办人员工编号',
    Inr_Intro_Oper_User_Id string comment '内部引入经办人ID',
    Inr_Intro_Oper_Name string comment '内部引入经办人姓名',
    Inr_Intro_Oper_Emp_Id string comment '内部引入经办人员工编号',
    Tit_Oper_User_Id string comment 'TITANS经办人ID',
    Tit_Oper_Name string comment 'TITANS经办人姓名',
    Tit_Oper_Emp_Id string comment 'TITANS经办人员工编号',
    Tit_Oper_Inr_Org_Id string comment 'TITANS经办人所属部门编号',
    Tit_Oper_Inr_Org_Name string comment 'TITANS经办人所属部门名称',
    Tit_Cust_Mngr_User_Id string comment 'TITANS客户经理ID',
    Tit_Cust_Mngr_Name string comment 'TITANS客户经理姓名',
    Tit_Cust_Mngr_Emp_Id string comment 'TITANS客户经理员工编号',
    Tit_Cust_Mngr_Inr_Org_Id string comment 'TITANS客户经理所属部门编号',
    Tit_Cust_Mngr_Inr_Org_Name string comment 'TITANS客户经理所属部门名称',
    Cust_Mngr_Emp_Stat_Cd_1 string comment '客户经理员工状态代码_1',
    Cust_Mngr_Emp_Stat_Desc_1 string comment '客户经理员工状态描述_1',
    Cust_Mngr_Emp_Stat_Cd_2 string comment '客户经理员工状态代码_2',
    Cust_Mngr_Emp_Stat_Desc_2 string comment '客户经理员工状态描述_2',
    Cust_Mngr_Emp_Stat_Cd_3 string comment '客户经理员工状态代码_3',
    Cust_Mngr_Emp_Stat_Desc_3 string comment '客户经理员工状态描述_3'
    )
COMMENT 'T98_OTC合约管理关系信息'
PARTITIONED BY (
    busi_date string comment '业务日期')
STORED AS ORC
;

-- querySql
set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

insert overwrite table otc_div_temp
select
    A.Contract_Code,
    A.client_id,
    max(case when A.seq = '1' then A.Introduction_Department else '' end) as Inr_Org_Id_1,
    max(case when A.seq = '1' then org.ORGNAME else '' end) as Inr_Org_Name_1,
    max(case when A.seq = '1' then coalesce(dept.Brch_Bel_Div_Org_Id,A.Introduction_Department) else '' end) as Div_Org_Id_1,
    max(case when A.seq = '1' then coalesce(dept.Brch_Bel_Div_Org_Name,org.ORGNAME) else '' end) as Div_Org_Name_1,
    max(case when A.seq = '1' then A.Customer_Manager else '' end) as Cust_Mngr_Id_1,
    max(case when A.seq = '1' then D.Emp_Name else '' end) as Cust_Mngr_Name_1,
    max(case when A.seq = '1' then COALESCE(D.Emp_Id, D.OA_User_Id, '') else '' end) as Cust_Mngr_Emp_Id_1,
    max(case when A.seq = '1' then A.Allocation_Proportion else '0' end) as Allo_Prop_1,
    max(case when A.seq = '2' then A.Introduction_Department else '' end) as Inr_Org_Id_2,
    max(case when A.seq = '2' then org.ORGNAME else '' end) as Inr_Org_Name_2,
    max(case when A.seq = '2' then coalesce(dept.Brch_Bel_Div_Org_Id,A.Introduction_Department) else '' end) as Div_Org_Id_2,
    max(case when A.seq = '2' then coalesce(dept.Brch_Bel_Div_Org_Name,org.ORGNAME) else '' end) as Div_Org_Name_2,
    max(case when A.seq = '2' then A.Customer_Manager else '' end) as Cust_Mngr_Id_2,
    max(case when A.seq = '2' then D.Emp_Name else '' end) as Cust_Mngr_Name_2,
    max(case when A.seq = '2' then COALESCE(D.Emp_Id, D.OA_User_Id, '') else '' end) as Cust_Mngr_Emp_Id_2,
    max(case when A.seq = '2' then A.Allocation_Proportion else '0' end) as Allo_Prop_2,
    max(case when A.seq = '3' then A.Introduction_Department else '' end) as Inr_Org_Id_3,
    max(case when A.seq = '3' then org.ORGNAME else '' end) as Inr_Org_Name_3,
    max(case when A.seq = '3' then coalesce(dept.Brch_Bel_Div_Org_Id,A.Introduction_Department) else '' end) as Div_Org_Id_3,
    max(case when A.seq = '3' then coalesce(dept.Brch_Bel_Div_Org_Name,org.ORGNAME) else '' end) as Div_Org_Name_3,
    max(case when A.seq = '3' then A.Customer_Manager else '' end) as Cust_Mngr_Id_3,
    max(case when A.seq = '3' then D.Emp_Name else '' end) as Cust_Mngr_Name_3,
    max(case when A.seq = '3' then COALESCE(D.Emp_Id, D.OA_User_Id, '') else '' end) as Cust_Mngr_Emp_Id_3,
    max(case when A.seq = '3' then A.Allocation_Proportion else '0' end) as Allo_Prop_3,
    max(case when A.seq = '1' then D.Emp_Stat_Cd else '' end) as Cust_Mngr_Emp_Stat_Cd_1,
    max(case when A.seq = '1' then D.Emp_Stat_Desc else '' end) as Cust_Mngr_Emp_Stat_Desc_1,
    max(case when A.seq = '2' then D.Emp_Stat_Cd else '' end) as Cust_Mngr_Emp_Stat_Cd_2,
    max(case when A.seq = '2' then D.Emp_Stat_Desc else '' end) as Cust_Mngr_Emp_Stat_Desc_2,
    max(case when A.seq = '3' then D.Emp_Stat_Cd else '' end) as Cust_Mngr_Emp_Stat_Cd_3,
    max(case when A.seq = '3' then D.Emp_Stat_Desc else '' end) as Cust_Mngr_Emp_Stat_Desc_3
from (
    select
        client_id, '' as Contract_Code, lpad(Introduction_Department,4,'0') as Introduction_Department, Customer_Manager, cast(Allocation_Proportion as double) as Allocation_Proportion,
        row_number() over(partition by client_id order by cast(Allocation_Proportion as double) desc, Customer_Manager) as seq
    from odata_n_ois.o_counterparty_introduction
    where busi_Date = '${data_day_str}' and Is_Deleted = 'N'
    union all
    select
        '' as client_id, Contract_Code, lpad(Introduction_Department,4,'0') as Introduction_Department, Customer_Manager, cast(Allocation_Proportion as double) as Allocation_Proportion,
        row_number() over(partition by Contract_Code order by cast(Allocation_Proportion as double) desc, Customer_Manager) as seq
    from odata_n_ois.o_contract_introduction
    where busi_Date = '${data_day_str}' and Is_Deleted = 'N'
    union all
    select
        client_id, '' as Contract_Code, lpad(department,4,'0') as Introduction_Department, introductor as Customer_Manager, cast(Allocation_Proportion as double) as Allocation_Proportion,
        row_number() over(partition by client_id order by cast(Allocation_Proportion as double) desc, introductor) as seq
    from odata_n_oom.g_hk_counterparty_introduction
    where busi_Date = '${data_day_str}'
    ) A
LEFT JOIN (
    SELECT Emp_Id, OA_User_Id, Emp_Name, Emp_Stat_Cd, Emp_Stat_Desc
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) D
ON A.Customer_Manager = D.OA_User_Id
left join (
    select * from (
        select
            if(dept_no != '', dept_no, substring(unif_org_id,2,4)) as dept_no,
            split(dn,'=')[1] as ORGNAME,
            row_number() over(partition by if(dept_no != '', dept_no, substring(unif_org_id,2,4)) order by inr_org_lvl) as rk
        from pdata_n.T04_OAS_INR_ORG
        where src_tbl = 'ODATA_N_OAS.P_GF_DEPARTMENT' and dept_flag = '1'
        ) t
    where rk = 1
    ) org
on A.Introduction_Department = org.dept_no
left join (
    SELECT Inr_Org_Id, Inr_Org_Name, Brch_Bel_Div_Org_Id, Brch_Bel_Div_Org_Name
    FROM PDATA_N.T98_ORG_BRCH_DIV_INFO
    WHERE Busi_Date = default.pretradedate(date_add('${data_day_str}', 1), 1)
    ) dept
on org.dept_no = dept.Inr_Org_Id
group by A.client_id, A.Contract_Code
;

set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

insert overwrite table T98_OTC_COMP_MNG_RELA_INFO partition(busi_date = '${data_day_str}')
select distinct
    info.Agt_Id,
    info.Cutp_Pty_Id as Pty_Id,
    coalesce(ci.Inr_Org_Id_1, cpi.Inr_Org_Id_1) as Inr_Org_Id_1,
    coalesce(ci.Inr_Org_Name_1, cpi.Inr_Org_Name_1) as Inr_Org_Name_1,
    coalesce(ci.Div_Org_Id_1, cpi.Div_Org_Id_1) as Div_Org_Id_1,
    coalesce(ci.Div_Org_Name_1, cpi.Div_Org_Name_1) as Div_Org_Name_1,
    coalesce(ci.Cust_Mngr_Id_1, cpi.Cust_Mngr_Id_1) as Cust_Mngr_User_Id_1,
    coalesce(ci.Cust_Mngr_Name_1, cpi.Cust_Mngr_Name_1) as Cust_Mngr_Name_1,
    coalesce(ci.Cust_Mngr_Emp_Id_1, cpi.Cust_Mngr_Emp_Id_1) as Cust_Mngr_Emp_Id_1,
    coalesce(ci.Allo_Prop_1, cpi.Allo_Prop_1) as Allo_Prop_1,
    coalesce(ci.Inr_Org_Id_2, cpi.Inr_Org_Id_2) as Inr_Org_Id_2,
    coalesce(ci.Inr_Org_Name_2, cpi.Inr_Org_Name_2) as Inr_Org_Name_2,
    coalesce(ci.Div_Org_Id_2, cpi.Div_Org_Id_2) as Div_Org_Id_2,
    coalesce(ci.Div_Org_Name_2, cpi.Div_Org_Name_2) as Div_Org_Name_2,
    coalesce(ci.Cust_Mngr_Id_2, cpi.Cust_Mngr_Id_2) as Cust_Mngr_User_Id_2,
    coalesce(ci.Cust_Mngr_Name_2, cpi.Cust_Mngr_Name_2) as Cust_Mngr_Name_2,
    coalesce(ci.Cust_Mngr_Emp_Id_2, cpi.Cust_Mngr_Emp_Id_2) as Cust_Mngr_Emp_Id_2,
    coalesce(ci.Allo_Prop_2, cpi.Allo_Prop_2) as Allo_Prop_2,
    coalesce(ci.Inr_Org_Id_3, cpi.Inr_Org_Id_3) as Inr_Org_Id_3,
    coalesce(ci.Inr_Org_Name_3, cpi.Inr_Org_Name_3) as Inr_Org_Name_3,
    coalesce(ci.Div_Org_Id_3, cpi.Div_Org_Id_3) as Div_Org_Id_3,
    coalesce(ci.Div_Org_Name_3, cpi.Div_Org_Name_3) as Div_Org_Name_3,
    coalesce(ci.Cust_Mngr_Id_3, cpi.Cust_Mngr_Id_3) as Cust_Mngr_User_Id_3,
    coalesce(ci.Cust_Mngr_Name_3, cpi.Cust_Mngr_Name_3) as Cust_Mngr_Name_3,
    coalesce(ci.Cust_Mngr_Emp_Id_3, cpi.Cust_Mngr_Emp_Id_3) as Cust_Mngr_Emp_Id_3,
    coalesce(ci.Allo_Prop_3, cpi.Allo_Prop_3) as Allo_Prop_3,
    coalesce(s_ba.operator_name, cp.operator) as Main_Oper_User_Id,
    Main.Emp_Name as Main_Oper_Name,
    Main.Emp_Id as Main_Oper_Emp_Id,
    coalesce(s_ba.introduction_operator_name, cp.introduction_operator) as Intro_Oper_User_Id,
    Intro.Emp_Name as Intro_Oper_Name,
    Intro.Emp_Id as Intro_Oper_Emp_Id,
    'TIT' AS Data_Src_Cd,
    UPPER('${filename}') AS Task_Name,
    '${data_day_str}' AS Data_Etl_Date,
    '${data_day_str}' AS Data_Upt_Date,
    '${data_today}' AS Data_Time,
    coalesce(is_ba.operator_name, cp.operator) as Inr_Main_Oper_User_Id,
    i_Main.Emp_Name as Inr_Main_Oper_Name,
    i_Main.Emp_Id as Inr_Main_Oper_Emp_Id,
    coalesce(is_ba.introduction_operator_name, cp.introduction_operator) as Inr_Intro_Oper_User_Id,
    i_Intro.Emp_Name as Inr_Intro_Oper_Name,
    i_Intro.Emp_Id as Inr_Intro_Oper_Emp_Id,
    tit.Tit_Oper_User_Id,
    t_op.Emp_Name as Tit_Oper_Name,
    t_op.Emp_Id as Tit_Oper_Emp_Id,
    t_op.Bel_Inr_Org_Id_Len4 as Tit_Oper_Inr_Org_Id,
    t_op.Bel_Inr_Org_Name as Tit_Oper_Inr_Org_Name,
    tit.Tit_Cust_Mngr_User_Id,
    t_cm.Emp_Name as Tit_Cust_Mngr_Name,
    t_cm.Emp_Id as Tit_Cust_Mngr_Emp_Id,
    t_cm.Bel_Inr_Org_Id_Len4 as Tit_Cust_Mngr_Inr_Org_Id,
    t_cm.Bel_Inr_Org_Name as Tit_Cust_Mngr_Inr_Org_Name,
    coalesce(ci.Cust_Mngr_Emp_Stat_Cd_1, cpi.Cust_Mngr_Emp_Stat_Cd_1) as Cust_Mngr_Emp_Stat_Cd_1,
    coalesce(ci.Cust_Mngr_Emp_Stat_Desc_1, cpi.Cust_Mngr_Emp_Stat_Desc_1) as Cust_Mngr_Emp_Stat_Desc_1,
    coalesce(ci.Cust_Mngr_Emp_Stat_Cd_2, cpi.Cust_Mngr_Emp_Stat_Cd_2) as Cust_Mngr_Emp_Stat_Cd_2,
    coalesce(ci.Cust_Mngr_Emp_Stat_Desc_2, cpi.Cust_Mngr_Emp_Stat_Desc_2) as Cust_Mngr_Emp_Stat_Desc_2,
    coalesce(ci.Cust_Mngr_Emp_Stat_Cd_3, cpi.Cust_Mngr_Emp_Stat_Cd_3) as Cust_Mngr_Emp_Stat_Cd_3,
    coalesce(ci.Cust_Mngr_Emp_Stat_Desc_3, cpi.Cust_Mngr_Emp_Stat_Desc_3) as Cust_Mngr_Emp_Stat_Desc_3
from (
    select distinct Agt_Id, Cutp_Pty_Id, Inr_Seri_No, Book_Bel_Dept
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_Date = '${data_day_str}' and Book_Bel_Dept in ('OTC','OTC_HK')
    ) info
left join (
    select * from otc_div_temp
    where Contract_Code != ''
    ) ci
on ci.Contract_Code = info.Agt_Id
left join (
    select * from pdata_news_n.t02_fin_float_income_vchr_info
    where busi_Date = '${data_day_str}' and src_id = 'OIS' and grp_id = '01'
        and cast(prin_prtc_prop as double) < 1
    ) fl
on fl.comp_no = info.Agt_Id
left join (
    select * from otc_div_temp
    where client_id != ''
    ) cpi
on cpi.client_id = if(info.Cutp_Pty_Id = 'DEV1100100652' and fl.comp_no is not null, fl.deal_cutp_no, info.Cutp_Pty_Id)
left join (--关联经办人
    select client_id, operator, introduction_operator
    from odata_n_ois.o_otc_derivative_counterparty
    where busi_Date = '${data_day_str}' and delete_flag = '0'
    union all
    select client_id, introductor as operator, introductor as introduction_operator
    from odata_n_oom.g_hk_counterparty_introduction
    where busi_Date = '${data_day_str}' and seq = '1'
    ) cp
on cp.client_id = if(info.Cutp_Pty_Id = 'DEV1100100652' and fl.comp_no is not null, fl.deal_cutp_no, info.Cutp_Pty_Id)
left join (
    select *
    from odata_n_ois.o_contract_base_rate
    where busi_date = '${data_day_str}' and Is_Deleted = 'N'
    ) s_ba
on info.agt_id = s_ba.CONTRACT_CODE and info.Book_Bel_Dept = 'OTC'
LEFT JOIN (
    SELECT Emp_Id, OA_User_Id, Emp_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) Main
ON coalesce(s_ba.operator_name, cp.operator) = Main.OA_User_Id
LEFT JOIN (
    SELECT Emp_Id, OA_User_Id, Emp_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) Intro
ON coalesce(s_ba.introduction_operator_name, cp.introduction_operator) = Intro.OA_User_Id
left join (
    select *
    from odata_n_ois.g_inr_contract_base_rate
    where busi_date = '${data_day_str}' and Is_Deleted = 'N'
    ) is_ba
on info.agt_id = is_ba.CONTRACT_CODE
LEFT JOIN (
    SELECT Emp_Id, OA_User_Id, Emp_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) i_Main
ON coalesce(is_ba.operator_name, cp.operator) = i_Main.OA_User_Id
LEFT JOIN (
    SELECT Emp_Id, OA_User_Id, Emp_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) i_Intro
ON coalesce(is_ba.introduction_operator_name, cp.introduction_operator) = i_Intro.OA_User_Id
left join (
    select key_otc_trade_id,
        max(case when property_name = 'operator' then property_value else '' end) as Tit_Oper_User_Id,
        max(case when property_name = 'customerManager' then property_value else '' end) as Tit_Cust_Mngr_User_Id
    from odata_n_tit.d_trd_otc_contr_props
    where busi_Date = '${data_day_str}' and property_name in ('operator','customerManager')
    group by key_otc_trade_id
    ) tit
on tit.key_otc_trade_id = info.Inr_Seri_No
left join (
    SELECT Emp_Id, OA_User_Id, Emp_Name, Bel_Inr_Org_Id_Len4, Bel_Inr_Org_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) t_op
ON tit.Tit_Oper_User_Id = t_op.OA_User_Id
left join (
    SELECT Emp_Id, OA_User_Id, Emp_Name, Bel_Inr_Org_Id_Len4, Bel_Inr_Org_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
    ) t_cm
ON tit.Tit_Cust_Mngr_User_Id = t_cm.OA_User_Id
;
