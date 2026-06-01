import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, select

from ..config import settings
from ..deps import RedisDep, SessionDep, require_permission
from ..models import Device
from ..rbac import Permission
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


@router.get("/devices/{device_id}", response_model=DeviceOut)
async def get_device(device_id: str, session: SessionDep):
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
    return device


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


@router.patch(
    "/devices/{device_id}",
    response_model=DeviceOut,
    dependencies=[Depends(require_permission(Permission.DEVICE_MANAGE))],
)
async def update_device(device_id: str, payload: DeviceUpdate, session: SessionDep):
    """Qurilmani joylashtirish/tahrirlash (nom, tuman, lat, lon)."""
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(device, field, value)
    await session.commit()
    await session.refresh(device)
    return device


@router.post(
    "/devices/{device_id}/image",
    response_model=DeviceOut,
    dependencies=[Depends(require_permission(Permission.DEVICE_MANAGE))],
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
    "/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission(Permission.DEVICE_MANAGE))],
)
async def delete_device(device_id: str, session: SessionDep):
    result = await session.execute(delete(Device).where(Device.id == device_id))
    await session.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Qurilma topilmadi")
