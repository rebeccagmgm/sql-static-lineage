-- 230204普通互换客户创收：01合约日主体，02~06并列补充；09输出内接07净创收与08毛佣金。
-- 07 CASE顺序：固定利率跨境互换 → 浮动利率跨境互换 → 多头持券 → 指数增强 → 0。
-- 08毛佣金只是另一输出，净佣金已进入前两分支，不再把08加到07上。
-- 下列include保持原SQL全部token顺序，不改成CTE、不额外去重或过滤。
-- @include 11_最终字段顺序.sql
select
-- @include 09_统一输出.sql
-- 连接主线：FROM / JOIN / ON直接保留在这里；复杂输入在括号内引用查询体。
-- 合约快照info：读取范围在01；与逐日明细det按合约号相接才形成合约日。
from (
-- @include 01_合约客户与逐日底座.sql
) info

-- 逐日本金det：只用明细自身起止日过滤；缺明细不生成合约日。
inner join (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
    where busi_date between Strt_Pric_Date and End_Pric_Date
    ) det
on info.agt_id = det.agt_id

-- 客户cp：T01_CORP_CUST法人客户，交易对手客户编号取USCC；多匹配仍会扩行。
left join (
    select * from PDATA_N.T01_CORP_CUST
    where src_tbl = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY' and busi_date = '${yyyy-MM-dd}' and DEL_FLAG = '0'
    ) cp
on cp.pty_id = info.Cutp_Pty_Id

-- 证券资料ins：按标的工具号补分类，参与指数增强领取范围和窗口键。
left join (
    select * from pdata_news_n.t02_tit_scr_base_info
    where src_id = 'TIT' and grp_id = '01'
    ) ins
on ins.in_code = info.Undrl_Ins_Id

-- 标的盈亏池u：复杂账簿／标的归集留在模块，下方ON保留实际领取范围。
left join (
-- @include 02_指数增强盈亏池.sql
) u
on det.busi_date = u.busi_date and coalesce(ins.undrl_clas, info.undrl_wd_cd) = u.Map_Undrl_Cd and info.book_agt_id = '10016' and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP'

-- 上传分配额x：与盈亏池并列补入，仍限定10016指数增强；不去重上传行。
left join query_upload.otc_rev_allocated x
on det.busi_date = x.Accrued_Date and coalesce(ins.undrl_clas, info.undrl_wd_cd) = x.undrl_wd_cd and info.book_agt_id = '10016' and info.Src_Contr_Type = 'INDEX_ENHANCE_SWAP'

-- 合约持仓盈亏pd：场外流水号＋账簿＋计提日，Tdy_Yield供09直接展示；07不直接取其金额，多匹配仍可能影响窗口。
left join (
-- @include 03_合约盈亏与汇率.sql
) pd
on info.otc_seri_no = pd.Src_Prd_Id and det.busi_date = pd.busi_date and info.Book_Agt_Id = pd.Book_Agt_Id

-- 汇率mid：人民币中间汇率报价，按结算币种＋计提日接入。
left join (
    select default.datekey2date(trd_dt) as trd_dt, src_crrc_cd, mid_price
    from pdata_news_n.t02_fxr_cfets_quot
    where src_id = 'TIT' and grp_id = '01'
    ) mid
on mid.src_crrc_cd = info.Sett_Crrc_Cd and mid.trd_dt = det.busi_date

-- 开仓参数sh：每条腿最新记录rk=1，再按合约内部号连接；不保证一合约一腿。
left join (--开仓
    select Swap_Comp_Agt_Id, Cms_Mode_Cd, Trd_Fee_Rate, Peshr_Cms, Bgng_Vol, Init_Rate, row_number() over(partition by Leg_Glbl_Seq_No order by busi_date desc) as rk
    from PDATA_N.T03_OTC_SWAP_COMP_HOLD_INFO
    where SRC_TBL = 'ODATA_N_TIT.D_POS_TRS_LEG_HIS_POS'
    ) sh
on sh.Swap_Comp_Agt_Id = info.Inr_Seri_No and sh.rk = 1

-- 平仓／分红evt：模块按内部合约号＋事件日聚合，再连接当前合约日。
left join (
-- @include 04_开平仓与分红.sql
) evt
on evt.Swap_Comp_Agt_Id = info.Inr_Seri_No and evt.Evt_Date = det.busi_date

-- 参考利率cr：补日加工留在模块，币种与计提日匹配见下方ON。
left join (
-- @include 05_市场利率补日.sql
) cr
on cr.Curr = info.Undrl_Curr and cr.trd_dt = det.busi_date

-- 浮动指数fr：指数编号＋计提日直接匹配，这一输入没有随cr一起补日。
left join (
    select split(rec_id,'-')[0] as Undrl_Id, intrt, default.datekey2date(trd_dt) as trd_dt
    from pdata_news_n.t02_ira_indx_info
    where src_id = 'TIT' and grp_id = '01'
    ) fr
on fr.Undrl_Id = info.Float_Undrl_Cd and fr.trd_dt = det.busi_date

-- 生效成本co：按计提日＋合约类型映射匹配，没有币种键；不要改成报告日最新参数。
left join (
-- @include 06_生效成本参数.sql
) co
on co.busi_date = det.busi_date and co.contract_type = if(info.Src_Contr_Type = 'S_CROSS_OPTION_SWAP','S_CROSS_SWAP',info.Src_Contr_Type)

) castTable
