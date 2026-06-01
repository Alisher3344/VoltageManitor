import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from ..config import settings
from ..database import async_session_factory
from ..deps import RedisDep
from ..models import Device

router = APIRouter(tags=["events"])


async def _snapshot() -> dict[str, int | None]:
    async with async_session_factory() as session:
        devices = (await session.scalars(select(Device))).all()
        return {d.id: d.last_value for d in devices}


async def _event_stream(request: Request, redis) -> AsyncGenerator[str, None]:
    # 1) Ulanish boshida — barcha mavjud holatlar
    snapshot = await _snapshot()
    yield f"data: {json.dumps({'all': snapshot})}\n\n"

    # 2) Redis pub/sub orqali yangilanishlar
    pubsub = redis.pubsub()
    await pubsub.subscribe(settings.events_channel)
    try:
        while True:
            if await request.is_disconnected():
                break
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=15
            )
            if msg is None:
                # Heartbeat — o'lik ulanishlar va proksi timeoutlariga qarshi
                yield ": ping\n\n"
                continue
            data = msg["data"]
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            yield f"data: {data}\n\n"
    except asyncio.CancelledError:
        raise
    finally:
        await pubsub.unsubscribe(settings.events_channel)
        await pubsub.aclose()


@router.get("/events")
async def events(request: Request, redis: RedisDep):
    return StreamingResponse(
        _event_stream(request, redis),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
