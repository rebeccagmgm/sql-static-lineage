with Init_Nom_Prin as(
    select 
        Busi_Type,
        Src_Contr_Type,
        Init_Nom_Prin
    from pdata_n.T98_OTC_DERI_COMP_SALE_INFO
    where Busi_Date = '${yyyy-MM-dd}'
    and grp_id in('01','02','03')
    and Strt_Pric_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}'
)

SELECT grp.grp_id AS grp_id, index.index_val, from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') data_time, 'wxliangjiaqi' modify_operator, '2999-12-31 00:00:00' modify_time, '1' status, 'ind2024091151029495' index_id, index.busi_date busi_date, tag_id FROM (

-- 1.tagdim102729 场外衍生品业务类型
SELECT
    '8888' as grp_val,
    'COMPANY' as grp_type_code,
    SUM(t.Init_Nom_Prin) AS index_val,
    tg.tag_id,
    '${yyyy-MM-dd}' as busi_date
FROM Init_Nom_Prin t
left join (
    select tag_id, dim_val from dm_index_n.tag_def where tag_partition_id = 'tagdim102729' and status = '1' and dim_num = '1' and calc_ind = '0'
) tg
on tg.dim_val = t.Busi_Type
group by tg.tag_id

union all
-- 2.tagdim102531 OTC经营分析报表衍生品合约类型
SELECT
    '8888' as grp_val,
    'COMPANY' as grp_type_code,
    SUM(t.Init_Nom_Prin) AS index_val,
    tg.tag_id,
    '${yyyy-MM-dd}' as busi_date
FROM Init_Nom_Prin t
left join(
    select 
        s0.grp_val -- 源合约类型
        ,s1.tag_id -- 报表合约类型
    from(select grp_id, grp_val from dm_index_n.grp_def where status = '1' and grp_type_code = 'OTC_DERI_CONTR_TYPE') s0
    join(select grp_id, tag_id from dm_index_n.grp_tag_OTC_DERI_CONTR_TYPE_rpt_contr_type where busi_date = '${yyyy-MM-dd}') s1
    on s0.grp_id = s1.grp_id
) tg
on t.Src_Contr_Type = tg.grp_val
group by tg.tag_id

union all
-- 3.tagdim101949 场外衍生品合约所属部门
SELECT
    '8888' as grp_val,
    'COMPANY' as grp_type_code,
    SUM(t.Init_Nom_Prin) AS index_val,
    tg.tag_id,
    '${yyyy-MM-dd}' as busi_date
FROM (
    select Book_Agt_Id,
        Ori_Crrd_Nom_Prin * CASE WHEN Crrc_Cd = 'CNY' THEN 1 
                                 WHEN Lcrrc_Crrc_Cd = 'CNY' THEN Lcrrc_Ori_Bgng_Rate 
                                 WHEN Sett_Crrc_Cd = 'CNY' THEN Sett_Bgng_Rate end as Init_Nom_Prin
    from PDATA_N.T98_SB_OTC_SWAP_COMP_INFO
    where busi_date = '${yyyy-MM-dd}' and Comp_Stat_Cd in ('101', '229', '226', '225', '252')
        and Strt_Pric_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}'
    ) t
JOIN (
    select * from PDATA_N.T03_OTC_DERI_BOOK_ADTNL_INFO
    where src_tbl = 'ODATA_N_TIT.D_REF_BOOK' and busi_date = '${yyyy-MM-dd}'
    ) RB
ON t.Book_Agt_Id = RB.Book_Agt_Id
left join (
    select * from dm_index_n.tag_def
    where tag_dim_id = 'tagdim101949' and tag_partition_id = 'tagdim101949'
    ) tg
on tg.dim_val = rb.Bel_Dept
group by tg.tag_id
union all
-- 4.tag510003012 GFS_FICC北上跨境（期货）
SELECT
    '8888' as grp_val,
    'COMPANY' as grp_type_code,
    SUM(t.Init_Nom_Prin) AS index_val,
    'tag510003012' as tag_id,
    '${yyyy-MM-dd}' as busi_date
FROM (
    select Book_Agt_Id,
        Ori_Crrd_Nom_Prin * CASE WHEN Crrc_Cd = 'CNY' THEN 1 
                                 WHEN Lcrrc_Crrc_Cd = 'CNY' THEN Lcrrc_Ori_Bgng_Rate 
                                 WHEN Sett_Crrc_Cd = 'CNY' THEN Sett_Bgng_Rate end as Init_Nom_Prin
    from PDATA_N.T98_SB_OTC_SWAP_COMP_INFO
    where busi_date = '${yyyy-MM-dd}' and Comp_Stat_Cd in ('101', '229', '226', '225', '252')
        and Strt_Pric_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}'
        and Swap_Type_Cd = 'N_CROSS_FUTURE_SWAP' -- 北上跨境（期货）
    ) t
JOIN (
    select * from PDATA_N.T03_OTC_DERI_BOOK_ADTNL_INFO
    where src_tbl = 'ODATA_N_TIT.D_REF_BOOK' and busi_date = '${yyyy-MM-dd}'
    and Bel_Dept = 'GFS_FICC'
    ) RB
ON t.Book_Agt_Id = RB.Book_Agt_Id
union all
-- 5.复合标签：场外衍生品源合约类型，场外衍生品交易对手是否为广发全球资本FICC
SELECT
    '8888' as grp_val,
    'COMPANY' as grp_type_code,
    SUM(t.Init_Nom_Prin) AS index_val,
    tg.tag_id,
    '${yyyy-MM-dd}' as busi_date
FROM (
    select Book_Agt_Id,
        Swap_Type_Cd,
        if(cutp_pty_shor_name = '广发全球资本FICC', '1', '0') as GFGCFICC_flag, -- 交易对手是否为广发全球资本FICC
        Ori_Crrd_Nom_Prin * CASE WHEN Crrc_Cd = 'CNY' THEN 1 
                                 WHEN Lcrrc_Crrc_Cd = 'CNY' THEN Lcrrc_Ori_Bgng_Rate 
                                 WHEN Sett_Crrc_Cd = 'CNY' THEN Sett_Bgng_Rate end as Init_Nom_Prin
    from PDATA_N.T98_SB_OTC_SWAP_COMP_INFO
    where busi_date = '${yyyy-MM-dd}'
        and Strt_Pric_Date between '${yyyy}-01-01' and '${yyyy-MM-dd}'
        and book_agt_id = '10218' -- GS-境内债券TRS-境内对客
        and Comp_Stat_Cd <> '218' -- 218-作废
    ) t
left join (
    -- 复合标签
    select 
        tag1.tag_id,
        tag1.dim_val as Swap_Type_Cd,
        tag2.dim_val as GFGCFICC_flag
    from(
        select * from dm_index_n.tag_def where tag_partition_id = 'tagdim000000' and status = '1' and tag_dim_id in('tagdim102539') -- 场外衍生品源合约类型
    ) tag1
    join(
        select * from dm_index_n.tag_def where tag_partition_id = 'tagdim000000' and status = '1' and tag_dim_id in('tagdim102576') -- 场外衍生品交易对手是否为广发全球资本FICC
    ) tag2
    on tag1.tag_id = tag2.tag_id
) tg
on tg.Swap_Type_Cd = t.Swap_Type_Cd
and tg.GFGCFICC_flag = t.GFGCFICC_flag
group by tg.tag_id
	) index JOIN (SELECT * FROM dm_index_n.grp_def WHERE status='1' AND grp_type_code IN ('COMPANY')) grp ON index.grp_type_code = (CASE WHEN grp.grp_type_code IN ('INDV_CUST','CORP_CUST') THEN 'CLIENT' ELSE grp.grp_type_code END) AND index.grp_val = grp.grp_val