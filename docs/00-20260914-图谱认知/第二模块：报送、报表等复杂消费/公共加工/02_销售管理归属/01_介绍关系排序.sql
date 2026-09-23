-- 01：把“谁介绍了客户／合约”整理成同一结构，并在各来源内部排名。
-- 输出一行仍是一条介绍关系，不是合约宽表；没有在这里截断到3条。
-- client_id=客户号，Contract_Code=合约号：本分支不用的身份填空串，不填NULL。
-- Introduction_Department=部门；Customer_Manager=开发人员／引入人；
-- Allocation_Proportion=分配比例（转double）；seq=本SQL重新计算的名次。
-- OIS两表的表名及上述中文字段释义来自【AI】元数据；香港表来自普通元数据。
-- OIS客户、OIS合约、香港客户先各自排名，再UNION ALL，不做跨来源重排。
-- 比例相同用人员编号排序；两项都相同没有额外决胜键。
-- 后续03_介绍关系横排按身份合组，因此同客户在两来源出现时可能同有seq=1。
introduction_ranked as (
    select
        client_id, -- 客户号
        '' as Contract_Code, -- 客户级关系不填合约号
        lpad(Introduction_Department,4,'0') as Introduction_Department, -- 部门号左补0到4位
        Customer_Manager, -- 开发人员，后续按OA账号查员工
        cast(Allocation_Proportion as double) as Allocation_Proportion, -- 分配比例
        row_number() over(partition by client_id order by cast(Allocation_Proportion as double) desc, Customer_Manager) as seq
    from odata_n_ois.o_counterparty_introduction -- 【AI】开发关系表（客户级）
    where busi_Date = '${data_day_str}' and Is_Deleted = 'N'
    union all
    select
        '' as client_id, -- 合约级关系不填客户号
        Contract_Code, -- 合约号
        lpad(Introduction_Department,4,'0') as Introduction_Department,
        Customer_Manager,
        cast(Allocation_Proportion as double) as Allocation_Proportion,
        row_number() over(partition by Contract_Code order by cast(Allocation_Proportion as double) desc, Customer_Manager) as seq
    from odata_n_ois.o_contract_introduction -- 【AI】合约开发关系分成表（合约级）
    where busi_Date = '${data_day_str}' and Is_Deleted = 'N'
    union all
    select
        client_id,
        '' as Contract_Code,
        lpad(department,4,'0') as Introduction_Department, -- 引入部门
        introductor as Customer_Manager, -- 引入人，统一成客户经理字段
        cast(Allocation_Proportion as double) as Allocation_Proportion,
        row_number() over(partition by client_id order by cast(Allocation_Proportion as double) desc, introductor) as seq
    from odata_n_oom.g_hk_counterparty_introduction -- 香港交易对手引入信息（客户级）
    where busi_Date = '${data_day_str}'
)
