import json
import logging
import time
from typing import Any, Optional, Dict, Tuple
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages Redis connection, rate limiting, and structured caching with in-memory fallback."""
    def __init__(self) -> None:
        self.redis: Optional[aioredis.Redis] = None
        self._is_connected: bool = False
        # In-memory fallbacks
        self._memory_cache: Dict[str, Tuple[str, float]] = {}  # key -> (json_val, expire_time)
        self._memory_rate_limit: Dict[str, list[float]] = {}  # ip/key -> timestamps

    async def connect(self) -> None:
        """Connect to Redis instance."""
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
            )
            await self.redis.ping()
            self._is_connected = True
            logger.info("Successfully connected to Redis instance at %s", settings.REDIS_URL)
        except Exception as e:
            self._is_connected = False
            logger.warning("Redis connection failed (%s). Falling back to resilient in-memory store.", e)

    async def disconnect(self) -> None:
        """Gracefully close Redis connection."""
        if self.redis:
            await self.redis.close()
            self._is_connected = False

    async def is_rate_limited(self, identifier: str, limit: int = 120, window_seconds: int = 60) -> Tuple[bool, int, int]:
        """
        Check rate limit using sliding window.
        Returns: (is_limited, current_count, retry_after_seconds)
        """
        if not settings.REDIS_RATE_LIMIT_ENABLED:
            return False, 0, 0

        now = time.time()
        key = f"ratelimit:{identifier}"

        if self._is_connected and self.redis:
            try:
                pipe = self.redis.pipeline()
                # Remove timestamps older than window
                pipe.zremrangebyscore(key, 0, now - window_seconds)
                # Add current timestamp
                pipe.zadd(key, {str(now): now})
                # Count elements in window
                pipe.zcard(key)
                # Set TTL on key
                pipe.expire(key, window_seconds + 5)
                results = await pipe.execute()
                current_count = results[2]

                if current_count > limit:
                    return True, current_count, int(window_seconds - (now % window_seconds))
                return False, current_count, 0
            except Exception as e:
                logger.warning("Redis error during rate limiting: %s. Using memory fallback.", e)

        # In-memory sliding window fallback
        timestamps = self._memory_rate_limit.get(identifier, [])
        cutoff = now - window_seconds
        timestamps = [t for t in timestamps if t > cutoff]
        timestamps.append(now)
        self._memory_rate_limit[identifier] = timestamps

        if len(timestamps) > limit:
            return True, len(timestamps), int(window_seconds)
        return False, len(timestamps), 0

    async def get_cache(self, key: str) -> Optional[Any]:
        """Fetch and deserialize JSON from cache."""
        if self._is_connected and self.redis:
            try:
                data = await self.redis.get(key)
                if data:
                    return json.loads(data)
                return None
            except Exception as e:
                logger.warning("Redis get_cache error on key %s: %s", key, e)

        # Fallback to in-memory cache
        if key in self._memory_cache:
            val, expire_time = self._memory_cache[key]
            if time.time() < expire_time:
                return json.loads(val)
            else:
                del self._memory_cache[key]
        return None

    async def set_cache(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        """Serialize and store JSON in cache with TTL."""
        serialized = json.dumps(value, default=str)
        if self._is_connected and self.redis:
            try:
                await self.redis.setex(key, ttl_seconds, serialized)
                return
            except Exception as e:
                logger.warning("Redis set_cache error on key %s: %s", key, e)

        # Memory store fallback
        self._memory_cache[key] = (serialized, time.time() + ttl_seconds)

    async def invalidate_pattern(self, pattern: str) -> None:
        """Invalidate keys matching prefix or pattern."""
        if self._is_connected and self.redis:
            try:
                keys = await self.redis.keys(pattern)
                if keys:
                    await self.redis.delete(*keys)
            except Exception as e:
                logger.warning("Redis invalidation error on pattern %s: %s", pattern, e)

        # Invalidate in-memory keys
        clean_prefix = pattern.replace("*", "")
        keys_to_del = [k for k in self._memory_cache if k.startswith(clean_prefix)]
        for k in keys_to_del:
            self._memory_cache.pop(k, None)


redis_manager = RedisManager()
