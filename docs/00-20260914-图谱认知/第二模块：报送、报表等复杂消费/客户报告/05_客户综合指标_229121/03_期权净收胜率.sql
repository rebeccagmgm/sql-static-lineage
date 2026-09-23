-- 期权净收为负占比 t2：仅欧式香草/安全气囊的起始计提行，接报告日01销售合约主信息。
-- net_coll=交易净收；SQL以<0计数，但币种、收付符号业务解释须另核。
-- 每个类别分子 / 同USCC两类别全部匹配行数；不是各类别自己的胜率，也未数DISTINCT合约。
-- 内连接按 Agt_Id；重复主信息可增加分子/分母。输出类别串顺序不保证。
    SELECT
        USCC as company_id
        ,concat_ws(',', collect_list(concat(category, ':', win_ratio))) as cust_win_rate
    from (
        -- @include 03.1_期权样本与类别计数.sql
    ) t
    group by USCC
