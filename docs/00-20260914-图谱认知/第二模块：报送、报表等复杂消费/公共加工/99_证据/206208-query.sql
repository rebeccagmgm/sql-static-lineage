with nom_prin as(
    -- 合约级年日均规模
    select
        t0.Src_Contr_Type
        ,t0.Agt_Id
        ,sum(t1.Dyna_Nom_Prin) / max(t0.actl_days) as agt_scal_yearapd -- 合约年日均规模
    from(
        select 
            Agt_Id
            ,Src_Contr_Type
            ,datediff(if(coalesce(Early_Term_Date, End_Pric_Date) <= '${yyyy-MM-dd}', '${yyyy-MM-dd}', coalesce(Early_Term_Date, End_Pric_Date)), Strt_Pric_Date) as actl_days -- 截止当前有效天数
        from pdata_n.T98_OTC_DERI_COMP_SALE_INFO
        where Busi_Date = '${yyyy-MM-dd}'
        and Grp_Id in('01','02','03')
        and coalesce(Early_Term_Date, End_Pric_Date) > '${yyyy}-01-01' -- 当年有效合约
    ) t0
    -- 动态名义本金
    inner join PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET t1
    on t0.agt_id = t1.agt_id
    and t1.End_Pric_Date > '${yyyy}-01-01' -- 当年有效合约
    and t1.busi_date <= '${yyyy-MM-dd}'
    and t1.busi_date <= t1.End_Pric_Date
    group by 
        t0.Src_Contr_Type
        ,t0.Agt_Id
),
comp_mng_rela as(
    -- OTC合约管理关系
    -- 单笔合约扩成3条，不分成的记录存''
    select
        s1.agt_id
        ,split(map_value, '#')[0] as inr_org_id    -- 营业部ID
        ,split(map_value, '#')[1] as div_org_id    -- 分公司ID
        ,split(map_value, '#')[2] as emp_id    -- 员工ID
        ,split(map_value, '#')[3] as allo_prop -- 分配比例
    from(
        select 
            agt_id
            ,map(
                'rela1', concat_ws('#', Inr_Org_Id_1, Div_Org_Id_1, Cust_Mngr_Emp_Id_1, Allo_Prop_1)
                ,'rela2', concat_ws('#', Inr_Org_Id_2, Div_Org_Id_2, Cust_Mngr_Emp_Id_2, Allo_Prop_2)
                ,'rela3', concat_ws('#', Inr_Org_Id_3, Div_Org_Id_3, Cust_Mngr_Emp_Id_3, Allo_Prop_3)
            ) as map_kv
        from pdata_n.t98_otc_comp_mng_rela_info
        where busi_date = '${yyyy-MM-dd}'
    ) s1
    lateral view explode(s1.map_kv) map_kv as map_key,map_value
)

SELECT grp.grp_id AS grp_id, index.index_val, from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss'), 'wxliangjiaqi' modify_operator, '2999-12-31 00:00:00' modify_time, '1' status, 'ind2025071898619889' index_id, index.busi_date busi_date, tag_id FROM (
-- 当年有效合约日均动态名义本金
-- 1.按营业部汇总
select
    rela.inr_org_id as grp_val
    ,'BUSINESSOFFICE' as grp_type_code
    ,'tag999999999' as tag_id
    ,sum(t0.agt_scal_yearapd * rela.allo_prop) as index_val
    ,'${yyyy-MM-dd}' as busi_date
from nom_prin t0
join comp_mng_rela rela
on t0.agt_id = rela.agt_id
and rela.inr_org_id <> ''
group by rela.inr_org_id

union all
-- 2.按分公司汇总
select
    rela.div_org_id as grp_val
    ,'BRANCHOFFICE' as grp_type_code
    ,'tag999999999' as tag_id
    ,sum(t0.agt_scal_yearapd * rela.allo_prop) as index_val
    ,'${yyyy-MM-dd}' as busi_date
from nom_prin t0
join comp_mng_rela rela
on t0.agt_id = rela.agt_id
and rela.div_org_id <> ''
group by rela.div_org_id

union all
-- 3.按员工汇总
select
    rela.emp_id as grp_val
    ,'STAFF' as grp_type_code
    ,'tag999999999' as tag_id
    ,sum(t0.agt_scal_yearapd * rela.allo_prop) as index_val
    ,'${yyyy-MM-dd}' as busi_date
from nom_prin t0
join comp_mng_rela rela
on t0.agt_id = rela.agt_id
and rela.emp_id <> ''
group by rela.emp_id

union all
-- 4.按分公司、合约类型汇总
select
    rela.div_org_id as grp_val
    ,'BRANCHOFFICE' as grp_type_code
    ,tag.tag_id
    ,sum(t0.agt_scal_yearapd * rela.allo_prop) as index_val
    ,'${yyyy-MM-dd}' as busi_date
from nom_prin t0
join comp_mng_rela rela
on t0.agt_id = rela.agt_id
and rela.div_org_id <> ''
left join(
    -- OTC报表合约类型
    select 
        s0.grp_val -- 源合约类型
        ,s1.tag_id -- 报表合约类型
    from(select grp_id, grp_val from dm_index_n.grp_def where status = '1' and grp_type_code = 'OTC_DERI_CONTR_TYPE') s0
    join(select grp_id, tag_id from dm_index_n.grp_tag_OTC_DERI_CONTR_TYPE_rpt_contr_type where busi_date = '${yyyy-MM-dd}') s1
    on s0.grp_id = s1.grp_id
) tag
on t0.Src_Contr_Type = tag.grp_val
group by
    rela.div_org_id
    ,tag.tag_id
	) index JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('BRANCHOFFICE', 'BUSINESSOFFICE', 'STAFF')) grp ON index.grp_type_code = (CASE WHEN grp.grp_type_code IN ('INDV_CUST','CORP_CUST') THEN 'CLIENT' ELSE grp.grp_type_code END) AND index.grp_val = grp.grp_val