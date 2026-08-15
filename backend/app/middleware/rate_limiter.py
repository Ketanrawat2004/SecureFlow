import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from app.core.config import settings
from app.core.redis_client import redis_manager


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Exclude health, readiness, and docs from rate limiting
        path = request.url.path
        if path in ["/health", "/ready", "/docs", "/openapi.json", "/redoc"] or not settings.REDIS_RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Get client IP or forward-for
        client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        identifier = f"ip:{client_ip}"
        limit = settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        window = 60

        is_limited, current_count, retry_after = await redis_manager.is_rate_limited(
            identifier=identifier,
            limit=limit,
            window_seconds=window
        )

        if is_limited:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "API rate limit exceeded. Please retry shortly.",
                    "retry_after_seconds": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + retry_after)),
                },
            )

        response = await call_next(request)
        remaining = max(0, limit - current_count)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
