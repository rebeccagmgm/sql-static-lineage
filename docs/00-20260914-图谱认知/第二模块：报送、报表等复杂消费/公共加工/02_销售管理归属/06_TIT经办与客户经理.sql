-- 06：TIT系统记录的经办人／客户经理，独立于介绍关系与OIS经办参数。
-- tit：odata_n_tit.d_trd_otc_contr_props（【AI】交易-场外合约结构-其他属性表）。
-- key_otc_trade_id元数据为“trs合约id”；本SQL用它连接info.Inr_Seri_No（内部流水号），
-- 不是Agt_Id合约编号。property_name／value为属性名／属性值。
-- operator→Tit_Oper_User_Id；customerManager→Tit_Cust_Mngr_User_Id。
-- 一个交易键横排成一行；同属性多值时取MAX，不是按时间取最新，也没按有效状态选。
-- 不存在某属性时，另一属性行的ELSE ''可能使对应输出为空串。
tit_role as (
    select key_otc_trade_id,
        max(case when property_name = 'operator' then property_value else '' end) as Tit_Oper_User_Id,
        max(case when property_name = 'customerManager' then property_value else '' end) as Tit_Cust_Mngr_User_Id
    from odata_n_tit.d_trd_otc_contr_props
    where busi_Date = '${data_day_str}' and property_name in ('operator','customerManager')
    group by key_otc_trade_id
),

-- t_op／t_cm：按各自TIT账号查PDATA_N.T98_ORG_EMP_BASE_INFO（员工基本信息）。
-- Bel_Inr_Org_Id_Len4=所属内部机构编号_4位长度；Bel_Inr_Org_Name=所属内部机构名称。
-- 这里输出员工所属部门；三槽位的Inr_Org则来自源介绍关系的部门，是不同口径。
-- 员工参数日快照，不去重、不筛在职、不向OIS或客户关系回退。
tit_role_employee as (
    SELECT Emp_Id, OA_User_Id, Emp_Name, Bel_Inr_Org_Id_Len4, Bel_Inr_Org_Name
    FROM PDATA_N.T98_ORG_EMP_BASE_INFO
    WHERE busi_date = '${data_day_str}'
)
