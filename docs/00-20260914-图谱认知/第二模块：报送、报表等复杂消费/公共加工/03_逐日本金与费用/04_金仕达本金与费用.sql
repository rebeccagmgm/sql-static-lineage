/*
04 / 金仕达的本金、利息、交易收入，是否都按同一天取值？

不是。本文件有三条并行取数线，在主脚本分别连接：
  ks   金额与用资：确认记录按业务日形成区间，延续到下一条记录前一天。
  ks_t 交易收入成本：直接匹配业务日，不延续；最终缺失补0。
  prop 保证金比例：风控记录先按合约、生成日取一条，再形成延续区间。

确认信息源表：odata_n_tit.d_ks_trade_comfirm_info（交易确认书信息表）。
  key_trade_comfirm_id=金仕达交易确认书id，接合约主信息的Agt_Id。
  dynamic_notional=动态名义本金；accrued_interest=当日应记利息；occupy_cost=用资成本。
  profit=股票交易收入，输出到Trd_Cms（交易佣金收入）；
  fee_cost=股票交易成本，输出到Trd_Cms_Cost（交易佣金成本）。
源字段原义与目标字段名不同，不能反过来用“佣金”解释源表所有股票交易收入。

例：18日记录本金1000、利息10、用资成本2，20日有新记录。
  18/19日都可使用18日的这三个值，利息在主脚本乘-1后输出为-10；
  18日profit不会因此延续到19日，19日没对应记录时交易收入输出0。
所以Inta虽取源字段“当日应记利息”，消费结果也可能来自更早的业务日。
*/

-- A① 确认记录划区间：取本次快照的历史；不先筛最近150天，以保留窗口前仍有效的记录。
-- 同确认键、同业务日若有多条，本分支没有去重，也没有稳定的同日先后裁决。
ks_amount_intervals AS (
    select key_trade_comfirm_id, business_date, accrued_interest, occupy_cost, dynamic_notional,
        lead(business_date, 1, date_add('${data_day_str}',1)) over(partition by key_trade_comfirm_id order by business_date) as next_date
    from odata_n_tit.d_ks_trade_comfirm_info -- 交易确认书信息表
    where busi_date = '${data_day_str}'
    ),

-- A② 延续金额：[本业务日，下一业务日前一天]；最后一条以加工日次日作右边界。
ks_amount_days AS (
    select *, date_add(business_date, pos) as Accrued_Date
    from ks_amount_intervals t
    lateral view posexplode(split(space(datediff(next_date, business_date)-1), ' ')) t as pos, val
    ),

-- B 交易收入/成本：仅取最近150天至加工日，直接按business_date匹配；不延续、不求和、不去重。
ks_trade_days AS (
    select key_trade_comfirm_id, profit, fee_cost, business_date as Accrued_Date
    from odata_n_tit.d_ks_trade_comfirm_info -- 交易确认书信息表
    where busi_date = '${data_day_str}'
        and business_date between date_sub('${data_day_str}',150) and '${data_day_str}'
    ),

-- C① 风控比例：GEN_DATE=【AI】业务日期，CONTRACT_ID=【AI】合约编号，GUARANTEE_RATIO=【AI】履约保证比例。
-- datekey2date将日期键转成日期字符串，例如20160101→2016-01-01。
-- 窗口按原GEN_DATE分组，组内又按同一个值排序，不能理解为选中“当天最新版本”。
ks_margin_ranked AS (
    select
        default.datekey2date(GEN_DATE) as GEN_DATE,
        CONTRACT_ID,
        GUARANTEE_RATIO as Marg_Prop,
        row_number() over(partition by CONTRACT_ID, GEN_DATE order by GEN_DATE) as rk
    from odata_n_tit.d_ks_trs_for_risk -- 【AI】TRS风控数据表
    where busi_date = '${data_day_str}'
    ),

-- C② 每个合约、生成日取一条，再用下一日期形成比例的有效区间。
ks_margin_intervals AS (
    select *, lead(GEN_DATE, 1, date_add('${data_day_str}',1)) over(partition by CONTRACT_ID order by GEN_DATE) as next_date
    from ks_margin_ranked a
    where rk = 1
    ),

-- C③ 延续比例；主脚本实际写CONTRACT_ID=info.Agt_Id，不改连Inr_Seri_No。
-- 这个字段叫“合约编号”，却与金仕达确认键相连；编号是否实际匹配仍需数据核验。
ks_margin_days AS (
    select *, date_add(GEN_DATE, pos) as Accrued_Date
    from ks_margin_intervals b
    lateral view posexplode(split(space(datediff(next_date, GEN_DATE)-1), ' ')) t as pos, val
    )
