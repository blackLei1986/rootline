# Phase 5 · Learning Engine

第五轮已把学习主流程从“所有词走同一套卡片”升级为：

```text
Recognize Fast → Classify → Learn Selectively → Reinforce in Context → Schedule Review
```

## 已实现模块

- `config/learning-engine.ts`：集中保存时间、验证率、深度学习和恢复模式阈值。
- `lib/candidate-pool.ts`：按学习价值、知识缺口、目标路径、词汇范围和新鲜度生成候选词。
- `lib/learning-depth.ts`：返回 `skip / quick / standard / deep`，并提供可解释 reason codes。
- `lib/learner-model.ts`：汇总识别准确率、自评校准、响应速度、retention 和 daily capacity。
- `lib/recognition-progress.ts`：维护识别状态、置信度、响应时间、流利度和抽样验证。
- `lib/adaptive-load.ts`：根据时间预算、表现和 review debt 计算每日负载。
- `lib/recovery-mode.ts`：积压达到阈值时只选最高优先级的一小批复习词。
- `lib/session-orchestrator.ts`：在时间预算内混合 Word、Phrase、Sentence、Quiz 与 Review。
- `lib/rapid-session.ts`：管理 Rapid Scan 分流、恢复、提前结束和总结。
- `lib/calibration.ts`：跨词汇层级抽样并给出初始词汇范围建议。

## 用户入口

- `/vocabulary`：Rapid Scan，支持 20 / 50 / 100 词和 10 / 20 / 30 分钟。
- `/learn`：动态混合 Session。
- `/review/burst`：5 分钟最高优先级复习。
- `/calibrate`：30 词轻量校准。
- `/`：Today's Recommendation、Recovery Mode 提示和三个主入口。

## 状态边界

- `RecognitionState` 描述用户本次看到词时的自评。
- `LearningStatus` 继续描述长期 SRS 状态。
- 单次 `known` 不会直接成为 `mastered`；仅部分 known 进入验证。
- fuzzy 和值得学习的 unknown 才进入强化流程与 SRS。
- 验证失败会把 known 降级为 fuzzy，并进入学习状态。

## 本地数据

存储版本为 v2。旧版 SRS 数据会迁移并保留。新增数据包含识别历史、confidence、response time、fluency、verification、学习目标、校准结果和最多 500 条学习事件。

所有进度仍为离线优先，保存在浏览器本地。
