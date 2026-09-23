-- 阅读分组：结算净收取 → 首条计提费率 → 票息 → 敲出/敲入 → 执行价档位 → 参与率档位。
-- 模块输出多个CTE而非一张表：结算按交易连、费率按工具连，其余条款先按交易聚合再连接。
-- 各CTE的输出键见下方；不要把原始条款明细互相JOIN后才聚合，那会改变多条款组合的行数。
-- 用途：期权条款
-- CR/KO/KI/STRIKE/PR 分别按 key_otc_trade_id 聚合；结算保持原有粒度，费率按工具选首条。
-- 加工日：${data_day_str}；复用次数1（任务86840）。
-- 期权结算（ODS）：按交易键连接，提供 NET_PNL → net_coll。
-- 这里没有汇总或选最新；多条结算记录可能扩展主查询行数，不能擅自改成一条。
option_settlement AS (
    select *
    -- key_otc_trade_id：内部合约ID；net_pnl：交易净收取（元）。
    from odata_n_tit.d_TRD_OPTION_DEAL_SETTLEMENT -- 【AI】场外交易-期权交易结算表
    WHERE busi_date = '${data_day_str}'
    ),

-- 【初始】期权权利金计提费率
first_premium_fee AS (
    select *
    from (
        SELECT *, row_number() over(partition by KEY_INSTRUMENT_ID order by CALC_DATE) as rn -- calc_date：计提日期
        FROM odata_n_tit.d_trd_daily_accrual_fee -- 【AI】按日应计提费用表
        where busi_Date = '${data_day_str}' and fee_type = 'ACCRUAL_PREMIUM_FEE' --期权日计提费用类型
        ) t
    where rn = 1
    ),

-- 票息（RODC）：结构化期权产品中的票息条款（coupon / yield component），常见于雪球、自动赎回等带票息收益的产品
-- 按交易键把 COUPON_RATE 转 double 再转 string，去重并用分号拼接。
coupon_terms AS (
    SELECT KEY_OTC_TRADE_ID, concat_ws(';',collect_set(cast(cast(COUPON_RATE as double) as string))) as COUPON_RATE
    FROM odata_n_tit.d_REF_OPTION_DEAL_CR -- 【AI】场外交易-期权合约结构-票息表
    where busi_date = '${data_day_str}'
    group by KEY_OTC_TRADE_ID
    ),

--提取自动赎回类期权（Autocall，雪球等）里的障碍条款（Barrier Terms）。
    -- 敲出（KO）：按交易键取观察日最小/最大值，上下敲出障碍比例分别去重拼接。
    -- 输出模块用 coalesce(上障碍,下障碍)，是优先取非NULL值，不是合并上下障碍。
knockout_terms AS (
    SELECT 
        KEY_OTC_TRADE_ID,
        MIN(substring(OBS_DATE,1,10)) as MIN_OBS_DATE,--OBS_DATE：最小观察日；
        Max(substring(OBS_DATE,1,10)) as Max_OBS_DATE,--OBS_DATE：最大观察日；
        concat_ws(';',collect_set(cast(cast(UP_KO_BARRIER_PCT as double) as string))) as UP_KO_BARRIER_PCT, --上敲出障碍%
        concat_ws(';',collect_set(cast(cast(DOWN_KO_BARRIER_PCT as double) as string))) as DOWN_KO_BARRIER_PCT --下敲出障碍%
    FROM odata_n_tit.d_REF_OP_DEAL_AUTOCALL_KODATE -- 【AI】场外交易-期权敲出观察日及票息信息
    where busi_date = '${data_day_str}'
    GROUP BY KEY_OTC_TRADE_ID
    ),

-- 敲入（KI）：按交易键汇总下敲入障碍比例，转数值后去重拼接。
-- 一行对应一个交易键；多档障碍保留为字符串，不压缩成单个价格。
knockin_terms AS (
    SELECT 
        KEY_OTC_TRADE_ID,
        concat_ws(';',collect_set(cast(cast(DOWN_KI_BARRIER_PCT as double) as string))) as DOWN_KI_BARRIER_PCT --下敲入障碍（%）。
    FROM odata_n_tit.d_REF_OP_DEAL_AUTOCALL_KIDATE -- 【AI】场外交易-期权敲入观察日及票息信息
    where busi_date = '${data_day_str}'
    GROUP BY KEY_OTC_TRADE_ID
    ),

-- 执行价档位（STk）：SEQ=0/1/2 分别生成执行价、下跌保护执行价、封顶价。
-- 每档用 max(if(...,数值,0))；非本档行的0可能影响最大值，不能随意改为NULL。
strike_terms AS (
    select
        KEY_OTC_TRADE_ID,
        max(if(SEQ = '0', cast(STRIKE_PCT as double), 0)) as Strk_PCT,  --普通执行价
        max(if(SEQ = '1', cast(STRIKE_PCT as double), 0)) as DOWN_Strk_PCT, --下保护执行价
        max(if(SEQ = '2', cast(STRIKE_PCT as double), 0)) as UP_Strk_PCT --上封顶执行价
    from odata_n_tit.d_REF_OPTION_DEAL_STRIKE -- 【AI】场外交易-期权合约结构-执行价格
    where busi_date = '${data_day_str}'
    group by KEY_OTC_TRADE_ID
    ),

--把期权结构里的参与率（Participation Rate）按方向拆成向上参与率和向下参与率。
--参与率：标的涨跌幅，有多少比例计入产品收益计算。
    --向上参与：标的上涨→参与收益
    --向下参与：标的下跌→按比例计算损益
-- 参与率档位（pr）：SEQ=0/1 分别生成向上/向下参与率，按交易键聚合。
-- 同样沿用 max(if(...,数值,0))；不把多条参与率求和或取平均。
participation_terms AS (
    SELECT
        KEY_OTC_TRADE_ID,
        max(if(SEQ = '0', cast(participation_rate as double), 0)) as Up_Prtc_rate, --向上参与率
        max(if(SEQ = '1', cast(participation_rate as double), 0)) as Down_Prtc_rate  --向下参与率
    -- KEY_OTC_TRADE_ID：内部合约ID；SEQ：参与率序号；participation_rate：参与率（%）。
    FROM odata_n_tit.d_REF_OPTION_DEAL_PR -- 【AI】场外交易-期权合约结构-参与率表
    WHERE busi_date = '${data_day_str}'
    group by KEY_OTC_TRADE_ID
    )
