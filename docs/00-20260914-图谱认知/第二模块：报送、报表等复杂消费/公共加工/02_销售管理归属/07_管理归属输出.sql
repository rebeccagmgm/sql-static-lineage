-- 07：以销售合约为起点，把两条独立的人员线并排写入管理归属表。
-- 介绍关系：合约号找ci、客户号找cpi → 每个字段优先ci，NULL才取cpi。
-- 经办角色：普通、内部各自选账号；TIT按内部流水号取属性 → 分别补员工资料。
-- info/ci/fl/cpi来自04_合约与客户关系；cp/s_ba/is_ba及经办员工来自05_普通与内部经办；
-- tit及其员工资料来自06_TIT经办与客户经理。输入实际表与关键字段注释见对应文件。
-- 例：A1合约关系只有王五1.0，则第2/3组已是空串/0，不会再用客户的李四补齐。
-- SELECT DISTINCT去重全部59个输出值，不是每合约只取一行；此任务不计算收入分摊。
insert overwrite table T98_OTC_COMP_MNG_RELA_INFO partition(busi_date = '${data_day_str}')
select distinct
    info.Agt_Id, -- 合约编号
    info.Cutp_Pty_Id as Pty_Id, -- 客户编号；保留销售基础原客户号
    -- 一、介绍关系第1组：机构、人员、比例分别选择；不是整套关系一起回退。
    coalesce(ci.Inr_Org_Id_1, cpi.Inr_Org_Id_1) as Inr_Org_Id_1, -- 引入部门编号_1
    coalesce(ci.Inr_Org_Name_1, cpi.Inr_Org_Name_1) as Inr_Org_Name_1, -- 引入部门名称_1
    coalesce(ci.Div_Org_Id_1, cpi.Div_Org_Id_1) as Div_Org_Id_1, -- 所属分公司编号_1
    coalesce(ci.Div_Org_Name_1, cpi.Div_Org_Name_1) as Div_Org_Name_1, -- 所属分公司名称_1
    coalesce(ci.Cust_Mngr_Id_1, cpi.Cust_Mngr_Id_1) as Cust_Mngr_User_Id_1, -- 客户经理OA账号_1
    coalesce(ci.Cust_Mngr_Name_1, cpi.Cust_Mngr_Name_1) as Cust_Mngr_Name_1, -- 客户经理姓名_1
    coalesce(ci.Cust_Mngr_Emp_Id_1, cpi.Cust_Mngr_Emp_Id_1) as Cust_Mngr_Emp_Id_1, -- 客户经理员工编号_1
    coalesce(ci.Allo_Prop_1, cpi.Allo_Prop_1) as Allo_Prop_1, -- 分配比例_1

    -- 介绍关系第2组：与第1组同样逐字段选择；空串、0都不触发回退。
    coalesce(ci.Inr_Org_Id_2, cpi.Inr_Org_Id_2) as Inr_Org_Id_2, -- 引入部门编号_2
    coalesce(ci.Inr_Org_Name_2, cpi.Inr_Org_Name_2) as Inr_Org_Name_2, -- 引入部门名称_2
    coalesce(ci.Div_Org_Id_2, cpi.Div_Org_Id_2) as Div_Org_Id_2, -- 所属分公司编号_2
    coalesce(ci.Div_Org_Name_2, cpi.Div_Org_Name_2) as Div_Org_Name_2, -- 所属分公司名称_2
    coalesce(ci.Cust_Mngr_Id_2, cpi.Cust_Mngr_Id_2) as Cust_Mngr_User_Id_2, -- 客户经理OA账号_2
    coalesce(ci.Cust_Mngr_Name_2, cpi.Cust_Mngr_Name_2) as Cust_Mngr_Name_2, -- 客户经理姓名_2
    coalesce(ci.Cust_Mngr_Emp_Id_2, cpi.Cust_Mngr_Emp_Id_2) as Cust_Mngr_Emp_Id_2, -- 客户经理员工编号_2
    coalesce(ci.Allo_Prop_2, cpi.Allo_Prop_2) as Allo_Prop_2, -- 分配比例_2

    -- 介绍关系第3组。
    coalesce(ci.Inr_Org_Id_3, cpi.Inr_Org_Id_3) as Inr_Org_Id_3, -- 引入部门编号_3
    coalesce(ci.Inr_Org_Name_3, cpi.Inr_Org_Name_3) as Inr_Org_Name_3, -- 引入部门名称_3
    coalesce(ci.Div_Org_Id_3, cpi.Div_Org_Id_3) as Div_Org_Id_3, -- 所属分公司编号_3
    coalesce(ci.Div_Org_Name_3, cpi.Div_Org_Name_3) as Div_Org_Name_3, -- 所属分公司名称_3
    coalesce(ci.Cust_Mngr_Id_3, cpi.Cust_Mngr_Id_3) as Cust_Mngr_User_Id_3, -- 客户经理OA账号_3
    coalesce(ci.Cust_Mngr_Name_3, cpi.Cust_Mngr_Name_3) as Cust_Mngr_Name_3, -- 客户经理姓名_3
    coalesce(ci.Cust_Mngr_Emp_Id_3, cpi.Cust_Mngr_Emp_Id_3) as Cust_Mngr_Emp_Id_3, -- 客户经理员工编号_3
    coalesce(ci.Allo_Prop_3, cpi.Allo_Prop_3) as Allo_Prop_3, -- 分配比例_3

    -- 二、普通经办：账号逐项回退客户资料；姓名／员工号按选定账号查员工表。
    coalesce(s_ba.operator_name, cp.operator) as Main_Oper_User_Id, -- 主经办人OA账号
    Main.Emp_Name as Main_Oper_Name, -- 主经办人姓名
    Main.Emp_Id as Main_Oper_Emp_Id, -- 主经办人员工编号
    coalesce(s_ba.introduction_operator_name, cp.introduction_operator) as Intro_Oper_User_Id, -- 引入经办人OA账号
    Intro.Emp_Name as Intro_Oper_Name, -- 引入经办人姓名
    Intro.Emp_Id as Intro_Oper_Emp_Id, -- 引入经办人员工编号

    -- 加工标记：不参与人员选择，保留原表字段位置。
    'TIT' AS Data_Src_Cd, -- 数据来源代码；原SQL固定TIT，不代表每个字段均来自TIT
    UPPER('${filename}') AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_day_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time, -- 数据时间

    -- 三、内部经办：独立参数，不与普通经办合并。
    coalesce(is_ba.operator_name, cp.operator) as Inr_Main_Oper_User_Id, -- 内部主经办人OA账号
    i_Main.Emp_Name as Inr_Main_Oper_Name, -- 内部主经办人姓名
    i_Main.Emp_Id as Inr_Main_Oper_Emp_Id, -- 内部主经办人员工编号
    coalesce(is_ba.introduction_operator_name, cp.introduction_operator) as Inr_Intro_Oper_User_Id, -- 内部引入经办人OA账号
    i_Intro.Emp_Name as Inr_Intro_Oper_Name, -- 内部引入经办人姓名
    i_Intro.Emp_Id as Inr_Intro_Oper_Emp_Id, -- 内部引入经办人员工编号

    -- 四、TIT角色：账号来自合约属性，部门来自员工资料，无OIS回退。
    tit.Tit_Oper_User_Id, -- TIT经办人OA账号
    t_op.Emp_Name as Tit_Oper_Name, -- TIT经办人姓名
    t_op.Emp_Id as Tit_Oper_Emp_Id, -- TIT经办人员工编号
    t_op.Bel_Inr_Org_Id_Len4 as Tit_Oper_Inr_Org_Id, -- TIT经办人所属部门编号
    t_op.Bel_Inr_Org_Name as Tit_Oper_Inr_Org_Name, -- TIT经办人所属部门名称
    tit.Tit_Cust_Mngr_User_Id, -- TIT客户经理OA账号
    t_cm.Emp_Name as Tit_Cust_Mngr_Name, -- TIT客户经理姓名
    t_cm.Emp_Id as Tit_Cust_Mngr_Emp_Id, -- TIT客户经理员工编号
    t_cm.Bel_Inr_Org_Id_Len4 as Tit_Cust_Mngr_Inr_Org_Id, -- TIT客户经理所属部门编号
    t_cm.Bel_Inr_Org_Name as Tit_Cust_Mngr_Inr_Org_Name, -- TIT客户经理所属部门名称

    -- 五、三槽位员工状态（与前面客户经理同样逐字段选择，保持原字段顺序）。
    coalesce(ci.Cust_Mngr_Emp_Stat_Cd_1, cpi.Cust_Mngr_Emp_Stat_Cd_1) as Cust_Mngr_Emp_Stat_Cd_1, -- 客户经理员工状态代码_1
    coalesce(ci.Cust_Mngr_Emp_Stat_Desc_1, cpi.Cust_Mngr_Emp_Stat_Desc_1) as Cust_Mngr_Emp_Stat_Desc_1, -- 客户经理员工状态描述_1
    coalesce(ci.Cust_Mngr_Emp_Stat_Cd_2, cpi.Cust_Mngr_Emp_Stat_Cd_2) as Cust_Mngr_Emp_Stat_Cd_2, -- 客户经理员工状态代码_2
    coalesce(ci.Cust_Mngr_Emp_Stat_Desc_2, cpi.Cust_Mngr_Emp_Stat_Desc_2) as Cust_Mngr_Emp_Stat_Desc_2, -- 客户经理员工状态描述_2
    coalesce(ci.Cust_Mngr_Emp_Stat_Cd_3, cpi.Cust_Mngr_Emp_Stat_Cd_3) as Cust_Mngr_Emp_Stat_Cd_3, -- 客户经理员工状态代码_3
    coalesce(ci.Cust_Mngr_Emp_Stat_Desc_3, cpi.Cust_Mngr_Emp_Stat_Desc_3) as Cust_Mngr_Emp_Stat_Desc_3 -- 客户经理员工状态描述_3
-- 以下依次接上资料；均为LEFT JOIN，缺少某侧资料不直接剔除销售合约。
-- ① 介绍关系：Agt_Id找合约关系ci；客户号找客户关系cpi。
from sale_contract info
left join contract_introduction ci
on ci.Contract_Code = info.Agt_Id
left join floating_voucher fl
on fl.comp_no = info.Agt_Id
-- 满足特殊客户+凭证匹配才换查找键；Pty_Id输出不变，NULL替代键也不回原客户。
left join customer_introduction cpi
on cpi.client_id = if(info.Cutp_Pty_Id = 'DEV1100100652' and fl.comp_no is not null, fl.deal_cutp_no, info.Cutp_Pty_Id)

-- ② 客户经办cp：普通、内部经办共同使用的回退账号来源，不是介绍关系中的客户经理。
left join customer_operator cp
on cp.client_id = if(info.Cutp_Pty_Id = 'DEV1100100652' and fl.comp_no is not null, fl.deal_cutp_no, info.Cutp_Pty_Id)

-- ③ 普通经办：普通合约参数s_ba优先，NULL账号才回退cp，再查员工。
-- 参数仅匹配OTC；选中账号但查不到员工时，不会再换cp账号。
left join contract_operator s_ba
on info.agt_id = s_ba.CONTRACT_CODE and info.Book_Bel_Dept = 'OTC'
LEFT JOIN operator_employee Main
ON coalesce(s_ba.operator_name, cp.operator) = Main.OA_User_Id
LEFT JOIN operator_employee Intro
ON coalesce(s_ba.introduction_operator_name, cp.introduction_operator) = Intro.OA_User_Id

-- ④ 内部经办：内部参数is_ba独立选择，也可回退cp；无上面的OTC部门限制。
left join internal_contract_operator is_ba
on info.agt_id = is_ba.CONTRACT_CODE
LEFT JOIN operator_employee i_Main
ON coalesce(is_ba.operator_name, cp.operator) = i_Main.OA_User_Id
LEFT JOIN operator_employee i_Intro
ON coalesce(is_ba.introduction_operator_name, cp.introduction_operator) = i_Intro.OA_User_Id

-- ⑤ TIT角色：内部流水号Inr_Seri_No → 属性角色 → 员工；不按合约号，也不回退cp。
left join tit_role tit
on tit.key_otc_trade_id = info.Inr_Seri_No
left join tit_role_employee t_op
ON tit.Tit_Oper_User_Id = t_op.OA_User_Id
left join tit_role_employee t_cm
ON tit.Tit_Cust_Mngr_User_Id = t_cm.OA_User_Id
;
