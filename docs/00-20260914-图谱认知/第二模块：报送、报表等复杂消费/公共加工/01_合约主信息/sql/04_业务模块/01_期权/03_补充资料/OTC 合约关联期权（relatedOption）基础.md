# relatedOption（关联期权）
## 1. 概念
`relatedOption` 表示：
> **一个 OTC 合约与另一个期权合约之间的业务关联关系。**
不是期权属性，而是**合同关系（Contract Relationship）**。
```text
OTC Contract
      |
      | relatedOption
      ↓
Option Contract
```
---
## 2. 数据来源
表：
```sql
odata_n_tit.d_trd_otc_contr_props
```
> 场外合约结构-其他属性表（KV结构）


|字段|含义|
|---|---|
|key_otc_trade_id|当前OTC合约ID|
|property_name|属性名称|
|property_value|关联对象|
示例：

|key_otc_trade_id|property_name|property_value|
|---|---|---|
|408000|relatedOption|OPT001|
表示：
```text
合约408000
      |
      ↓
期权OPT001
```
---
## 3. SQL逻辑
```sql
where property_name='relatedOption'
```
只提取关联期权关系。
即：
> 找出所有 OTC 合约对应的关联期权。
---
## 4. 业务场景
部分场外衍生品由多个合同组成：
```text
结构化产品
      |
      +-- TRS合约
      |
      +-- Option合约
```
系统中分别登记 TRS 和 Option，通过：
```text
TRS
 |
 | relatedOption
 ↓
Option
```
表达两者业务关联。
---
## 5. 与雪球的关系
雪球通常建模为：
```text
Option Contract
    |
    +-- Underlying
    +-- Coupon
    +-- KO
    +-- KI
```
但实际业务中可能：
```text
TRS
 |
 +-- relatedOption
          |
          ↓
     Snowball Option
```
即 TRS 作为外层合同，期权作为关联结构。
---
## 6. 与其他关系区别
### 标的关系
```text
Option
  |
  ↓
Instrument
```
回答：
> 期权挂钩什么资产？
### 篮子关系
```text
Basket
  |
  ↓
Constituent Instrument
```
回答：
> 一个篮子包含哪些成分？
### 合同关系
```text
TRS
 |
 ↓
Option
```
回答：
> 一个合同关联哪个其他合同？
---
## 7. 知识地图归类
属于：
**Contract Relationship（合同关系）**
不是：
- Underlying（标的）
- Product Terms（产品条款）
- Valuation（估值）
```text
OTC Derivative
├── Contract
├── Contract Relationship
│       └── relatedOption
├── Underlying
├── Terms
│       ├── Coupon
│       ├── KO
│       └── KI
└── Valuation
```
---
## 关键记忆
> `relatedOption` 不是期权字段，而是一条合同关系边，用于连接 OTC 合约与关联期权，表达复杂衍生品结构。