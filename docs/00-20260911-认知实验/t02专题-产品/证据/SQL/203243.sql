-- task_id: 203243
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm03/pdata_news_n.t02_stk_fctr_expo_sw_TL_dy1d_exposure_grp01
-- observed_at: 2026-09-05T01:07:19.248Z

-- createSql
CREATE TABLE IF NOT EXISTS t02_stk_fctr_expo_sw
(
   busi_date              string comment '数据日期'
  ,rec_id                 string comment '记录编号'
  ,secu_id                string comment '统一证券编号'
  ,src_sys_prdno          string comment '源系统产品编号'
  ,stk_cd                 string comment '股票代码'      
  ,trd_dt                 string comment '交易日期'
  ,beta_sty_fctr          string comment 'BETA风格因子'      
  ,mtm_sty_fctr           string comment '动量风格因子'    
  ,mval_sty_fctr          string comment '市值风格因子'      
  ,prft_sty_fctr          string comment '盈利风格因子'      
  ,resid_vola_sty_fctr    string comment '残余波动率风格因子'            
  ,gro_sty_fctr           string comment '成长风格因子'    
  ,val_sty_fctr           string comment '价值风格因子'    
  ,lvrg_sty_fctr          string comment '杠杆风格因子'      
  ,liqd_sty_fctr          string comment '流动性风格因子'      
  ,not_line_mval_sty_fctr string comment '非线性市值风格因子'              
  ,bnk_indt_fctr          string comment '银行行业因子'      
  ,realest_indt_fctr      string comment '房地产行业因子'          
  ,med_bio_indt_fctr      string comment '医药生物行业因子'          
  ,trans_indt_fctr        string comment '交通运输行业因子'        
  ,mining_indt_fctr       string comment '采掘行业因子'        
  ,nfmetal_indt_fctr      string comment '有色金属行业因子'          
  ,hha_indt_fctr          string comment '家用电器行业因子'      
  ,leiser_indt_fctr       string comment '休闲服务行业因子'        
  ,mecheqp_indt_fctr      string comment '机械设备行业因子'          
  ,blddec_indt_fctr       string comment '建筑装饰行业因子'        
  ,comtra_indt_fctr       string comment '商业贸易行业因子'        
  ,bldma_indt_fctr        string comment '建筑材料行业因子'        
  ,auto_indt_fctr         string comment '汽车行业因子'      
  ,texapp_indt_fctr       string comment '纺织服装行业因子'        
  ,fdbev_indt_fctr        string comment '食品饮料行业因子'        
  ,electr_indt_fctr       string comment '电子行业因子'        
  ,comp_indt_fctr         string comment '计算机行业因子'      
  ,ligman_indt_fctr       string comment '轻工制造行业因子'        
  ,pubutil_indt_fctr      string comment '公用事业行业因子'          
  ,telcomm_indt_fctr      string comment '通信行业因子'          
  ,agri_indt_fctr         string comment '农林牧渔行业因子'      
  ,chem_indt_fctr         string comment '化工行业因子'      
  ,media_indt_fctr        string comment '传媒行业因子'        
  ,steel_indt_fctr        string comment '钢铁行业因子'        
  ,nbfi_indt_fctr         string comment '非银金融行业因子'      
  ,eleceqp_indt_fctr      string comment '电气设备行业因子'          
  ,defense_indt_fctr      string comment '国防军工行业因子'          
  ,conglo_indt_fctr       string comment '综合行业因子'        
  ,cty_fctr               string comment '国家因子'
  ,logic_del_flag         string comment '逻辑删除标识'
  ,etl_chk_flag           string comment 'ETL校验标识'
  ,regu_chk_flag          string comment '规则检查标识'
  ,manu_modif_flag        string comment '手工修改标识'
  ,whth_vld_flag          string comment '是否有效标识'
  ,creator                string comment '创建人'
  ,upd_prsn               string comment '更新人'
  ,estb_time              string comment '创建时间'
  ,src_timsp              string comment '源时间戳'
  ,remark                 string comment '备注'
  ,src_tbl                string comment '来源表'
  ,src_rec_id             string comment '来源记录'
  ,rec_upd_time           string comment '记录修改时间'
  ,rec_down_time          string comment '记录创建时间'
) comment '股票因子暴露表_申万行业'
partitioned by(
  src_id string comment'来源标识',
  grp_id string comment'并行标识'
)
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
  set hive.support.concurrency=false;
 
  INSERT OVERWRITE TABLE t02_stk_fctr_expo_sw partition (SRC_ID = 'TL', GRP_ID = '01')
  SELECT 
    '${data_day_str}'              as BUSI_DATE               -- 数据日期
    ,a.id                               as rec_id                  -- 记录编号
    ,b.secu_id                          as secu_id                 -- 统一证券编号
    ,b.src_sys_prdno                    as src_sys_prdno           -- 源系统产品编号
    ,a.ticker_symbol                    as stk_cd                  -- 股票代码
    ,a.TRADE_DATE                       as trd_dt                  -- 交易日期
    ,a.BETA                             as beta_sty_fctr           -- BETA风格因子        
    ,a.MOMENTUM                         as mtm_sty_fctr            -- 动量风格因子      
    ,a.SIZE                             as mval_sty_fctr           -- 市值风格因子        
    ,a.EARNYILD                         as prft_sty_fctr           -- 盈利风格因子        
    ,a.RESVOL                           as resid_vola_sty_fctr     -- 残余波动率风格因子              
    ,a.GROWTH                           as gro_sty_fctr            -- 成长风格因子      
    ,a.BTOP                             as val_sty_fctr            -- 价值风格因子      
    ,a.LEVERAGE                         as lvrg_sty_fctr           -- 杠杆风格因子        
    ,a.LIQUIDTY                         as liqd_sty_fctr           -- 流动性风格因子        
    ,a.sizenl                           as not_line_mval_sty_fctr  -- 非线性市值风格因子                
    ,a.bank                             as bnk_indt_fctr           -- 银行行业因子        
    ,a.realestate                       as realest_indt_fctr       -- 房地产行业因子            
    ,a.health                           as med_bio_indt_fctr       -- 医药生物行业因子            
    ,a.transportation                   as trans_indt_fctr         -- 交通运输行业因子          
    ,a.mining                           as mining_indt_fctr        -- 采掘行业因子          
    ,a.nonfermetal                      as nfmetal_indt_fctr       -- 有色金属行业因子            
    ,a.houseapp                         as hha_indt_fctr           -- 家用电器行业因子        
    ,a.leiservice                       as leiser_indt_fctr        -- 休闲服务行业因子          
    ,a.machiequip                       as mecheqp_indt_fctr       -- 机械设备行业因子            
    ,a.builddeco                        as blddec_indt_fctr        -- 建筑装饰行业因子          
    ,a.commetrade                       as comtra_indt_fctr        -- 商业贸易行业因子          
    ,a.conmat                           as bldma_indt_fctr         -- 建筑材料行业因子          
    ,a.auto                             as auto_indt_fctr          -- 汽车行业因子        
    ,a.textile                          as texapp_indt_fctr        -- 纺织服装行业因子          
    ,a.foodbever                        as fdbev_indt_fctr         -- 食品饮料行业因子          
    ,a.electronics                      as electr_indt_fctr        -- 电子行业因子          
    ,a.computer                         as comp_indt_fctr          -- 计算机行业因子        
    ,a.lightindus                       as ligman_indt_fctr        -- 轻工制造行业因子          
    ,a.utilities                        as pubutil_indt_fctr       -- 公用事业行业因子            
    ,a.telecom                          as telcomm_indt_fctr       -- 通信行业因子            
    ,a.agriforest                       as agri_indt_fctr          -- 农林牧渔行业因子        
    ,a.chem                             as chem_indt_fctr          -- 化工行业因子        
    ,a.media                            as media_indt_fctr         -- 传媒行业因子          
    ,a.ironsteel                        as steel_indt_fctr         -- 钢铁行业因子          
    ,a.nonbankfinan                     as nbfi_indt_fctr          -- 非银金融行业因子        
    ,a.eleceqp                          as eleceqp_indt_fctr       -- 电气设备行业因子            
    ,a.aerodef                          as defense_indt_fctr       -- 国防军工行业因子            
    ,a.conglomerates                    as conglo_indt_fctr        -- 综合行业因子          
    ,a.COUNTRY                          as cty_fctr                -- 国家因子  
    ,a.lgcl_del_flg                     as logic_del_flag          -- 逻辑删除标识
    ,a.etl_crc                          as etl_chk_flag            -- ETL校验标识
    ,a.qa_rule_chk_flg                  as regu_chk_flag           -- 规则检查标识
    ,a.qa_manual_flg                    as manu_modif_flag         -- 手工修改标识
    ,a.qa_active_flg                    as whth_vld_flag           -- 是否有效标识
    ,a.create_by                        as creator                 -- 创建人
    ,a.update_by                        as upd_prsn                -- 更新人
    ,a.update_by                        as estb_time               -- 创建时间   
    ,a.tmstamp                          as src_timsp               -- 源时间戳
    ,''                                 as remark                  -- 备注
    ,'odata_n_uip.q_dy1d_exposure'      as src_tbl                 -- 来源表
    ,a.id                               as src_rec_id              -- 来源记录
    ,a.update_time                      as rec_upd_time            -- 记录修改时间
    ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss') AS REC_DOWN_TIME -- 记录创建时间
  FROM odata_n_uip.q_dy1d_exposure a
  left join (
    select * from pdata_news_n.t02_stk_base_info
    where src_id = 'TL' and grp_id = '01'
    and mkt_cd in ('SSE', 'SZSE', 'BSE')
  ) b on a.ticker_symbol = b.scr_cd
  ;
