# Rootline V0.1 公网部署清单

> 目标：把当前代码部署到 Vercel，做第一轮真实用户测试。
> 当前状态：代码 build/test 全绿，但 Supabase 尚未建表，部署前必须完成下面 4 步。
> 预计耗时：约 20–30 分钟（其中 Supabase 建表 2 分钟、Auth 配置 5 分钟、Vercel 10 分钟）。

---

## Step 0 — 提交并推送代码（本机执行）

Vercel 只能部署已提交的代码。当前有大量未提交文件，先提交：

```bash
cd "/Users/leipan/Desktop/Codex 项目"
git add -A
git commit -m "chore: V0.1 部署前收尾（FSRS 调度 + 精简内容 + 部署清单）"
# 若尚未授权 GitHub：
brew install gh && gh auth login
git push -u origin main
```

---

## Step 1 — Supabase 建表（一次性，最关键）

在 Supabase 控制台 → 你的项目 → **SQL Editor**，粘贴执行以下任意一种：

**方式 A（推荐，单文件）**：打开本地文件 `supabase/apply-all.sql`（1324 行，已合并 6 份迁移、35 张表 + RPC 函数，幂等可重复执行），全选复制粘贴到 SQL Editor，点 Run。

**方式 B（按序逐份）**：按顺序执行这 6 个文件：
1. `supabase/migrations/202609170001_account_learning.sql`
2. `supabase/migrations/202609170002_rss_reading.sql`
3. `supabase/migrations/202609170003_today_reading.sql`
4. `supabase/migrations/202609180001_vocabulary_core.sql`
5. `supabase/migrations/202609180002_adaptive_learning.sql`
6. `supabase/migrations/202609180003_root_learning.sql`

**验证**：执行完在 SQL Editor 里跑 `select count(*) from public.words;` 等，应不再报「relation does not exist」。

（可选）导入示例词库：执行 `supabase/seed.sql`，会给 `spect` 词根族塞入几个演示词，方便第一次联调。

---

## Step 2 — Supabase Auth 配置（邮箱验证 + 回调地址）

在 Supabase 控制台 → **Authentication**：

1. **Sign In / Up**（或 Providers → Email）：
   - 开启 **Confirm email**（邮箱确认）
   - （可选）关闭 "Allow anonymous sign-ins"

2. **URL Configuration** → Redirect URLs，加入以下两条：
   - `https://你的域名/auth/callback`（生产）
   - `http://localhost:3000/auth/callback`（本地调试）

3. **Site URL** 填你的生产域名（如 `https://rootline.vercel.app`）。

---

## Step 3 — Vercel 导入项目 + 环境变量

1. 在 [vercel.com](https://vercel.com) → **Add New Project** → 导入你的 GitHub 仓库（已 push 的 main 分支）。
2. 框架自动识别为 **Next.js**，无需改动默认构建命令（`next build`）。
3. 在 **Environment Variables** 里配置（值从本地 `.env.local` 复制，或从 Supabase 控制台复制）：

| 变量名 | 值来源 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | 形如 `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 同上 → anon public key | 浏览器安全，可公开 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上 → service_role key | **仅服务端，绝不泄露** |
| `NEXT_PUBLIC_SITE_URL` | **填生产域名** | 例 `https://rootline.vercel.app`（**不要填 localhost**） |
| `CRON_SECRET` | 自定随机长字符串 | 例 `openssl rand -hex 32` 生成 |
| `FEED_FETCH_CONTACT` | 你的邮箱 | 抓取 feed 时声明身份 |
| `CLOUD_LEARNING_ENABLED` | `false`（本轮先关） | 建表 + 验证后再改 `true` |
| `RSS_READING_ENABLED` | `false`（本轮先关） | 同上 |

> 注意：`NEXT_PUBLIC_SITE_URL` 一定要用生产域名，否则邮箱验证链接会跳到 localhost。

4. 点 **Deploy**。

---

## Step 4 — 部署后验证（Smoke Test）

部署完成后，逐项确认：

- [ ] 首页 `/` 正常渲染（本地 Dashboard）
- [ ] 未登录访问 `/today` → 出现「去登录」按钮（不再是「无法加载」）
- [ ] 注册 → 收验证邮件 → 点链接 → 自动登录
- [ ] 登录后 `/today` 能生成今日计划（若仍报错，回到 Step 1 确认建表成功）
- [ ] 走一遍核心链路：开始学习 → 查看答案 → 提交评分(1/2/3/4) → 下一词 → 刷新页面 → 进度还在
- [ ] `/progress` 显示 Learned / Mastered / Due / Goal 四个指标

---

## 常见问题速查

| 症状 | 原因 | 解决 |
|------|------|------|
| `/today` 报 500 | Supabase 没建表 | 回 Step 1 跑 `apply-all.sql` |
| 登录后 `today_plans` 报错 | 只跑了旧 apply-all.sql（缺词汇表） | 用新的 1324 行 `apply-all.sql` |
| 验证邮件链接跳到 localhost | `NEXT_PUBLIC_SITE_URL` 没改 | Step 3 改为生产域名 |
| 收不到验证邮件 | Supabase 未开 Confirm email / 邮箱服务限流 | 检查 Auth 设置，用真实邮箱 |
| Vercel 部署的是旧代码 | 未 commit/push | 回 Step 0 |

---

## 后续（上线后可再做）

- `CLOUD_LEARNING_ENABLED` / `RSS_READING_ENABLED` 改为 `true`（建表验证通过后）
- 删除死代码 `lib/learning/scheduler.ts`（自定义 FSRS，已被 ts-fsrs 取代）
- 配置 Cron（`/api/cron/feeds`，需 `CRON_SECRET` + Vercel Cron 触发）用于 RSS 选材
