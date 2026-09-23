/*
220979：在香港范围内，把合约逐日金额变成销售收入，再做保底、分配和累计。
01 合约日与资料：主信息 info × 逐日金额 det；客户范围 cp；管理归属 m。
   SELECT 实际接入 02 收入 CASE；FROM 并列接入 04 返息/汇率/事件、03 七路参数。
05 在完整合约日结果上按原窗口调整期权结束日收入，并连接香港历史奖励。
06 承接调整金额，分配本金、累计总收入和三组介绍收入；07 保持全部输出列顺序。

这里只给原三层子查询命名，未把阶段结果重新 JOIN；这是阅读关系，不是物理执行顺序。
@include 由 render.mjs 展开，不是 Hive 语法，不执行上游生产，也不代入日期参数。
*/
WITH contract_day_income AS (
-- @include 01_合约日与资料.sql
),
adjusted_day_income AS (
-- @include 05_保底与历史奖励.sql
),
allocated_day_income AS (
-- @include 06_分配与累计.sql
)
-- @include 07_日报输出.sql
