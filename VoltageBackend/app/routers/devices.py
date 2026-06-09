import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, select

from ..config import settings
from ..deps import RedisDep, SessionDep, require_permission
from ..models import Device, DeviceEvent, User
from ..rbac import Permission, role_has_permission
from ..schemas import DeviceCreate, DeviceOut, DeviceUpdate, StateUpdate
from ..services.ingest import set_state

router = APIRouter(tags=["devices"])

ALLOWED_IMAGE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}


# ---------- Ochiq (monitor uchun) ----------
@router.get("/status")
async def status_dict(session: SessionDep) -> dict[str, int | None]:
    """Eski format bilan mos: {"11": 1, "12": 0, ...}"""
    devices = (await session.scalars(select(Device))).all()
    return {d.id: d.last_value for d in devices}


@router.get("/devices", response_model=list[DeviceOut])
async def list_devices(session: SessionDep):
    return (await session.scalars(select(Device).order_by(Device.id))).all()


# ---------- Boshqaruv (maxfiy SIM ma'lumotlari — faqat admin/operator) ----------
@router.get(
    "/devices/manage",
    dependencies=[Depends(require_permission(Permission.DEVICE_EDIT))],
)
async def list_devices_manage(session: SessionDep):
    """To'liq ro'yxat — telefon/ICCID/koordinata bilan (Excel uchun)."""
    devices = (await session.scalars(select(Device).order_by(Device.id))).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "phone": d.phone,
            "iccid": d.iccid,
            "lat": d.lat,
            "lon": d.lon,
        }
        for d in devices
    ]


@router.get("/devices/{device_id}", response_model=DeviceOut)
async def get_device(device_id: str, session: SessionDep):
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
    return device


@router.get("/devices/{device_id}/history")
async def device_history(
    device_id: str,
    session: SessionDep,
    hours: int = Query(default=24, ge=1, le=168),
):
    """Holat tarixi: o'tgan `hours` soat ichidagi o'tishlar + uptime% va uzilishlar soni.

    Tarix faqat holat o'zgarganda yoziladi, shuning uchun har bir yozuv — o'tish nuqtasi.
    Oyna boshidagi holatni bilish uchun oynagacha bo'lgan oxirgi yozuv ham qo'shiladi.
    """
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")

    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)

    prior = await session.scalar(
        select(DeviceEvent)
        .where(DeviceEvent.device_id == device_id, DeviceEvent.ts < since)
        .order_by(DeviceEvent.ts.desc())
        .limit(1)
    )
    rows = (
        await session.scalars(
            select(DeviceEvent)
            .where(DeviceEvent.device_id == device_id, DeviceEvent.ts >= since)
            .order_by(DeviceEvent.ts)
        )
    ).all()

    # Oyna boshidagi holat (sintetik nuqta), keyin haqiqiy o'tishlar
    events: list[dict] = []
    if prior is not None:
        events.append({"value": prior.value, "ts": since.isoformat()})
    events.extend({"value": r.value, "ts": r.ts.isoformat()} for r in rows)
    if not events and device.last_value is not None:
        events.append({"value": device.last_value, "ts": since.isoformat()})

    # uptime% (yoniq vaqt / oyna) va uzilishlar (0 ga o'tishlar)
    total = (now - since).total_seconds()
    on_time = 0.0
    for i, e in enumerate(events):
        start = datetime.fromisoformat(e["ts"])
        end = datetime.fromisoformat(events[i + 1]["ts"]) if i + 1 < len(events) else now
        if e["value"] == 1:
            on_time += (end - start).total_seconds()
    uptime = round(100 * on_time / total) if total else 0
    outages = sum(1 for r in rows if r.value == 0)

    return {
        "device_id": device_id,
        "from": since.isoformat(),
        "to": now.isoformat(),
        "events": events,
        # Real o'tishlar jurnali (eng yangisi birinchi): yongan/o'chgan + vaqt
        "log": [{"value": r.value, "ts": r.ts.isoformat()} for r in reversed(rows)],
        "uptime_pct": uptime,
        "outages": outages,
    }


# ---------- Himoyalangan (boshqaruv) ----------
@router.post(
    "/devices/{device_id}/state",
    dependencies=[Depends(require_permission(Permission.DEVICE_WRITE))],
)
async def update_state(
    device_id: str, payload: StateUpdate, session: SessionDep, redis: RedisDep
):
    await set_state(session, redis, device_id, payload.value)
    return {"ok": True, "id": device_id, "value": payload.value}


@router.get(
    "/update",
    dependencies=[Depends(require_permission(Permission.DEVICE_WRITE))],
    deprecated=True,
)
async def update_compat(
    session: SessionDep,
    redis: RedisDep,
    id: str = Query(default="default"),
    value: str = Query(default=""),
):
    """Eski endpoint bilan moslik (qo'lda boshqaruv uchun)."""
    if value not in ("0", "1"):
        raise HTTPException(status_code=400, detail="value 0 yoki 1 bo'lishi kerak")
    await set_state(session, redis, id, int(value))
    return {"ok": True, "id": id, "value": int(value)}


@router.post(
    "/devices",
    response_model=DeviceOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Permission.DEVICE_MANAGE))],
)
async def register_device(payload: DeviceCreate, session: SessionDep):
    if await session.get(Device, payload.id) is not None:
        raise HTTPException(status_code=409, detail="Bunday ID mavjud")
    device = Device(
        id=payload.id,
        name=payload.name,
        address=payload.address,
        district=payload.district,
        lat=payload.lat,
        lon=payload.lon,
    )
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return device


@router.patch("/devices/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: str,
    payload: DeviceUpdate,
    session: SessionDep,
    user: Annotated[User, Depends(require_permission(Permission.DEVICE_EDIT))],
):
    """Qurilmani tahrirlash. Operator faqat nom/rasmni o'zgartiradi;
    joylashuv (lat/lon/tuman) faqat to'liq boshqaruv huquqida (admin)."""
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
    data = payload.model_dump(exclude_unset=True)
    # Joylashuvni faqat DEVICE_MANAGE (admin) o'zgartira oladi
    if not role_has_permission(user.role.name, Permission.DEVICE_MANAGE):
        if {"lat", "lon", "district"} & data.keys():
            raise HTTPException(
                status_code=403,
                detail="Sizda joylashuvni o'zgartirish huquqi yo'q (faqat nom/rasm)",
            )
    for field, value in data.items():
        setattr(device, field, value)
    await session.commit()
    await session.refresh(device)
    return device


@router.post(
    "/devices/{device_id}/image",
    response_model=DeviceOut,
    dependencies=[Depends(require_permission(Permission.DEVICE_EDIT))],
)
async def upload_image(
    device_id: str, session: SessionDep, file: UploadFile = File(...)
):
    """Qurilma rasmini yuklash (png/jpg/webp/gif, ≤5MB)."""
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")

    ext = ALLOWED_IMAGE.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=400, detail="Rasm formati: png, jpg, webp yoki gif"
        )
    content = await file.read()
    if len(content) > settings.max_image_bytes:
        raise HTTPException(status_code=400, detail="Rasm 5MB dan katta")

    settings.media_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    (settings.media_dir / fname).write_bytes(content)
    device.image_url = f"/media/{fname}"
    await session.commit()
    await session.refresh(device)
    return device


@router.delete(
    "/devices/{device_id}/image",
    response_model=DeviceOut,
    dependencies=[Depends(require_permission(Permission.DEVICE_EDIT))],
)
async def delete_image(device_id: str, session: SessionDep):
    """Qurilma rasmini o'chirish (faylni ham, bog'lanishni ham)."""
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
    if device.image_url:
        # /media/<fayl> -> faqat fayl nomi (traversal'dan himoya)
        fname = device.image_url.rsplit("/", 1)[-1]
        try:
            (settings.media_dir / fname).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
        device.image_url = None
        await session.commit()
        await session.refresh(device)
    return device


@router.delete(
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(Permission.DEVICE_MANAGE))],
)
async def delete_device(device_id: str, session: SessionDep):
    result = await session.execute(delete(Device).where(Device.id == device_id))
    await session.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
