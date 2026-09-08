--drop TABLE if exists T98_OTC_DERI_COMP_SALE_ADTNL_DET;
CREATE TABLE if not exists T98_OTC_DERI_COMP_SALE_ADTNL_DET(
    Agt_Id string comment '合约编号',
    Busi_Type string comment '业务类型',
    Cutp_Pty_Id string comment '交易对手客户编号',
    Undrl_Ins_Id string comment '标的ID',
    Undrl_Wd_Cd string comment '标的万得代码',
    Undrl_Name string comment '标的名称',
    Strt_Pric_Date string comment '期初定价日',
    End_Pric_Date string comment '期末定价日',
    Init_Nom_Prin string comment '初始名义本金',
    Dyna_Nom_Prin string comment '动态名义本金',
    fee_rate string comment '费率',
    Inta string comment '应计利息',
    Fnd_Cost string comment '用资成本',
    Trd_Cms string comment '交易佣金收入',
    Trd_Cms_Cost string comment '交易佣金成本',
    Marg_Prop string comment '保证金比例',
    Data_Src_Cd string comment '数据来源代码',
    Task_Name string comment '任务名',
    Data_Etl_Date string comment '数据加载日期',
    Data_Upt_Date string comment '数据更新日期',
    Data_Time string comment '数据时间'
    )
COMMENT 'T98_场外衍生品合约销售收入附加明细'
PARTITIONED BY (
    Busi_Date string comment '业务日期',
    Grp_Id string comment '并行分组标识'
    )
STORED AS ORC
;