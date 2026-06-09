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

    # Tarixga FAQAT holat o'zgarganda yozamiz (keepalive'lar bazani shishirmaydi).
    # last_seen esa har safar yangilanadi — bu "oflayn" aniqlash uchun kerak.
    changed = device.last_value != value
    now = datetime.now(timezone.utc)
    device.last_value = value
    device.last_seen = now
    if changed:
        session.add(DeviceEvent(device_id=dev_id, value=value))
    await session.commit()

    # Har safar e'lon qilamiz: SSE klientlari last_seen'ni yangilab tursin
    # (keepalive kelganda ham — aks holda qurilma noto'g'ri "oflayn" bo'ladi).
    await redis.publish(
        settings.events_channel,
        json.dumps({"id": dev_id, "value": value, "ts": now.isoformat()}),
    )


async def set_meta(
    session: AsyncSession, dev_id: str, iccid: str | None, phone: str | None
) -> None:
    """Qurilmadan kelgan o'zgarmas SIM ma'lumotlarini saqlash (ICCID, telefon)."""
    dev_id = str(dev_id)
    device = await session.get(Device, dev_id)
    if device is None:
        device = Device(id=dev_id)
        session.add(device)
    if iccid:
        device.iccid = iccid
    if phone:
        device.phone = phone
    await session.commit()


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
            if ":" not in text:
                continue
            # Token (yoqilgan bo'lsa) — birinchi bo'lakni tekshirib olib tashlaymiz
            if settings.ingest_token:
                tok, sep, rest = text.partition(":")
                if not sep or tok != settings.ingest_token:
                    log.warning("[TCP] noto'g'ri/yo'q token — rad etildi")
                    continue
                text = rest
            # SIM ma'lumotlari: "META:id:iccid:phone"
            if text.startswith("META:"):
                meta = text.split(":")
                m_id = meta[1].strip() if len(meta) > 1 else ""
                iccid = (meta[2].strip() if len(meta) > 2 else "") or None
                phone = (meta[3].strip() if len(meta) > 3 else "") or None
                if m_id:
                    async with async_session_factory() as session:
                        await set_meta(session, m_id, iccid, phone)
                    log.info("[TCP] META %s iccid=%s phone=%s", m_id, iccid, phone)
                continue
            # Holat: "id:value"
            dev_id, _, val = text.partition(":")
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
