-- 本文件读取pd合约持仓盈亏；mid汇率查询和两路ON条件均在00。
-- pd：账簿持仓汇总，按场外流水号+账簿+计提日读取本合约日盈亏，本分支主要供展示。
-- mid：人民币中间汇率，按info.Sett_Crrc_Cd结算币种+det计提日读取，缺失时公式按1。
-- fixed/FLEXO的本金息差段未再乘mid；事件佣金、按股佣金、分红与指数池才按各自公式换算。
-- 本文件提供pd查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
select * from PDATA_N.T98_OTC_BOOK_HOLD_SUM
    where src_tbl = 'ODATA_N_TIT.D_POS_POSITION_DAILY'
