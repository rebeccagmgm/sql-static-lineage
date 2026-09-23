/*
07 / 这条结构腿挂钩哪些资产，初始规模有多大？

期权分支直接读取合约上的initial_notional；普通互换在这里从持仓明细汇总：
  ① ranked_initial_positions  历史排序：每个“腿 + 标的”按源业务日从早到晚编号
    ↓
  ② first_initial_positions   选初始记录：每组只取rk=1
    ↓
  ③ initial_position_details  补标的属性：证券、工具池、期货类型和类型字典
    ↓
  ④ initial_position          按腿汇总：初始本金 = Σ（期初交易价 × 初始数量）
                                       同时拼出标的代码、名称、类型、币种

此处输出两类信息：持仓金额供10_本金与汇率.sql折算人民币；
标的属性供09_经营分类.sql判断类别，并在11_输出字段.sql展示。

两个日期分开看：
  busi_date     → 本次读取的加工日快照；本地元数据备注为空，含义按本SQL过滤用途说明。
  src_busi_date → 【AI】源业务日期；用它决定每个“腿 + 标的”的先后顺序。
最早记录按每个标的分别选，可能来自不同日期，并非全腿统一的某一天持仓；
若某标的后来才出现，它在可见历史中的首条记录也可能被选中。
*/

-- ① 历史排序：还保留所有历史记录，只增加每组内部的先后编号。
-- “初始”限于当前快照可见历史；日期并列未加裁决键。
ranked_initial_positions AS (
    select *,row_number() over(partition by key_leg_id, underlying_ins_id order by src_busi_date) as rk
    from odata_n_tit.d_pos_trs_leg_his_pos -- 【AI】持仓-TRS浮动及结构化腿历史持仓
    where busi_Date = '${data_day_str}'
    ),

-- ② 选初始记录：一行对应一个“腿 + 标的”；此时尚未补维表、未汇总本金。
first_initial_positions AS (
    select *
    from ranked_initial_positions
    where rk = 1
    ),

-- ③ 补标的属性：t仍是初始持仓；只把下一步会用到的字段列出来。
-- 证券、工具池、期货属性按加工日取值；类型字典按CD128及备注限定，不带日期条件。
-- 保留原LEFT JOIN及其多条匹配；此步不去重，匹配放大仍会传递到本金汇总。
initial_position_details AS (
    SELECT
        t.key_leg_id as key_leg_id, -- 按腿汇总键；历史持仓表元数据备注为空
        t.underlying_ins_id as underlying_ins_id, -- 【AI】持仓证券内码
        t.wind_code as wind_code, -- 【AI】持仓WIND代码
        t.ins_sht_desc as ins_sht_desc, -- 【AI】证券简称；仍取持仓表，不改取证券表
        t.Init_Price as Init_Price, -- 【AI】期初交易价
        t.Init_Quantity as Init_Quantity, -- 【AI】初始数量
        c.interotc_underlying_category as interotc_underlying_category, -- 工具池标的小类；识别BONDS
        d.ins_family as ins_family, -- 证券集；经营分类与展示使用
        d.currency as currency, -- 证券表币种，不是持仓表同名currency
        d.ins_lng_desc as ins_lng_desc, -- 证券全名
        sutd.dw_cd_val_desc as dw_cd_val_desc, -- 各标的证券集先查字典
        f.future_type as future_type -- 期货类型
    FROM first_initial_positions t
    left join (
        select * from odata_n_tit.r_cfg_instrument_pool_props -- 配置-标的池标的属性表
        where busi_Date = '${data_day_str}' and KEY_POOL_ID = '10000'
        ) c
    on c.key_instrument_id = t.underlying_ins_id -- 连接的是持仓证券内码，不是key_leg_id
    left join (
        select * from odata_n_tit.d_ref_instrument where busi_Date = '${data_day_str}' -- 证券-证券基本信息
        ) d
    on d.key_instrument_id = t.underlying_ins_id
    left join (
        select * from odata_n_tit.d_ref_future_properties where busi_Date = '${data_day_str}' -- 【AI】证券-期货信息表
        ) f
    on f.key_instrument_id = t.underlying_ins_id
    left join (
        select *
        from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值；CD128限定TITANS场外衍生品标的类型
        where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
        ) sutd
    on sutd.dw_cd_val = d.ins_family
    ),

-- ④ 按腿汇总：p是上一步补完属性的明细；现在才把多标的合并为一行。
-- initial_position在主脚本中别名为his_ini；his_ini.Nom_Prin就是这里算出的初始持仓金额。
-- collect_list保留重复、collect_set去重；各列未指定顺序，不能按分号位置逐项配对。
initial_position AS (
    SELECT
        p.key_leg_id,
        concat_ws(';',collect_list(p.underlying_ins_id)) as underlying_ins_id,
        concat_ws(';',collect_list(p.wind_code)) as wind_code,
        concat_ws(';',collect_list(p.ins_sht_desc)) as ins_sht_desc,
        concat_ws(';',collect_set(p.interotc_underlying_category)) as interotc_underlying_category,
        concat_ws(';',collect_set(p.ins_family)) as ins_family,
        concat_ws(';',collect_set(p.currency)) as currency,
        concat_ws(';',collect_set(p.ins_lng_desc)) as ins_lng_desc,
        concat_ws(';',collect_set(p.dw_cd_val_desc)) as dw_cd_val_desc,
        concat_ws(';',collect_set(p.future_type)) as future_type,
        sum(p.Init_Price * p.Init_Quantity) as Nom_Prin -- 初始本金；尚未乘人民币汇率
    FROM initial_position_details p
    group by key_leg_id -- 一行一条腿，不保证主查询最终一合约一行
    )
