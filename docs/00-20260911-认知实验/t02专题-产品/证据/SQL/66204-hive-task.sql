-- task_id: 66204
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/prd_dm/pdata_news_n.t02_prd_fin_info
-- observed_at: 2026-09-05T01:06:26.549Z

-- createSql
CREATE TABLE IF NOT EXISTS T02_PRD_FIN_INFO(
    Busi_Date               STRING  COMMENT '业务日期'
   ,Rec_Id                  STRING  COMMENT 'ID'
   ,Secu_Id                 STRING  COMMENT '统一证券编码'
   ,Src_Sys_Prdno           STRING  COMMENT '源系统产品编号'
   ,Prd_Stat                STRING  COMMENT '产品状态'
   ,Scr_Cd                  STRING  COMMENT '产品代码'
   ,Ch_Name                 STRING  COMMENT '产品名称'
   ,Ch_Abbr                 STRING  COMMENT '简称'
   ,Pinyin_Abbr             STRING  COMMENT '拼音简称'
   ,Pd_Type                 STRING  COMMENT '投资期限'
   ,Ivst_Type               STRING  COMMENT '投资品种'
   ,Scr_Type                STRING  COMMENT '产品类型'
   ,Setp_Date               STRING  COMMENT '成立日期'
   ,Mgmt_Pd                 STRING  COMMENT '管理期限'
   ,Risk_Lvl                STRING  COMMENT '风险等级'
   ,Fir_Amt                 STRING  COMMENT '参与金额'
   ,Adtnl_Amt               STRING  COMMENT '追加金额'
   ,Perf_Compr_Basi         STRING  COMMENT '业绩比较基准'
   ,Iss_Size                STRING  COMMENT '实际发行规模'
   ,Clos_Date               STRING  COMMENT '产品到期日'
   ,Val_Date                STRING  COMMENT '起息日期'
   ,Crrc_Type               STRING  COMMENT '币种'
   ,Par_Val                 STRING  COMMENT '面值'
   ,Is_Stru                 STRING  COMMENT '是否分级'
   ,Parent_Scr_Cd           STRING  COMMENT '母份额编码'
   ,Intr_Days               STRING  COMMENT '计息天数'
   ,Upd_Desc                STRING  COMMENT '数据更新备注'
   ,Purch_Way_Id            STRING  COMMENT '渠道ID'
   ,Pay_Way_Id              STRING  COMMENT '支付方式ID'
   ,Open_Date_Desc          STRING  COMMENT '开放期描述'
   ,Clos_Date_Desc          STRING  COMMENT '封闭期描述'
   ,Ivst_Tgt                STRING  COMMENT '投资目标'
   ,Ivst_Scop               STRING  COMMENT '投资范围'
   ,Scr_Advantage           STRING  COMMENT '产品优势'
   ,Trd_Rule                STRING  COMMENT '交易规则'
   ,Income_Div              STRING  COMMENT '收益分配'
   ,Remark                  STRING  COMMENT '备注'
   ,Upd_Time                STRING  COMMENT '更新时间'
   ,Ver                     STRING  COMMENT '版本'
   ,Upd_By                  STRING  COMMENT '最后更新人'
   ,Lock_Stat               STRING  COMMENT '锁定状态'
   ,Sale_Since              STRING  COMMENT '销售激励'
   ,Aprs                    STRING  COMMENT '考核与新增资产核算'
   ,Sale_Srequ              STRING  COMMENT '适当性销售要求'
   ,Prd_Desc                STRING  COMMENT '产品简介'
   ,Modif                   STRING  COMMENT '修改'
   ,Create_At               STRING  COMMENT '录入时间'
   ,Create_By               STRING  COMMENT '录入人'
   ,Pay_Way                 STRING  COMMENT '支付方式'
   ,Purch_Way               STRING  COMMENT '渠道'
   ,Rpt_PeoPle              STRING  COMMENT '报备人员'
   ,Sale_Contr_Date         STRING  COMMENT '销售合同签署日期'
   ,Ivst_Mngr               STRING  COMMENT '投资经理'
   ,Pub_At                  STRING  COMMENT '发行时间'
   ,Rate_Std                STRING  COMMENT '费率标准'
   ,Sale_Prepare            STRING  COMMENT '产品上架准备'
   ,Prd_Type                STRING  COMMENT '产品分类'
   ,Prd_Sub_Type            STRING  COMMENT '产品子类'
   ,Frgn_Ast                STRING  COMMENT '是否海外资产'
   ,Mkt_Cd                  STRING  COMMENT '所在市场'
   ,Iss_Co                  STRING  COMMENT '发行公司'
   ,Inst_Sty                STRING  COMMENT '投资风格'
   ,Income_Type             STRING  COMMENT '收益类型'
   ,Psecu_Type              STRING  COMMENT '资管产品一级分类'
   ,Prod_Stat               STRING  COMMENT '日历状态'
   ,Exch_Cd                 STRING  COMMENT ''
   ,Prd_Ta_No               STRING  COMMENT 'TA代码'
   ,Prd_Type2               STRING  COMMENT '产品分类'
   ,Author                  STRING  COMMENT '拟搞人'
   ,Review_org              STRING  COMMENT '引入部门'
   ,Review_Num              STRING  COMMENT '评审号'
   ,Sale_Org                STRING  COMMENT '销售部门'
   ,Ast_All_Type            STRING  COMMENT '资产详细分类'
   ,Ast_One_Type            STRING  COMMENT '资产第一级分类'
   ,Agr_Type                STRING  COMMENT '是否签署产品协议[0:不需要,1:需要'
   ,Appr_Type               STRING  COMMENT '是否需要适当性匹配[0:不需要,1:需要可不匹配,2:需要且必须同意]'
   ,GF_Selling              STRING  COMMENT '是否代销：(null or 1)|是,2|否'
   ,Wthdr_Type              STRING  COMMENT '服务产品特有:0是不可以,1:需要,2:服务中不可以'
   ,Hedg_Flag               STRING  COMMENT '对冲属性：0，否；1，是'
   ,Issr                    STRING  COMMENT '发行主体：1，公募专户；2，期货资管；3，券商集合理财；4，私募公司；5，其他；'
   ,Qty_Flag                STRING  COMMENT '量化属性：0，否；1，是'
   ,Strg                    STRING  COMMENT '投资策略：1，定向增发；2，股票多空；3，股票多头；4，管理期货；5，债券基金；6，组合基金；7，股票市场中性；8，并购重组；9，套利策略；10，宏观策略；11，多策略；12，股权投资；13，海外投资；14，非标类；15，其他策略；'
   ,Alr_Line                STRING  COMMENT '警告线'
   ,Connected_Cd            STRING  COMMENT '关联代码'
   ,Trt_Line                STRING  COMMENT '处置线'
   ,Customize_Do_Or_Not     STRING  COMMENT '是否定制'
   ,Prd_Rels_Obj            STRING  COMMENT '专项产品标志:0|常规发行，1|新客专享，2|员工专项，3|多添富定制，4|私行专享，5|富裕客户，6|金管家专享'
   ,Sales_Area              STRING  COMMENT '销售区域'
   ,Sub_Co_Or_Not           STRING  COMMENT '是否子公司产品'
   ,Buy_Bk                  STRING  COMMENT '提前终止或回购条件'
   ,Dbl_Recc                STRING  COMMENT '双录话术'
   ,For_Cust_Type           STRING  COMMENT '面向客户类型:1|所有，2|专业投资者，3|非专业投资者'
   ,Ivst_Term               STRING  COMMENT '投资限制'
   ,Prd_Oper_Type           STRING  COMMENT '产品运作方式：2|封闭式，3|开放式'
   ,Ivst_Rati               STRING  COMMENT '投资比例'
   ,Perf_Bm_Show            STRING  COMMENT '是否业绩比较基准'
   ,Revw_Stat               STRING  COMMENT '评审状态: 1:待补录，2:待复核，3:待审批，4:已上架，5:已下架，6:退回，7:修改-待复核，8:修改-待确认，9-修改-退回'
   ,Prd_Mdl                 STRING  COMMENT '资管产品：常规|1，非常规|2'
   ,Ast_Type                STRING  COMMENT '资产分类: 现金货币类|1,固定收益类|2,权益类|3,另类投资类|4,海外投资类|5,混合类|6'
   ,Wealth_Type             STRING  COMMENT '产品财富分类: 保证金产品|11,货币基金|12,保本型|21,非保本型|22,公募权益基金|31,私募权益基金|32,资管理财（权益类）|33,OTC（权益类）|34, PE/VC|41,对冲基金|42,大宗商品|43,房地产信托基金|44,红酒基金|45,黄金外汇|46,海外固收|51,海外权益|52,海外对冲基金|53,海外其他|54, 混合偏股|61,混合偏债|62,其他|63'
   ,Src_Id                  STRING  COMMENT '来源标识'
   ,Src_Tbl                 STRING  COMMENT '来源表'
   ,Rec_Upd_Time            STRING  COMMENT '数据更新时间'
   ,Rec_Down_Time           STRING  COMMENT '数据进表时间'
   ,Eff_Flag                STRING  COMMENT '有效标志'
   ,Stat                    STRING  COMMENT '状态'
   ,Begin_At                STRING  COMMENT '开始时间'
   ,Expired_At              STRING  COMMENT '失效时间'
)COMMENT '产品中心产品基本信息'
STORED AS ORC
;

-- querySql
set hive.merge.mapfiles = true ;
set hive.merge.mapredfiles = true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.exec.max.created.files=10000;
set hive.exec.max.dynamic.partitions.pernode=10000;
set hive.exec.max.dynamic.partitions=10000;
set hive.auto.convert.join=false;
set hive.optimize.sort.dynamic.partition=true;
set hive.map.aggr = true;
set hive.groupby.skewindata=true;
set hive.support.concurrency=false;

INSERT OVERWRITE TABLE T02_PRD_FIN_INFO
SELECT
        '${data_day_str}'                                          AS  Busi_Date               --业务日期
       ,a.ID                                                              AS  Rec_Id                  --ID
       ,DEFAULT.GET_RCC_SECUID(
               CASE WHEN a.SECUTYPE < 6000 THEN 'AM'                                                           --资管
               WHEN a.SECUTYPE = 6010 THEN 'AM'                                                           --收益凭证
               WHEN 6000 < a.SECUTYPE AND a.SECUTYPE < 7000 THEN 'OC'                                       --OTC，归类OT(其他) 
               WHEN 7000 < a.SECUTYPE AND a.SECUTYPE < 8000 THEN 'PF'                                       --私募
               WHEN a.SECUTYPE IN ('9001','9002','9999') THEN 'FD' 
               WHEN a.SECUTYPE = 9997 THEN 'RE'                                                          --金快线，国债回购
               ELSE  'OT'  END
           , SECUCODE, CASE WHEN a.PRODTA_NO = '1' THEN 'SSE'
                            WHEN a.PRODTA_NO = '2' THEN 'SZSE'
                            ELSE '99' END)                              AS  Secu_Id                 --统一证券编码
       ,CONCAT('PRD', '-', a.SECUCODE)                                    AS  Src_Sys_Prdno           --源系统产品编号
       ,a.DATASTATUS                                                      AS  Prd_Stat                --产品状态
       ,a.SECUCODE                                                        AS  Scr_Cd                  --产品代码
       ,a.CHINAME                                                         AS  Ch_Name                 --产品名称
       ,a.CHINAMEABBR                                                     AS  Ch_Abbr                 --简称
       ,a.CHISPELLING                                                     AS  Pinyin_Abbr             --拼音简称
       ,a.PERIODTYPE                                                      AS  Pd_Type                 --投资期限
       ,a.INVESTTYPE                                                      AS  Ivst_Type               --投资品种
       ,a.SECUTYPE                                                        AS  Scr_Type                --产品类型
       ,a.SETUPDATE                                                       AS  Setp_Date               --成立日期
       ,a.MGMTPERIOD                                                      AS  Mgmt_Pd                 --管理期限
       ,a.RISKLEVEL                                                       AS  Risk_Lvl                --风险等级
       ,a.FIRSTAMOUNT                                                     AS  Fir_Amt                 --参与金额
       ,a.ADDITIONAMOUNT                                                  AS  Adtnl_Amt               --追加金额
       ,a.PERFBEN                                                         AS  Perf_Compr_Basi         --业绩比较基准
       ,a.ISSSIZE                                                         AS  Iss_Size                --实际发行规模
       ,a.CLOSEDATE                                                       AS  Clos_Date               --产品到期日
       ,a.VALUEDATE                                                       AS  Val_Date                --起息日期
       ,a.CURRENCYTYPE                                                    AS  Crrc_Type               --币种
       ,a.PARVALUE                                                        AS  Par_Val                 --面值
       ,a.COMPOSETAG                                                      AS  Is_Stru                 --是否分级
       ,a.PARENTSECUCODE                                                  AS  Parent_Scr_Cd           --母份额编码
       ,a.INTERESTDAYS                                                    AS  Intr_Days               --计息天数
       ,a.UPDATEDESC                                                      AS  Upd_Desc                --数据更新备注
       ,a.PURCHASEWAY_ID                                                  AS  Purch_Way_Id            --渠道ID
       ,a.PAYWAY_ID                                                       AS  Pay_Way_Id              --支付方式ID
       ,a.OPENDATEDESC                                                    AS  Open_Date_Desc          --开放期描述
       ,a.CLOSEDATEDESC                                                   AS  Clos_Date_Desc          --封闭期描述
       ,a.INVESTGOAL                                                      AS  Ivst_Tgt                --投资目标
       ,a.INVESTSCOPE                                                     AS  Ivst_Scop               --投资范围
       ,a.SECUADVANTAGE                                                   AS  Scr_Advantage           --产品优势
       ,a.TRADINGRULE                                                     AS  Trd_Rule                --交易规则
       ,a.INCOMEDIVISION                                                  AS  Income_Div              --收益分配
       ,a.REMARK                                                          AS  Remark                  --备注
       ,a.UPDATETIME                                                      AS  Upd_Time                --更新时间
       ,a.VERSION                                                         AS  Ver                     --版本
       ,a.UPDATEBY                                                        AS  Upd_By                  --最后更新人
       ,a.LOCKSTATUS                                                      AS  Lock_Stat               --锁定状态
       ,a.SALESINCE                                                       AS  Sale_Since              --销售激励
       ,a.APPRAISAL                                                       AS  Aprs                    --考核与新增资产核算
       ,a.SALESREQU                                                       AS  Sale_Srequ              --适当性销售要求
       ,a.PRODDESC                                                        AS  Prd_Desc                --产品简介
       ,a.MODIFIED                                                        AS  Modif                   --修改
       ,a.CREATEAT                                                        AS  Create_At               --录入时间
       ,a.CREATEBY                                                        AS  Create_By               --录入人
       ,a.PAYWAY                                                          AS  Pay_Way                 --支付方式
       ,a.PURCHASEWAY                                                     AS  Purch_Way               --渠道
       ,a.REPORTPEOPLE                                                    AS  Rpt_PeoPle              --报备人员
       ,a.SALESCONTRACTDATE                                               AS  Sale_Contr_Date         --销售合同签署日期
       ,a.INVESTMANAGER                                                   AS  Ivst_Mngr               --投资经理
       ,a.PUBLISHAT                                                       AS  Pub_At                  --发行时间
       ,a.RATESTANDARD                                                    AS  Rate_Std                --费率标准
       ,a.SALEPREPARE                                                     AS  Sale_Prepare            --产品上架准备
       ,a.PRODTYPE                                                        AS  Prd_Type                --产品分类
       ,a.PRODUCTSUBTYPE                                                  AS  Prd_Sub_Type            --产品子类
       ,a.ABROADASSET                                                     AS  Frgn_Ast                --是否海外资产
       ,a.ALLMARKETS                                                      AS  Mkt_Cd                  --所在市场
       ,a.ISSUE_COMPANY                                                   AS  Iss_Co                  --发行公司
       ,a.INVESTSTYLE                                                     AS  Inst_Sty                --投资风格
       ,a.INCOMETYPE                                                      AS  Income_Type             --收益类型
       ,a.PSECUTYPE                                                       AS  Psecu_Type              --资管产品一级分类
       ,a.PRODSTATUS                                                      AS  Prod_Stat               --日历状态
       ,a.EXCHANGE_CODES                                                  AS  Exch_Cd                 --
       ,a.PRODTA_NO                                                       AS  Prd_Ta_No               --TA代码
       ,a.PROD_TYPE                                                       AS  Prd_Type2               --产品分类
       ,a.AUTHOR                                                          AS  Author                  --拟搞人
       ,a.REVIEORG                                                        AS  Review_org              --引入部门
       ,a.REVIEWNUM                                                       AS  Review_Num              --评审号
       ,a.SALEORG                                                         AS  Sale_Org                --销售部门
       ,a.ASSETALLTYPE                                                    AS  Ast_All_Type            --资产详细分类
       ,a.ASSETONETYPE                                                    AS  Ast_One_Type            --资产第一级分类
       ,a.AGR_TYPE                                                        AS  Agr_Type                --是否签署产品协议[0:不需要,1:需要
       ,a.APPRO_TYPE                                                      AS  Appr_Type               --是否需要适当性匹配[0:不需要,1:需要可不匹配,2:需要且必须同意]
       ,a.GFSELLING                                                       AS  GF_Selling              --是否代销：(null or 1)|是,2|否
       ,a.WITHDRAW_TYPE                                                   AS  Wthdr_Type              --服务产品特有:0是不可以,1:需要,2:服务中不可以
       ,a.HEDGINGFLAG                                                     AS  Hedg_Flag               --对冲属性：0，否；1，是
       ,a.ISSUER                                                          AS  Issr                    --发行主体：1，公募专户；2，期货资管；3，券商集合理财；4，私募公司；5，其他；
       ,a.QUANTITATIVEFLAG                                                AS  Qty_Flag                --量化属性：0，否；1，是
       ,a.STRATEGY                                                        AS  Strg                    --投资策略：1，定向增发；2，股票多空；3，股票多头；4，管理期货；5，债券基金；6，组合基金；7，股票市场中性；8，并购重组；9，套利策略；10，宏观策略；11，多策略；12，股权投资；13，海外投资；14，非标类；15，其他策略；
       ,a.ALERTLINE                                                       AS  Alr_Line                --警告线
       ,a.CONNECTEDCODE                                                   AS  Connected_Cd            --关联代码
       ,a.TREATLINE                                                       AS  Trt_Line                --处置线
       ,a.CUSTOMIZEDORNOT                                                 AS  Customize_Do_Or_Not     --是否定制
       ,a.PROD_RELEASE_OBJECT                                             AS  Prd_Rels_Obj            --专项产品标志:0|常规发行，1|新客专享，2|员工专项，3|多添富定制，4|私行专享，5|富裕客户，6|金管家专享
       ,a.SALESAREA                                                       AS  Sales_Area              --销售区域
       ,a.SUBCOMPANYORNOT                                                 AS  Sub_Co_Or_Not           --是否子公司产品
       ,a.BUYBACK                                                         AS  Buy_Bk                  --提前终止或回购条件
       ,a.DOUBLERECORD                                                    AS  Dbl_Recc                --双录话术
       ,a.FORCUSTOMERTYPE                                                 AS  For_Cust_Type           --面向客户类型:1|所有，2|专业投资者，3|非专业投资者
       ,a.INVESTTERM                                                      AS  Ivst_Term               --投资限制
       ,a.PRODOPERATIONTYPE                                               AS  Prd_Oper_Type           --产品运作方式：2|封闭式，3|开放式
       ,a.INVESTRATIO                                                     AS  Ivst_Rati               --投资比例
       ,a.PERFBENSHOW                                                     AS  Perf_Bm_Show            --是否业绩比较基准
       ,a.REVIEWSTATUS                                                    AS  Revw_Stat               --评审状态: 1:待补录，2:待复核，3:待审批，4:已上架，5:已下架，6:退回，7:修改-待复核，8:修改-待确认，9-修改-退回
       ,a.PRODMODEL                                                       AS  Prd_Mdl                 --资管产品：常规|1，非常规|2
       ,a.ASSETSTYPE                                                      AS  Ast_Type                --资产分类: 现金货币类|1,固定收益类|2,权益类|3,另类投资类|4,海外投资类|5,混合类|6
       ,a.WEALTHTYPE                                                      AS  Wealth_Type             --产品财富分类: 保证金产品|11,货币基金|12,保本型|21,非保本型|22,公募权益基金|31,私募权益基金|32,资管理财（权益类）|33,OTC（权益类）|34, PE/VC|41,对冲基金|42,大宗商品|43,房地产信托基金|44,红酒基金|45,黄金外汇|46,海外固收|51,海外权益|52,海外对冲基金|53,海外其他|54, 混合偏股|61,混合偏债|62,其他|63
       ,'PRD'                                                             AS  Src_Id
       ,'odata_n_prd.p_basicproduct'                                      AS  Src_Tbl
       ,'${data_today}'                                              AS  Rec_Upd_Time            --数据更新时间
       ,'${data_today}'                                              AS  Rec_Down_Time           --数据进表时间
       ,b.activity                                                        AS  Eff_Flag                --有效标志
       ,b.status                                                          AS  Stat                    --状态
       ,b.begin_at                                                        AS  Begin_At                --开始时间
       ,b.expired_at                                                      AS  Expired_At              --失效时间
from (
    select
     *
    FROM    odata_n_prd.p_basicproduct
    WHERE   Busi_Date = '${data_day_str}'
    AND     SECUCODE IS NOT NULL
) a
left join (
    select
     d.*
    from (
        select
         c.*
         --status 0有效 3 过期  1失效，优先取status=0,3的，最后才取status=1的
        ,row_number() over(partition by c.prod_code order by case when c.status='1' then '3'
                                                                  when c.status='3' then '1'
                                                                  else c.status end,c.expired_at desc) as rn 
        from odata_n_prd.prd_p_go_ctrl_product c
        where c.Busi_Date = '${data_day_str}'
    ) d
    where d.rn = 1
) b
on a.SECUCODE = b.prod_code
;
