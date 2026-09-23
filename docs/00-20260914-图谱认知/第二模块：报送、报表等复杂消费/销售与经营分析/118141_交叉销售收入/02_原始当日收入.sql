/*
02 / 选择这一条合约日的原始收入规则。
位置：01_合约日与资料.sql的SELECT；输入资料已经在该层通过03参数匹配及管理关系JOIN提供。
输出：Curr_Prvs_Sales_Income，随后进入04调整，再进入06分配累计；不是已支付金额。

按下列优先级取第一个命中，不将四份模块的结果相加：
  02.1 特殊类型：AIRBAG抵扣/保证金关联，以及关联LONG_HOLD_SWAP置零
  02.2 金仕达：利息、交易收入成本和用资字段乘成本率
  02.3 普通期权：价差＋基准，四种年化/绝对组合
  02.4 普通互换：价差＋基准，四种年化/绝对组合

四个文件都是本CASE内部的WHEN/THEN片段，不是四张结果表；不要另建JOIN或UNION。
@include由render.mjs展开，完整SQL仍是一条查询。
末尾不补ELSE：没有匹配规则时，原始收入仍为NULL。
*/

CASE
-- @include 02.1_特殊类型与保证金关联.sql
-- @include 02.2_金仕达原始收入.sql
-- @include 02.3_普通期权原始收入.sql
-- @include 02.4_普通互换原始收入.sql
END AS Curr_Prvs_Sales_Income,
