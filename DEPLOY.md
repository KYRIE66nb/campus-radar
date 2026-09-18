# 部署指南（全部免费资源）

目标：部署到 Vercel，产出可评审的 Tool URL。整个过程约 15 分钟。

## 0. 准备账号（全部免费）

| 服务 | 用途 | 链接 |
|---|---|---|
| Vercel | 托管应用 + 每日 Cron | vercel.com |
| Neon | 免费 Postgres 数据库 | neon.com |
| QQ/163 邮箱 | SMTP 发信（授权码），保证评审填任意邮箱都能收到真实邮件 | 见下 |
| GitHub | 仓库 + 每小时 Actions 调度 | github.com |

## 1. 建数据库（Neon）

1. 注册 Neon → Create Project（区域随意）。
2. 复制 Connection string（`postgres://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`）。

## 2. 部署到 Vercel

方式 A（推荐，网页操作）：
1. 把本项目推到 GitHub 仓库（私有即可）。
2. Vercel → Add New Project → Import 该仓库。
3. Environment Variables 填入（Production + Preview 都勾）：

```env
DATABASE_URL=postgres://...（Neon 连接串）
AUTH_SECRET=随便一串长随机字符（如 openssl rand -hex 32）
CRON_SECRET=另一串随机字符
APP_URL=https://你的域名.vercel.app
# SMTP（QQ 邮箱示例：设置→账户→开启SMTP→生成授权码）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=你的QQ号@qq.com
SMTP_PASS=授权码（不是QQ密码）
SMTP_FROM=校园热点雷达 <你的QQ号@qq.com>
# 可选：LLM 总结增强（OpenAI 兼容接口）
# LLM_API_KEY=...  LLM_BASE_URL=...  LLM_MODEL=...
```

4. Deploy。`vercel.json` 已配置每日 Cron（00:30 UTC = 08:30 北京）。

方式 B（CLI）：`npm i -g vercel && vercel`，同样在 `vercel env add` 中加入上述变量。

## 3. 初始化表结构 + 种子数据（二选一）

**方式 A（线上，推荐）**——部署后执行：

```bash
curl -X POST "https://你的域名.vercel.app/api/admin/seed" \
  -H "x-cron-secret: 你的CRON_SECRET" \
  -H "Content-Type: application/json" -d '{"reset": true}'
```

**方式 B（本地）**：

```bash
npm run db:push                                        # 建表（读 .env 的 DATABASE_URL）
DATABASE_URL="postgres://...neon..." npm run seed -- --reset   # 种子（本地需能访问 Google News）
```

## 4. 启动每小时调度（GitHub Actions）

仓库 Settings → Secrets and variables → Actions 添加：

- `TOOL_URL` = `https://你的域名.vercel.app`
- `CRON_SECRET` = 与 Vercel 环境变量一致

`.github/workflows/dispatch.yml` 已就绪（每小时 :05 触发，公开的 Actions 运行记录可作为"定时任务真实运行"的佐证）。

## 5. 部署后验收清单

```bash
BASE="https://你的域名.vercel.app"

# 1) 来源在生产环境（海外 IP）真实可达
curl "$BASE/api/health/sources?school=清华大学" -H "x-cron-secret: $CRON_SECRET"

# 2) 定时调度入口
curl -X POST "$BASE/api/cron/dispatch" -H "x-cron-secret: $CRON_SECRET"
```

然后浏览器走查：
- [ ] `/login` 一键登录（review@demo.campus / demo1234）
- [ ] 首页点「立即运行一次」→ 获得实时变化的结果（对比上次新增条数）
- [ ] 设置页填真实邮箱 → 再运行 → 收到真实邮件（SMTP 配置正确时）
- [ ] 历史日报：7 天预置 + 今日实时；09-16 那天能看到"官网来源失败但日报仍生成"
- [ ] 来源说明页：贴吧 403 状态、14 天健康格、Mock 标注
- [ ] 分享链接（设置页底部）匿名可打开

## 常见问题

- **邮件发不出**：QQ 邮箱需开启 SMTP 并用授权码；Vercel 日志看 `/api/run` 的 emailError。
- **官网来源在海外超时**：健康检查若失败，日报会自动降级并在界面标注；可稍后重试或换演示学校。
- **种子重复执行**：接口幂等（已有数据则跳过）；`{"reset": true}` 可清空重建。
- **本地开发**：`npm run db:push && npm run seed && npm run dev`（.env 用本地或 Neon 库皆可）。
