/*
01 / 一份当前合约资料，怎样变成多天的计提记录？
把一张当前合约快照展开成“每日计提明细”，生成合约每天一行的 Accrued_Date。

输入：T98_OTC_DERI_COMP_SALE_INFO（合约销售主信息）的本次加工日快照。
不是每天读取对应的历史快照；类型、客户、初始本金、汇率等会随当前资料带到展开的各天。

① 先确定结束边界：有提前终止日就取提前终止日，否则取期末定价日。
② 选结束边界晚于2021-09-30、且期初不晚于结束边界的记录。
③ 从“期初定价日、本次加工日前150天”中较晚一天展开到加工日，首尾都包括。
   例如加工日为9月21日、合约9月18日开始，就生成18、19、20、21日四行。

为什么没有在终止日停止展开？
  原SQL的展开终点是加工日；期权、普通互换在主脚本的金额CASE中把终止日之后置0。
  金仕达、FAST的CASE没有相同的归零判断，不能一概解释为只生成存续期记录。

输出contract_days在主脚本中别名为info；Accrued_Date是计提日，
最终写到目标表分区busi_date。150日是回看跨度，含端点时可覆盖151个日期。
*/

/*
【用途】
将当前合约快照展开为每日计提记录，生成 contract × Accrued_Date 粒度数据。

【输入】
T98_OTC_DERI_COMP_SALE_INFO（加工日快照）。
不读取历史快照，展开后的记录沿用当前快照中的合约属性。

【逻辑】
1. 结束日期：
   Early_Term_Date 存在时取提前终止日，否则取 End_Pric_Date。

2. 合约筛选：
   结束日期 > 2021-09-30；
   Strt_Pric_Date <= 结束日期。

3. 日期展开：
   起始日期 = max(Strt_Pric_Date, 加工日前150天)；
   结束日期 = 加工日；
   生成包含首尾日期的每日记录。

   示例：
   加工日 9月21日，开始日 9月18日：
   生成 9月18日~9月21日。

【注意】
- 展开终点不是终止日，而是加工日。。
- 后续金额计算模块根据终止日期判断是否计入：
    存续期 → 正常计算；
    终止后 → 金额置0。
- 输出 contract_days，Accrued_Date 为计提日。
*/

-- ① 合约范围：只读当日快照，不另筛状态、源类型或grp_id；四类业务都参与。
contract_scope AS (
    select *, coalesce(Early_Term_Date, End_Pric_Date) as End_Pric_Date_n
    from T98_OTC_DERI_COMP_SALE_INFO -- 场外衍生品合约销售主信息
    where busi_date = '${data_day_str}'
        and coalesce(Early_Term_Date, End_Pric_Date) > '2021-09-30'
        and Strt_Pric_Date <= coalesce(Early_Term_Date, End_Pric_Date)
    ),

-- ② 日期展开：按“起始日 ~ 加工日”生成每日计提日期。
-- 起始日 = max(Strt_Pric_Date, 加工日前150天)；
-- posexplode生成日偏移pos，date_add逐日展开。
-- 输出Accrued_Date（一行=合约×计提日）。
contract_days AS (
    select *,
        date_add(default.gfgreatest(Strt_Pric_Date,date_sub('${data_day_str}',150)), pos) as Accrued_Date
    from contract_scope opt
    lateral view posexplode(split(space(datediff('${data_day_str}', default.gfgreatest(Strt_Pric_Date,date_sub('${data_day_str}',150)))), ' ')) t as pos, val
    )
