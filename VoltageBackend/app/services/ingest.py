"""Qurilma holatini qabul qilish: xom TCP listener (ESP32) + set_state.

set_state Postgres'ga yozadi (qurilma + tarix) va Redis pub/sub orqali
barcha SSE ulanishlariga e'lon qiladi. Bu web-ishchilardan mustaqil ishlaydi.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import async_session_factory
from ..models import Device, DeviceEvent

log = logging.getLogger("voltage.ingest")


async def set_state(
    session: AsyncSession,
    redis: aioredis.Redis,
    dev_id: str,
    value: int,
) -> None:
    dev_id = str(dev_id)
    value = int(value)

    device = await session.get(Device, dev_id)
    if device is None:
        device = Device(id=dev_id)
        session.add(device)

    device.last_value = value
    device.last_seen = datetime.now(timezone.utc)
    session.add(DeviceEvent(device_id=dev_id, value=value))
    await session.commit()

    await redis.publish(
        settings.events_channel, json.dumps({"id": dev_id, "value": value})
    )


async def _handle_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    redis: aioredis.Redis,
) -> None:
    addr = writer.get_extra_info("peername")
    log.info("ESP32 ulandi: %s", addr)
    try:
        while True:
            line = await asyncio.wait_for(reader.readline(), timeout=180)
            if not line:
                break
            text = line.strip().decode("ascii", "ignore")
            # Format: "id:value"
            if ":" not in text:
                continue
            dev_id, val = text.split(":", 1)
            dev_id, val = dev_id.strip(), val.strip()
            if dev_id and val in ("0", "1"):
                async with async_session_factory() as session:
                    await set_state(session, redis, dev_id, int(val))
                log.info("[TCP] %s -> %s", dev_id, val)
    except (asyncio.TimeoutError, ConnectionError):
        pass
    except Exception:  # noqa: BLE001
        log.exception("TCP klient xatosi")
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:  # noqa: BLE001
            pass
        log.info("ESP32 uzildi: %s", addr)


async def start_tcp_server(redis: aioredis.Redis) -> asyncio.AbstractServer:
    server = await asyncio.start_server(
        lambda r, w: _handle_client(r, w, redis),
        host="0.0.0.0",
        port=settings.tcp_port,
    )
    log.info("Xom TCP listener :%d (ESP32 uchun)", settings.tcp_port)
    return server
