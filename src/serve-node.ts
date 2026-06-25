import { serve } from '@hono/node-server';
import app from './index.js';

// Node.js 本地开发服务器 — 用于不安装 wrangler 时本地测试
serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`\n🚀 NekoCloud (Node.js) 已启动`);
  console.log(`📍 地址: http://localhost:${info.port}\n`);
});
