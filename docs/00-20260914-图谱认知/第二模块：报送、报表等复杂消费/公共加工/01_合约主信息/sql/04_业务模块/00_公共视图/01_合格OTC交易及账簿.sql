-- 合格交易及账簿；复用3次：01期权、02普通互换、04指定FAST_TRS。
-- 交易 --账簿ID + 同快照日，INNER JOIN--> 账簿；缺失账簿不入选。
-- 使用方须限定busi_date；产品类型、合约状态由各分支筛选。
create view v_t98_sale_trade_scope as
select
    trade.busi_date, -- 业务日期
    trade.key_otc_trade_id, -- 合约连接键：TRADEFLOW内部交易流水号
    trade.internal_trade_id, -- 交易内部编号，不是上一列的连接键
    trade.key_instrument_id, -- 工具相关资料连接键；元数据称“场外合约交易流水号”
    trade.key_book_id, -- 交易所属账簿ID
    book.key_book_id as book_key_book_id, -- 单独保留账簿侧来源，供目标Book_Agt_Id使用
    trade.business_type, -- 业务类型
    book.department, -- 部门
    book.book_name, -- 账簿名称
    book.desk, -- 柜台
    book.company -- 公司；普通互换经营分类使用GFS_HK
from odata_n_tit.d_trd_otc_trade trade -- 【AI】交易-OTC—交易表（父类）
inner join odata_n_tit.d_ref_book book -- 账簿信息表
    on trade.busi_date = book.busi_date
   and trade.key_book_id = book.key_book_id
where trade.key_book_id not in ('10022', '10019')
  and book.department in ('OTC', 'OTC_HK');
