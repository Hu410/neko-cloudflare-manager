const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface CfApiResponse<T = any> {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    count: number;
    total_count: number;
  };
}

export class CfClient {
  private apiKey: string;
  private apiEmail: string;

  constructor(apiKey: string, apiEmail: string) {
    this.apiKey = apiKey;
    this.apiEmail = apiEmail;
  }

  headers(): Record<string, string> {
    return {
      'X-Auth-Key': this.apiKey,
      'X-Auth-Email': this.apiEmail,
      'Content-Type': 'application/json',
    };
  }

  async request<T = any>(path: string, init: RequestInit = {}): Promise<CfApiResponse<T>> {
    const url = `${CF_API_BASE}${path}`;
    const h: Record<string, string> = { ...this.headers(), ...(init.headers as Record<string, string> || {}) };

    if (init.body instanceof FormData) {
      delete h['Content-Type'];
    }

    const resp = await fetch(url, { ...init, headers: h });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`CF API (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as CfApiResponse<T>;
    if (!data.success) {
      const msg = data.errors?.map(e => e.message).join('; ') || 'Unknown error';
      throw new Error(`CF API: ${msg}`);
    }
    return data;
  }

  get<T = any>(path: string) { return this.request<T>(path, { method: 'GET' }); }
  post<T = any>(path: string, body?: any) { return this.request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }); }
  put<T = any>(path: string, body?: any) { return this.request<T>(path, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }); }
  delete<T = any>(path: string, body?: any) { return this.request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }); }
}
