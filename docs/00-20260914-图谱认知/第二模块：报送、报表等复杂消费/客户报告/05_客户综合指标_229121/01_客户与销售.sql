-- 客户底座 t0：报告日创收快照中，上一年元旦至报告日出现过的 grp 01/02/03 客户。
-- 一行=公司全称+USCC；不是最近12个月，也不要求当日有持仓或正创收。
-- T01_OTC_DERI_CUST（衍生品客户）的 Oper_User_Id=经办人；按客户当事人号接入。
-- T98_ORG_EMP_BASE_INFO（员工基本信息）按 Oa_User_Id 补 Emp_Name（姓名）；名单去重、顺序不保证。
SELECT
        r.Cutp_Pty_Full_Name as company_name
        ,r.USCC as company_id
        ,concat_ws(';', collect_set(e.Emp_Name)) as contact_sales
        ,concat_ws(';', collect_set(c.Oper_User_Id)) as sales_login
    from DM_OTC_N.OTC_REV_DAILY_RPT r
    left join pdata_n.T01_OTC_DERI_CUST c
        on r.Cutp_Pty_Id = c.Pty_Id
        and c.BUSI_DATE = '${yyyy-MM-dd}'
        and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
    left join pdata_n.T98_ORG_EMP_BASE_INFO e
        on c.Oper_User_Id = e.Oa_User_Id
        and e.BUSI_DATE = '${yyyy-MM-dd}'
    where r.busi_date = '${yyyy-MM-dd}'
    and r.grp_id in('01','02','03')
    and r.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
    group by r.Cutp_Pty_Full_Name, r.USCC
