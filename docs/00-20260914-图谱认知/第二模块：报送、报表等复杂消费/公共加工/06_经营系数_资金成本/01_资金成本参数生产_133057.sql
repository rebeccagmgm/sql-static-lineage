/*
一条OIS资金成本配置 → 整理为T99参考参数 → 下游按合约类型和期初日匹配。
主体是ODATA_N_OIS.G_BUS_TYPE_CAPITAL_COST的加工日快照，无JOIN、聚合或去重。
CAPITAL_COST直接写成Fnd_Cost，不除100、不计算用资金额，不等于金仕达det.Fnd_Cost。
目标按SRC_TBL来源分区覆盖，不是按业务日期分区；原查询完整保留22列顺序。
源表中文名“销售收入合约类型资金成本利率表”来自原任务注释，源元数据表注释为空。
正常阅读接本目录02，再看03指向的118141唯一收入公式。
*/

INSERT OVERWRITE TABLE T99_DERI_COMP_TYPE_FND_COST_REF
PARTITION(SRC_TBL='${src_table}')
SELECT
    -- 一、适用对象与成本参数：原值传递，不计算金额。
    BUSINESS_TYPE AS Busi_Type, -- 业务类型：OPTION期权 / TRS互换
    CONTRACT_TYPE AS Src_Comp_Type_Cd, -- 源合约类型代码，118141的匹配键
    CONTRACT_TYPE_NAME AS Src_Comp_Type_Desc, -- 源合约类型名称
    UNDERLYING_TYPE AS Src_Undrl_Type_Cd, -- 标的类型：STOCK个股 / NON_STOCK非个股
    EFFECTIVE_DATE AS Vld_Date, -- 实际生效日期；118141此处未用来挑选参数
    CAPITAL_COST AS Fnd_Cost, -- 成本参数原值；在118141中作为成本率使用

    -- 二、维护信息与删除标记；本生产查询不筛掉已删除记录。
    CREATED_DATETIME AS Estb_Time, -- 创建时间
    UPDATED_DATETIME AS Upd_Time, -- 更新时间
    CREATED_BY AS Creator, -- 创建人
    UPDATED_BY AS Upd_Prsn, -- 更新人
    DISCRIPTION AS Desc, -- 描述或补充说明
    CASE
        WHEN IS_DELETED='Y' THEN '1'
        WHEN IS_DELETED='N' THEN '0'
        ELSE IS_DELETED
    END AS Del_Flag, -- 其他值含NULL原样保留；下游只取0

    -- 三、任务留痕，不参与收入计算。
    '${data_src_cd}' AS Data_Src_Cd, -- 数据来源代码
    '${filename}' AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_today_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time, -- 数据时间
    '${src_table}' AS Real_Src_Tbl, -- 真实源表

    -- 四、源部门和起息区间，决定118141是否匹配到这条成本参数。
    -- 三个源字段在本地源元数据中缺失；以下含义按原任务目标DDL核对。
    DEPARTMENT AS Src_Dept_No, -- 源部门编码；118141只取OTC
    SUBSTR(INTEREST_START_DATE,1,10) AS Intr_Strt_Date, -- 起息开始日期
    SUBSTR(INTEREST_END_DATE,1,10) AS Intr_End_Date, -- 起息结束日期
    'OTC' AS Bel_Busi_Dept -- 所属业务部门：固定值，不代替Src_Dept_No筛选
FROM (
    SELECT *
    FROM ${src_table} -- ODATA_N_OIS.G_BUS_TYPE_CAPITAL_COST
    WHERE BUSI_DATE='${data_day_str}'
) A
;
