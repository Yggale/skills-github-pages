# AutoTrade Pro - PRD

## Vision
A MT5-style automatic trading mobile application that integrates RSI, Bollinger Bands, Moving Averages (SMA) and Exponential Moving Averages (EMA) for day-trading. Built with Expo (React Native) + FastAPI + MongoDB. Currently runs on simulated market data; designed to swap in MetaTrader 5 connectivity later.

## Core Features Implemented

### Market Catalog
- 60+ instruments across **Forex Majors / Minors / Exotics**, **Indices**, **Commodities**, **Crypto**, and **Stocks**.
- Each instrument simulates realistic OHLC candles with random walk + mean reversion, bid/ask spreads, day high/low.

### Technical Indicators (all configurable)
- **RSI** (period 14 default, oversold 30 / overbought 70).
- **Bollinger Bands** (period 20, ±2σ).
- **Simple Moving Averages** - MA fast 20 / MA slow 50.
- **Exponential Moving Averages** - **EMA 9** (reactivity) / **EMA 20** (short-term trend) per user spec.

### Automated Trading Engine
- Background loop ticks every 2s: updates prices, refreshes P&L, hits SL/TP, evaluates active strategies.
- Strategies vote across enabled indicators; opens a position when N indicators confirm the same direction.
- Auto positions tagged with `opened_by: auto` and limited to `max_open_positions`.

### Manual Trading
- Buy/Sell at bid/ask with volume input, configurable SL/TP in pips, position close button.
- Real-time P&L and pips on every open position.

### Day-Trading Dashboard
- Live equity, balance, margin, free margin.
- **Daily target tracker** (default €500) with progress bar + 🎯 alert when reached.
- **Max daily loss** guard (default €300) with ⚠️ alert when hit.
- Win-rate, trades-today, floating P&L, open-position count.
- Mini candlestick chart + indicator overlays + RSI sub-chart for the selected symbol.

### Strategy Configuration UI
- List of strategies with toggle, per-indicator tags, risk summary.
- Editor with on/off toggles for RSI, BB, MA, EMA; period inputs; SL/TP/volume/max-positions/confirm-signals tuning.
- Multi-symbol selection grid.

### Account & History
- Simulation/Live mode toggle (Live disabled until MT5 integration).
- Edit daily target & max daily loss.
- Closed-trade history with side, prices, pips, P&L.
- Reset account to €10 000 starting balance.

## API Surface (`/api`)
- `GET /instruments`, `GET /instruments/{symbol}`, `GET /candles/{symbol}`
- `GET/POST /account`, `POST /account/reset`, `POST /account/mode`, `PATCH /account/settings`
- `GET /stats/daily`
- `GET /positions`, `POST /orders`, `POST /positions/{id}/close`, `GET /history`
- `GET/POST /strategies`, `POST /strategies/{id}/toggle`, `DELETE /strategies/{id}`

## Architecture
- **Frontend**: Expo Router with tab navigation: Dashboard · Markets · Trade · Auto (Strategies) · Account (Settings & History). Pure-View candlestick & RSI charts (no native deps).
- **Backend**: FastAPI + Motor; market state cached in-memory; positions/strategies/accounts persisted in MongoDB.
- **Storage**: existing `@/src/utils/storage` wrapper available; not required (no auth yet).

## Roadmap
- Real MT5 broker connectivity (MetaApi or REST bridge).
- Notifications (push) when daily target reached or auto-trade fires.
- Multi-timeframe selection (1m/5m/15m/1h).
- Strategy backtester over historical candles.

## Current Status
- ✅ MVP complete on simulated data.
- ✅ Indicators (RSI, BB, MA, EMA 9/20) wired into chart + auto-trader.
- ✅ Daily target €500 + max loss €300 enforced in dashboard with alerts.
- 🟡 Live mode blocked (broker integration pending) — UI prompts user accordingly.
