/*
01｜介绍关系标准化与来源内排序
汇总三类介绍关系：
  1）OIS客户级开发关系
  2）OIS合约级开发关系
  3）香港客户级引入关系

统一输出客户号/合约号、引入部门、引入人员、分配比例，
并按客户或合约在各自来源内部，以分配比例降序生成 seq。

注意：
seq仅表示“来源内部排名”，三个来源排名后再 UNION ALL，
不做跨来源统一重排，因此同一客户可能同时存在多个 seq=1。
本步骤保留全部介绍关系，不做TopN截断；后续03再负责横排。
*/
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
        lpad(Introduction_Department,4,'0') as Introduction_Department,-- 部门号左补0到4位
        Customer_Manager,-- 开发人员，后续按OA账号查员工
        cast(Allocation_Proportion as double) as Allocation_Proportion, -- 分配比例
        row_number() over(partition by Contract_Code order by cast(Allocation_Proportion as double) desc, Customer_Manager) as seq
    from odata_n_ois.o_contract_introduction -- 【AI】合约开发关系分成表（合约级）
    where busi_Date = '${data_day_str}' and Is_Deleted = 'N'
    union all
    select
        client_id,
        '' as Contract_Code,
        lpad(department,4,'0') as Introduction_Department, -- 引入部门
        introductor as Customer_Manager, -- 引入人，统一成客户经理字段
        cast(Allocation_Proportion as double) as Allocation_Proportion,-- 分配比例
        row_number() over(partition by client_id order by cast(Allocation_Proportion as double) desc, introductor) as seq
    from odata_n_oom.g_hk_counterparty_introduction -- 香港交易对手引入信息（客户级）
    where busi_Date = '${data_day_str}'
)
