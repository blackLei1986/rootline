# Phase 5 · Phase A 架构分析

本文件冻结第五轮开始前的系统基线，并明确后续智能分流、学习优先级、学习深度和 Session Orchestration 的职责边界。Phase A 不改动学习 UI，也不提前把识别状态塞进现有 SRS。

## 1. 当前系统基线

### Rapid Vocabulary

入口为 `/vocabulary`，实现集中在 `components/rapid-vocabulary.tsx`。

当前行为：

- 全量词按 `priorityScore` 降序排列。
- 页面打开后立即展示中文释义、搭配和句子，不存在真正的 recognition-first 阶段。
- 用户只有“认识了，下一个”和“深入学习”两个动作。
- 点击“认识了”会调用 `markWordIntroduced()`，把词直接写成长期 `learning` 状态并计入今日新词。
- 没有 `known / fuzzy / unknown`，也没有 response time、confidence、verification 或分类结果。
- 索引只在 React 本地状态中；刷新后回到第 1 个词。
- 进度条固定以 20 词为分母，不能选择 20 / 50 / 100，也不是一个可恢复的 Session。
- Deep 建议只依据 `lapses >= 2 || staticDifficulty >= 72`，没有使用识别结果、学习价值、考试相关性或历史正确率。

结论：它是一个按价值排序的“快速浏览器”，还不是第五轮定义的 Rapid Scan。

### Session Builder

`lib/session-builder.ts` 负责生成 `/learn` 使用的静态项目数组。

当前行为：

- 每个 Session 只选择一个 active root。
- 新词由当前词根下的推荐词组成，默认 5 个；复习词默认最多 15 个。
- 固定结构为 Root Intro → Root Recall → 每词 Word Intro → Word Recall → Mixed Quiz。
- 创建 Session 时一次性生成全部项目；运行中只能因答错插入同题型 reinforcement。
- 没有 time budget、learning depth、phrase/sentence item、rapid item、verification item 或 early-stop summary。
- `LearningSession` 能恢复 `currentIndex` 和答案，现有 `/learn` 刷新恢复能力良好，可作为新 orchestrator 的兼容基础。

结论：它是一个确定性的课程 Session Builder，不应继续承载动态 Next Best Item 逻辑。后续保留兼容入口，由独立 `session-orchestrator.ts` 组合不同项目。

### Spaced Repetition

`lib/spaced-repetition.ts` 使用 `again / hard / good / easy` 更新长期记忆状态。

当前行为：

- `LearningStatus` 为 `new / learning / review / mastered`。
- 首次调度间隔为 10 分钟、8 小时、1 天、3 天；之后按固定倍率增长。
- `memoryStrength`、`difficulty`、`reviewCount` 和 rating 共同决定长期状态。
- 答错会被归一化为 `hard`，但 `recordWordAnswer()` 仍会增加 lapse。
- 只有存在 `nextReviewAt` 的词才会进入 due queue。

结论：长期记忆状态与快速识别结果是不同维度。现有 SRS 可以继续负责“何时复习”，但不能用它代替“用户刚看到这个词时觉得会不会”。

### WordProgress 与 Storage

`WordProgress` 当前只保存长期学习和 SRS 数据：

- 状态、复习次数、正确/错误次数、streak、lapses；
- 记忆强度、难度、间隔；
- 首学、最近复习、下次复习和最近评分。

`LearningStorage` 当前版本为 1，迁移函数会用默认对象补齐旧字段，适合增量升级。缺失的数据包括：

- 最新 recognition state 与识别历史；
- recognition confidence 与 verification 记录；
- response-time / fluency；
- context 能力；
- 学习目标、考试路径、词汇 band 和偏好时长；
- review debt、个人容量和 calibration；
- Rapid Session 本身及本地事件。

## 2. 当前主要耦合问题

1. **“见过”被当成“学过”**：Rapid 的下一步直接调用 `markWordIntroduced()`，会污染 `newWordsLearned` 和 SRS 状态。
2. **自评与实绩混在一起**：系统只有 quiz 正误，没有独立的 recognition self-rating，无法识别误报 known。
3. **候选选择与教学编排混在一起**：`buildTodaySession()` 同时决定学什么、如何排序、用什么卡片和何时测验。
4. **优先级信息利用不足**：Rapid 只看 `priorityScore`；review priority 不看 word value、exam relevance 或 recent learning。
5. **强化只有“同题重做”**：错题回流复制原 item，不满足 Word → Phrase → Sentence 的跨形式重复。
6. **固定数量而非时间预算**：默认新词/复习词数量写死，无法根据 backlog、准确率或用户可用时间调整。
7. **两个 Session 生命周期**：`/learn` 有可恢复 session，Rapid 没有；继续扩展会形成两套相互冲突的进度语义。

## 3. Phase B 数据边界决定

后续实现应保持以下分离：

### RecognitionState

`known | fuzzy | unknown` 只表示一次快速识别结果。它不直接把词设为 `mastered`，也不直接创建 SRS 卡。

建议在 `WordProgress` 增加：

- `recognitionState: RecognitionState | null`
- `recognitionConfidence: number`
- `recognitionCount: number`
- `knownCount / fuzzyCount / unknownCount`
- `lastRecognizedAt: string | null`
- `averageRecognitionMs: number | null`
- `verificationDue: boolean`
- `verificationCorrect / verificationWrong`

`known` 只更新 recognition 数据，并按配置抽样进入 verification；`fuzzy` 和值得学习的 `unknown` 才进入学习/SRS。

### LearningStatus

继续由 SRS 维护 `new | learning | review | mastered`。只有发生实质学习或可验证回忆后才改变，不能由单次 known 自评直接改变。

### Fluency

Fluency 应是派生或独立维度，初版只需要 recognition response time 与最近验证表现。不要把“答得快”直接等同于“长期记得牢”。

### LearningGoal

学习目标应拆成：

- `path`: general / ielts / toefl / ielts-toefl / academic
- `vocabularyBand`: 当前候选词范围
- `sessionMinutes`: 10 / 20 / 30
- `goalType`: passive recognition / active usage（初版默认 recognition + context）

## 4. Phase C 算法职责

### `candidate-pool.ts`

只回答“哪些词值得被看见”。输入 path、band、词表和 progress；输出带可解释 score 的候选词。它不得决定卡片 UI 或 SRS 间隔。

排序基线：

```text
candidateScore =
  learningValue
  × pathRelevance
  × noveltyOrKnowledgeGap
  × coverageNeed
  - recentExposurePenalty
```

候选池优先未见、高价值、匹配目标路径的词，并排除当前 session 已出现的词。

### `learning-depth.ts`

只回答“这个词现在要学多深”。返回 `skip | quick | standard | deep` 和 reason codes。

必须满足的最小规则：

- known + 已验证 + 高记忆强度 → skip；
- known + 未验证 → skip，并安排 verification；
- fuzzy → standard；
- unknown + 低价值 → quick 或 defer；
- unknown + 高频/高价值/高考试相关 → deep；
- 连续错误或多次 lapse → deep。

### `learner-model.ts`

只汇总用户模型：识别准确率、自评校准度、响应速度、retention、偏好时长和 daily capacity。初版规则化计算，不写 UI，也不直接改变某个词状态。

### `session-orchestrator.ts`

负责“下一条应该是什么”，组合 rapid、word、phrase、sentence、quiz、review。它消费 candidate、depth、learner model 和 time budget，不复制这些算法。

必须保留：

- current index、分类结果与 items 的本地恢复；
- 提前结束；
- 同词跨形式重复；
- 不连续堆叠 deep card；
- 可生成真实 summary。

## 5. 兼容迁移策略

1. Storage 版本从 1 升级到 2；所有新增字段都提供默认值，旧用户的 SRS 数据原样保留。
2. 保留现有 `LearningStatus` 和 SRS 调度接口，避免第五轮同时重写记忆算法。
3. 新增独立 Rapid Session key；不要复用现有 `/learn` active-session key，直到 orchestrator 可同时读取两者并完成迁移。
4. `markWordIntroduced()` 只在 quick/standard/deep 学习真正开始时调用；Rapid Scan 的 known 操作调用新的 recognition action。
5. 所有算法阈值集中到 `config/learning-engine.ts`，算法返回 reason codes 供 debug 和测试使用。
6. 新事件采用 append-only 本地结构；先限制条数，避免 LocalStorage 无限增长。

## 6. 下一阶段验收顺序

### 第一批：模型与纯函数

- Storage v2 迁移无数据丢失。
- known/fuzzy/unknown 与长期 status 独立。
- learning depth 覆盖规格中的所有示例。
- candidate pool 对高价值 unknown、目标路径和未见词排序正确。
- known 抽样验证可注入固定 random，测试稳定。

### 第二批：Session 运行时

- Rapid 20/50/100 能创建、保存和恢复。
- 50 词中 30 个 known 不会全部进入 SRS。
- fuzzy/unknown 被分流到 Word → Phrase → Sentence。
- 刷新 37/50 后仍停在 37/50。
- 提前结束能保存已完成分类并生成准确 summary。

### 第三批：负载与恢复

- backlog 高时自动减少 new words。
- 高准确率、低债务时适当增加 intake。
- 大量 overdue 进入 recovery mode，只取最高优先级批次。

## 7. 当前质量基线

2026-09-17 在现有依赖上验证：

- Vitest：10 个测试文件、37 个测试全部通过。
- TypeScript：通过。
- ESLint：通过。
- Next.js 16.3.5 production build：通过，191 个静态页面成功生成。

因此第五轮应以小步提交方式推进：先添加模型和纯函数测试，再接入 Rapid UI，最后替换首页推荐与统一 orchestrator。这样每一步都能区分“算法回归”和“界面回归”。
