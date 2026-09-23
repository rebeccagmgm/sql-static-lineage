-- 输入：组合履保结果 + 组合附加资料 + 有效当事人关系 + 当日对公客户。
-- 输出：每条连接后的正本金履保记录及nom_weight → 05模块SUM(比例×权重)。
-- 原组合/身份链不去重；名本窗口按连接后的USCC分组，NULL比例的本金仍占权重。
SELECT
    c.USCC as company_id -- 统一社会信用代码，客户权重分组键
    ,comb.Cutp_Pty_Id as counterparty_id -- 组合归属的内部交易对手编号
    ,m.Comb_Agt_Grp_ID -- 组合协议组编号，接comb.Agt_Grp_Id
    ,cast(m.Dyna_Nom_Prin as double) as dyna_nom_prin -- 组合动态名义本金
    ,cast(m.Marg_Perf_Prtc_Rati as double) as marg_ratio -- 履约保障比例

    ,cast(m.Dyna_Nom_Prin as double)
     / sum(cast(m.Dyna_Nom_Prin as double)) over(partition by c.USCC) as nom_weight -- 本行本金 / 同USCC符合本模块条件的全部本金
-- 身份与输入来源（保持原连接后记录，不预先合并）：
from pdata_n.T03_OTC_CUTP_MARG_ACCT_PERF_GUAR_RSLT m -- 组合履保结果
inner join pdata_n.T03_OTC_DERI_COMP_COMB_ADTNL_INFO comb -- 衍生品合约组合附加信息
    on m.Comb_Agt_Grp_Id = comb.Agt_Grp_Id
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
where m.busi_date = '${yyyy-MM-dd}'
  and m.src_tbl = 'ODATA_N_TIT.D_BUNDLE_MARGIN_DAILY_RESULT'
  and m.Perf_Marg_Flag = '1'
  and cast(m.Dyna_Nom_Prin as double) > 0
