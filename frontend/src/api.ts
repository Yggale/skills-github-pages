// AutoTrade Pro - thin REST client around the FastAPI backend.

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE) {
  // eslint-disable-next-line no-console
  console.warn("EXPO_PUBLIC_BACKEND_URL is not defined.");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export type Instrument = {
  symbol: string;
  name: string;
  category: string;
  digits: number;
  bid: number;
  ask: number;
  last: number;
  prev: number;
  day_high: number;
  day_low: number;
  change: number;
  change_pct: number;
};

export type Candle = { t: string; o: number; h: number; l: number; c: number };

export type Indicators = {
  rsi: (number | null)[];
  bb_upper: (number | null)[];
  bb_middle: (number | null)[];
  bb_lower: (number | null)[];
  ma_fast: (number | null)[];
  ma_slow: (number | null)[];
  ema_fast: (number | null)[];
  ema_slow: (number | null)[];
};

export type Account = {
  id: string;
  mode: "simulation" | "live";
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  currency: string;
  leverage: number;
  daily_target: number;
  max_daily_loss: number;
};

export type Position = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  open_price: number;
  current_price: number;
  close_price?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  pnl: number;
  pips: number;
  opened_at: string;
  closed_at?: string;
  status: "open" | "closed";
  comment?: string;
  opened_by: "manual" | "auto";
};

export type Strategy = {
  id: string;
  name: string;
  enabled: boolean;
  symbols: string[];
  use_rsi: boolean;
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  use_bb: boolean;
  bb_period: number;
  bb_mult: number;
  use_ma: boolean;
  ma_fast: number;
  ma_slow: number;
  use_ema: boolean;
  ema_fast: number;
  ema_slow: number;
  volume: number;
  stop_loss_pips: number;
  take_profit_pips: number;
  max_open_positions: number;
  confirm_signals: number;
};

export type DailyStats = {
  date: string;
  realized_pnl: number;
  floating_pnl: number;
  total_pnl: number;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  open_positions: number;
  daily_target: number;
  max_daily_loss: number;
  target_progress: number;
  target_reached: boolean;
  loss_limit_hit: boolean;
};

export const api = {
  instruments: () => request<Instrument[]>("/instruments"),
  instrument: (symbol: string) => request<Instrument>(`/instruments/${symbol}`),
  candles: (symbol: string, params?: Partial<Record<string, number>>) => {
    const q = params
      ? "?" + Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&")
      : "";
    return request<{ symbol: string; candles: Candle[]; indicators: Indicators }>(
      `/candles/${symbol}${q}`,
    );
  },
  account: () => request<Account>("/account"),
  resetAccount: () => request<Account>("/account/reset", { method: "POST" }),
  setMode: (mode: "simulation" | "live") =>
    request<Account>("/account/mode", { method: "POST", body: JSON.stringify({ mode }) }),
  updateAccountSettings: (data: Partial<Account>) =>
    request<Account>("/account/settings", { method: "PATCH", body: JSON.stringify(data) }),
  dailyStats: () => request<DailyStats>("/stats/daily"),
  positions: (status: "open" | "closed" = "open") =>
    request<Position[]>(`/positions?status=${status}`),
  history: (limit = 100) => request<Position[]>(`/history?limit=${limit}`),
  createOrder: (data: {
    symbol: string;
    side: "buy" | "sell";
    volume: number;
    stop_loss?: number | null;
    take_profit?: number | null;
    comment?: string;
  }) => request<Position>("/orders", { method: "POST", body: JSON.stringify(data) }),
  closePosition: (id: string) =>
    request<Position>(`/positions/${id}/close`, { method: "POST" }),
  strategies: () => request<Strategy[]>("/strategies"),
  saveStrategy: (s: Strategy) =>
    request<Strategy>("/strategies", { method: "POST", body: JSON.stringify(s) }),
  toggleStrategy: (id: string) =>
    request<Strategy>(`/strategies/${id}/toggle`, { method: "POST" }),
  deleteStrategy: (id: string) =>
    request<{ deleted: string }>(`/strategies/${id}`, { method: "DELETE" }),
};
