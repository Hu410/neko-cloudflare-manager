import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getConfig, type Env } from './config';
import { CfClient } from './cf-client';
import { html } from './ui';

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

function getClient(c: any): CfClient {
  const cfg = getConfig(c.env);
  const key = c.req.header('x-cf-api-key') || cfg.cfApiKey;
  const email = c.req.header('x-cf-api-email') || cfg.cfApiEmail;
  return new CfClient(key, email);
}

// ==================== Server Config ====================
app.get('/api/server/config', (c) => {
  const cfg = getConfig(c.env);
  const hasEnvCreds = !!(cfg.cfApiKey && cfg.cfApiEmail);
  return c.json({ success: true, result: { hasEnvCreds, needPassword: hasEnvCreds && !!cfg.accessPassword } });
});

app.post('/api/server/verify-password', async (c) => {
  const cfg = getConfig(c.env);
  const { password } = await c.req.json();
  if (!cfg.accessPassword) return c.json({ success: true });
  if (password === cfg.accessPassword) return c.json({ success: true });
  return c.json({ success: false, error: '密码错误' }, 401);
});

// ==================== Auth & Accounts ====================
app.get('/api/auth/verify', async (c) => {
  try {
    const client = getClient(c);
    const resp = await fetch('https://api.cloudflare.com/client/v4/user', { headers: client['headers']?.() || { 'X-Auth-Key': (getConfig(c.env).cfApiKey), 'X-Auth-Email': (getConfig(c.env).cfApiEmail), 'Content-Type': 'application/json' } });
    const data = await resp.json();
    return c.json(data);
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/accounts', async (c) => {
  try {
    const client = getClient(c);
    const data = await client.get('/accounts?per_page=50');
    return c.json(data);
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== Zones & DNS ====================
app.get('/api/zones', async (c) => {
  try {
    const client = getClient(c);
    const page = c.req.query('page') || '1';
    const data = await client.get(`/zones?page=${page}&per_page=50&order=name`);
    return c.json(data);
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/zones/:zoneId/dns', async (c) => {
  try {
    const client = getClient(c);
    const { zoneId } = c.req.param();
    const type = c.req.query('type') ? `&type=${c.req.query('type')}` : '';
    const name = c.req.query('name') ? `&name=${c.req.query('name')}` : '';
    const data = await client.get(`/zones/${zoneId}/dns_records?per_page=100${type}${name}&order=name`);
    return c.json(data);
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/zones/:zoneId/dns/:recordId', async (c) => {
  try {
    const client = getClient(c);
    const { zoneId, recordId } = c.req.param();
    return c.json(await client.get(`/zones/${zoneId}/dns_records/${recordId}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/api/zones/:zoneId/dns', async (c) => {
  try {
    const client = getClient(c);
    const { zoneId } = c.req.param();
    return c.json(await client.post(`/zones/${zoneId}/dns_records`, await c.req.json()));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.put('/api/zones/:zoneId/dns/:recordId', async (c) => {
  try {
    const client = getClient(c);
    const { zoneId, recordId } = c.req.param();
    return c.json(await client.put(`/zones/${zoneId}/dns_records/${recordId}`, await c.req.json()));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/zones/:zoneId/dns/:recordId', async (c) => {
  try {
    const client = getClient(c);
    const { zoneId, recordId } = c.req.param();
    return c.json(await client.delete(`/zones/${zoneId}/dns_records/${recordId}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== Workers ====================
app.get('/api/workers/scripts', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.get(`/accounts/${aid}/workers/scripts`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/workers/scripts/:name', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { name } = c.req.param();
    return c.json(await client.get(`/accounts/${aid}/workers/scripts/${name}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/workers/scripts/:name/content', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { name } = c.req.param();
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/scripts/${name}`, { headers: (client as any).headers() });
    return c.json({ success: true, result: { content: await resp.text() } });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.put('/api/workers/scripts/:name', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { name } = c.req.param();
    const { content } = await c.req.json();
    const form = new FormData();
    form.append('script', new Blob([content], { type: 'application/javascript' }), 'worker.js');
    form.append('metadata', JSON.stringify({ body_part: 'script', bindings: [] }));
    return c.json(await client.put(`/accounts/${aid}/workers/scripts/${name}`, form));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/workers/scripts/:name', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { name } = c.req.param();
    return c.json(await client.delete(`/accounts/${aid}/workers/scripts/${name}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== Pages ====================
app.get('/api/pages/projects', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.get(`/accounts/${aid}/pages/projects`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/pages/projects/:name/deployments', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { name } = c.req.param();
    return c.json(await client.get(`/accounts/${aid}/pages/projects/${name}/deployments`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/pages/projects/:name', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { name } = c.req.param();
    return c.json(await client.delete(`/accounts/${aid}/pages/projects/${name}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== R2 ====================
app.get('/api/r2/buckets', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.get(`/accounts/${aid}/r2/buckets`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/api/r2/buckets', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.post(`/accounts/${aid}/r2/buckets`, await c.req.json()));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/r2/buckets/:name', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.delete(`/accounts/${aid}/r2/buckets/${c.req.param().name}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/r2/buckets/:name/objects', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const prefix = c.req.query('prefix') ? `&prefix=${c.req.query('prefix')}` : '';
    return c.json(await client.get(`/accounts/${aid}/r2/buckets/${c.req.param().name}/objects?per_page=1000${prefix}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/r2/buckets/:name/objects', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const key = c.req.query('key')!;
    return c.json(await client.delete(`/accounts/${aid}/r2/buckets/${c.req.param().name}/objects/${key}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== KV ====================
app.get('/api/kv/namespaces', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.get(`/accounts/${aid}/storage/kv/namespaces?per_page=100`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/api/kv/namespaces', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.post(`/accounts/${aid}/storage/kv/namespaces`, await c.req.json()));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/kv/namespaces/:id', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.delete(`/accounts/${aid}/storage/kv/namespaces/${c.req.param().id}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/kv/namespaces/:id/keys', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const prefix = c.req.query('prefix') ? `&prefix=${c.req.query('prefix')}` : '';
    return c.json(await client.get(`/accounts/${aid}/storage/kv/namespaces/${c.req.param().id}/keys?limit=100${prefix}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/kv/namespaces/:id/values/:key', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { id, key } = c.req.param();
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/storage/kv/namespaces/${id}/values/${encodeURIComponent(key)}`, { headers: (client as any).headers() });
    return c.json({ success: true, result: { key, value: await resp.text() } });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.put('/api/kv/namespaces/:id/values', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { key, value, expiration } = await c.req.json();
    const params = expiration ? `?expiration=${expiration}` : '';
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/storage/kv/namespaces/${c.req.param().id}/values/${encodeURIComponent(key)}${params}`, { method: 'PUT', headers: { ...(client as any).headers(), 'Content-Type': 'text/plain' }, body: value });
    return c.json(await resp.json());
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/kv/namespaces/:id/keys/:key', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { id, key } = c.req.param();
    return c.json(await client.delete(`/accounts/${aid}/storage/kv/namespaces/${id}/values/${encodeURIComponent(key)}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== D1 ====================
app.get('/api/d1/databases', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.get(`/accounts/${aid}/d1/database?per_page=100`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/api/d1/databases', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.post(`/accounts/${aid}/d1/database`, await c.req.json()));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/d1/databases/:id', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.delete(`/accounts/${aid}/d1/database/${c.req.param().id}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/api/d1/databases/:id/query', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    const { sql, params } = await c.req.json();
    return c.json(await client.post(`/accounts/${aid}/d1/database/${c.req.param().id}/query`, { sql, params: params || [] }));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.get('/api/d1/databases/:id/tables', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.post(`/accounts/${aid}/d1/database/${c.req.param().id}/query`, { sql: "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') ORDER BY name" }));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== Databases (Hyperdrive) ====================
app.get('/api/databases/hyperdrive', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.get(`/accounts/${aid}/hyperdrive/configs`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/api/databases/hyperdrive', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.post(`/accounts/${aid}/hyperdrive/configs`, await c.req.json()));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/api/databases/hyperdrive/:id', async (c) => {
  try {
    const client = getClient(c);
    const aid = c.req.query('account_id')!;
    return c.json(await client.delete(`/accounts/${aid}/hyperdrive/configs/${c.req.param().id}`));
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== Analytics ====================
app.get('/api/analytics/zones/:zoneId/analytics', async (c) => {
  try {
    const client = getClient(c);
    const { zoneId } = c.req.param();
    const since = parseInt(c.req.query('since') || '-1440');
    const now = new Date();
    const dateStart = new Date(now.getTime() + since * 60000).toISOString();
    const dateEnd = now.toISOString();
    const dayStart = dateStart.split('T')[0];
    const dayEnd = dateEnd.split('T')[0];

    const absSince = Math.abs(since);
    const dsList = absSince <= 1440 ? ['httpRequests1mGroups', 'httpRequests1hGroups']
      : absSince <= 10080 ? ['httpRequests1hGroups', 'httpRequests1dGroups']
      : ['httpRequests1dGroups'];

    async function fetchTs(ds: string): Promise<any[]> {
      const isDaily = ds === 'httpRequests1dGroups';
      const vt = isDaily ? '$z:String!,$s:Date!,$e:Date!' : '$z:String!,$s:DateTime!,$e:DateTime!';
      const filt = isDaily ? 'date_geq:$s,date_leq:$e' : 'datetime_geq:$s,datetime_leq:$e';
      const dim = isDaily ? 'date' : 'datetime';
      const vars = isDaily ? { z: zoneId, s: dayStart, e: dayEnd } : { z: zoneId, s: dateStart, e: dateEnd };
      const q = `query(${vt}){viewer{zones(filter:{zoneTag:$z}){${ds}(limit:1000,orderBy:[${dim}_ASC],filter:{${filt}}){sum{requests cachedRequests bytes cachedBytes threats pageViews}dimensions{${dim}}}}}}`;
      const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: (client as any).headers(), body: JSON.stringify({ query: q, variables: vars }) });
      const r: any = await resp.json();
      return r?.data?.viewer?.zones?.[0]?.[ds] || [];
    }

    let tsRows = await fetchTs(dsList[0]);
    if (!tsRows.length && dsList[1]) tsRows = await fetchTs(dsList[1]);
    if (!tsRows.length && dsList[0] !== 'httpRequests1dGroups') tsRows = await fetchTs('httpRequests1dGroups');

    const totalsQ = `query($z:String!,$s:Date!,$e:Date!){viewer{zones(filter:{zoneTag:$z}){
      httpRequests1dGroups(limit:100,filter:{date_geq:$s,date_leq:$e}){
        sum{requests cachedRequests bytes cachedBytes threats pageViews
          countryMap{clientCountryName requests threats}
          responseStatusMap{edgeResponseStatus requests}}
        uniq{uniques}
        dimensions{date}
      }}}}`;

    const tResp = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: (client as any).headers(), body: JSON.stringify({ query: totalsQ, variables: { z: zoneId, s: dayStart, e: dayEnd } }) });
    const tResult: any = await tResp.json();
    const daily = tResult?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];

    let sum = { requests: 0, cachedRequests: 0, bytes: 0, cachedBytes: 0, threats: 0, pageViews: 0, uniques: 0 };
    let countries: Record<string, { name: string; requests: number; threats: number }> = {};
    let statuses: Record<string, number> = {};

    for (const d of daily) {
      const s = d.sum || {};
      sum.requests += s.requests || 0; sum.cachedRequests += s.cachedRequests || 0;
      sum.bytes += s.bytes || 0; sum.cachedBytes += s.cachedBytes || 0;
      sum.threats += s.threats || 0; sum.pageViews += s.pageViews || 0;
      sum.uniques += d.uniq?.uniques || 0;
      for (const cc of (s.countryMap || [])) {
        const k = cc.clientCountryName || 'Unknown';
        if (!countries[k]) countries[k] = { name: k, requests: 0, threats: 0 };
        countries[k].requests += cc.requests || 0; countries[k].threats += cc.threats || 0;
      }
      for (const st of (s.responseStatusMap || [])) {
        const code = String(st.edgeResponseStatus || '');
        statuses[code] = (statuses[code] || 0) + (st.requests || 0);
      }
    }

    const sg = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
    for (const [code, cnt] of Object.entries(statuses)) {
      const n = parseInt(code);
      if (n >= 200 && n < 300) sg['2xx'] += cnt;
      else if (n >= 300 && n < 400) sg['3xx'] += cnt;
      else if (n >= 400 && n < 500) sg['4xx'] += cnt;
      else if (n >= 500 && n < 600) sg['5xx'] += cnt;
      else sg.other += cnt;
    }

    return c.json({
      success: true,
      result: {
        timeseries: tsRows.map((t: any) => ({ ts: t.dimensions?.date || t.dimensions?.datetime, requests: t.sum?.requests || 0, cached: t.sum?.cachedRequests || 0, bytes: t.sum?.bytes || 0, cachedBytes: t.sum?.cachedBytes || 0, threats: t.sum?.threats || 0, pageViews: t.sum?.pageViews || 0 })),
        totals: sum,
        countries: Object.values(countries).sort((a, b) => b.requests - a.requests),
        statusGroups: sg,
      },
    });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== Frontend ====================
app.get('/', (c) => c.html(html));

export default app;
