"""
scheduler.py — оставлен как заглушка.
Система назначений удалена, планировщик отключён.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def scheduler_loop():
    """No-op scheduler — assignments system removed."""
    logger.info("Scheduler stub started (assignments system removed)")
    while True:
        await asyncio.sleep(3600)
