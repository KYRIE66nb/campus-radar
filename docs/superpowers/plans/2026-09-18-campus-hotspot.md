# 校园热点追踪（CampusRadar）实现计划

> **For execution:** 单会话 inline 执行（任务耦合紧密），每任务完成即跑对应测试。步骤用 checkbox 跟踪。

**Goal:** 为笔试题 6 构建「校园热点追踪 + 邮件日报」全栈应用，部署 Vercel 供评审在线测试。

**Architecture:** Next.js 16 App Router 单体应用（页面 + API route handlers），Drizzle ORM + PostgreSQL（dev=本地 PG，prod=Neon），来源适配器 → 归一化/聚类/四分类引擎 → 日报组装器 → 邮件适配器，三个触发口（Vercel Cron / GitHub Actions / 手动）共用幂等运行入口。

**Tech Stack:** Next.js 16 + TypeScript + Tailwind v4 + Drizzle + postgres.js + jose + bcryptjs + cheerio + fast-xml-parser + nodemailer + zod + vitest。

**Spec:** 笔试题 6（见会话）：必做 8 项要求 + 交付物 4 项 + 评审重点 8 条。

## Global Constraints

- 所有"今天/日期"逻辑使用 Asia/Shanghai 时区（服务器是 UTC）。
- Mock 数据全链路带 `is_mock` 标记，UI 一律打「Mock」徽章，绝不冒充实数据。
- 传闻/讨论类内容总结必须用"据社区讨论/网传…未获证实"句式，规则层保证。
- 单来源失败只记状态不阻断日报；无新内容输出诚实空报告。
- 来源请求：8s 超时、失败重试 1 次、30min 内存缓存、UA 声明。
-scheduled 触发幂等：`(userId, reportDate)` 唯一；手动触发不限次，邮件每用户每日 ≤5 封。
- 环境变量缺省可运行：邮件无凭据 → dry-run 模式（UI 明示）；LLM 无 key → 纯规则总结。

## 文件结构

```
src/
  db/schema.ts            全部表定义（drizzle pg）
  db/index.ts             连接（DATABASE_URL 或本地 PG）
  lib/time.ts             Asia/Shanghai 日期助手
  lib/auth.ts             bcrypt + jose JWT cookie session
  lib/sources/types.ts    SourceAdapter 接口 / NewsItem / FetchResult
  lib/sources/thuOfficial.ts   清华官网新闻（cheerio）
  lib/sources/googleNewsRss.ts Google News RSS（fast-xml-parser）
  lib/sources/tieba.ts    贴吧（预期 403，降级演示）
  lib/sources/mockForum.ts Mock 论坛（演示传闻/生命周期）
  lib/sources/index.ts    注册表 + fetchAllSources（超时/重试/缓存/限频）
  lib/dedupe.ts           normalizeTitle / bigrams / jaccard / cluster
  lib/classify.ts         四分类 / 热度 / evidence 等级
  lib/report.ts           composeReport（HTML+文本，诚实空路径）
  lib/llm.ts              可选总结增强（超时回退）
  lib/mailer.ts           SMTP / Resend / dry-run
  lib/pipeline.ts         runPipeline 编排（幂等、统计、持久化）
  lib/schools.ts          学校→来源映射与说明文案
  app/(pages)             login / dashboard / history / sources / settings / r/[token]
  app/api/...             auth / settings / run / runs / reports / topics / feedback / cron/dispatch / health/sources
scripts/seed.ts           demo 账号 + 7 天历史回填
tests/                    vitest：dedupe / classify / report / adapters(fixtures)
.github/workflows/dispatch.yml  每小时 cron 调 /api/cron/dispatch
vercel.json               每日 cron
```

## 任务清单

- [ ] T1 脚手架：schema（users/settings/items/topics/runs/reports/source_state/source_health/feedback/scheduled_runs）、db 连接、布局导航、vercel.json、.env.example —— 验证：`drizzle-kit push` 成功
- [ ] T2 认证与设置：/api/auth/* + /api/settings（zod 校验）—— 验证：curl 注册/登录/改设置
- [ ] T3 适配器：4 个 adapter + fetchAllSources；fixtures 单测 —— 验证：vitest + 本地真实抓取一次
- [ ] T4 聚类分类：纯函数单测（同事件合并、四分类判定、热度、evidence）
- [ ] T5 日报组装：单测（分节、空路径、传闻句式）
- [ ] T6 运行引擎：runPipeline 幂等 + /api/run + /api/cron/dispatch（CRON_SECRET）—— 验证：连跑两次 scheduled 只产一封
- [ ] T7 邮件：三适配器 + dry-run 单测
- [ ] T8 页面 + 种子：全部页面渲染 + seed.ts 回填 7 天（真实抓取 + Mock 生命周期，标 backfill）
- [ ] T9 部署准备：DEPLOY.md、workflow、本地 `next build` 通过、端到端走查
- [ ] T10 上线：用户凭据到位后 vercel deploy + 部署侧来源健康检查 + 评审重点 8 条逐项验收

## 验收对照（评审重点 8 条 → 实现点）

1. 配置学校/关键词/邮箱/时间 → /settings + zod
2. ≥2 真实来源 → 清华官网 + Google News RSS（贴吧/水木为受限演示）
3. 手动运行真实变化 → /api/run 每次实抓，展示与上次 diff
4. 同事件合并 → bigram Jaccard 聚类，官网+媒体同事件合并显示多来源
5. 总结保留来源+事实/传闻区分 → evidence 徽章 + 句式模板
6. 定时+邮件真实运行 → cron 记录 + runs 表 + 发信状态
7. 单源失败仍出报告 → 贴吧常驻失败演示
8. 说明反爬/Mock/限制 → /sources 页 + 页脚说明块
