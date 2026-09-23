/*
07 / 初始本金和展示标的，怎样从历史持仓中选出来？

源表：odata_n_tit.d_pos_fast_trs_leg_his_pos（北上极速腿历史持仓表）。
只读加工日快照中的EOD_POSITION（日终持仓），按“合约工具键＋标的代码”找最早记录。

  历史排序 → 每个标的选最早一条 → 补标的资料和类型 → 按合约工具键汇总
                                                       ├─ 初始本金
                                                       └─ 展示标的摘要

关键字段：
  key_instrument_id → 本持仓表注释为“合约ID”，接交易表的同名工具键。
  wind_code         → 标的代码，用它区分同一合约下的标的；不是按underlying_ins_id分组排序。
  src_busi_date     → 持仓日期（源头的busi_date），决定最早记录。
  busi_date         → 数据日期，这里用于限定本次加工快照。
  dynamic_notional  → 动态名义本金（标的币种）。取最早记录上的这个字段，汇总为初始本金；
                      没有改取notional，也没有重算期初价格×数量。

“最早”按各标的分别选，不一定是同一个日期；后来加入的标的也可能纳入。
最终initial_position在主脚本中别名为dy：这里dy表示初始结果，不是当日持仓。
*/

-- ① 历史排序：同一合约工具键、同一WIND代码，从早到晚编号；同日并列未加裁决键。
ranked_initial_positions AS (
    SELECT *,row_number() over(partition by key_instrument_id, wind_code order by src_busi_date) as rk
    FROM odata_n_tit.d_pos_fast_trs_leg_his_pos -- 北上极速腿历史持仓表
    where busi_Date = '${data_day_str}' and position_type = 'EOD_POSITION'
    ),

-- ② 选最早记录：每个“合约工具键＋标的代码”一行，还没有汇总本金。
first_initial_positions AS (
    SELECT *
    FROM ranked_initial_positions
    where rk = 1
    ),

-- ③ 补标的资料：dy为所选持仓，d为证券基本信息；两边的类型、币种来源要分开。
-- 持仓WIND代码 → 证券WIND代码 → 证券内码 → 期货属性；字典按证券表的证券集取中文名。
-- 保留LEFT JOIN的多条匹配，不去重；因此后面的本金汇总可能受维表重复影响。
initial_position_details AS (
    SELECT
        dy.key_instrument_id as key_instrument_id, -- 合约侧工具键，不是下方证券表的证券内码
        dy.underlying_ins_id as underlying_ins_id, -- 标的ID
        dy.wind_code as wind_code, -- 标的代码
        dy.ins_sht_desc as ins_sht_desc, -- 标的简称，取持仓表
        d.ins_lng_desc as ins_lng_desc, -- 证券全名，取证券基本信息
        -- 标的市场分类：持仓的类型＋证券表的币种；不是按持仓币种判断HK/US。
        -- OTH_STOCK=其他股票市场，HK_STOCK=港股，US_STOCK=美股，NON_STOCK=非股票；“-”为未匹配。
        case when dy.ins_family in ('EQUITY', 'GDR', 'BASKET') and d.currency not in ('HKD', 'USD') then 'OTH_STOCK'
             when dy.ins_family in ('EQUITY', 'GDR', 'BASKET') and d.currency = 'HKD' then 'HK_STOCK'
             when dy.ins_family in ('EQUITY', 'GDR', 'BASKET') and d.currency = 'USD' then 'US_STOCK'
             when dy.ins_family not in ('EQUITY', 'GDR', 'BASKET') then 'NON_STOCK'
             else '-' end as underlying_type,
        dy.ins_family as ins_family, -- 源标的类型：持仓表的标的类型
        sutd.dw_cd_val_desc as dw_cd_val_desc, -- 源类型描述却按证券表ins_family查字典，原SQL并非同一来源
        dy.currency as currency, -- 展示币种取持仓表，不是上述市场分类使用的证券表币种
        f.future_type as future_type, -- 期货类型
        dy.dynamic_notional as dynamic_notional -- 所选最早记录的动态名义本金（标的币种）
    FROM first_initial_positions dy
    left join (
        select * from odata_n_tit.d_ref_instrument where busi_Date = '${data_day_str}' -- 证券-证券基本信息
        ) d
    on d.wind_code = dy.wind_code
    left join (
        select * from odata_n_tit.d_ref_future_properties where busi_Date = '${data_day_str}' -- 【AI】证券-期货信息表
        ) f
    on f.key_instrument_id = d.key_instrument_id
    left join (
        select *
        from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值
        where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
        ) sutd
    on sutd.dw_cd_val = d.ins_family
    ),

-- ④ 按合约工具键汇总：p是上一步明细；本金已经由源系统提供，本步只求和。
-- 名称/代码用分号、类型/币种用逗号；各列独立收集且无指定顺序，不能按位置配对。
-- collect_list保留重复，collect_set去重；不等于对本金明细去重。
initial_position AS (
    select
        p.key_instrument_id,
        concat_ws(';',collect_list(p.underlying_ins_id)) as Undrl_Ins_Id,
        concat_ws(';',collect_list(p.wind_code)) as Undrl_Wd_Cd,
        concat_ws(';',collect_list(p.ins_sht_desc)) as Undrl_Name,
        concat_ws(';',collect_list(p.ins_lng_desc)) as Undrl_Long_Name,
        concat_ws(',',collect_set(p.underlying_type)) as Undrl_Type,
        '' as Undrl_Type_Desc,
        concat_ws(',',collect_set(p.ins_family)) as Src_Undrl_Type,
        concat_ws(',',collect_set(p.dw_cd_val_desc)) as Src_Undrl_Type_Desc,
        concat_ws(',',collect_set(coalesce(p.currency,''))) as Undrl_Curr,
        concat_ws(',',collect_set(p.future_type)) as future_type,
        sum(p.dynamic_notional) as Init_Nom_Prin -- 初始名义本金；未在此换汇
    FROM initial_position_details p
    group by p.key_instrument_id
    )
