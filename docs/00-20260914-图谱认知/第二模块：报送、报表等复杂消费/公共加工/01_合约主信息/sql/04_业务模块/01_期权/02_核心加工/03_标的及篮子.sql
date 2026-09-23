-- 01期权试点 / 第二站：这份合约挂钩什么标的？
-- 输入 option_base；输出 option_underlying = 原记录 + 下方7个标的属性。
--
-- b.underlying_instrument_id（结构标的内部代码）
--   +--> 工具池 c：债券展示类型
--   +--> 证券 ins：名称、证券集
--   +--> 期货 fu：期货类型
--   \--> 篮子 bc：成分先关联证券/期货，再按篮子证券内码汇总
--          ↓
--   名称/证券集/期货类型按各字段COALESCE取值；只有NULL回退。
--
-- 分类读classification_ins_family；展示读source_underlying_type，两者不能混用。
-- 整个阶段不对合约行去重/聚合；只有篮子自身按原SQL聚合，保留原重复匹配影响。
-- 下方证券/篮子元数据注释沿用本地目录；带【AI】标记的原注释不作为人工确认定义。

instrument_pool AS (
-- key_instrument_id：标的ID；key_pool_id：标的池ID；interotc_underlying_category：报价系统标的小类。
select * from odata_n_tit.r_cfg_instrument_pool_props -- 配置-标的池标的属性表
    where busi_Date = '${data_day_str}' and KEY_POOL_ID = '10000'
),

instrument_snapshot AS (
select *
        from odata_n_tit.d_ref_instrument -- 证券-证券基本信息
        where busi_Date = '${data_day_str}' 
),

future_properties AS (
select *
        from odata_n_tit.d_ref_future_properties -- 【AI】证券-期货信息表（目录原注释）
        where busi_Date = '${data_day_str}' 
),

/**
* 把“篮子证券 → 篮子成分证券 → 成分证券属性”汇总成一行，形成篮子的标签摘要信息。
一个篮子证券（basket）里面有哪些成分证券，然后把成分证券的信息聚合到一行。
**/
basket_summary AS ( 
select
        bc.key_instrument_id, -- 篮子证券内码：汇总结果的分组键
        concat_ws(';',collect_list(ins.ins_sht_desc)) as ins_sht_desc, -- ins_sht_desc：证券简称；成分简称以分号拼接
        concat_ws(';',collect_list(ins.ins_lng_desc)) as ins_lng_desc, -- ins_lng_desc：证券全名；成分全名以分号拼接
        concat_ws(';',collect_set(ins.ins_family)) as ins_family, -- ins_family：证券集，字典项=INSTRUMENTFAMILY；去重拼接
        concat_ws(';',collect_set(fu.future_type)) as future_type -- future_type：期货类型；去重拼接
    from (
        select *
        from odata_n_tit.d_ref_basket_constituent -- 篮子成分表
        where busi_Date = '${data_day_str}' 
        ) bc
    left join (
        select *
        from odata_n_tit.d_ref_instrument -- 证券-证券基本信息
        where busi_Date = '${data_day_str}'
        ) ins
    on ins.key_instrument_id = bc.underlying_inst_id -- ⭐证券内码 = 篮子成分证券内码（不是篮子内码）
    left join (
        select *
        from odata_n_tit.d_ref_future_properties -- 【AI】证券-期货信息表（目录原注释）
        where busi_Date = '${data_day_str}'
        ) fu
    on fu.key_instrument_id = bc.underlying_inst_id -- 证券内码-期货代码 = 篮子成分证券内码
    group by bc.key_instrument_id -- 按篮子证券内码收回每篮子一行；维表重复匹配仍会影响拼接内容
),

underlying_type_dictionary AS (
select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值；dw_cd_val=代码取值，dw_cd_val_desc=取值描述
    where dw_cd_id = 'CD128' and remark = 'TITANS场外衍生品标的类型'
),

/**
* 期权标的（underlying）的标准化画像加工
**/
option_underlying AS ( 
    SELECT b.*,
        -- 分类使用的证券集，不能替换成下方BOND改写后的展示类型
        coalesce(bc.ins_family,ins.ins_family) AS classification_ins_family,
        -- 标的名称：篮子优先，单证券回退
        coalesce(bc.ins_sht_desc,ins.ins_sht_desc) AS underlying_name,
        -- 股票市场/非股票分类：沿用证券集与结构标的币种的判断
        case when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') and b.underlying_currency not in ('HKD', 'USD') then 'OTH_STOCK'
         when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') and b.underlying_currency = 'HKD' then 'HK_STOCK'
         when coalesce(bc.ins_family,ins.ins_family) in ('EQUITY', 'GDR') and b.underlying_currency = 'USD' then 'US_STOCK'
         when coalesce(bc.ins_family,ins.ins_family) not in ('EQUITY', 'GDR') then 'NON_STOCK'
         else '-' end AS underlying_type,
        -- 展示源类型：bond、篮子用证券集
        if(c.interotc_underlying_category = 'BONDS', 'BOND', coalesce(bc.ins_family,ins.ins_family)) AS source_underlying_type,
        -- 展示源类型描述
        if(c.interotc_underlying_category = 'BONDS', '债券', sutd.dw_cd_val_desc) AS source_underlying_type_desc,
        -- 标的全名：篮子优先
        coalesce(bc.ins_lng_desc,ins.ins_lng_desc) AS underlying_long_name,
        -- 期货类型：篮子优先，期货属性回退
        coalesce(bc.future_type,fu.future_type) AS future_type
    FROM option_base b --期权宽表加工
    left join instrument_pool c
on c.key_instrument_id = b.underlying_instrument_id
    left join instrument_snapshot ins --证券信息
on ins.key_instrument_id = b.underlying_instrument_id
    left join future_properties fu --期货信息
on fu.key_instrument_id = b.underlying_instrument_id
    left join basket_summary bc --篮子主体+成分信息
on bc.key_instrument_id = b.underlying_instrument_id
    left join underlying_type_dictionary sutd --标的类型代码
on sutd.dw_cd_val = coalesce(bc.ins_family,ins.ins_family)
)
