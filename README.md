# 2026 国庆北京-兰州-埃及航班路径评估

这个项目用于比较 2026-09-25 到 2026-10-07 期间，北京出发并返回北京的两类埃及旅行方案。

当前先交付报告和可复算评分模型：

- `reports/2026-09-egypt-route-report.md`：中文路线与行程评估报告
- `data/route_candidates.json`：候选方案、估算价格、估算移动时间和关键假设
- `scripts/score_routes.mjs`：价格/时间同权重评分脚本
- 中国平台会作为后续核价重点：携程、去哪儿、飞猪、美团用于机票/酒店核价；小红书用于旅行规划经验交叉验证。

## 评分逻辑

同等权重下，越便宜、越省时越好：

```text
price_score = min(candidate.price_usd) / candidate.price_usd * 100
time_score = min(candidate.travel_hours) / candidate.travel_hours * 100
total_score = 0.5 * price_score + 0.5 * time_score
```

运行：

```bash
node scripts/score_routes.mjs
```

## 当前结论

在“价格、时间同等权重”和“必须含托运行李”的约束下，当前推荐：

1. 只按价格/时间：方案 3 + 开罗 + 沙姆沙伊赫，综合分最高。
2. 按历史+红海体验完整度：方案 3 + 开罗 + 卢克索 + 赫尔格达更推荐。
3. 如果郑州节点不可取消，选择方案 2 + 赫尔格达，但需要更早离开埃及，行程更压缩。

所有金额都是 2026-07-29 调研时的网页报价/航线信息整理后的估算，最终出票前需要按同一公式更新。

## 中国平台核价顺序

1. 携程：优先查国际多程/缺口程、开罗/赫尔格达酒店和机酒套餐。
2. 去哪儿：交叉查国内段、国际特价和缺口程。
3. 飞猪：查国际机票、酒店、签证/当地玩乐套餐。
4. 美团：查国内机票、高铁、国内酒店；国际段作为补充。
5. 小红书：查埃及自由行、当地导游、防坑、赫尔格达/沙姆沙伊赫体验，不作为票价来源。

## 新增方案 3

方案 3 是：9/24 晚北京飞兰州，9/27 早兰州飞长春，9/27 晚或 9/28 回北京，9/29 北京往返埃及。

埃及分支：

- 开罗 + 卢克索 + 赫尔格达：历史体验完整，红海也顺路，但转场更多。
- 开罗 + 沙姆沙伊赫：价格/时间更优，红海度假更强，但少了卢克索。

## 实时比价工作流

半自动实时比价围绕方案 3：

- S3-HRG：开罗 + 卢克索 + 赫尔格达
- S3-SSH：开罗 + 沙姆沙伊赫

数据文件：

- `data/live_price_options.json`

验证和评分：

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/score_live_options.mjs
node scripts/generate_live_report.mjs
```

生成报告：

- `reports/2026-09-egypt-live-price-comparison.md`
