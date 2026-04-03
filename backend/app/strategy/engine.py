from __future__ import annotations
import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)


class StrategyEngine:
    def __init__(self) -> None:
        self._tasks: dict[int, asyncio.Task[None]] = {}
        self._stops: dict[int, asyncio.Event] = {}

    def is_running(self, instance_id: int) -> bool:
        t = self._tasks.get(instance_id)
        return t is not None and not t.done()

    def running_count(self) -> int:
        return sum(1 for t in self._tasks.values() if not t.done())

    def stop(self, instance_id: int) -> None:
        ev = self._stops.pop(instance_id, None)
        if ev is not None:
            ev.set()
        t = self._tasks.pop(instance_id, None)
        if t is not None:
            t.cancel()

    def start(self, instance_id: int, coro_factory: Callable[[asyncio.Event], Awaitable[None]]) -> None:
        if self.is_running(instance_id):
            return
        stop = asyncio.Event()
        self._stops[instance_id] = stop

        async def _wrap() -> None:
            try:
                await coro_factory(stop)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.exception("strategy instance %s crashed: %s", instance_id, e)

        self._tasks[instance_id] = asyncio.create_task(_wrap())


engine = StrategyEngine()
