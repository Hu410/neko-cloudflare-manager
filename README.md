# ☁️ NekoCloud Manager

一个基于 [Hono](https://hono.dev/) 的 Cloudflare 资源管理面板，支持 **Cloudflare Workers / Pages** 和 **Vercel** 多平台部署。

## ✨ 功能

| 模块 | 功能 |
|------|------|
| 🏠 **仪表盘** | 资源概览、流量 Analytics（请求/带宽/访客/状态码/国家分布） |
| 🌐 **DNS 管理** | A/AAAA/CNAME/MX/TXT/SRV 记录的增删改查 |
| ⚡ **Workers** | 部署/查看代码/删除 Worker 脚本 |
| 📄 **Pages** | 项目列表/部署历史/回滚/删除 |
| 📦 **R2 存储** | 创建/删除 Bucket，浏览/上传/删除文件 |
| 🔑 **KV 存储** | 命名空间管理，键值的增删改查 |
| 🗃️ **D1 数据库** | 创建/删除数据库，SQL 控制台，查看表结构 |
| 🐘 **Hyperdrive** | PostgreSQL / MySQL 连接池配置管理 |

## 📸 界面预览

深色主题 + 紫粉渐变 + 毛玻璃效果，二次元 Neko 风格 🐱

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/)（Cloudflare 部署）
- Cloudflare [Global API Key](https://dash.cloudflare.com/profile/api-tokens)

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd nekocloud
npm install
```

### 2. 配置环境变量

复制 `.dev.vars` 并填入你的 Cloudflare 凭证：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`：

```env
CF_API_KEY=your_global_api_key_here
CF_API_EMAIL=your_email@example.com
ACCESS_PASSWORD=your_password_here
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `CF_API_KEY` | ✅ | Cloudflare Global API Key |
| `CF_API_EMAIL` | ✅ | Cloudflare 账号邮箱 |
| `ACCESS_PASSWORD` | 可选 | 页面访问密码（配置后需输入密码才能访问） |

> 也支持 `CLOUDFLARE_API_KEY` / `CLOUDFLARE_API_EMAIL`（Wrangler 标准变量名）

### 3. 本地开发

**Wrangler（推荐）：**
```bash
npm run dev
# 访问 http://localhost:8787
```

**Node.js：**
```bash
npm run dev:node
# 访问 http://localhost:3000
```

## 🌍 部署

### Cloudflare Workers

```bash
# 1. 登录 Wrangler
wrangler login

# 2. 设置 Secrets（敏感信息不会明文存储）
wrangler secret put CF_API_KEY
wrangler secret put CF_API_EMAIL
wrangler secret put ACCESS_PASSWORD    # 可选

# 3. 部署
npm run deploy:workers
```

部署后会获得一个 `*.workers.dev` 域名。

### Cloudflare Pages

```bash
# 1. 构建
npm run build:ui

# 2. 部署到 Pages
npm run deploy:pages
```

在 Cloudflare Dashboard → Pages 项目中配置环境变量。

### Vercel

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 部署
npm run deploy:vercel
```

在 Vercel Dashboard → Settings → Environment Variables 中配置：
- `CF_API_KEY`
- `CF_API_EMAIL`
- `ACCESS_PASSWORD`

## 📁 项目结构

```
nekocloud/
├── src/
│   ├── index.ts          # Hono 主应用（所有 API 路由）
│   ├── config.ts         # 跨平台环境变量读取
│   ├── cf-client.ts      # Cloudflare API 客户端封装
│   ├── index.html        # 前端 HTML（源文件）
│   ├── ui.ts             # 自动生成：HTML 内嵌为字符串
│   ├── build-ui.ts       # 构建脚本：HTML → ui.ts
│   ├── serve-node.ts     # Node.js 本地开发服务器
│   └── vercel.ts         # Vercel Serverless 入口
├── wrangler.toml         # Cloudflare Workers 配置
├── vercel.json           # Vercel 部署配置
├── .dev.vars             # 本地开发环境变量（不提交）
└── package.json
```

## 🏗️ 技术架构

| 层级 | 技术 |
|------|------|
| **框架** | [Hono](https://hono.dev/) — 超轻量 Web 框架，原生支持 CF Workers / Vercel / Node.js |
| **前端** | 单文件 HTML SPA（内嵌 CSS/JS），Canvas 图表引擎 |
| **API** | Cloudflare REST API v4 + GraphQL Analytics API |
| **模块** | ESM（`"type": "module"`） |

### 跨平台兼容性

| 平台 | 状态 | 说明 |
|------|------|------|
| Cloudflare Workers | ✅ | 主要部署目标 |
| Cloudflare Pages | ✅ | 静态 + Functions |
| Vercel | ✅ | Node.js Serverless |
| Node.js 本地 | ✅ | 开发/调试用 |

### 与 Express 版本的区别

| | Express 版 | Hono 版（本项目） |
|---|---|---|
| 框架 | Express（仅 Node.js） | Hono（跨平台） |
| 模块 | CommonJS | ESM |
| 环境变量 | dotenv + process.env | 平台原生（CF env / process.env） |
| 静态文件 | 文件系统 serve | 构建时内嵌 |
| 依赖体积 | ~5MB | ~200KB |

## 🔐 安全

- `ACCESS_PASSWORD` 为可选访问密码，配置后页面需输入密码才能使用
- 所有凭证通过后端代理请求 Cloudflare API，前端不存储 API Key
- `.dev.vars` 已加入 `.gitignore`，不会被提交

## 📄 许可证

MIT
