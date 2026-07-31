# 埃及段行程规划器

这个项目当前聚焦 2026 国庆埃及段行程规划，不再处理中国国内段。

固定约束：

- 2026-09-30 09:00 到达开罗
- 2026-10-07 14:45 从开罗起飞
- 全部金额口径使用人民币 CNY
- 查询任务由助手处理；用户只处理登录、验证码、短信验证和最终购买确认
- 不保存密码、cookie、token

## 当前方案

- A1：开罗 + 卢克索 + 赫尔格达，默认推荐。优势是红海时间更完整，10/6 回开罗，10/7 国际返程缓冲更稳。
- A2：开罗 + 阿斯旺/阿布辛贝 + 卢克索 + 赫尔格达。优势是补上阿布辛贝，代价是红海时间被压缩，并且必须优先确认 10/7 赫尔格达早班回开罗。

如果 A2 找不到 10/7 早班赫尔格达到开罗、且无法在 11:00 前到达开罗，规划器会把 A2 标为高风险，并建议 10/6 先回开罗。

## 本地页面

生成页面数据：

```bash
node scripts/build_egypt_itinerary_data.mjs
```

启动本地页面：

```bash
cd /Users/xixinyu.simona/projects/路径规划/.worktrees/live-price-comparison
python3 -m http.server 8000
```

访问：

```text
http://localhost:8000/app/
```

Planner v3 支持：

- 对比 A1「开罗 + 卢克索 + 赫尔格达」和 A2「开罗 + 阿布辛贝 + 卢克索 + 赫尔格达」
- 按天展示上午、下午、晚上怎么安排
- 明确说明为什么阿布辛贝方案先去阿斯旺再去卢克索
- 标出 A2 的 10/7 赫尔格达早班回开罗风险
- 把所有待补票价、酒店、项目标记为「待我查询」
- 每个查询任务提供实际订票/预订入口、助手候选录入表和「标记未找到」按钮
- 点左侧行程查询时会自动填入当前候选；候选卡也可手动「填入表单」
- 保存候选后即时刷新候选列表、显示保存反馈、更新方案分数和 10/7 回开罗风险
- 导出更新后的 JSON

## 验证

```bash
node tests/egypt_itinerary_validation.test.mjs
node tests/egypt_itinerary_core.test.mjs
node tests/egypt_itinerary_build.test.mjs
node tests/egypt_itinerary_app.test.mjs
node tests/dashboard_app.test.mjs
node scripts/validate_egypt_itinerary.mjs data/egypt_itinerary_options.json
node scripts/build_egypt_itinerary_data.mjs
node scripts/verify_dashboard.mjs
```

## 旧文件说明

仓库里还保留了早期 v1/v2 的路线评估、实时比价、国内段相关数据和脚本，作为历史资料。当前 active 页面只加载 `app/egypt-itinerary-data.js` 和 `app/app.js`，以埃及段 planner v3 为准。
