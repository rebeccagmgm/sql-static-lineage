/*
03 / 一张确认书挂钩哪些标的？
输入：odata_n_tit.d_ks_trs_eod_postion（日终持仓表视图）的加工日快照。
本文件名称保留原业务主题编号；实际不读取期权篮子成分表。

持仓记录
  → ① 按“确认书+标的”排序
  → ② 每个标的只取最新记录
  → ③ 补证券全名、证券集、币种和类型中文名
  → ④ 按确认书拼出标的清单
输出underlying_summary，主脚本别名ins。本金不在这里算，见11。
*/

/* ① 排序：同一标的的哪一天持仓较新？
   key_trade_comfirm_id：金仕达交易确认书编号ID。
   underlying_wind_code：底层资产WIND代码。
   src_busi_date：持仓日期（源头BUSI_DATE）；不是本次读取的快照日busi_date。
*/
ranked_positions AS (
    select *,
        row_number() over(
            partition by key_trade_comfirm_id, underlying_wind_code
            order by src_busi_date desc
        ) as rn
    from odata_n_tit.d_ks_trs_eod_postion -- 日终持仓表视图（元数据名称）
    where busi_date = '${data_day_str}'
),

/* ② 取最新：每“确认书+WIND代码”保留1条
   各标的分别选最新，可能不是同一天；不要求持仓日=加工日，也不检查数量非零。
   日期并列时没有第二排序键。
*/
latest_positions AS (
    select
        x.key_trade_comfirm_id, -- 交易确认书ID
        x.underlying_wind_code as un_code, -- 底层资产WIND代码
        x.wind_name as un_name -- 底层资产证券名称
    from ranked_positions x
    where x.rn = 1
),

/* ③ 补资料：持仓只有代码和名称，还需要证券类别、币种等信息
   b = 上一步的持仓标的；d = 证券基本信息；sutd = CD128标的类型字典。
   用WIND代码连接，不是证券内码；多条证券/字典匹配会保留，不在此去重。
*/
position_details AS (
    select
        b.key_trade_comfirm_id as key_trade_comfirm_id, -- 确认书ID
        b.un_code as un_code, -- 持仓中的WIND代码
        b.un_name as un_name, -- 持仓中的名称
        d.ins_lng_desc as ins_lng_desc, -- 证券全名
        d.ins_family as ins_family, -- 证券集，决定股票/非股票分类
        d.currency as currency, -- 证券币种，参与市场分类
        sutd.dw_cd_val_desc as dw_cd_val_desc -- 源标的类型中文描述
    from latest_positions b
    left join (
        select * from odata_n_tit.d_ref_instrument where busi_Date = '${data_day_str}' -- 证券-证券基本信息
    ) d
        on d.wind_code = b.un_code
    left join (
        select *
        from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值
        where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
    ) sutd
        on sutd.dw_cd_val = d.ins_family
),

/* ④ 汇总：每确认书输出1组标的清单
   p = 上一步补齐的标的资料，字段来源见③，不是新的物理表。
   名称/代码用分号保留列表；类型/币种用逗号去重拼接。均无排序保证，不能按位置配对。
*/
underlying_summary AS (
    select
        p.key_trade_comfirm_id, -- 汇总键，也是接回确认书的键
        '' as Undrl_Ins_Id, -- 标的内部ID：本分支固定空串
        concat_ws(';',collect_list(p.un_code)) as Undrl_Wd_Cd, -- 标的WIND代码
        concat_ws(';',collect_list(p.un_name)) as Undrl_Name, -- 持仓来源的名称
        concat_ws(';',collect_list(p.ins_lng_desc)) as Undrl_Long_Name, -- 证券全名
        -- 股票/GDR/篮子按币种分市场；其他证券集为非股票，信息不足时为'-'。
        concat_ws(',',collect_set(case
            when p.ins_family in ('EQUITY', 'GDR', 'BASKET') and p.currency not in ('HKD', 'USD') then 'OTH_STOCK'
            when p.ins_family in ('EQUITY', 'GDR', 'BASKET') and p.currency = 'HKD' then 'HK_STOCK'
            when p.ins_family in ('EQUITY', 'GDR', 'BASKET') and p.currency = 'USD' then 'US_STOCK'
            when p.ins_family not in ('EQUITY', 'GDR', 'BASKET') then 'NON_STOCK'
            else '-' end)) as Undrl_Type,
        '' as Undrl_Type_Desc, -- 标的类型描述：固定空串
        concat_ws(',',collect_set(p.ins_family)) as Src_Undrl_Type, -- 源证券集
        concat_ws(',',collect_set(p.dw_cd_val_desc)) as Src_Undrl_Type_Desc, -- 类型中文描述
        concat_ws(',',collect_set(coalesce(p.currency,''))) as Undrl_Curr -- 标的币种
    from position_details p
    group by p.key_trade_comfirm_id
)
-- 主脚本还要求Undrl_Wd_Cd非NULL；没有匹配本汇总的确认书会被剔除，但空字符串不等于NULL。
