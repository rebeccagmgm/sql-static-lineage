/**02｜补充介绍人、引入部门及所属分公司信息

本步骤为01中的介绍关系补充人员和机构维度，不产生新的介绍关系。

关系链：
  A.Customer_Manager
      ──OA用户编号──> introduction_employee
      → 员工号、姓名、员工状态

  A.Introduction_Department
      ──部门号──> oa_department
      → 引入部门名称
      ──机构关系──> branch_division
      → 所属分公司

注意：“引入部门”是介绍关系上登记的部门，
不等于介绍人员工当前所属部门。
所属分公司也不是直接用 Introduction_Department 查询，
而是先识别OA机构后再补充分公司归属。

*/


-- 补充介绍人的员工信息。
-- 01中的 Customer_Manager 存的是 OA用户编号，
-- 这里用 Customer_Manager = OA_User_Id 关联员工基本信息表，
-- 取得员工编号 Emp_Id、员工姓名 Emp_Name、员工状态 Emp_Stat_Cd／Emp_Stat_Desc。
-- 使用参数日员工快照；未筛在职状态，也未按 OA_User_Id 去重。
introduction_employee as (
    SELECT Emp_Id, OA_User_Id, Emp_Name, Emp_Stat_Cd, Emp_Stat_Desc
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO --T98_员工基本信息
    WHERE busi_date = '${data_day_str}'
),

-- 整理“引入部门”的OA机构信息，后续用部门号补部门名称。
-- “部门号 → OA部门名称”的机构映射，
-- Introduction_Department → dept_no → ORGNAME，以及一个部门号有多条机构记录时，优先取机构层级较小的那条。
oa_department as (
select *
from (
select
    if(dept_no != '', dept_no, substring(unif_org_id,2,4)) as dept_no,
    split(dn,'=')[1] as ORGNAME,
    row_number() over(
    partition by if(dept_no != '', dept_no, substring(unif_org_id,2,4))
    order by inr_org_lvl
    ) as rk
from pdata_n.T04_OAS_INR_ORG -- OA内部机构
where src_tbl = 'ODATA_N_OAS.P_GF_DEPARTMENT' --OA 系统的「部门表」
and dept_flag = '1'
) t
where rk = 1
),


-- 补充机构所属分公司信息
-- Inr_Org_Id=内部机构编号；Inr_Org_Name=内部机构简称；
-- Brch_Bel_Div_Org_Id／Name=营业部所属分公司编号／名称。
-- 保留原日期函数。先参数日+1再pretradedate(...,1)，不是直接参数日-1。
branch_division as (
    SELECT Inr_Org_Id, Inr_Org_Name, Brch_Bel_Div_Org_Id, Brch_Bel_Div_Org_Name
    FROM PDATA_N.T98_ORG_BRCH_DIV_INFO --分支机构及所属分公司，每天一份快照
    WHERE Busi_Date = default.pretradedate(date_add('${data_day_str}', 1), 1)
)
