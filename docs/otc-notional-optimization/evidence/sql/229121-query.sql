
SELECT company_name,
	company_id,
	contact_sales,
	sales_login,
	cust_hold_win_rate,
	cust_win_rate,
	margin_ratio,
	margin_call_line,
	margin_grade,
	risk_test_data,
	outst_margin_amount,
	used_quota,
	approved_quota,
	approved_busi_type,
	margin_call_rate,
	cust_advance_info,
	credit_measure,
	cust_satisfaction_score,
	cust_satisfaction_feedback,
	swap_turnover_rate,
	swap_new_principal,
	swap_outst_month_end,
	swap_platform_fee,
	swap_bond_interest,
	swap_commission,
	busi_date FROM (
	 SELECT
    t0.company_name                    -- 公司名称
    ,t0.company_id                     -- 公司ID/USCC
    ,t0.contact_sales                  -- 对接销售
    ,t0.sales_login                    -- 销售LOGIN
    ,t1.cust_hold_win_rate             -- 客户持仓总胜率
    ,t2.cust_win_rate                  -- 客户胜率
    ,m1.margin_ratio                   -- 履保比例
    ,m2.margin_call_line               -- 追保线
    ,null as margin_grade              -- 履保分级
    ,null as risk_test_data            -- 风险压测数据
    ,coalesce(perf.perf_dyna_nom_prin, 0) / 10000 as outst_margin_amount       -- 存续履保交易规模(万元)
    ,coalesce(perf.perf_dyna_nom_prin, 0) / 10000 as used_quota                -- 已用额度(万元)
    ,lim.approved_limit / 10000 as approved_quota            -- 获批额度(万元)
    ,lim.approved_type as approved_busi_type        -- 获批的业务类型
    ,mc.margin_call_rate            -- 及时追保完成率
    ,adv.cust_advance_info           -- 客户垫资情况(如有)
    ,cm.credit_measure              -- 增信措施(如有)
    ,null as cust_satisfaction_score     -- 客户满意度总分
    ,null as cust_satisfaction_feedback  -- 客户满意度改进意见
    ,t3.swap_turnover_rate             -- 互换业务本月换手率
    ,t3.swap_new_principal   / 10000     as swap_new_principal   -- 互换业务本月新增本金(万元)
    ,t3.swap_outst_month_end / 100000000 as swap_outst_month_end -- 互换业务上月末存续(亿元)
    ,fee.swap_platform_fee   / 10000     as swap_platform_fee    -- 互换业务平台费(万元)
    ,fee.swap_bond_interest  / 10000     as swap_bond_interest   -- 互换业务券息(万元)
    ,com.swap_commission     / 10000     as swap_commission      -- 互换业务佣金(万元)
    ,'${yyyy-MM-dd}' as busi_date            -- 业务日期
from (

    /*====================================================================================
    * [模块00] 主表：近一年有计提记录的公司 + 经办人信息
    * 数据源    : DM_OTC_N.OTC_REV_DAILY_RPT
    * 关联表    : T01_OTC_DERI_CUST, T98_ORG_EMP_BASE_INFO
    * 过滤条件  : Accrued_Date 近一年
    * 输出字段  : company_name, company_id, contact_sales, sales_login
    *===================================================================================*/
    SELECT 
        r.Cutp_Pty_Full_Name as company_name
        ,r.USCC as company_id
        ,concat_ws(';', collect_set(e.Emp_Name)) as contact_sales
        ,concat_ws(';', collect_set(c.Oper_User_Id)) as sales_login
    from DM_OTC_N.OTC_REV_DAILY_RPT r
    left join pdata_n.T01_OTC_DERI_CUST c
        on r.Cutp_Pty_Id = c.Pty_Id
        and c.BUSI_DATE = '${yyyy-MM-dd}'
        and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
    left join pdata_n.T98_ORG_EMP_BASE_INFO e
        on c.Oper_User_Id = e.Oa_User_Id
        and e.BUSI_DATE = '${yyyy-MM-dd}'
    where r.busi_date = '${yyyy-MM-dd}'
    and r.grp_id in('01','02','03') -- 期权、互换、金仕达
    and r.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
    group by r.Cutp_Pty_Full_Name, r.USCC
) t0

/*====================================================================================
 * [模块01] 客户持仓总胜率
 * 计算逻辑  : 日期区间创收之和为正的笔数/总笔数
 * 数据源    : DM_OTC_N.OTC_REV_DAILY_RPT
 * 过滤条件  : 已终止合约 (coalesce(Early_Term_Date, End_Pric_Date) <= 业务日期)
 * 输出字段  : company_id, cust_hold_win_rate
 *===================================================================================*/
left join (
    SELECT
        t.company_name
        ,t.company_id
        ,sum(case when t.contract_rev > 0 then 1 else 0 end) / count(*) as cust_hold_win_rate
    from (
        SELECT
            Cutp_Pty_Full_Name as company_name
            ,USCC as company_id
            ,Agt_Id
            ,sum(cast(Curr_Rev as double)) as contract_rev
        from DM_OTC_N.OTC_REV_DAILY_RPT
        where busi_date = '${yyyy-MM-dd}'
          and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
          and coalesce(Early_Term_Date, End_Pric_Date) <= '${yyyy-MM-dd}'
        group by USCC, Cutp_Pty_Full_Name, Agt_Id
    ) t
    group by t.company_name, t.company_id
) t1 on t0.company_id = t1.company_id

/*====================================================================================
 * [模块02] 期权业务客户胜率
 * 计算逻辑  : 交易净收<0视为我司支付(客户盈利), 胜率=支付笔数/公司级总笔数
 * 数据源    : DM_OTC_N.OTC_REV_DAILY_RPT, T98_OTC_DERI_COMP_SALE_INFO
 * 过滤条件  : 首次计提日, 仅计算欧式香草/安全气囊两种类型
 * 类型归并  : 欧式香草→欧式期权; 安全气囊→安全气囊
 * 输出字段  : company_id, cust_win_rate (格式: 类型:胜率)
 *===================================================================================*/
left join (
    SELECT
        USCC as company_id
        ,concat_ws(',', collect_list(concat(category, ':', win_ratio))) as cust_win_rate
    from (
        SELECT
            r.USCC
            ,case
                when r.Src_Contr_Type_Desc = '欧式香草' then '欧式期权'
                else '安全气囊'
             end as category
            ,sum(case when cast(s.net_coll as double) < 0 then 1 else 0 end)
             / sum(count(*)) over(partition by r.USCC) as win_ratio
        from DM_OTC_N.OTC_REV_DAILY_RPT r
        inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s
            on r.Agt_Id = s.Agt_Id
            and s.busi_date = '${yyyy-MM-dd}'
            and s.grp_id = '01'
        where r.busi_date = '${yyyy-MM-dd}'
          and r.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
          and r.Accrued_Date = r.Strt_Pric_Date
          and r.Src_Contr_Type_Desc in ('欧式香草', '安全气囊')
        group by r.USCC, r.Src_Contr_Type_Desc
    ) t
    group by USCC
) t2 on t0.company_id = t2.company_id

/*====================================================================================
 * [模块03] 互换业务月换手率
 * 计算逻辑  : 月换手率 = (当月新增名义本金+当月平仓金额) / 上月末存续规模
 * 数据源    : DM_OTC_N.OTC_REV_DAILY_RPT, T05_OTC_COMP_DURA_CHG_EVT
 * 过滤条件  : 互换业务(Busi_Type='TRS')
 * 输出字段  : company_id, swap_turnover_rate, swap_new_principal, swap_outst_month_end
 *===================================================================================*/
left join (
    SELECT
        s.USCC as company_id
        ,(sum(s.new_principal) + sum(coalesce(c.close_amount, 0))) / sum(s.outst_amount) as swap_turnover_rate
        ,sum(s.new_principal) as swap_new_principal
        ,sum(s.outst_amount) as swap_outst_month_end
    from (
        SELECT
            USCC
            ,Inr_Seri_No
            ,sum(case when Accrued_Date between '${yyyy-MM}-01' and '${yyyy-MM-dd}' 
                      then Init_Nom_Prin else 0 end) as new_principal
            ,sum(case when Accrued_Date = last_day('${yyyy-MM-dd,-1M}') 
                      then Dyna_Nom_Prin else 0 end) as outst_amount
        from DM_OTC_N.OTC_REV_DAILY_RPT
        where busi_date = '${yyyy-MM-dd}'
          and Busi_Type = 'TRS'
          and(
            Accrued_Date between '${yyyy-MM}-01' and '${yyyy-MM-dd}' and Accrued_Date = Strt_Pric_Date
            or
            Accrued_Date = last_day('${yyyy-MM-dd,-1M}')
          )
        group by USCC, Inr_Seri_No
    ) s
    left join (
        SELECT
            Otc_Comp_Agt_Id
            ,sum(Nom_Prin_Chg_Delta) as close_amount
        from pdata_n.T05_OTC_COMP_DURA_CHG_EVT
        where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT'
          and Evt_Date between '${yyyy-MM}-01' and '${yyyy-MM-dd}'
          and Evt_Type_Cd in (
                'CLOSE_STOCKS'       -- 提前部分平仓
              , 'EARLY_TERMINATION' -- 客户提前终止
              , 'TERMINATION'       -- 合约到期
              )
        group by Otc_Comp_Agt_Id
    ) c on s.Inr_Seri_No = c.Otc_Comp_Agt_Id
    group by s.USCC
) t3 on t0.company_id = t3.company_id

/*====================================================================================
 * [模块04] 履保比例
 *------------------------------------------------------------------------------------
 * 计算逻辑  : 
 *   第0步：组合级 - 取履保结果表 + 关联组合附加信息获取交易对手 + 关联当事人关系+对公客户获取管理人
 *   第1步：管理人级 - 加权平均履保比例（权重=该组合名本/管理人名本汇总）
 *
 * 关联链路:
 *   m(履保结果).Comb_Agt_Grp_Id 
 *     --> comb(组合附加信息).Agt_Grp_Id  → 获取 comb.Cutp_Pty_Id (TIT060-xxx)
 *     --> h(当事人关系).Pty_Id          → 获取 h.Rela_Pty_Id (OIS客户编号)
 *     --> c(对公客户).PTY_ID            → 获取 c.USCC (统一社会信用代码)
 *===================================================================================*/
left join (
    SELECT
        t.company_id                                            -- 管理人ID(统一社会信用代码)
        -- 加权平均 = Σ(组合履保比例 × 该组合名本占管理人全部名本的比重)
        ,sum(t.marg_ratio * t.nom_weight) as margin_ratio       -- 加权平均履保比例
    from (
        -- 原始数据 + 关联链路 + 窗口函数计算权重
        SELECT
            c.USCC as company_id                                -- 统一社会信用代码
            ,comb.Cutp_Pty_Id as counterparty_id                -- 交易对手当事人编号
            ,m.Comb_Agt_Grp_ID                                  -- 组合协议组编号 (=BUNDLE_ID)
            ,cast(m.Dyna_Nom_Prin as double) as dyna_nom_prin   -- 动态名义本金
            ,cast(m.Marg_Perf_Prtc_Rati as double) as marg_ratio    -- 履约保障比例
            -- 权重：该组合名本占管理人全部名本的比重（窗口函数按管理人汇总）
            ,cast(m.Dyna_Nom_Prin as double) 
             / sum(cast(m.Dyna_Nom_Prin as double)) over(partition by c.USCC) as nom_weight
        from pdata_n.T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT m              -- 履保结果表
        inner join pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO comb         -- 组合附加信息
            on m.Comb_Agt_Grp_Id = comb.Agt_Grp_Id
            and comb.SRC_TBL = 'ODATA_N_TIT.D_TRD_BUNDLE_INFO'
            and comb.Comb_Compnt_Cd in ('TRS', 'OPTION', 'MIXTURE') -- TRS-收益互换, OPTION-场外期权, MIXTURE-混用
        inner join pdata_n.T01_PTY_RELA_H h                           -- 当事人关系历史
            on comb.Cutp_Pty_Id = h.Pty_Id                           -- TIT060-xxx → OIS客户映射
            and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
            and h.STRT_DATE <= '${yyyy-MM-dd}'
            and h.END_DATE > '${yyyy-MM-dd}'
        inner join pdata_n.T01_CORP_CUST c                            -- 对公客户
            on h.Rela_Pty_Id = c.PTY_ID                              -- OIS客户编号 → 当事人编号
            and c.BUSI_DATE = '${yyyy-MM-dd}'
            and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
        where m.busi_date = '${yyyy-MM-dd}'
          and m.src_tbl = 'ODATA_N_TIT.D_BUNDLE_MARGIN_DAILY_RESULT'
          and m.Perf_Marg_Flag = '1'                                 -- 履保标志
          and cast(m.Dyna_Nom_Prin as double) > 0                    -- 名义本金>0，避免除零
    ) t
    group by t.company_id
) m1 on t0.company_id = m1.company_id

/*====================================================================================
 * [模块05] 追保线
 *------------------------------------------------------------------------------------
 * 计算逻辑  : 
 *   第0步：合约级 - 取履保参数表(含追保线) + 关联组合附加信息获取交易对手 + 关联当事人关系+对公客户获取管理人
 *   第1步：管理人级 - 加权平均追保线（权重=该合约名本/管理人名本汇总）
 *
 * 关联链路:
 *   r(履保参数).Comb_Agt_Grp_Id 
 *     --> comb(组合附加信息).Agt_Grp_Id  → 获取 comb.Cutp_Pty_Id (TIT060-xxx)
 *     --> h(当事人关系).Pty_Id          → 获取 h.Rela_Pty_Id (OIS客户编号)
 *     --> c(对公客户).PTY_ID            → 获取 c.USCC (统一社会信用代码)
 *===================================================================================*/
left join (
    SELECT
        t.company_id                                             -- 管理人ID(统一社会信用代码)
        -- 加权平均 = Σ(合约追保线 × 该合约名本占管理人全部名本的比重)
        ,sum(t.margin_call_line * t.nom_weight) as margin_call_line  -- 加权平均追保线
    from (
        -- 原始数据 + 关联链路 + 窗口函数计算权重
        SELECT
            c.USCC as company_id                                 -- 统一社会信用代码
            ,comb.Cutp_Pty_Id as counterparty_id                 -- 交易对手当事人编号
            ,r.Comb_Agt_Grp_Id                                   -- 组合协议组编号 (=BUNDLE_ID)
            ,cast(r.Lcrrc_Dyna_Nom_Prin as double) as dyna_nom_prin   -- 本币动态名义本金
            ,cast(r.Bail_Apd_Marg_Line as double) as margin_call_line -- 保证金追保线
            -- 权重：该合约名本占管理人全部名本的比重（窗口函数按管理人汇总）
            ,cast(r.Lcrrc_Dyna_Nom_Prin as double) 
             / sum(cast(r.Lcrrc_Dyna_Nom_Prin as double)) over(partition by c.USCC) as nom_weight
        from pdata_n.T03_OTC_COMP_PERF_MARG_REF r                       -- 履保参数表(含追保线)
        inner join pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO comb       -- 组合附加信息(F1全量表)
            on r.Comb_Agt_Grp_Id = comb.Agt_Grp_Id
            and comb.SRC_TBL = 'ODATA_N_TIT.D_TRD_BUNDLE_INFO'
            and comb.Comb_Compnt_Cd in ('TRS', 'OPTION', 'MIXTURE') -- TRS-收益互换, OPTION-场外期权, MIXTURE-混用
        inner join pdata_n.T01_PTY_RELA_H h                            -- 当事人关系历史
            on comb.Cutp_Pty_Id = h.Pty_Id                             -- TIT060-xxx → OIS客户映射
            and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
            and h.STRT_DATE <= '${yyyy-MM-dd}'
            and h.END_DATE > '${yyyy-MM-dd}'
        inner join pdata_n.T01_CORP_CUST c                             -- 对公客户
            on h.Rela_Pty_Id = c.PTY_ID                               -- OIS客户编号 → 当事人编号
            and c.BUSI_DATE = '${yyyy-MM-dd}'
            and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
        where r.busi_date = '${yyyy-MM-dd}'
          and r.src_tbl = 'ODATA_N_TIT.D_BUNDLE_DAILY_CONTR_PARAM'    -- 组合履保计算参数来源
          and r.Bail_Apd_Marg_Line is not null                         -- 追保线不为空
          and cast(r.Lcrrc_Dyna_Nom_Prin as double) > 0                -- 名义本金>0，避免除零
    ) t
    group by t.company_id
) m2 on t0.company_id = m2.company_id

/*====================================================================================
 * [模块06] 获批额度 + 获批业务类型
 *------------------------------------------------------------------------------------
 * 计算逻辑  : 按管理人汇总额度，多个获批业务类型用分号分隔
 * 数据源    : T01_PTY_LMT_H, T01_PTY_RELA_H, T01_CORP_CUST
 * 过滤条件  : 开链状态、额度类型为管理人限额
 * 输出字段  : company_name, approved_limit, approved_type
 *===================================================================================*/
left join (
    SELECT
        c.ORG_FULL_NAME_CH as company_name
        ,max(cast(l.Lmt as double)) as approved_limit
        ,concat_ws(';', collect_set(l.Perm_Busi_Type)) as approved_type
    from pdata_n.T01_PTY_LMT_H l
    inner join pdata_n.T01_PTY_RELA_H h
        on l.Pty_Id = h.Pty_Id
        and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
        and h.STRT_DATE <= '${yyyy-MM-dd}'
        and h.END_DATE > '${yyyy-MM-dd}'
    inner join pdata_n.T01_CORP_CUST c
        on h.Rela_Pty_Id = c.PTY_ID
        and c.BUSI_DATE = '${yyyy-MM-dd}'
        and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
    where l.SRC_TBL = 'ODATA_N_TIT.D_RISK_CTPTY_LIMIT_THRESHOLD'
        and l.Strt_Date <= '${yyyy-MM-dd}'
        and l.End_Date > '${yyyy-MM-dd}'
        and l.Pty_Lmt_Type_Cd = 'ADMINISTRATORLIMIT' -- 管理人限额
    group by c.ORG_FULL_NAME_CH
) lim on t0.company_name = lim.company_name

/*====================================================================================
 * [模块07] 存续履保交易规模
 * 逻辑: 按管理人汇总有履保(静态/动态)交易对手去除“南下期货”的动态名本
 *===================================================================================*/
left join (
    SELECT
        s.Cutp_Pty_Full_Name as company_name
        ,sum(cast(s.Dyna_Nom_Prin as double)) as perf_dyna_nom_prin
    from pdata_n.T03_OTC_COMP_PERF_MARG_REF r
    inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s
        on r.Otc_Comp_Agt_Id = s.Inr_Seri_No
        and s.busi_date = '${yyyy-MM-dd}'
        and s.grp_id in ('01','02','03')
        and s.Contr_Type_Desc <> '南下期货'
    where r.busi_date = '${yyyy-MM-dd}'
      and r.src_tbl = 'ODATA_N_TIT.D_REF_OTC_CONTR_MARGIN_PARAM'
      and r.Enable_Perf_Marg_Type_Cd in ('STATIC', 'DYNAMIC')
    group by s.Cutp_Pty_Full_Name
) perf on t0.company_name = perf.company_name

/*====================================================================================
 * [模块08] 增信措施
 * 逻辑: 有履保方案的交易对手，按公司聚合简称(分号分隔)
 *===================================================================================*/
left join (
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
) cm on t0.company_name = cm.company_name

/*====================================================================================
 * [模块09] 及时追保完成率
 * 逻辑: <=2的递延天数 / 总递延天数
 * 关联链: 追保表(m).Pty_Id → 当事人关系(h) → 公司主体(c)取公司名
 *===================================================================================*/
left join (
    SELECT
        c.ORG_FULL_NAME_CH as company_name
        ,sum(case when cast(m.Defr_Days as int) <= 2 then cast(m.Defr_Days as int) else 0 end) 
         / sum(cast(m.Defr_Days as int)) as margin_call_rate
    from PDATA_N.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO m
    inner join pdata_n.T01_PTY_RELA_H h
        on m.Pty_Id = h.Pty_Id
        and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
        and h.STRT_DATE <= '${yyyy-MM-dd}'
        and h.END_DATE > '${yyyy-MM-dd}'
    inner join pdata_n.T01_CORP_CUST c
        on h.Rela_Pty_Id = c.PTY_ID
        and c.BUSI_DATE = '${yyyy-MM-dd}'
        and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
    where m.Busi_Date = '${yyyy-MM-dd}'
      and m.Perf_Marg_Date >= '${yyyy,-1y}-01-01'
      and m.Perf_Marg_Date <= '${yyyy-MM-dd}'
      and m.Src_Tbl = 'ODATA_N_TIT.G_MARGIN_CALL_SETTING'
    group by c.ORG_FULL_NAME_CH
) mc on t0.company_name = mc.company_name

/*====================================================================================
 * [模块10] 客户垫资情况（如有）
 * 展示前提: 复用dm_otc_n.bi_otc_cust_tag表 tag_name='有垫资' (已含连续3月≥3次逻辑)
 *===================================================================================*/
left join (
    SELECT
        ind.company_name
        ,concat(
            '根据托管行资金流水及券商对账单回溯，客户于',
            ind.freq_quarter,
            '存在垫资行为'
            ,'。客户近一年存在持续但规模可控的垫资行为，平均每周约',
            cast(round(ind.weekly_freq, 1) as string),
            '次、单次时长',
            round(ind.avg_duration, 0),
            '天左右，日均垫资金额集中在',
            round(ind.daily_amt_wan, 0),
            '万元。'
        ) as cust_advance_info
    from (
        select company_name from dm_otc_n.bi_otc_cust_tag
        where busi_date = '${yyyy-MM-dd}'
          and tag_name = '有垫资'
    ) qual
    inner join (
        SELECT
            c.ORG_FULL_NAME_CH as company_name           -- 管理人名称
            ,case
                when substr(max(m.Perf_Marg_Date), 6, 2) in ('01','02','03')
                     then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第一季度')
                when substr(max(m.Perf_Marg_Date), 6, 2) in ('04','05','06')
                     then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第二季度')
                when substr(max(m.Perf_Marg_Date), 6, 2) in ('07','08','09')
                     then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第三季度')
                when substr(max(m.Perf_Marg_Date), 6, 2) in ('10','11','12')
                     then concat(substr(max(m.Perf_Marg_Date), 1, 4), '年第四季度')
             end as freq_quarter                          -- 垫资行为发生的最近季度
            ,count(distinct m.Perf_Marg_Date) * 7.0 
                / (datediff('${yyyy-MM-dd}', '${yyyy,-1y}-01-01') + 1)
             as weekly_freq                               -- 年周均次数(动态周数)
            ,avg(cast(m.Defr_Days as double)) as avg_duration  -- 单次垫资平均时长(天)
            ,sum(cast(m.Marg_Call_Amt as double))
             / nullif(sum(cast(m.Defr_Days as int)), 0) / 10000
             as daily_amt_wan                             -- 日均垫资金额(万元)
        from PDATA_N.T03_OTC_DERI_COMP_COMB_MARG_CALL_INFO m
        inner join pdata_n.T01_PTY_RELA_H h
            on m.Pty_Id = h.Pty_Id
            and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
            and h.STRT_DATE <= '${yyyy-MM-dd}'
            and h.END_DATE > '${yyyy-MM-dd}'
        inner join pdata_n.T01_CORP_CUST c
            on h.Rela_Pty_Id = c.PTY_ID
            and c.BUSI_DATE = '${yyyy-MM-dd}'
            and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
        where m.Busi_Date = '${yyyy-MM-dd}'
          and m.Perf_Marg_Date >= '${yyyy,-1y}-01-01'
          and m.Perf_Marg_Date <= '${yyyy-MM-dd}'
          and m.Src_Tbl = 'ODATA_N_TIT.G_MARGIN_CALL_SETTING'
          and cast(m.Defr_Days as int) >= 2
        group by c.ORG_FULL_NAME_CH
    ) ind on qual.company_name = ind.company_name
) adv on t0.company_name = adv.company_name

/*====================================================================================
 * [模块11] 互换业务平台费 + 券息（原始值，SELECT区统一折算为万元）
 * 计算逻辑  : 按 Leg类型(FLOAT/FIXED) 分别汇总累计已实现/未实现收益
 * 数据源    : PDATA_N.T98_OTC_SWAP_COMP_LEG_VALU_INFO (源: D_POS_TRS_LEG_VALUATION)
 *            PDATA_N.T98_OTC_DERI_COMP_SALE_INFO     (源: D_TRD_OTC_TRADE)
 * 关联链路  : 估值表(v).Swap_Comp_Agt_Id → 销售表(s).Agt_Id → 取管理人名称
 *
 * 字段说明:
 *   v.Swap_Comp_Leg_Type_Cd : Leg类型 (FLOAT_LEG_TYPE/FIXED_LEG_TYPE)
 *   s.Src_Contr_Type_Desc   : 互换类型描述 (如"南下跨境","跨境借券")
 *   v.Accum_Rlz_Yield       : 累计已实现收益 (源表ACCU_REALIZED_PNL)
 *   v.Accum_Unrlz_Yield     : 累计未实现收益 (源表ACCU_UNREALIZED_PNL)
 *
 * 平台费适用互换类型 : 南下跨境, 南下跨境（场内期权）, 南下跨境（期货）, 多头持券
 * 券息适用互换类型   : 跨境借券, 借券互换
 *===================================================================================*/
left join (
    SELECT
        s.Cutp_Pty_Full_Name as company_name           -- 管理人名称
        /* 平台费：南下跨境系列 + 多头持券 */
        ,sum(
            case when s.Src_Contr_Type_Desc in (
                '南下跨境','南下跨境（场内期权）','南下跨境（期货）','多头持券'
            ) then
                cast(v.Accum_Unrlz_Yield as double)     -- 累计未实现收益
              + cast(v.Accum_Rlz_Yield as double)       -- 累计已实现收益
            else 0 end
        ) as swap_platform_fee                          -- 平台费
        /* 券息：跨境借券 + 借券互换 */
        ,sum(
            case when s.Src_Contr_Type_Desc in (
                '跨境借券','借券互换'
            ) then
                cast(v.Accum_Unrlz_Yield as double)     -- 累计未实现收益
              + cast(v.Accum_Rlz_Yield as double)       -- 累计已实现收益
            else 0 end
        ) as swap_bond_interest                         -- 券息
    from PDATA_N.T98_OTC_SWAP_COMP_LEG_VALU_INFO v
    inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s
        on v.Exp_Comp_No = s.Agt_Id
        and s.busi_date = '${yyyy-MM-dd}'
        and s.grp_id = '02'                             -- 互换业务
    where v.busi_date = '${yyyy-MM-dd}'
      and v.src_tbl = 'ODATA_N_TIT.D_POS_TRS_LEG_VALUATION'
      and v.Swap_Comp_Leg_Type_Cd in ('FLOAT_LEG_TYPE', 'FIXED_LEG_TYPE')
    group by s.Cutp_Pty_Full_Name
) fee on t0.company_name = fee.company_name

/*====================================================================================
 * [模块12] 互换业务佣金
 * 计算逻辑  : 汇总 grp_id=02(互换) + 03(金仕达) 的交易佣金(trd_cms)
 * 数据源    : DM_OTC_N.OTC_REV_DAILY_RPT
 * 过滤条件  : grp_id in ('02','03'), Accrued_Date 近一年
 *===================================================================================*/
left join (
    SELECT
        s.Cutp_Pty_Full_Name as company_name           -- 管理人名称
        ,sum(coalesce(cast(s.trd_cms as double), 0)) as swap_commission   -- 佣金汇总(元)
    from DM_OTC_N.OTC_REV_DAILY_RPT s
    where s.busi_date = '${yyyy-MM-dd}'
      and s.grp_id in ('02', '03')  -- 互换 + 金仕达
      and s.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'   -- 近一年计提日
    group by s.Cutp_Pty_Full_Name
) com on t0.company_name = com.company_name 
	) castTable