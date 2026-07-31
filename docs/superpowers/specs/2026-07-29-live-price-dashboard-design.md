# 实时比价 Dashboard 设计

日期：2026-07-29

## 背景

项目已经有 `data/live_price_options.json`、评分脚本和 Markdown 实时比价报告。用户希望继续开发一个网页界面，更直观地查看方案 3 的实时价格、酒店候选、当地项目和风险项。

第一版网页不做自动爬虫。中国 OTA、酒店平台和当地项目网站存在登录、验证码、App 价和动态价，自动抓取不稳定。网页应做成“半自动实时决策台”：展示当前采集价，提供来源链接，允许用户手动录入最新价格并立即重算。

## 目标

构建一个本地静态网页 Dashboard，用于比较：

- S3-HRG：开罗 + 卢克索 + 赫尔格达
- S3-SSH：开罗 + 沙姆沙伊赫

页面必须支持：

1. 展示两个分支的总价、人均、移动时间、价格分、时间分、综合分。
2. 展示机票、酒店、当地项目、地面交通四类明细。
3. 区分“计入总价”和“备选”。
4. 标出托运行李 unknown、餐食 unknown、低置信度价格。
5. 每条明细提供打开来源链接。
6. 用户可在页面内修改人民币价格、选择是否计入总价，并即时重算。
7. 用户可导出修改后的 JSON，用于后续覆盖 `data/live_price_options.json`。

## 非目标

- 不自动登录或抓取携程、去哪儿、飞猪、美团、Booking、GetYourGuide 等平台。
- 不保存到服务器；第一版只在浏览器内修改并导出文件。
- 不做用户账号、云同步、数据库。
- 不替代最终下单页确认，尤其是托运行李、餐食、取消政策。

## 运行方式

优先做无依赖静态网页：

- `app/index.html`
- `app/styles.css`
- `app/app.js`
- `app/live-price-data.js`

由于浏览器直接打开 HTML 时可能无法读取本地 JSON，新增一个构建脚本：

- `scripts/build_dashboard_data.mjs`

该脚本读取 `data/live_price_options.json`，生成 `app/live-price-data.js`：

```js
window.LIVE_PRICE_DATA = { ... };
```

运行：

```bash
node scripts/build_dashboard_data.mjs
```

打开方式：

- 直接打开 `app/index.html`。
- 如果浏览器限制本地脚本，可在项目根目录运行 `python3 -m http.server 8000` 后访问本地页面。

## 页面结构

### 顶部摘要

显示：

- 当前查询时间。
- 推荐分支。
- S3-HRG 与 S3-SSH 总价、人均、移动时间、综合分。
- 价格说明：当前价格来自公开可见参考价，最终出票/预订前需校准。

### 分支对比区

两列对比卡：

- 分支名称。
- 总价、人均。
- 飞机/酒店/项目/交通拆分。
- 移动时间。
- 行李待确认航段数。
- 体验摘要。

### 明细 Tabs

四个 tabs：

- 机票
- 酒店
- 当地项目
- 地面交通

每个 tab 支持：

- 按分支过滤：全部、S3-HRG、S3-SSH。
- 按状态过滤：全部、计入总价、备选。
- 显示来源平台、价格、置信度、备注。
- “打开来源”按钮。

### 编辑能力

每条明细支持：

- 修改人民币价格。
- 勾选/取消“计入总价”。
- 修改简短备注。

修改后立即重算：

- 分支总价。
- 人均。
- 价格分、时间分、综合分。

### 导出

提供“导出更新后的 JSON”按钮：

- 生成完整 JSON 文件内容。
- 文件名建议：`live_price_options.updated.json`。
- 用户后续可手动替换 `data/live_price_options.json`。

## 数据与计算

前端复用 Node 脚本中的计算逻辑，但实现为浏览器端纯函数：

- `summarizeBranches(data)`
- `scoreBranches(summaries)`

为避免重复逻辑漂移，第一版可以在 `app/app.js` 中实现同名函数，并用测试覆盖关键公式。

计价规则：

- `selected !== false` 的条目计入总价。
- `selected === false` 的条目展示为备选，不计入总价。
- 机票字段：`price_cny`。
- 酒店字段：`price_cny_total`。
- 当地项目字段：`price_cny_total_for_2`。
- 地面交通字段：`price_cny_total`。

评分公式：

```text
price_score = min(total_trip_cny) / current_total_trip_cny * 100
time_score = min(total_travel_minutes) / current_total_travel_minutes * 100
total_score = 0.5 * price_score + 0.5 * time_score
```

## 风险提示

页面应突出显示：

- `checked_baggage_included === "unknown"`。
- `meal_plan` 包含 `unknown` 或 `confirm`。
- `confidence_level === "low"`。
- `notes` 中包含 exact date not visible、placeholder、confirm 等词。

这些风险不阻止评分，但必须在页面中可见。

## 设计风格

这是旅行决策工具，不是营销页。

风格要求：

- 信息密度高，但分区清楚。
- 使用简洁的表格、分支卡片、tabs、筛选控件。
- 不做大 hero。
- 不使用大量装饰渐变。
- 颜色用于区分风险和状态，不做单一色系。
- 手机和桌面都能读表格；小屏可横向滚动明细表。

## 测试与验收

需要新增测试或验证：

1. `node scripts/build_dashboard_data.mjs` 能生成 `app/live-price-data.js`。
2. `app/live-price-data.js` 中存在 `window.LIVE_PRICE_DATA`。
3. 前端评分函数和 Node 评分脚本对当前 JSON 的总价一致。
4. 用本地服务器打开页面时，无控制台语法错误。
5. 页面显示 S3-SSH 与 S3-HRG 两个分支。
6. 修改价格后，页面总价发生变化。
7. 导出 JSON 包含用户修改后的价格。

## 第一版验收标准

- 打开页面即可看到两个分支总价对比。
- 能切换四类明细。
- 能看见每条候选的价格、平台、置信度和来源链接。
- 能手动修改价格并重算。
- 能导出更新后的 JSON。
- README 有网页运行说明。
