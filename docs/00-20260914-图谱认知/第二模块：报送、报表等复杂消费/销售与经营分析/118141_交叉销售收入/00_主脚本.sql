/*
118141 / 从“合约×计提日”的输入，算到销售收入日报。
这是阅读层次，不声明数据库物理执行顺序；不改变原查询的连接、窗口和字段顺序。

合约主信息 + 逐日金额 + 五路经营参数 + 人员机构
  → contract_day_income：原始当日收入
  → adjusted_day_income：扣金仕达系统费用 / 期权结束日保底调整
  → allocated_day_income：本金分配、收入分配、累计
  → 日报输出：保持原字段顺序与字符串转换

先沿普通期权读02、04、06；参数来源疑问再回到03相应材料。
@include由同目录render.mjs展开；这里只组织一条完整查询，不执行上游生产脚本。
*/

WITH contract_day_income AS (
    -- 第一阶段：输入如何汇合、原始当日收入怎样算，完整SELECT在01。
-- @include 01_合约日与资料.sql
),
adjusted_day_income AS (
    -- 第二阶段：保留每条原始合约日，再补调整后收入；不重新拼接本金/参数。
    SELECT T.*,
-- @include 04_收入调整.sql
    FROM contract_day_income T
-- @include 05_历史奖励.sql
),
allocated_day_income AS (
    -- 第三阶段：06的FROM明确接adjusted_day_income；累计在调整之后计算。
-- @include 06_分配与累计.sql
)
-- 最外层仅按原字段顺序输出、转换类型，不再计算另一套收入。
-- @include 07_日报输出.sql
