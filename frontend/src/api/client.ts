import { ApiResponse, ImportPreviewResult, LoginResponse, PrintHistoryItem, PrintStats, Product, PurchaseOrder } from '../types';

const BASE = '/api';

// ── Token store（模組層級，避免修改所有現有呼叫點）──────────
let _authToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

export function setUnauthorizedHandler(fn: () => void): void {
  _onUnauthorized = fn;
}

function handleUnauthorized(): void {
  _authToken = null;
  _onUnauthorized?.();
}

async function parseJSON<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text();
  if (!text) return { success: false, error: `HTTP ${res.status} - 空回應` };
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { success: false, error: `HTTP ${res.status} - 非 JSON 回應：${text.slice(0, 100)}` };
  }
}

async function get<T>(path: string): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  if (res.status === 401) {
    handleUnauthorized();
    return { success: false, error: 'Session 已過期，請重新登入' };
  }
  return parseJSON<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  // 公開 auth 路由不觸發自動登出
  if (res.status === 401 && !path.startsWith('/auth/')) {
    handleUnauthorized();
    return { success: false, error: 'Session 已過期，請重新登入' };
  }
  return parseJSON<T>(res);
}

export const api = {
  getProduct: (code: string) => get<Product>(`/products/${encodeURIComponent(code)}`),

  getPurchaseOrder: (poNo: string) => get<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(poNo)}`),

  createPrintJob: (payload: {
    source_module: 'WMSM020' | 'WMSM030';
    po_no?: string;
    import_batch?: string;
    operator: string;
    printer_name?: string;
    items: unknown[];
  }) => post<{ job_no: string; total_copies: number }>('/print-jobs', payload),

  getPrintHistory: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    return get<{ items: PrintHistoryItem[]; total: number }>(`/print-history?${qs}`);
  },

  getPrintStats: () => get<PrintStats>('/print-stats'),

  getOperators: () => get<string[]>('/operators'),

  previewImport: async (file: File): Promise<ApiResponse<ImportPreviewResult>> => {
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
    const res = await fetch(`${BASE}/import/preview`, { method: 'POST', headers, body: form });
    if (res.status === 401) {
      handleUnauthorized();
      return { success: false, error: 'Session 已過期，請重新登入' };
    }
    return parseJSON<ImportPreviewResult>(res);
  },

  executeImport: (batch_no: string, operator: string) =>
    post<{ job_no: string; total_copies: number }>('/import/execute', { batch_no, operator }),

  saveUATConfirmation: (payload: {
    confirmer_name: string;
    department: string;
    confirm_date: string;
    result: string;
    check_items: Record<string, boolean>;
    remarks: string;
  }) => post('/uat/confirm', payload),

  // ── Auth ────────────────────────────────────────────────
  login: (username: string, password: string) =>
    post<LoginResponse>('/auth/login', { username, password }),

  register: (username: string, password: string, displayName?: string) =>
    post<{ id: number; username: string; display_name: string; role: string }>('/auth/register', { username, password, displayName }),

  forgotPassword: (username: string) =>
    post('/auth/forgot-password', { username }),
};
