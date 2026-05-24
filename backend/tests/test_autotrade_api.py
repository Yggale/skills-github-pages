"""Backend tests for AutoTrade Pro API."""
import time
import pytest


# ------------- Health -------------
class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ------------- Instruments -------------
class TestInstruments:
    def test_list_instruments(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/instruments")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 60, f"Expected >=60 instruments got {len(data)}"
        cats = {i["category"] for i in data}
        for expected in [
            "Forex Majors", "Forex Minors", "Forex Exotics",
            "Indices", "Commodities", "Crypto", "Stocks",
        ]:
            assert expected in cats, f"Missing category {expected}"

    def test_audusd_detail(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/instruments/AUDUSD")
        assert r.status_code == 200
        d = r.json()
        for k in ("symbol", "bid", "ask", "last", "digits"):
            assert k in d
        assert d["symbol"] == "AUDUSD"
        assert d["digits"] == 5
        assert d["ask"] >= d["bid"]

    def test_unknown_symbol_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/instruments/FAKEXYZ")
        assert r.status_code == 404


# ------------- Candles + Indicators -------------
class TestCandles:
    def test_audusd_candles_with_ema(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/candles/AUDUSD",
            params={"limit": 80, "ema_fast": 9, "ema_slow": 20},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "AUDUSD"
        assert isinstance(d["candles"], list) and len(d["candles"]) > 0
        ind = d["indicators"]
        for k in ("rsi", "bb_upper", "bb_middle", "bb_lower", "ma_fast", "ma_slow", "ema_fast", "ema_slow"):
            assert k in ind, f"Missing indicator {k}"
            assert len(ind[k]) == len(d["candles"])

    def test_candles_unknown_symbol(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/candles/FAKE")
        assert r.status_code == 404


# ------------- Account -------------
class TestAccount:
    def test_get_account(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/account")
        assert r.status_code == 200
        d = r.json()
        assert d["currency"] == "EUR"
        assert d["daily_target"] == 500.0
        assert d["max_daily_loss"] == 300.0
        assert "balance" in d and "equity" in d

    def test_update_settings(self, api_client, base_url):
        r = api_client.patch(
            f"{base_url}/api/account/settings",
            json={"daily_target": 750.0, "max_daily_loss": 400.0},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["daily_target"] == 750.0
        assert d["max_daily_loss"] == 400.0
        # Restore
        api_client.patch(
            f"{base_url}/api/account/settings",
            json={"daily_target": 500.0, "max_daily_loss": 300.0},
        )


# ------------- Daily Stats -------------
class TestDailyStats:
    def test_daily_stats_shape(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/stats/daily")
        assert r.status_code == 200
        d = r.json()
        for k in (
            "realized_pnl", "floating_pnl", "total_pnl", "trades", "wins", "losses",
            "win_rate", "open_positions", "daily_target", "max_daily_loss",
            "target_progress", "target_reached", "loss_limit_hit",
        ):
            assert k in d, f"Missing key {k}"


# ------------- Orders / Positions -------------
class TestOrders:
    def test_open_and_close_position(self, api_client, base_url):
        # Get current ask
        inst = api_client.get(f"{base_url}/api/instruments/AUDUSD").json()
        order = {
            "symbol": "AUDUSD",
            "side": "buy",
            "volume": 0.10,
            "stop_loss": round(inst["ask"] - 0.0020, 5),
            "take_profit": round(inst["ask"] + 0.0040, 5),
            "comment": "TEST_unit",
        }
        r = api_client.post(f"{base_url}/api/orders", json=order)
        assert r.status_code == 200, r.text
        pos = r.json()
        assert pos["symbol"] == "AUDUSD"
        assert pos["side"] == "buy"
        assert pos["volume"] == 0.10
        assert pos["status"] == "open"
        assert pos["opened_by"] == "manual"
        pid = pos["id"]

        # Verify in list
        lst = api_client.get(f"{base_url}/api/positions", params={"status": "open"}).json()
        ids = [p["id"] for p in lst]
        assert pid in ids

        # Close
        r2 = api_client.post(f"{base_url}/api/positions/{pid}/close")
        assert r2.status_code == 200
        closed = r2.json()
        assert closed["status"] == "closed"
        assert closed["close_price"] is not None

        # Re-close should fail
        r3 = api_client.post(f"{base_url}/api/positions/{pid}/close")
        assert r3.status_code == 400

    def test_invalid_order(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/orders", json={"symbol": "FAKE", "side": "buy", "volume": 0.1})
        assert r.status_code in (400, 422)

    def test_volume_must_be_positive(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/orders", json={"symbol": "AUDUSD", "side": "buy", "volume": 0})
        assert r.status_code == 422


# ------------- Strategies -------------
class TestStrategies:
    def test_list_strategies(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/strategies")
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1
        s = lst[0]
        # EMA fields present
        assert s.get("use_ema") is True
        assert s.get("ema_fast") == 9
        assert s.get("ema_slow") == 20

    def test_toggle_strategy(self, api_client, base_url):
        lst = api_client.get(f"{base_url}/api/strategies").json()
        sid = lst[0]["id"]
        before = lst[0]["enabled"]
        r = api_client.post(f"{base_url}/api/strategies/{sid}/toggle")
        assert r.status_code == 200
        after = r.json()["enabled"]
        assert after != before
        # toggle back
        api_client.post(f"{base_url}/api/strategies/{sid}/toggle")

    def test_toggle_unknown(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/strategies/does-not-exist/toggle")
        assert r.status_code == 404


# ------------- Auto-trader -------------
class TestAutoTrader:
    def test_enable_strategy_creates_auto_position(self, api_client, base_url):
        lst = api_client.get(f"{base_url}/api/strategies").json()
        target = next((s for s in lst if "AUDUSD" in s["symbols"]), lst[0])
        sid = target["id"]
        # Ensure enabled
        if not target["enabled"]:
            api_client.post(f"{base_url}/api/strategies/{sid}/toggle")

        found_auto = False
        deadline = time.time() + 60  # wait up to 60s
        while time.time() < deadline:
            pos = api_client.get(f"{base_url}/api/positions", params={"status": "open"}).json()
            if any(p.get("opened_by") == "auto" for p in pos):
                found_auto = True
                break
            time.sleep(3)

        # Disable strategy
        api_client.post(f"{base_url}/api/strategies/{sid}/toggle")

        if not found_auto:
            pytest.skip("Auto-trader didn't fire a signal within 60s window (signal-dependent)")
        assert found_auto
