# 附录B TITANS源字典

**阅读重点：业务枚举、映射与配置。**

```sql
SELECT
    DICT_NAME          AS "数据字典名称",
    DICT_ITEM_NAME     AS "数据字典子项名称",
    DICT_ITEM_LABEL    AS "显示标签",
    DICT_ITEM_COMMENTS AS "字典子项说明",
    CREATE_DATETIME    AS "创建时间",
    INVALID_DATETIME   AS "失效时间",
    DATA_TIME          AS "数据时间",
    BUSI_DATE          AS "业务日期"
FROM ODATA_N_TIT.D_CFG_DICTIONARY_DESC
WHERE BUSI_DATE = '2026-09-14'
ORDER BY DICT_NAME, DICT_ITEM_NAME;
```

## 1. 表的定位与记录结构

**`D_CFG_DICTIONARY_DESC` 同时保存业务枚举、对象映射和配置参数。** 它为业务字段补充名称和含义，但不是交易事实表，也不包含 TITANS 的全部业务定义。

| 字段 | 作用 | 使用要点 |
|---|---|---|
| `DICT_NAME` | 字典域，限定代码所属语境 | `Party`、`CouponPayer` 即使都有 `PARTY_A`，分别描述我司身份、票息支付方 |
| `DICT_ITEM_NAME` | 域内代码或配置项名称 | 与字典域共同识别一项；不能只按代码连接 |
| `DICT_ITEM_LABEL` | 显示标签，也可能承载映射目标或配置值 | 不保证是中文，更不保证只是名称 |
| `DICT_ITEM_COMMENTS` | 子项说明 | 常含实际中文含义、参数用途或映射双方名称 |
| `CREATE_DATETIME / INVALID_DATETIME` | 创建、失效时间 | 与业务日期分开；保留失效记录以解释历史代码 |
| `BUSI_DATE / DATA_TIME` | 快照业务日期、数据时间 | 与事实表对齐快照，避免新旧字典混用 |

本份底稿为 **2026-09-14 的 118 个字典域、1,086 条记录**，域内代码组合未发现重复。`!`、`！` 共 140 条，主要是域标题或说明项，不是可直接统计的业务取值；导出的 `rn_行号` 不作为业务关联键。

## 2. 三种内容，三种读法

| 内容性质 | 底稿中的真实记录 | 业务含义 |
|---|---|---|
| 业务枚举 | `ContrStatus / EFFECTIVE / 生效` | 把状态代码解释为状态名称 |
| 对象映射 | `CTPTY_MAPPING / 10161 / 11623` | 标签栏存另一个主体 ID，说明栏解释映射双方 |
| 参数值或开关 | `HK_UNDERLYING_LEVER_RATE / DEFAULT_LEVER_RATE / 0.2` | 标签栏存参数值；说明为“杠杠比例默认配置” |
| 参数值或开关 | `CORPORATION_EVENT_CONFIG / PAYMENT_DATE_EDIT / Y` | 配置派息日是否可编辑 |
| 参数名称目录 | `LIQ_PARAMETER_NAME / AGGREGATE_BY_LONGSHORT / 是否依据longshort合并持仓` | 定义参数的名称，并未给出某账户实际启用与否 |

因此不能把整张表统一加工成“代码→中文名称”后就丢掉其他字段。**映射目标、实际配置值、参数名称是不同的信息。** 参数记录的存在也不证明某个业务程序正在读取或执行它。

## 3. 业务域导航

下表按用途归纳底稿中的代表字典域；分组用于查找，不是系统新增层级。

| 业务范围 | 字典域 | 主要解释对象 |
|---|---|---|
| 公司、部门与账簿 | `Company`、`Department`、`Desk`、`ResourceType` | 组织标签、账簿业务分类和资源类型 |
| 主体与角色 | `CTPTY_MAPPING`、`Party`、`ClearingHouse`、`CouponPayer` | 主体映射、我司身份、清算方身份、票息支付方 |
| 生命周期 | `ContrStatus`、`ProductStatus`、`TradeStatus`、`TRANSFER_STATUS` | 合约、产品、交易及转让各自的状态 |
| 交易行为与来源 | `BuySell`、`LongShort`、`TradeDirection`、`TradeSource`、`TradingPlace`、`TradingHedgeChannel` | 买卖、多空、委托方向、来源和交易渠道 |
| 清算、交收与收付 | `CLEARING_TYPE`、`SettlementTypeEnum`、`PAYRECEIVE_TYPE`、`FeeType`、`TransferType` | 清算事项、交收方式、应收应付、费用及转让类型 |
| 产品与结构 | `BundleType`、`OptionType`、`OptionSubType`、`OtcOptionContractType`、`OtcOptionContractSubType`、`relateProductType` | 组合结构、期权类别及关联产品类型 |
| 条款与计算约定 | `CallPut`、`BarrierType`、`BarrierWay`、`DayCount`、`DateRoll`、`CompoundFrequency`、`ObservationFreq`、`Dividend` | 方向、障碍条件、计息基础、日期调整、观察及分红约定 |
| 币种、标的与市场 | `ContractCurrency`、`BaseCurrency`、`InstrumentFamily`、`BondType`、`Exchange`、`InterotcUnderlyingCategory` | 币种、工具分类、交易所和标的类别 |
| 定价与行情 | `InstrumentRateSource`、`InterpolatorType`、`YieldCurveType`、`VolatilityCalculatorType`、`PricingParameterRNG` | 行情来源及定价参数分类 |
| 控制与系统配置 | `LIQ_PARAMETER_NAME`、`CORPORATION_EVENT_CONFIG`、`AccessType`、`MessageTrigger`、`ReportTo`、`ReportStatus` | 清算参数、可编辑开关、权限、消息及报送配置 |

域名相似不代表可替换。例如 `TradeSource` 是交易来源，本份记录包括 `CALYPSO`、`CTP`、`ESUNNY`、`GFSOTC`、`PT_O32`；它不能直接解释 TRS 的 `SOURCE_CHANNEL`（合约生成渠道）。

## 4. 与账簿、TRS 直接相关的业务含义

### 4.1 账簿：组织归属与业务用途分开

- `Company`、`Department` 提供公司、部门标签。已查 SQL 将账簿部门配置中的代码按 `Company / Department` 域关联 `DICT_ITEM_NAME`，取 `DICT_ITEM_LABEL` 作为名称。
- `Desk` 的域说明为“交易台”，码值包含主动对冲、互换对冲、线性互换、融券、债券 TRS 等；数仓另以 `CD2204` 将其定义为账簿业务分类。
- `ResourceType / BOOK` 的标签为 `Book`、说明为“交易账簿”，确认该资源类型的名称；它不单独证明账簿与交易、账户的连接关系。

公司和部门说明管理归属，desk 进一步区分业务类型、对冲方式及管理用途；不能仅凭这些标签建立严格的行政组织树。完整名称见 [账簿](01.3%20%E8%B4%A6%E7%B0%BF.md)。

### 4.2 主体映射：目标 ID 存在标签栏

`CTPTY_MAPPING` 除域说明项外，本份底稿有以下两条映射：

| 源代码 `DICT_ITEM_NAME` | 映射目标 `DICT_ITEM_LABEL` | `DICT_ITEM_COMMENTS` |
|---|---|---|
| `10161` | `11623` | 广发证券OTC:广发证券OTC_HK |
| `11616` | `11613` | 广发全球资本XOTC:广发全球资本OTC_HK |

记录证明存在这些方向的主体 ID 映射及业务名称。**映射不等于同一法人，也不代表双向等价。** 它支持“部分交易对手 ID 表示内部业务主体”的判断，不能外推所有账簿归属主体均为内部主体；具体使用场景还需消费 SQL。

### 4.3 合约状态与甲乙方身份

`ContrStatus` 的全部非标题码值为：

| 代码 | 含义 |
|---|---|
| `DRAFT` | 草稿 |
| `TOTRADE` | 待交易 |
| `EFFECTIVE` | 生效 |
| `TERMINATED` | 终止 |
| `CANCELED` | 作废 |

这些值定义状态名称，不提供状态迁移顺序或触发规则。

`Party`、`ClearingHouse`、`CouponPayer` 各自都有 `PARTY_A=甲方`、`PARTY_B=乙方`，但分别表达我司身份、清算方身份、票息支付方。解释付款方向时，应先确认我司是哪一方，再结合支付方字段，不能固定把甲方理解为我司。

### 4.4 清算事项、交收方式与终止原因

`CLEARING_TYPE` 的全部非标题码值：

| 代码 | 含义 |
|---|---|
| `AUTOCALL_KO` | Autocall敲出 |
| `COUPON` | 支付票息 |
| `EARLY_TERMINATION` | 客户提前赎回 |
| `MATURITY` | 正常到期 |

`SettlementTypeEnum` 的全部非标题码值，其中文取自说明栏：

| 代码 | 含义 |
|---|---|
| `CASH` | 现金 |
| `COMPOSITE` | 复合 |
| `ELECTATEXECISE` | 到期选择 |
| `PHYSICAL` | 实物 |
| `QUANTO` | 汇率联动 |

**上述域不可跨字段直接套用**：

- TRS 的 `TERMINATION_TYPE` 已在仓库代码域 `CD706` 查到 `EARLY_TERMINATION=客户提前终止`。没有关联规则证明它使用 `CLEARING_TYPE`，不能把“客户提前赎回”作为更精确的替代解释，更不能由此推导客户已发起赎回。
- `CROSS_CURRENCY_TYPE=COMPOSITE` 与交收类型中的代码同名，尚不能直接沿用其“复合”说明，更不能据此推导汇率计算公式。

## 5. 字典应怎样关联和展示

**关联身份：来源表 + 字典域 + 域内代码 + 日期范围。** 本次快照中 `DICT_NAME + DICT_ITEM_NAME` 唯一；跨日使用时还需限定 `BUSI_DATE`，不能把该快照观察提升为数据库主键约束。

1. **先确认字段对应的域。** 优先看消费 SQL、源字段注释或代码域定义；仅凭码值相同只能形成候选。
2. **同日关联后再处理有效期。** 这份导出保留了失效记录，失效时间非空不能不经判断就删除；历史含义查询与当前可选项查询的筛选目的不同。
3. **将 `! / ！` 与业务码值分开。** 它们提供域标题、说明，本份中还存在不同标题项共存；不把它们翻译成正常业务选项。
4. **标签与说明同时保留。** `PAYRECEIVE_TYPE / PAY` 的标签是 `Pay`，说明才是“应付”；`DateRoll / FOLLOWING` 的说明是“遇非交易日调整为下一个交易日”。映射域和参数域不使用统一的中文回填规则。
5. **未命中保留原码。** 不从其他域取第一条同名结果，不用空值覆盖原始代码，也不将字典中的配置值当作运行结果。

## 6. 与数仓字典的分工

| 资料 | 保存什么 | 用途 |
|---|---|---|
| `D_CFG_DICTIONARY_DESC` | TITANS 源字典域、源代码、标签、说明及部分配置 | 解释源系统语义 |
| `REF_DW_CD_LIST` | 仓库代码域的名称、来源及定义 | 确认目标字段使用哪个 `CDxxx` 域 |
| `REF_DW_CD_VAL` | 仓库代码及含义 | 解释仓库码值，如 `CD704` 互换类型、`CD1764` 合约生成渠道 |
| `REF_CD_CVT_MAP` | 限定源系统、源表、源字段及目标字段的转码规则 | 确认源代码如何变成仓库代码 |

存在两种加工方式：**原码直接入仓后按仓库域解释**，或**先经转换表转码再解释**。例如 TRS 的类型、生成渠道直接进入对应目标字段；合约状态、复核状态则在所查 SQL 中经过转码。四类资料不能互相替代。

本份源字典未完整覆盖 TRS 的类型、生成渠道及跨币种类型。`CD704 / CD1764` 可从本地仓库字典补充；`FLEXO`、`OPTION_MARGIN_EOD`、复核 `PASS` 的剩余缺口见 [普通互换](02.1%20%E6%99%AE%E9%80%9A%E4%BA%92%E6%8D%A2.md)。

## 依据

- [源字典合并 CSV](../../../../../数综基础信息/原信息/关键表信息/D_CFG_DICTIONARY_DESC_合并_中英文字段.csv)：业务日期 2026-09-14。本篇分析该导出，不宣称覆盖系统全部配置；字典枚举完整列表均按对应域列出，未按合约样本筛选。
- 静态 SQL：`165634`（公司/部门名称关联）、`103941`（TRS 类型、渠道和转码）；本地仓库字典：`CD704`、`CD706`、`CD1764`、`CD2204`。查询路径见 [本地 SQLite 导航](../../../local-sqlite-guide.md)。

返回 [00 协议账户与合约全貌](00%20协议账户与合约全貌.md)。
