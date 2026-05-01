# pragma pylint: disable=missing-docstring, invalid-name

from datetime import datetime
from typing import Optional, Tuple, Union

import talib.abstract as ta
from pandas import DataFrame

from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy


class SpotFixedGridStrategy(IStrategy):
    """
    现货单向固定比例网格策略。

    策略会在价格回调时开第一笔现货多单，然后以首仓价格为锚点，
    每下跌 `grid_step_pct` 的固定比例就追加一笔等额网格买单。
    当整体持仓按加权成本计算的盈利达到同样固定比例时，整仓退出。

    建议配置：
      - trading_mode: spot
      - margin_mode: ""
      - max_open_trades: 希望同时运行网格的交易对数量
      - stake_amount: 每个交易对一轮网格的总预算
    """

    INTERFACE_VERSION = 3

    can_short = False
    timeframe = "5m"
    startup_candle_count = 200
    process_only_new_candles = True

    # 固定网格参数。示例：0.02 表示每格 2%。
    grid_step_pct = 0.02
    max_grid_entries = 6

    position_adjustment_enable = True
    max_entry_position_adjustment = max_grid_entries - 1

    # 关闭默认 ROI/止损退出，统一由 custom_exit() 控制网格止盈。
    minimal_roi = {"0": 100}
    stoploss = -0.99
    trailing_stop = False
    use_exit_signal = True
    exit_profit_only = False
    ignore_roi_if_entry_signal = True

    order_types = {
        "entry": "limit",
        "exit": "limit",
        "stoploss": "market",
        "stoploss_on_exchange": False,
    }
    order_time_in_force = {"entry": "GTC", "exit": "GTC"}

    plot_config = {
        "main_plot": {
            "ema50": {"color": "orange"},
            "ema200": {"color": "blue"},
        },
        "subplots": {
            "RSI": {
                "rsi": {"color": "red"},
            },
            "Trend": {
                "adx": {"color": "purple"},
            },
        },
    }

    def informative_pairs(self):
        return []

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema50"] = ta.EMA(dataframe, timeperiod=50)
        dataframe["ema200"] = ta.EMA(dataframe, timeperiod=200)
        dataframe["rsi"] = ta.RSI(dataframe, timeperiod=14)
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=14)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        initial_grid_entry = (
            (dataframe["volume"] > 0)
            # 避免在明显长期下跌趋势中启动新网格。
            & (dataframe["ema50"] >= dataframe["ema200"] * 0.995)
            # 避免在单边趋势过强时追入第一格。
            & (dataframe["adx"] < 35)
            # 只在价格回调后启动，不追高。
            & (dataframe["close"] < dataframe["ema50"])
            & (dataframe["rsi"] < 55)
        )

        dataframe.loc[initial_grid_entry, "enter_long"] = 1
        dataframe.loc[initial_grid_entry, "enter_tag"] = "grid_start"

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["exit_long"] = 0
        return dataframe

    def custom_stake_amount(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_stake: float,
        min_stake: Optional[float],
        max_stake: float,
        leverage: float,
        entry_tag: Optional[str],
        side: str,
        **kwargs,
    ) -> float:
        """
        为全部网格买入预留资金，避免策略需要杠杆或额外钱包余额
        才能完成已配置的网格层数。
        """
        grid_stake = proposed_stake / self.max_grid_entries
        grid_stake = min(grid_stake, max_stake)

        if min_stake and grid_stake < min_stake:
            return min(min_stake, max_stake)

        return grid_stake

    def adjust_trade_position(
        self,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        min_stake: Optional[float],
        max_stake: float,
        current_entry_rate: float,
        current_exit_rate: float,
        current_entry_profit: float,
        current_exit_profit: float,
        **kwargs,
    ) -> Optional[Union[float, Tuple[float, str]]]:
        entries = trade.nr_of_successful_entries

        if entries >= self.max_grid_entries:
            return None

        filled_entries = trade.select_filled_orders(trade.entry_side)
        first_entry_rate = self._order_rate(filled_entries[0], trade.open_rate) if filled_entries else trade.open_rate
        next_grid_rate = first_entry_rate * ((1 - self.grid_step_pct) ** entries)

        if current_rate > next_grid_rate:
            return None

        stake_amount = self._next_grid_stake(trade, entries)
        stake_amount = min(stake_amount, max_stake)

        if min_stake and stake_amount < min_stake:
            return None

        return stake_amount, f"grid_buy_{entries + 1}"

    def custom_exit(
        self,
        pair: str,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        **kwargs,
    ) -> Optional[str]:
        if current_profit >= self.grid_step_pct:
            return "grid_take_profit"

        return None

    def leverage(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_leverage: float,
        max_leverage: float,
        side: str,
        **kwargs,
    ) -> float:
        return 1.0

    @staticmethod
    def _order_rate(order, fallback_rate: float) -> float:
        rate = (
            getattr(order, "safe_price", None)
            or getattr(order, "average", None)
            or getattr(order, "price", None)
            or fallback_rate
        )
        return float(rate)

    @staticmethod
    def _next_grid_stake(trade: Trade, entries: int) -> float:
        filled_entries = trade.select_filled_orders(trade.entry_side)

        if filled_entries:
            first_stake = getattr(filled_entries[0], "stake_amount", None)
            if first_stake:
                return float(first_stake)

        return float(trade.stake_amount) / max(entries, 1)
