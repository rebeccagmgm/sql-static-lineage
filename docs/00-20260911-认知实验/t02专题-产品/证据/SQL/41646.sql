-- task_id: 41646
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_stk_base_info_WD
-- observed_at: 2026-09-05T01:06:14.036Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_stk_base_info(
busi_date          string comment      '数据日期'
,rec_id            string comment      '记录编号'
,secu_id           string comment      '统一证券编码'
,src_sys_prdno     string comment      '源系统产品编号'
,scr_cd            string comment      '股票代码'
,corp_id           string comment      '公司ID'
,abbr_name         string comment      '证券简称'
,pinyin_zh         string comment      '中文拼音'
,mkt_cd            string comment      '交易所代码'
,scr_type          string comment      '证券类别(一级标准分类)'
,crrc_cd           string comment      '交易货币代码'
,list_stat_cd      string comment      '上市状态代码'
,list_date         string comment      '上市日期'
,list_brd_cd       string comment      '上市板块代码'
,list_brd_name     string comment      '上市板块名称'
,shsc_flag         string comment      '深股通或港股通标识'
,delist_date       string comment       '退市日期'
,src_rec_id        string comment       '来源记录'
,src_tbl           string comment      '来源表'
,remark            string comment      '备注'
,rec_upd_time      string comment      '记录更新时间'
,rec_down_time     string comment      '记录修改时间'
)COMMENT '股票基本信息'
PARTITIONED BY (src_id string comment '来源标识')
stored as orc;
