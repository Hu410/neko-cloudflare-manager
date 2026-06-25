// 跨平台环境变量读取 — 兼容 CF Workers env / process.env
export interface Env {
  CF_API_KEY: string;
  CF_API_EMAIL: string;
  CLOUDFLARE_API_KEY?: string;
  CLOUDFLARE_API_EMAIL?: string;
  ACCESS_PASSWORD?: string;
}

export function getConfig(env?: Env) {
  // CF Workers: env 来自 wrangler.toml 或 secrets
  // Vercel/Node: env 来自 process.env
  const e = env || (typeof process !== 'undefined' ? process.env as any : {});
  return {
    cfApiKey: e.CF_API_KEY || e.CLOUDFLARE_API_KEY || '',
    cfApiEmail: e.CF_API_EMAIL || e.CLOUDFLARE_API_EMAIL || '',
    accessPassword: e.ACCESS_PASSWORD || '',
  };
}
