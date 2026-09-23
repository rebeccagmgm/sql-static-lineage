-- 用途：为B2B期权计算可在期初记一次的估值收入；不是逐日本金，也不使用基础系数。
-- 输入：当前合约主信息中的Bgng_Npv（元数据：期初NPV）、Rel_Agt_Id（关联合约编号）。
-- 输出b2b_initial_value，每个x.agt_id聚合一行；04按合约号LEFT JOIN为npv。
-- 先拆关联编号，再取MAX自身估值+SUM关联估值，避免自身值随关联数重复加。
-- MAX/SUM都没有补0；关联全部缺失时SUM为NULL，最终initial_npv仍为NULL。
-- INR_DEMO变为B2B：自身1200，关联REL_A=-200、REL_B=-100 → initial_npv=900。
-- 04仅在期初日输出900，05分给主360/引入540，随后累计保持这些值。
select
    x.agt_id,
    -- 拆关系后的两行自身1200取MAX一次；两行关联分别-200/-100再SUM。
    max(x.Bgng_Npv) + sum(z.Bgng_Npv) as initial_npv
-- 第一步：从当前主信息中的B2B合约拆关联合约号，不trim、不去重。
from (
    select agt_id, x.rel_agt_id, Bgng_Npv
    from (
        select agt_id, rel_agt_id, Bgng_Npv from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
        where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2023-01-01' and hedg_type_cd = 'B2B'
        ) t
    lateral view explode(split(rel_agt_id,',')) x as rel_agt_id
    ) x
-- 第二步：关联合约只要求当前加工日；不要求它也属于B2B或也通过主体范围条件。
left join (
    select
        agt_id,
        Bgng_Npv
    from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}'
    ) z
on x.rel_agt_id = z.agt_id
-- 第三步：按自身合约汇总。仅REL_A命中时1200-200=1000；全部不命中则NULL。
-- 若关系REL_A重复两次，SUM会重复计入；MAX自身值不能替关联关系去重。
group by x.agt_id
