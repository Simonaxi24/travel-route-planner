# 2026 埃及方案 3 半自动实时比价设计

日期：2026-07-29

## 背景

当前项目已有静态报告、候选路线 JSON 和评分脚本，但价格仍是估算值。用户现在倾向方案 3 的两个埃及分支，并需要看到具体机票、酒店、当地项目和地面交通价格后再做决定。

方案 3 固定为：

- 09-24 晚：北京 → 兰州
- 09-27 早：兰州 → 长春
- 09-27 晚或 09-28：长春 → 北京
- 09-29：北京 → 开罗
- 10-06：开罗 → 北京

需要比较两个埃及分支：

- S3-HRG：开罗 + 卢克索 + 赫尔格达
- S3-SSH：开罗 + 沙姆沙伊赫

主输出币种为人民币 CNY。

## 目标

建立一套半自动实时比价流程：由 Codex 主动搜索公开可见价格，整理成结构化明细和决策报告；用户后续可用携程、去哪儿、飞猪、美团等实际可下单价格校准。

输出必须回答：

1. 每段机票多少钱，是否含托运行李，时间成本如何。
2. 每个城市有哪些酒店候选，价格、位置、餐食、取消政策和适合理由是什么。
3. 当地项目和地面交通各多少钱，体验差异是什么。
4. S3-HRG 与 S3-SSH 的总价、总时间和体验差异如何。
5. 在价格和时间同权重下推荐哪条线；在体验完整度优先时是否改变推荐。

## 非目标

- 不承诺自动完成最终出票或酒店预订。
- 不绕过登录、验证码、App 专属价或平台反爬限制。
- 不把小红书经验帖作为票价或酒店价格依据。
- 不直接抓取需要登录后才能看到的私有价格；这类价格由用户补充后再校准。

## 数据来源策略

### 航班

优先级：

1. 中国平台：携程、去哪儿、飞猪、美团。
2. 航司官网：国航、埃及航空、南航、东航、海航等相关航司。
3. 国际比价平台：Google Flights、Skyscanner、Trip.com 等。

需要覆盖：

- 北京 → 兰州，09-24 晚。
- 兰州 → 长春，09-27 早。
- 长春 → 北京，09-27 晚或 09-28。
- 北京 → 开罗，09-29。
- 开罗 → 北京，10-06。
- S3-HRG 埃及内陆：开罗 → 卢克索、赫尔格达 → 开罗。
- S3-SSH 埃及内陆：开罗 ↔ 沙姆沙伊赫。

每条航班记录字段：

- route_id
- branch_id
- date
- origin
- destination
- platform
- carrier
- flight_number_or_summary
- departure_time
- arrival_time
- duration_minutes
- layover_summary
- price_cny
- original_price
- checked_baggage_included
- baggage_note
- refund_change_note
- booking_url_or_search_url
- confidence_level
- notes

### 酒店

酒店按 2 位成人、1 间房查询。每个城市给 2-3 个候选。

来源：

1. 中国平台：携程、去哪儿、飞猪、美团。
2. 国际平台：Booking、Agoda、Trip.com、Expedia、Hotels.com。
3. 当地/区域平台与酒店官网：埃及或中东当地平台、度假村官网、酒店集团官网。

城市与偏好：

- 开罗：交通便利、干净、安全、去金字塔/博物馆/机场或集合点方便。给吉萨金字塔附近和市中心/尼罗河附近两类候选。
- 卢克索：东岸交通便利优先，方便神庙、码头、餐厅和包车出发。干净、安全、评分稳定。
- 赫尔格达：海边环境好、评分高、含早晚饭或全包优先，度假设施完整。
- 沙姆沙伊赫：海边环境好、评分高、含早晚饭或全包优先，适合度假和出海项目。

每条酒店记录字段：

- hotel_id
- branch_id
- city
- check_in
- check_out
- nights
- platform
- hotel_name
- star_rating
- guest_rating
- room_type
- meal_plan
- cancellable
- location_summary
- price_cny_total
- price_cny_per_night
- original_price
- booking_url_or_search_url
- why_candidate
- tradeoffs
- confidence_level

### 当地项目

当地项目以海外平台为主，中国平台作补充参考。

优先来源：

1. GetYourGuide。
2. Viator。
3. Tripadvisor。
4. Klook / KKday，如有合适产品。
5. 携程/飞猪当地玩乐，仅作交叉参考。

项目范围：

- 开罗/吉萨：金字塔、狮身人面像、博物馆、老城，可查半日或一日游。
- 卢克索：一日包车/导游，覆盖东岸和西岸核心景点。
- 红海：赫尔格达或沙姆沙伊赫半日/一日游，包括浮潜、出海、潜水体验、Ras Mohammed 国家公园等。

每条项目记录字段：

- activity_id
- branch_id
- city
- date_or_day
- platform
- activity_name
- duration
- included_items
- pickup_included
- language
- rating
- review_count
- price_cny_total_for_2
- original_price
- booking_url_or_search_url
- why_candidate
- tradeoffs
- confidence_level

### 地面交通

需要单独列出，不混入酒店或项目：

- 开罗机场接送。
- 开罗市内打车/接送预算。
- 卢克索包车或带车导游。
- 卢克索 → 赫尔格达专车/巴士。
- 赫尔格达/沙姆沙伊赫机场接送。

每条地面交通记录字段：

- transport_id
- branch_id
- date_or_day
- from
- to
- mode
- provider_or_platform
- duration_minutes
- price_cny_total
- original_price
- included_items
- booking_url_or_search_url
- notes
- confidence_level

## 汇总与评分

每个分支汇总：

- total_flight_cny
- total_hotel_cny
- total_activity_cny
- total_ground_transport_cny
- total_trip_cny
- total_trip_cny_per_person
- total_travel_minutes
- hotel_nights
- checked_baggage_risk_count
- self_transfer_risk_count
- experience_summary

评分公式：

```text
price_score = min(total_trip_cny) / current_total_trip_cny * 100
time_score = min(total_travel_minutes) / current_total_travel_minutes * 100
total_score = 0.5 * price_score + 0.5 * time_score
```

体验标签不进入主评分，但必须出现在报告解释中：

- 历史完整度
- 海边度假强度
- 转场疲劳
- 行李风险
- 价格确定性
- 可取消灵活度

推荐规则：

- 如果只按价格和时间，综合分最高者为主推荐。
- 如果 S3-HRG 比 S3-SSH 贵不超过 1500 元/人，且总转场时间差不超过 6 小时，倾向推荐 S3-HRG，因为它多了卢克索，历史体验增量大。
- 如果 S3-HRG 比 S3-SSH 贵超过 2500-3000 元/人，或总转场时间多 6 小时以上，倾向推荐 S3-SSH。
- 如果任一方案出现不含托运行李、不可保护自转机或取消政策很差，需要在推荐中降级说明。

## 输出文件

建议新增：

- `data/live_price_options.json`：结构化价格明细。
- `reports/2026-09-egypt-live-price-comparison.md`：中文实时比价报告。
- `scripts/score_live_options.mjs`：读取明细、汇总总价和评分。

后续可选：

- `app/`：本地网页应用，用于筛选、编辑价格、重算评分。

## 报告结构

实时比价报告应包含：

1. 查询时间、汇率假设、价格有效性说明。
2. 一页结论：S3-HRG vs S3-SSH 推荐结果。
3. 总价对比表。
4. 机票明细表。
5. 酒店候选表，每个城市 2-3 个候选。
6. 当地项目表。
7. 地面交通表。
8. 风险和校准清单：哪些价格需要用户在 App 或登录后确认。
9. 下一步行动：建议先锁哪些航段、哪些酒店可等。

## 错误处理与不确定性

- 如果某个平台价格不可见，记录为 `unavailable_publicly`，并保留搜索入口。
- 如果价格只显示“起”，记录最低可见价并标记低置信度。
- 如果无法确认托运行李，标记为 `unknown`，不得默认为包含。
- 如果酒店餐食政策不清楚，标记为 `meal_plan_unknown`，不得默认为含早晚。
- 如果外币来源不同，使用统一查询日汇率换算为 CNY，并保留原币。

## 验收标准

实施完成后应满足：

1. 至少覆盖 S3-HRG 和 S3-SSH 两个分支。
2. 每个分支有完整总价：机票、酒店、当地项目、地面交通。
3. 每个城市至少 2 个酒店候选；海边酒店优先含早晚饭或全包。
4. 每个红海分支至少 2 个半日/一日游候选。
5. 航班价格必须标注是否含托运行李或是否未知。
6. 报告能明确说明“为什么推荐这条线”。
7. 评分脚本能从 JSON 重新计算总价和排序。
