-- 增信资料 cm：履保方案→当日对手方名称资料，按 Full_Name_En 与客户中文全名直接匹配。
-- T01_CUTP_PERF_MARG_PLAN_INFO来源D_MARGIN_PLAN；T01_PTY_NAME来源D_REF_COUNTER_PARTY。
-- 输出 Shor_Name_Ch（中文简称）去重拼接，SQL没有提取担保品、担保方式或方案条款。
    SELECT
        n.Full_Name_En as company_name
        ,concat_ws(';', collect_set(n.Shor_Name_Ch)) as credit_measure
    from pdata_n.T01_CUTP_PERF_MARG_PLAN_INFO p
    inner join pdata_n.T01_PTY_NAME n
        on p.Pty_Id = n.Pty_Id
        and n.src_tbl = 'ODATA_N_TIT.D_REF_COUNTER_PARTY'
        and n.busi_date = '${yyyy-MM-dd}'
    where p.busi_date = '${yyyy-MM-dd}'
      and p.src_tbl = 'ODATA_N_TIT.D_MARGIN_PLAN'
    group by n.Full_Name_En
