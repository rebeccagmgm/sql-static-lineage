/*
114013 / 从合约日金额到对内销售收入日报。

01 当前合约、对内重分类 ── 与逐日明细dy、客户范围cp汇合
      ├─ 02 映射mp → 类型基准b；合约价差sp；合约基准cb
      └─ 03 自身与关联合约期初估值npv（仅B2B期权收入使用）
                              ↓
04 contract_day_income：按B2B、特殊类型、普通绝对/年化顺序选收入公式
                              ↓
05 allocated_day_income：接内部经办人m，分配当日收入并按合约累计
                              ↓
06 日报52列：保持原顺序，转换原来需要转换的列

这是原嵌套查询的阅读层次，不声明数据库物理执行顺序。
每个CTE只替代原位置的一段子查询，不重新按合约号拼接中间结果。
@include由render.mjs展开，不是Hive原生语法；没有执行生产SQL。
*/
WITH contract_info AS (
-- @include 01_合约范围与对内分类.sql
),
-- 02定义四路并列参数查询。实际JOIN及所有ON条件统一保留在04。
-- @include 02_分类映射与参数.sql
,
b2b_initial_value AS (
-- @include 03_B2B期初估值.sql
),
contract_day_income AS (
-- @include 04_合约日与当日收入.sql
),
allocated_day_income AS (
-- @include 05_内部分配与累计.sql
)
-- @include 06_日报输出.sql
