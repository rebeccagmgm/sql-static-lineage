-- 输入：组合每日履保参数 + 组合附加资料 + 有效当事人关系 + 当日对公客户。
-- 输出：每条连接后、追保线非NULL且正本金记录的nom_weight → 06模块汇总贡献。
-- 与05.1不同：先排除NULL追保线再分本金；不能复用同一分母。
SELECT
    c.USCC as company_id -- 统一社会信用代码，客户权重分组键
    ,comb.Cutp_Pty_Id as counterparty_id -- 组合归属的内部交易对手编号
    ,r.Comb_Agt_Grp_Id
    ,cast(r.Lcrrc_Dyna_Nom_Prin as double) as dyna_nom_prin -- 组合本币动态名义本金
    ,cast(r.Bail_Apd_Marg_Line as double) as margin_call_line -- 保证金追保线

    ,cast(r.Lcrrc_Dyna_Nom_Prin as double)
     / sum(cast(r.Lcrrc_Dyna_Nom_Prin as double)) over(partition by c.USCC) as nom_weight -- 本行本金 / 同USCC符合本模块条件的全部本金
-- 身份与输入来源（保持原连接后记录，不预先合并）：
from pdata_n.T03_OTC_COMP_PERF_MARG_REF r -- 合约履保参数，来源由src_tbl区分
inner join pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO comb -- 衍生品合约组合附加信息
    on r.Comb_Agt_Grp_Id = comb.Agt_Grp_Id
    and comb.SRC_TBL = 'ODATA_N_TIT.D_TRD_BUNDLE_INFO'
    and comb.Comb_Compnt_Cd in ('TRS', 'OPTION', 'MIXTURE')
inner join pdata_n.T01_PTY_RELA_H h -- 当事人关系历史：内部对手方→OIS客户
    on comb.Cutp_Pty_Id = h.Pty_Id
    and h.SRC_TBL = 'ODATA_N_TIT.D_REF_CTPTY_MAPPING'
    and h.STRT_DATE <= '${yyyy-MM-dd}'
    and h.END_DATE > '${yyyy-MM-dd}'
inner join pdata_n.T01_CORP_CUST c -- 对公客户：取USCC/公司全名
    on h.Rela_Pty_Id = c.PTY_ID
    and c.BUSI_DATE = '${yyyy-MM-dd}'
    and c.SRC_TBL = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY'
where r.busi_date = '${yyyy-MM-dd}'
  and r.src_tbl = 'ODATA_N_TIT.D_BUNDLE_DAILY_CONTR_PARAM'
  and r.Bail_Apd_Marg_Line is not null
  and cast(r.Lcrrc_Dyna_Nom_Prin as double) > 0
