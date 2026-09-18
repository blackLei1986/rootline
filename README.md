# Rootline

一个以「高频优先 + 词根辅助 + 语境巩固 + 考试覆盖」为原则的英语词汇学习站。当前保留 20 个 Stage 1 词根，并将内容升级为统一 Master Vocabulary。

## 已实现

- 今日学习 Session：词根导入、主动回忆、3–5 个同词根新词、混合测验与总结
- 5 种测验题型，支持答案揭示、键盘评分和错误讲解
- 错题在 2–5 道题后回流，单词每轮最多回流 3 次
- 可解释的间隔重复调度、困难词优先级与词根掌握度
- LocalStorage 进度持久化与进行中 Session 恢复
- 真实 Dashboard、今日复习队列、困难词列表和独立综合测验
- 仅开发环境显示的进度调试工具
- 四阶段课程框架、4 个 Stage 1 Unit 与推荐式解锁
- 词根/单词学习价值评分、Core/Extension/Advanced 分层
- 课程页、主题地图、Stage Review 与陌生词构词推理
- 词汇数据审计：`pnpm audit:vocabulary`
- 快速扩词、Deep Mode 和 Word → Phrase → Sentence 学习链
- Recognition 与 SRS 双状态：`known / fuzzy / unknown` 不再直接等同长期掌握
- 20 / 50 / 100 词 Rapid Scan、快捷键分流、抽样验证与刷新恢复
- 按词汇价值、知识缺口和学习路径生成候选池，并动态选择 quick / standard / deep
- 10 / 20 / 30 分钟时间预算、混合 Session Orchestrator 与提前结束总结
- Adaptive Daily Load、Review Debt、Recovery Mode 和 5 分钟 Burst Review
- 首次词汇校准、Recognition Confidence、Fluency 与本地学习事件
- General / Academic / IELTS-oriented / TOEFL-oriented 共享学习路径
- Zod 严格 Schema、AI Provider 抽象、Prompt 版本与可断点续跑 Pipeline
- 开发环境内容审核页：`/dev/content-review`

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 质量检查

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

## Vocabulary Pipeline

```bash
pnpm vocab:import -- --dry-run
pnpm vocab:generate -- --limit=20 --dry-run
pnpm vocab:validate -- --dry-run
pnpm vocab:audit -- --dry-run
pnpm vocab:report
pnpm vocab:export -- --dry-run
```

设计审计与质量门详见 [Master Vocabulary architecture](./docs/master-vocabulary-architecture.md)。
