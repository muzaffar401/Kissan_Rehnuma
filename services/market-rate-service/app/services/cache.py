"""Cache wrapper: Redis when available, in-process TTL dict otherwise.

Both GET endpoints read through cache_get() first and write through
cache_set() on DB misses. TTL configurable via CACHE_TTL_SECONDS.
"""
import json
import logging
import threading
import time
from typing import Any, Optional

from app.core.config import CACHE_TTL_SECONDS, REDIS_URL

logger = logging.getLogger("market_rate.cache")

_redis_client = None
_redis_tried = False
_memory: dict = {}
_lock = threading.Lock()


def _redis():
    global _redis_client, _redis_tried
    if not _redis_tried:
        _redis_tried = True
        try:
            import redis

            client = redis.from_url(REDIS_URL, socket_connect_timeout=1)
            client.ping()
            _redis_client = client
            logger.info("Using Redis cache at %s", REDIS_URL)
        except Exception as exc:
            logger.warning(
                "Redis unavailable (%s) — falling back to in-process cache", exc
            )
    return _redis_client


def cache_get(key: str) -> Optional[Any]:
    client = _redis()
    if client is not None:
        try:
            raw = client.get(key)
            if raw:
                return json.loads(raw)
            return None
        except Exception as exc:
            logger.warning("Redis get failed: %s", exc)
    with _lock:
        item = _memory.get(key)
        if item and item[0] > time.time():
            return item[1]
        _memory.pop(key, None)
    return None


def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    ttl = ttl or CACHE_TTL_SECONDS
    client = _redis()
    if client is not None:
        try:
            client.setex(key, ttl, json.dumps(value))
            return
        except Exception as exc:
            logger.warning("Redis set failed: %s", exc)
    with _lock:
        _memory[key] = (time.time() + ttl, value)
