"""
AutoTrade Pro - MT5-style trading platform backend.

Provides simulated market data, technical indicators (RSI, Bollinger Bands,
Moving Averages), order management, and an auto-trading strategy engine.
"""
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
import random
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="AutoTrade Pro API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# =========================================================================
# MARKET CATALOG - Simulated assets across categories
# =========================================================================
INSTRUMENTS: Dict[str, dict] = {
    # ==== FOREX MAJORS ====
    "EURUSD": {"name": "Euro / US Dollar", "category": "Forex Majors", "base_price": 1.0850, "volatility": 0.0008, "digits": 5, "pip_value": 10},
    "GBPUSD": {"name": "British Pound / US Dollar", "category": "Forex Majors", "base_price": 1.2650, "volatility": 0.0010, "digits": 5, "pip_value": 10},
    "USDJPY": {"name": "US Dollar / Japanese Yen", "category": "Forex Majors", "base_price": 149.50, "volatility": 0.15, "digits": 3, "pip_value": 9.10},
    "AUDUSD": {"name": "Australian Dollar / US Dollar", "category": "Forex Majors", "base_price": 0.6580, "volatility": 0.0007, "digits": 5, "pip_value": 10},
    "USDCAD": {"name": "US Dollar / Canadian Dollar", "category": "Forex Majors", "base_price": 1.3580, "volatility": 0.0008, "digits": 5, "pip_value": 7.36},
    "USDCHF": {"name": "US Dollar / Swiss Franc", "category": "Forex Majors", "base_price": 0.8820, "volatility": 0.0008, "digits": 5, "pip_value": 11.34},
    "NZDUSD": {"name": "New Zealand Dollar / US Dollar", "category": "Forex Majors", "base_price": 0.6120, "volatility": 0.0007, "digits": 5, "pip_value": 10},
    # ==== FOREX MINORS / CROSSES ====
    "EURGBP": {"name": "Euro / British Pound", "category": "Forex Minors", "base_price": 0.8580, "volatility": 0.0006, "digits": 5, "pip_value": 12.65},
    "EURJPY": {"name": "Euro / Japanese Yen", "category": "Forex Minors", "base_price": 162.20, "volatility": 0.18, "digits": 3, "pip_value": 9.10},
    "EURCHF": {"name": "Euro / Swiss Franc", "category": "Forex Minors", "base_price": 0.9570, "volatility": 0.0007, "digits": 5, "pip_value": 11.34},
    "EURAUD": {"name": "Euro / Australian Dollar", "category": "Forex Minors", "base_price": 1.6485, "volatility": 0.0011, "digits": 5, "pip_value": 6.58},
    "EURCAD": {"name": "Euro / Canadian Dollar", "category": "Forex Minors", "base_price": 1.4730, "volatility": 0.0010, "digits": 5, "pip_value": 7.36},
    "EURNZD": {"name": "Euro / New Zealand Dollar", "category": "Forex Minors", "base_price": 1.7720, "volatility": 0.0012, "digits": 5, "pip_value": 6.12},
    "GBPJPY": {"name": "British Pound / Japanese Yen", "category": "Forex Minors", "base_price": 189.10, "volatility": 0.22, "digits": 3, "pip_value": 9.10},
    "GBPCHF": {"name": "British Pound / Swiss Franc", "category": "Forex Minors", "base_price": 1.1158, "volatility": 0.0010, "digits": 5, "pip_value": 11.34},
    "GBPAUD": {"name": "British Pound / Australian Dollar", "category": "Forex Minors", "base_price": 1.9220, "volatility": 0.0014, "digits": 5, "pip_value": 6.58},
    "GBPCAD": {"name": "British Pound / Canadian Dollar", "category": "Forex Minors", "base_price": 1.7185, "volatility": 0.0012, "digits": 5, "pip_value": 7.36},
    "GBPNZD": {"name": "British Pound / New Zealand Dollar", "category": "Forex Minors", "base_price": 2.0665, "volatility": 0.0015, "digits": 5, "pip_value": 6.12},
    "AUDJPY": {"name": "Australian Dollar / Japanese Yen", "category": "Forex Minors", "base_price": 98.40, "volatility": 0.14, "digits": 3, "pip_value": 9.10},
    "AUDCHF": {"name": "Australian Dollar / Swiss Franc", "category": "Forex Minors", "base_price": 0.5805, "volatility": 0.0006, "digits": 5, "pip_value": 11.34},
    "AUDCAD": {"name": "Australian Dollar / Canadian Dollar", "category": "Forex Minors", "base_price": 0.8935, "volatility": 0.0007, "digits": 5, "pip_value": 7.36},
    "AUDNZD": {"name": "Australian Dollar / New Zealand Dollar", "category": "Forex Minors", "base_price": 1.0750, "volatility": 0.0008, "digits": 5, "pip_value": 6.12},
    "CADJPY": {"name": "Canadian Dollar / Japanese Yen", "category": "Forex Minors", "base_price": 110.05, "volatility": 0.14, "digits": 3, "pip_value": 9.10},
    "CADCHF": {"name": "Canadian Dollar / Swiss Franc", "category": "Forex Minors", "base_price": 0.6495, "volatility": 0.0006, "digits": 5, "pip_value": 11.34},
    "CHFJPY": {"name": "Swiss Franc / Japanese Yen", "category": "Forex Minors", "base_price": 169.50, "volatility": 0.20, "digits": 3, "pip_value": 9.10},
    "NZDJPY": {"name": "New Zealand Dollar / Japanese Yen", "category": "Forex Minors", "base_price": 91.50, "volatility": 0.13, "digits": 3, "pip_value": 9.10},
    "NZDCHF": {"name": "New Zealand Dollar / Swiss Franc", "category": "Forex Minors", "base_price": 0.5395, "volatility": 0.0006, "digits": 5, "pip_value": 11.34},
    "NZDCAD": {"name": "New Zealand Dollar / Canadian Dollar", "category": "Forex Minors", "base_price": 0.8312, "volatility": 0.0007, "digits": 5, "pip_value": 7.36},
    # ==== FOREX EXOTICS ====
    "USDTRY": {"name": "US Dollar / Turkish Lira", "category": "Forex Exotics", "base_price": 31.20, "volatility": 0.08, "digits": 4, "pip_value": 3.20},
    "USDZAR": {"name": "US Dollar / South African Rand", "category": "Forex Exotics", "base_price": 18.85, "volatility": 0.05, "digits": 4, "pip_value": 5.30},
    "USDMXN": {"name": "US Dollar / Mexican Peso", "category": "Forex Exotics", "base_price": 17.10, "volatility": 0.04, "digits": 4, "pip_value": 5.85},
    "USDSGD": {"name": "US Dollar / Singapore Dollar", "category": "Forex Exotics", "base_price": 1.3450, "volatility": 0.0006, "digits": 5, "pip_value": 7.44},
    "USDHKD": {"name": "US Dollar / Hong Kong Dollar", "category": "Forex Exotics", "base_price": 7.8210, "volatility": 0.0010, "digits": 5, "pip_value": 1.28},
    "USDNOK": {"name": "US Dollar / Norwegian Krone", "category": "Forex Exotics", "base_price": 10.45, "volatility": 0.025, "digits": 4, "pip_value": 9.57},
    "USDSEK": {"name": "US Dollar / Swedish Krona", "category": "Forex Exotics", "base_price": 10.32, "volatility": 0.025, "digits": 4, "pip_value": 9.69},
    "USDPLN": {"name": "US Dollar / Polish Zloty", "category": "Forex Exotics", "base_price": 3.95, "volatility": 0.012, "digits": 4, "pip_value": 25.30},
    "USDCNH": {"name": "US Dollar / Chinese Yuan (Offshore)", "category": "Forex Exotics", "base_price": 7.2050, "volatility": 0.008, "digits": 5, "pip_value": 1.39},
    "EURTRY": {"name": "Euro / Turkish Lira", "category": "Forex Exotics", "base_price": 33.85, "volatility": 0.09, "digits": 4, "pip_value": 3.20},
    "EURPLN": {"name": "Euro / Polish Zloty", "category": "Forex Exotics", "base_price": 4.32, "volatility": 0.014, "digits": 4, "pip_value": 25.30},
    "EURSEK": {"name": "Euro / Swedish Krona", "category": "Forex Exotics", "base_price": 11.20, "volatility": 0.028, "digits": 4, "pip_value": 9.69},
    "EURNOK": {"name": "Euro / Norwegian Krone", "category": "Forex Exotics", "base_price": 11.34, "volatility": 0.027, "digits": 4, "pip_value": 9.57},
    "GBPSGD": {"name": "British Pound / Singapore Dollar", "category": "Forex Exotics", "base_price": 1.7012, "volatility": 0.0013, "digits": 5, "pip_value": 7.44},
    "GBPZAR": {"name": "British Pound / South African Rand", "category": "Forex Exotics", "base_price": 23.85, "volatility": 0.07, "digits": 4, "pip_value": 5.30},
    # ==== INDICES ====
    "US30": {"name": "Dow Jones 30", "category": "Indices", "base_price": 38500.0, "volatility": 80.0, "digits": 2, "pip_value": 1.0},
    "SPX500": {"name": "S&P 500", "category": "Indices", "base_price": 5050.0, "volatility": 12.0, "digits": 2, "pip_value": 1.0},
    "NAS100": {"name": "Nasdaq 100", "category": "Indices", "base_price": 17800.0, "volatility": 60.0, "digits": 2, "pip_value": 1.0},
    "GER40": {"name": "DAX 40", "category": "Indices", "base_price": 17200.0, "volatility": 55.0, "digits": 2, "pip_value": 1.0},
    "UK100": {"name": "FTSE 100", "category": "Indices", "base_price": 7650.0, "volatility": 25.0, "digits": 2, "pip_value": 1.0},
    "FRA40": {"name": "CAC 40", "category": "Indices", "base_price": 7780.0, "volatility": 28.0, "digits": 2, "pip_value": 1.0},
    "JPN225": {"name": "Nikkei 225", "category": "Indices", "base_price": 38400.0, "volatility": 120.0, "digits": 2, "pip_value": 1.0},
    # ==== COMMODITIES ====
    "XAUUSD": {"name": "Gold / US Dollar", "category": "Commodities", "base_price": 2050.0, "volatility": 8.0, "digits": 2, "pip_value": 10.0},
    "XAGUSD": {"name": "Silver / US Dollar", "category": "Commodities", "base_price": 23.50, "volatility": 0.30, "digits": 3, "pip_value": 50.0},
    "USOIL": {"name": "Crude Oil WTI", "category": "Commodities", "base_price": 78.50, "volatility": 0.80, "digits": 2, "pip_value": 10.0},
    "UKOIL": {"name": "Brent Crude Oil", "category": "Commodities", "base_price": 82.30, "volatility": 0.85, "digits": 2, "pip_value": 10.0},
    "NATGAS": {"name": "Natural Gas", "category": "Commodities", "base_price": 2.10, "volatility": 0.06, "digits": 3, "pip_value": 10.0},
    # ==== CRYPTO ====
    "BTCUSD": {"name": "Bitcoin / US Dollar", "category": "Crypto", "base_price": 52000.0, "volatility": 400.0, "digits": 2, "pip_value": 1.0},
    "ETHUSD": {"name": "Ethereum / US Dollar", "category": "Crypto", "base_price": 2850.0, "volatility": 35.0, "digits": 2, "pip_value": 1.0},
    "XRPUSD": {"name": "Ripple / US Dollar", "category": "Crypto", "base_price": 0.5320, "volatility": 0.015, "digits": 4, "pip_value": 1.0},
    "SOLUSD": {"name": "Solana / US Dollar", "category": "Crypto", "base_price": 105.0, "volatility": 3.5, "digits": 2, "pip_value": 1.0},
    # ==== STOCKS (CFD) ====
    "AAPL": {"name": "Apple Inc.", "category": "Stocks", "base_price": 188.50, "volatility": 1.20, "digits": 2, "pip_value": 1.0},
    "TSLA": {"name": "Tesla Inc.", "category": "Stocks", "base_price": 245.00, "volatility": 4.50, "digits": 2, "pip_value": 1.0},
    "MSFT": {"name": "Microsoft Corp.", "category": "Stocks", "base_price": 410.00, "volatility": 2.20, "digits": 2, "pip_value": 1.0},
    "GOOGL": {"name": "Alphabet Inc.", "category": "Stocks", "base_price": 148.50, "volatility": 1.50, "digits": 2, "pip_value": 1.0},
    "AMZN": {"name": "Amazon.com Inc.", "category": "Stocks", "base_price": 175.20, "volatility": 1.80, "digits": 2, "pip_value": 1.0},
    "NVDA": {"name": "NVIDIA Corp.", "category": "Stocks", "base_price": 720.00, "volatility": 8.50, "digits": 2, "pip_value": 1.0},
    "META": {"name": "Meta Platforms", "category": "Stocks", "base_price": 485.00, "volatility": 4.20, "digits": 2, "pip_value": 1.0},
}


# =========================================================================
# IN-MEMORY MARKET STATE
# =========================================================================
# Holds last 200 simulated candles per instrument and the current live price.
MARKET_CACHE: Dict[str, dict] = {}


def _seed_candles(symbol: str, count: int = 200) -> List[dict]:
    """Generate `count` historical OHLC candles for `symbol`."""
    spec = INSTRUMENTS[symbol]
    price = spec["base_price"]
    vol = spec["volatility"]
    now = datetime.now(timezone.utc)
    candles: List[dict] = []
    # 1-minute candles going backward, walk forward to build history
    for i in range(count):
        ts = now - timedelta(minutes=(count - i))
        open_p = price
        # Random walk with slight mean reversion toward base price
        drift = (spec["base_price"] - price) * 0.0015
        change = random.gauss(0, vol) + drift
        close_p = max(open_p + change, spec["base_price"] * 0.5)
        high_p = max(open_p, close_p) + abs(random.gauss(0, vol * 0.3))
        low_p = min(open_p, close_p) - abs(random.gauss(0, vol * 0.3))
        candles.append({
            "t": ts.isoformat(),
            "o": round(open_p, spec["digits"]),
            "h": round(high_p, spec["digits"]),
            "l": round(low_p, spec["digits"]),
            "c": round(close_p, spec["digits"]),
        })
        price = close_p
    return candles


def _ensure_market(symbol: str) -> dict:
    if symbol not in MARKET_CACHE:
        candles = _seed_candles(symbol)
        last = candles[-1]["c"]
        spec = INSTRUMENTS[symbol]
        spread = spec["volatility"] * 0.15
        MARKET_CACHE[symbol] = {
            "candles": candles,
            "last": last,
            "prev": last,
            "bid": round(last - spread / 2, spec["digits"]),
            "ask": round(last + spread / 2, spec["digits"]),
            "day_open": candles[0]["c"],
            "day_high": max(c["h"] for c in candles),
            "day_low": min(c["l"] for c in candles),
        }
    return MARKET_CACHE[symbol]


def _tick(symbol: str) -> dict:
    """Advance the simulated price one tick and append a new candle."""
    state = _ensure_market(symbol)
    spec = INSTRUMENTS[symbol]
    last = state["last"]
    drift = (spec["base_price"] - last) * 0.0015
    change = random.gauss(0, spec["volatility"] * 0.5) + drift
    new_price = max(last + change, spec["base_price"] * 0.5)
    new_price = round(new_price, spec["digits"])

    # Add a new candle (rolling window)
    last_candle = state["candles"][-1]
    spread = spec["volatility"] * 0.15
    new_candle = {
        "t": datetime.now(timezone.utc).isoformat(),
        "o": last_candle["c"],
        "h": round(max(last_candle["c"], new_price) + abs(random.gauss(0, spec["volatility"] * 0.2)), spec["digits"]),
        "l": round(min(last_candle["c"], new_price) - abs(random.gauss(0, spec["volatility"] * 0.2)), spec["digits"]),
        "c": new_price,
    }
    state["candles"].append(new_candle)
    if len(state["candles"]) > 200:
        state["candles"] = state["candles"][-200:]
    state["prev"] = last
    state["last"] = new_price
    state["bid"] = round(new_price - spread / 2, spec["digits"])
    state["ask"] = round(new_price + spread / 2, spec["digits"])
    state["day_high"] = max(state["day_high"], new_price)
    state["day_low"] = min(state["day_low"], new_price)
    return state


# =========================================================================
# TECHNICAL INDICATORS
# =========================================================================
def calc_sma(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return out
    s = sum(values[:period])
    out[period - 1] = s / period
    for i in range(period, len(values)):
        s += values[i] - values[i - period]
        out[i] = s / period
    return out


def calc_ema(values: List[float], period: int) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return out
    k = 2 / (period + 1)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    for i in range(period, len(values)):
        cur = values[i] * k + prev * (1 - k)
        out[i] = cur
        prev = cur
    return out


def calc_rsi(values: List[float], period: int = 14) -> List[Optional[float]]:
    out: List[Optional[float]] = [None] * len(values)
    if len(values) <= period:
        return out
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        diff = values[i] - values[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    rs = avg_gain / avg_loss if avg_loss > 0 else 100.0
    out[period] = 100 - (100 / (1 + rs)) if avg_loss > 0 else 100.0
    for i in range(period + 1, len(values)):
        diff = values[i] - values[i - 1]
        gain = max(diff, 0)
        loss = max(-diff, 0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        if avg_loss == 0:
            out[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            out[i] = 100 - (100 / (1 + rs))
    return out


def calc_bollinger(values: List[float], period: int = 20, mult: float = 2.0):
    sma = calc_sma(values, period)
    upper: List[Optional[float]] = [None] * len(values)
    lower: List[Optional[float]] = [None] * len(values)
    for i in range(period - 1, len(values)):
        window = values[i - period + 1:i + 1]
        mean = sma[i] or 0
        variance = sum((v - mean) ** 2 for v in window) / period
        sd = math.sqrt(variance)
        upper[i] = mean + mult * sd
        lower[i] = mean - mult * sd
    return {"middle": sma, "upper": upper, "lower": lower}


def compute_indicators(candles: List[dict], cfg: dict) -> dict:
    closes = [c["c"] for c in candles]
    rsi = calc_rsi(closes, cfg.get("rsi_period", 14))
    bb = calc_bollinger(closes, cfg.get("bb_period", 20), cfg.get("bb_mult", 2.0))
    ma_fast = calc_sma(closes, cfg.get("ma_fast", 50))
    ma_slow = calc_sma(closes, cfg.get("ma_slow", 200))
    return {
        "rsi": rsi,
        "bb_upper": bb["upper"],
        "bb_middle": bb["middle"],
        "bb_lower": bb["lower"],
        "ma_fast": ma_fast,
        "ma_slow": ma_slow,
    }


# =========================================================================
# MODELS
# =========================================================================
class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mode: Literal["simulation", "live"] = "simulation"
    balance: float = 10000.0
    equity: float = 10000.0
    margin: float = 0.0
    free_margin: float = 10000.0
    currency: str = "EUR"
    leverage: int = 100
    daily_target: float = 500.0
    max_daily_loss: float = 300.0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AccountSettings(BaseModel):
    mode: Optional[Literal["simulation", "live"]] = None
    daily_target: Optional[float] = None
    max_daily_loss: Optional[float] = None
    leverage: Optional[int] = None


class OrderCreate(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    volume: float = Field(gt=0)
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    comment: Optional[str] = None


class Position(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    symbol: str
    side: Literal["buy", "sell"]
    volume: float
    open_price: float
    current_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    pnl: float = 0.0
    pips: float = 0.0
    opened_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    closed_at: Optional[str] = None
    close_price: Optional[float] = None
    status: Literal["open", "closed"] = "open"
    comment: Optional[str] = None
    opened_by: Literal["manual", "auto"] = "manual"


class Strategy(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Default Strategy"
    enabled: bool = False
    symbols: List[str] = Field(default_factory=lambda: ["EURUSD"])
    # Indicators
    use_rsi: bool = True
    rsi_period: int = 14
    rsi_oversold: float = 30.0
    rsi_overbought: float = 70.0
    use_bb: bool = True
    bb_period: int = 20
    bb_mult: float = 2.0
    use_ma: bool = True
    ma_fast: int = 50
    ma_slow: int = 200
    use_ema: bool = True
    ema_fast: int = 9
    ema_slow: int = 20
    # Risk
    volume: float = 0.10
    stop_loss_pips: float = 30.0
    take_profit_pips: float = 60.0
    max_open_positions: int = 3
    # Logic
    confirm_signals: int = 2  # number of indicators required to agree
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# =========================================================================
# HELPERS - Position P&L & DB access
# =========================================================================
def pip_size(symbol: str) -> float:
    spec = INSTRUMENTS[symbol]
    if spec["category"] == "Forex":
        return 0.0001 if spec["digits"] >= 4 else 0.01
    return 1.0


def calc_pnl(pos: dict, current_price: float) -> tuple:
    spec = INSTRUMENTS[pos["symbol"]]
    direction = 1 if pos["side"] == "buy" else -1
    price_diff = (current_price - pos["open_price"]) * direction
    ps = pip_size(pos["symbol"])
    pips = price_diff / ps
    pnl = pips * pos["volume"] * spec["pip_value"]
    return round(pnl, 2), round(pips, 1)


async def get_account() -> dict:
    acc = await db.accounts.find_one({}, {"_id": 0})
    if not acc:
        new_acc = Account().model_dump()
        await db.accounts.insert_one(new_acc.copy())
        return new_acc
    return acc


async def update_account_equity():
    acc = await get_account()
    positions = await db.positions.find({"status": "open"}, {"_id": 0}).to_list(1000)
    total_pnl = 0.0
    used_margin = 0.0
    for p in positions:
        state = _ensure_market(p["symbol"])
        pnl, pips = calc_pnl(p, state["last"])
        total_pnl += pnl
        spec = INSTRUMENTS[p["symbol"]]
        # Approximate margin: notional / leverage
        notional = p["volume"] * 100000 * spec["base_price"] if spec["category"] == "Forex" else p["volume"] * spec["base_price"]
        used_margin += notional / acc["leverage"]
        await db.positions.update_one(
            {"id": p["id"]},
            {"$set": {"current_price": state["last"], "pnl": pnl, "pips": pips}},
        )
    equity = acc["balance"] + total_pnl
    await db.accounts.update_one(
        {"id": acc["id"]},
        {"$set": {
            "equity": round(equity, 2),
            "margin": round(used_margin, 2),
            "free_margin": round(equity - used_margin, 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


# =========================================================================
# AUTO-TRADING ENGINE
# =========================================================================
def evaluate_signal(candles: List[dict], strat: dict) -> Optional[str]:
    """Return 'buy', 'sell', or None based on confluence of enabled indicators."""
    if len(candles) < max(strat["ma_slow"], strat["bb_period"], strat["rsi_period"] + 1):
        return None
    ind = compute_indicators(candles, strat)
    closes = [c["c"] for c in candles]
    last_close = closes[-1]
    buy_votes = 0
    sell_votes = 0
    active = 0

    if strat["use_rsi"]:
        active += 1
        last_rsi = ind["rsi"][-1]
        if last_rsi is not None:
            if last_rsi < strat["rsi_oversold"]:
                buy_votes += 1
            elif last_rsi > strat["rsi_overbought"]:
                sell_votes += 1

    if strat["use_bb"]:
        active += 1
        upper = ind["bb_upper"][-1]
        lower = ind["bb_lower"][-1]
        if upper is not None and lower is not None:
            if last_close <= lower:
                buy_votes += 1
            elif last_close >= upper:
                sell_votes += 1

    if strat["use_ma"]:
        active += 1
        f = ind["ma_fast"][-1]
        s = ind["ma_slow"][-1]
        f_prev = ind["ma_fast"][-2] if len(ind["ma_fast"]) > 1 else None
        s_prev = ind["ma_slow"][-2] if len(ind["ma_slow"]) > 1 else None
        if f is not None and s is not None and f_prev is not None and s_prev is not None:
            # Bullish trend
            if f > s and f_prev <= s_prev:
                buy_votes += 1
            elif f < s and f_prev >= s_prev:
                sell_votes += 1
            elif f > s:
                buy_votes += 0  # already trended, no fresh signal
            elif f < s:
                sell_votes += 0

    if strat.get("use_ema", False):
        active += 1
        ef = ind["ema_fast"][-1]
        es = ind["ema_slow"][-1]
        ef_prev = ind["ema_fast"][-2] if len(ind["ema_fast"]) > 1 else None
        es_prev = ind["ema_slow"][-2] if len(ind["ema_slow"]) > 1 else None
        if ef is not None and es is not None and ef_prev is not None and es_prev is not None:
            # Fresh EMA crossover
            if ef > es and ef_prev <= es_prev:
                buy_votes += 1
            elif ef < es and ef_prev >= es_prev:
                sell_votes += 1
            elif ef > es and last_close > ef:
                buy_votes += 1
            elif ef < es and last_close < ef:
                sell_votes += 1

    if active == 0:
        return None
    required = min(strat["confirm_signals"], active)
    if buy_votes >= required and buy_votes > sell_votes:
        return "buy"
    if sell_votes >= required and sell_votes > buy_votes:
        return "sell"
    return None


async def run_auto_trader():
    """Background loop: ticks markets, updates positions, evaluates strategies."""
    while True:
        try:
            # Tick every active instrument
            for symbol in INSTRUMENTS.keys():
                _tick(symbol)
            await update_account_equity()
            await check_sl_tp()
            await evaluate_strategies()
        except Exception as e:
            logger.error(f"Auto-trader loop error: {e}", exc_info=True)
        await asyncio.sleep(2)


async def check_sl_tp():
    """Auto-close positions hitting Stop Loss or Take Profit."""
    positions = await db.positions.find({"status": "open"}, {"_id": 0}).to_list(1000)
    for p in positions:
        state = MARKET_CACHE.get(p["symbol"])
        if not state:
            continue
        price = state["last"]
        should_close = False
        reason = None
        if p["side"] == "buy":
            if p.get("stop_loss") and price <= p["stop_loss"]:
                should_close = True
                reason = "stop_loss"
            elif p.get("take_profit") and price >= p["take_profit"]:
                should_close = True
                reason = "take_profit"
        else:
            if p.get("stop_loss") and price >= p["stop_loss"]:
                should_close = True
                reason = "stop_loss"
            elif p.get("take_profit") and price <= p["take_profit"]:
                should_close = True
                reason = "take_profit"
        if should_close:
            await close_position_internal(p["id"], reason=reason)


async def evaluate_strategies():
    """Check enabled strategies and open new positions on fresh signals."""
    strategies = await db.strategies.find({"enabled": True}, {"_id": 0}).to_list(100)
    for strat in strategies:
        # Limit total auto open positions
        open_count = await db.positions.count_documents({"status": "open", "opened_by": "auto"})
        if open_count >= strat["max_open_positions"]:
            continue
        for symbol in strat["symbols"]:
            if symbol not in INSTRUMENTS:
                continue
            # Avoid stacking same-symbol auto position
            existing = await db.positions.find_one({"status": "open", "symbol": symbol, "opened_by": "auto"})
            if existing:
                continue
            state = _ensure_market(symbol)
            signal = evaluate_signal(state["candles"], strat)
            if signal:
                await open_position_internal(
                    symbol=symbol,
                    side=signal,
                    volume=strat["volume"],
                    sl_pips=strat["stop_loss_pips"],
                    tp_pips=strat["take_profit_pips"],
                    opened_by="auto",
                    comment=f"Auto: {strat['name']}",
                )


# =========================================================================
# TRADING ENGINE
# =========================================================================
async def open_position_internal(symbol: str, side: str, volume: float,
                                  sl_pips: Optional[float] = None,
                                  tp_pips: Optional[float] = None,
                                  stop_loss: Optional[float] = None,
                                  take_profit: Optional[float] = None,
                                  opened_by: str = "manual",
                                  comment: Optional[str] = None) -> dict:
    if symbol not in INSTRUMENTS:
        raise HTTPException(status_code=400, detail=f"Unknown symbol {symbol}")
    state = _ensure_market(symbol)
    price = state["ask"] if side == "buy" else state["bid"]
    ps = pip_size(symbol)

    if stop_loss is None and sl_pips:
        stop_loss = round(price - sl_pips * ps if side == "buy" else price + sl_pips * ps, INSTRUMENTS[symbol]["digits"])
    if take_profit is None and tp_pips:
        take_profit = round(price + tp_pips * ps if side == "buy" else price - tp_pips * ps, INSTRUMENTS[symbol]["digits"])

    pos = Position(
        symbol=symbol,
        side=side,  # type: ignore
        volume=volume,
        open_price=price,
        current_price=price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        opened_by=opened_by,  # type: ignore
        comment=comment,
    ).model_dump()
    await db.positions.insert_one(pos.copy())
    pos.pop("_id", None)
    logger.info(f"[{opened_by}] Opened {side} {volume} {symbol} @ {price}")
    return pos


async def close_position_internal(position_id: str, reason: str = "manual") -> dict:
    pos = await db.positions.find_one({"id": position_id}, {"_id": 0})
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if pos["status"] != "open":
        raise HTTPException(status_code=400, detail="Position already closed")
    state = _ensure_market(pos["symbol"])
    close_price = state["bid"] if pos["side"] == "buy" else state["ask"]
    pnl, pips = calc_pnl(pos, close_price)
    await db.positions.update_one(
        {"id": position_id},
        {"$set": {
            "status": "closed",
            "close_price": close_price,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "pnl": pnl,
            "pips": pips,
            "current_price": close_price,
            "comment": (pos.get("comment") or "") + f" [{reason}]",
        }},
    )
    # Update account balance
    acc = await get_account()
    new_balance = round(acc["balance"] + pnl, 2)
    await db.accounts.update_one({"id": acc["id"]}, {"$set": {"balance": new_balance}})
    logger.info(f"Closed {position_id} @ {close_price} PnL={pnl} reason={reason}")
    pos["status"] = "closed"
    pos["close_price"] = close_price
    pos["pnl"] = pnl
    return pos


# =========================================================================
# API ENDPOINTS
# =========================================================================
@api_router.get("/")
async def root():
    return {"service": "AutoTrade Pro", "status": "ok"}


@api_router.get("/instruments")
async def list_instruments():
    out = []
    for sym, spec in INSTRUMENTS.items():
        state = _ensure_market(sym)
        change = state["last"] - state["day_open"]
        change_pct = (change / state["day_open"]) * 100 if state["day_open"] else 0
        out.append({
            "symbol": sym,
            "name": spec["name"],
            "category": spec["category"],
            "digits": spec["digits"],
            "bid": state["bid"],
            "ask": state["ask"],
            "last": state["last"],
            "prev": state["prev"],
            "day_high": state["day_high"],
            "day_low": state["day_low"],
            "change": round(change, spec["digits"]),
            "change_pct": round(change_pct, 2),
        })
    return out


@api_router.get("/instruments/{symbol}")
async def get_instrument(symbol: str):
    if symbol not in INSTRUMENTS:
        raise HTTPException(status_code=404, detail="Symbol not found")
    state = _ensure_market(symbol)
    spec = INSTRUMENTS[symbol]
    change = state["last"] - state["day_open"]
    return {
        "symbol": symbol,
        "name": spec["name"],
        "category": spec["category"],
        "digits": spec["digits"],
        "bid": state["bid"],
        "ask": state["ask"],
        "last": state["last"],
        "prev": state["prev"],
        "day_high": state["day_high"],
        "day_low": state["day_low"],
        "change": round(change, spec["digits"]),
        "change_pct": round((change / state["day_open"]) * 100, 2) if state["day_open"] else 0,
    }


@api_router.get("/candles/{symbol}")
async def get_candles(symbol: str, limit: int = 100,
                       rsi_period: int = 14, bb_period: int = 20, bb_mult: float = 2.0,
                       ma_fast: int = 50, ma_slow: int = 200,
                       ema_fast: int = 9, ema_slow: int = 20):
    if symbol not in INSTRUMENTS:
        raise HTTPException(status_code=404, detail="Symbol not found")
    state = _ensure_market(symbol)
    candles = state["candles"][-min(limit, 200):]
    cfg = {
        "rsi_period": rsi_period,
        "bb_period": bb_period,
        "bb_mult": bb_mult,
        "ma_fast": ma_fast,
        "ma_slow": ma_slow,
        "ema_fast": ema_fast,
        "ema_slow": ema_slow,
    }
    ind = compute_indicators(state["candles"], cfg)
    # Trim indicators to candles range
    start = len(state["candles"]) - len(candles)
    trimmed = {k: v[start:] for k, v in ind.items()}
    return {
        "symbol": symbol,
        "candles": candles,
        "indicators": trimmed,
    }


@api_router.get("/account")
async def api_get_account():
    await update_account_equity()
    return await get_account()


@api_router.post("/account/reset")
async def reset_account():
    """Reset balance to 10,000 and close all positions. Useful for demo."""
    await db.positions.delete_many({})
    new_acc = Account().model_dump()
    await db.accounts.delete_many({})
    await db.accounts.insert_one(new_acc.copy())
    new_acc.pop("_id", None)
    return new_acc


@api_router.post("/account/mode")
async def set_mode(payload: dict):
    mode = payload.get("mode")
    if mode not in ("simulation", "live"):
        raise HTTPException(status_code=400, detail="mode must be simulation or live")
    acc = await get_account()
    await db.accounts.update_one({"id": acc["id"]}, {"$set": {"mode": mode}})
    return await get_account()


@api_router.patch("/account/settings")
async def update_account_settings(settings: AccountSettings):
    acc = await get_account()
    update = {k: v for k, v in settings.model_dump(exclude_none=True).items()}
    if update:
        await db.accounts.update_one({"id": acc["id"]}, {"$set": update})
    return await get_account()


@api_router.get("/stats/daily")
async def daily_stats():
    """Day-trading stats: today's realized P&L vs target, win-rate, trade count."""
    acc = await get_account()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    closed = await db.positions.find(
        {"status": "closed", "closed_at": {"$gte": today_start.isoformat()}},
        {"_id": 0},
    ).to_list(2000)
    open_positions = await db.positions.find({"status": "open"}, {"_id": 0}).to_list(2000)
    realized = round(sum(p["pnl"] for p in closed), 2)
    floating = round(sum(p["pnl"] for p in open_positions), 2)
    total = round(realized + floating, 2)
    wins = len([p for p in closed if p["pnl"] > 0])
    losses = len([p for p in closed if p["pnl"] <= 0])
    win_rate = round((wins / len(closed)) * 100, 1) if closed else 0.0
    target = acc.get("daily_target", 500.0)
    progress = round((realized / target) * 100, 1) if target else 0.0
    return {
        "date": today_start.date().isoformat(),
        "realized_pnl": realized,
        "floating_pnl": floating,
        "total_pnl": total,
        "trades": len(closed),
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "open_positions": len(open_positions),
        "daily_target": target,
        "max_daily_loss": acc.get("max_daily_loss", 300.0),
        "target_progress": progress,
        "target_reached": realized >= target,
        "loss_limit_hit": realized <= -abs(acc.get("max_daily_loss", 300.0)),
    }


@api_router.post("/orders")
async def create_order(order: OrderCreate):
    return await open_position_internal(
        symbol=order.symbol,
        side=order.side,
        volume=order.volume,
        stop_loss=order.stop_loss,
        take_profit=order.take_profit,
        opened_by="manual",
        comment=order.comment,
    )


@api_router.get("/positions")
async def list_positions(status: str = "open"):
    await update_account_equity()
    cursor = db.positions.find({"status": status}, {"_id": 0}).sort("opened_at", -1)
    return await cursor.to_list(1000)


@api_router.post("/positions/{position_id}/close")
async def close_position(position_id: str):
    return await close_position_internal(position_id, reason="manual")


@api_router.get("/history")
async def trade_history(limit: int = 100):
    cursor = db.positions.find({"status": "closed"}, {"_id": 0}).sort("closed_at", -1).limit(limit)
    return await cursor.to_list(limit)


@api_router.get("/strategies")
async def list_strategies():
    return await db.strategies.find({}, {"_id": 0}).to_list(100)


@api_router.post("/strategies")
async def upsert_strategy(strat: Strategy):
    data = strat.model_dump()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    existing = await db.strategies.find_one({"id": strat.id})
    if existing:
        await db.strategies.update_one({"id": strat.id}, {"$set": data})
    else:
        await db.strategies.insert_one(data.copy())
    data.pop("_id", None)
    return data


@api_router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str):
    res = await db.strategies.delete_one({"id": strategy_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {"deleted": strategy_id}


@api_router.post("/strategies/{strategy_id}/toggle")
async def toggle_strategy(strategy_id: str):
    strat = await db.strategies.find_one({"id": strategy_id}, {"_id": 0})
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found")
    new_state = not strat["enabled"]
    await db.strategies.update_one({"id": strategy_id}, {"$set": {"enabled": new_state}})
    strat["enabled"] = new_state
    return strat


# =========================================================================
# APP LIFECYCLE
# =========================================================================
@app.on_event("startup")
async def on_startup():
    # Warm market cache
    for sym in INSTRUMENTS.keys():
        _ensure_market(sym)
    # Ensure account exists
    await get_account()
    # Seed a default strategy if none
    existing = await db.strategies.count_documents({})
    if existing == 0:
        default = Strategy(
            name="AUD/USD Day Trader",
            enabled=False,
            symbols=["AUDUSD"],
            rsi_period=14,
            rsi_oversold=30.0,
            rsi_overbought=70.0,
            bb_period=20,
            bb_mult=2.0,
            ma_fast=20,
            ma_slow=50,
            use_ema=True,
            ema_fast=9,
            ema_slow=20,
            volume=0.10,
            stop_loss_pips=20.0,
            take_profit_pips=40.0,
            max_open_positions=3,
            confirm_signals=2,
        ).model_dump()
        await db.strategies.insert_one(default.copy())
    # Migration: ensure all existing strategies have EMA fields
    await db.strategies.update_many(
        {"use_ema": {"$exists": False}},
        {"$set": {"use_ema": True, "ema_fast": 9, "ema_slow": 20}},
    )
    # Start auto-trader background task
    asyncio.create_task(run_auto_trader())
    logger.info("AutoTrade Pro started.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
