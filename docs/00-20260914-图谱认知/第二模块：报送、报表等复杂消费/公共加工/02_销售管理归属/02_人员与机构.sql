-- 02：介绍关系用到的人员与机构。别把“引入部门”当成“员工当前所属部门”。
-- A.Customer_Manager ──OA用户编号──> introduction_employee D：姓名／员工号／状态
-- A.Introduction_Department ──4位部门号──> oa_department org：部门名称
--                                         └──> branch_division dept：所属分公司
-- 分公司通过org再连接；不是直接拿A.Introduction_Department查dept。
-- D：PDATA_N.T98_ORG_EMP_BASE_INFO（T98_员工基本信息），参数日快照。
-- Emp_Id=员工编号；OA_User_Id=OA用户编号；Emp_Name=员工姓名；
-- Emp_Stat_Cd／Emp_Stat_Desc=员工状态代码／描述。未筛在职状态，也未去重。
introduction_employee as (
    SELECT Emp_Id, OA_User_Id, Emp_Name, Emp_Stat_Cd, Emp_Stat_Desc
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
),

-- org：pdata_n.T04_OAS_INR_ORG（OA内部机构）。
-- dept_no=部门编号；unif_org_id=统一机构编码；inr_org_lvl=内部机构层级；
-- dn的元数据释义为“DOMINO中的DN”，SQL取按“=”拆分的第2段作为ORGNAME。
-- 只保留指定来源表且dept_flag=1。部门号不为''用自身，否则截统一机构码第2～5位。
-- 每个处理后的部门号按层级升序取rk=1；同层级无额外排序键。
-- 注意原SQL没有busi_date条件，不能描述成“当日OA机构快照”。
oa_department as (
    select * from (
        select
            if(dept_no != '', dept_no, substring(unif_org_id,2,4)) as dept_no,
            split(dn,'=')[1] as ORGNAME,
            row_number() over(partition by if(dept_no != '', dept_no, substring(unif_org_id,2,4)) order by inr_org_lvl) as rk
        from pdata_n.T04_OAS_INR_ORG
        where src_tbl = 'ODATA_N_OAS.P_GF_DEPARTMENT' and dept_flag = '1'
        ) t
    where rk = 1
),

-- dept：PDATA_N.T98_ORG_BRCH_DIV_INFO（分支机构及所属分公司，每天一份快照）。
-- Inr_Org_Id=内部机构编号；Inr_Org_Name=内部机构简称；
-- Brch_Bel_Div_Org_Id／Name=营业部所属分公司编号／名称。
-- 保留原日期函数。先参数日+1再pretradedate(...,1)，不是直接参数日-1。
-- 本地函数目录仅查到内部Presto签名，不能据此确认此Hive UDF的交易日边界。
branch_division as (
    SELECT Inr_Org_Id, Inr_Org_Name, Brch_Bel_Div_Org_Id, Brch_Bel_Div_Org_Name
    FROM PDATA_N.T98_ORG_BRCH_DIV_INFO
    WHERE Busi_Date = default.pretradedate(date_add('${data_day_str}', 1), 1)
)
