from __future__ import annotations
from typing import Any
from app.trading.binance import BinanceTestnetConnector


async def run_backtest(
    strategy_key: str,
    symbol: str,
    interval: str,
    config: dict[str, Any],
    initial_capital: float = 10000.0,
    limit: int = 500,
    market_type: str = "spot",
) -> dict:
    """Run a simple backtest using historical klines."""
    conn = BinanceTestnetConnector()
    raw_klines = await conn.public_klines(symbol, interval, limit=limit)
    
    closes = [float(k[4]) for k in raw_klines]
    times = [int(k[0]) for k in raw_klines]
    
    if len(closes) < 50:
        return {"error": "Insufficient data for backtest", "status": "failed"}
    
    signals = _generate_signals(strategy_key, closes, config)
    result = _simulate_trades(closes, times, signals, initial_capital, config)
    result["status"] = "completed"
    return result


def _generate_signals(strategy_key: str, closes: list[float], config: dict) -> list[str]:
    """Generate BUY/SELL/HOLD signals for each bar."""
    n = len(closes)
    signals = ["HOLD"] * n
    
    if strategy_key == "simple_ma":
        fast = int(config.get("fast_period", config.get("fast", 7)))
        slow = int(config.get("slow_period", config.get("slow", 25)))
        for i in range(slow, n):
            fast_ma = sum(closes[i - fast:i]) / fast
            slow_ma = sum(closes[i - slow:i]) / slow
            prev_fast = sum(closes[i - fast - 1:i - 1]) / fast
            prev_slow = sum(closes[i - slow - 1:i - 1]) / slow
            if prev_fast <= prev_slow and fast_ma > slow_ma:
                signals[i] = "BUY"
            elif prev_fast >= prev_slow and fast_ma < slow_ma:
                signals[i] = "SELL"
    
    elif strategy_key == "rsi":
        period = config.get("period", 14)
        overbought = config.get("overbought", 70)
        oversold = config.get("oversold", 30)
        rsi_vals = _calc_rsi(closes, period)
        prev_state = "HOLD"
        for i in range(len(rsi_vals)):
            idx = i + period
            if idx >= n:
                break
            rsi = rsi_vals[i]
            if rsi < oversold and prev_state != "BUY":
                signals[idx] = "BUY"
                prev_state = "BUY"
            elif rsi > overbought and prev_state != "SELL":
                signals[idx] = "SELL"
                prev_state = "SELL"
    
    elif strategy_key == "bollinger":
        period = config.get("period", 20)
        num_std = config.get("num_std", 2.0)
        prev_state = "HOLD"
        for i in range(period, n):
            window = closes[i - period:i]
            sma = sum(window) / period
            std = (sum((x - sma) ** 2 for x in window) / period) ** 0.5
            upper = sma + num_std * std
            lower = sma - num_std * std
            price = closes[i]
            if price <= lower and prev_state != "BUY":
                signals[i] = "BUY"
                prev_state = "BUY"
            elif price >= upper and prev_state != "SELL":
                signals[i] = "SELL"
                prev_state = "SELL"
    
    return signals


def _calc_rsi(closes: list[float], period: int) -> list[float]:
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    results = []
    for i in range(period - 1, len(deltas)):
        window = deltas[i - period + 1:i + 1]
        gains = [d for d in window if d > 0]
        losses = [-d for d in window if d < 0]
        avg_gain = sum(gains) / period if gains else 0
        avg_loss = sum(losses) / period if losses else 0
        if avg_loss == 0:
            results.append(100.0)
        else:
            rs = avg_gain / avg_loss
            results.append(100 - 100 / (1 + rs))
    return results


def _simulate_trades(
    closes: list[float], times: list[int], signals: list[str],
    initial_capital: float, config: dict
) -> dict:
    capital = initial_capital
    position = 0.0
    trades = []
    equity_curve = []
    entry_price = 0.0
    wins = 0
    losses_count = 0
    peak_equity = initial_capital
    max_drawdown = 0.0
    
    qty_pct = float(config.get("quantity_pct", 0.95))
    
    for i, sig in enumerate(signals):
        price = closes[i]
        current_equity = capital + position * price
        
        if current_equity > peak_equity:
            peak_equity = current_equity
        dd = (peak_equity - current_equity) / peak_equity * 100 if peak_equity > 0 else 0
        if dd > max_drawdown:
            max_drawdown = dd
        
        if i % max(1, len(signals) // 200) == 0:
            equity_curve.append({"time": times[i] // 1000, "equity": round(current_equity, 2)})
        
        if sig == "BUY" and position == 0:
            qty = (capital * qty_pct) / price
            position = qty
            capital -= qty * price
            entry_price = price
            trades.append({
                "time": times[i] // 1000, "side": "BUY", "price": round(price, 2),
                "qty": round(qty, 6), "capital": round(capital, 2)
            })
        elif sig == "SELL" and position > 0:
            capital += position * price
            pnl = (price - entry_price) * position
            if pnl > 0:
                wins += 1
            else:
                losses_count += 1
            trades.append({
                "time": times[i] // 1000, "side": "SELL", "price": round(price, 2),
                "qty": round(position, 6), "pnl": round(pnl, 2), "capital": round(capital, 2)
            })
            position = 0
            entry_price = 0
    
    final_equity = capital + position * closes[-1] if closes else capital
    equity_curve.append({"time": times[-1] // 1000 if times else 0, "equity": round(final_equity, 2)})
    total_trades = wins + losses_count
    
    return {
        "initial_capital": initial_capital,
        "final_capital": round(final_equity, 2),
        "total_return_pct": round((final_equity - initial_capital) / initial_capital * 100, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "total_trades": total_trades,
        "win_rate": round(wins / total_trades * 100, 1) if total_trades > 0 else 0,
        "sharpe_ratio": 0,
        "trades": trades[-50:],
        "equity_curve": equity_curve,
    }
