from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .rbac import RoleName


# ---------- Auth / Users ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str | None = None
    is_active: bool
    role: RoleOut
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    email: EmailStr | None = None
    role: RoleName = RoleName.VIEWER


# ---------- Devices ----------
class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str | None = None
    address: str | None = None
    district: str | None = None
    image_url: str | None = None
    lat: float | None = None
    lon: float | None = None
    last_value: int | None = None
    last_seen: datetime | None = None
    created_at: datetime


class DeviceCreate(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str | None = None
    address: str | None = None
    district: str | None = None
    lat: float | None = None
    lon: float | None = None


class DeviceUpdate(BaseModel):
    """Joylashtirish/tahrirlash — barcha maydonlar ixtiyoriy."""
    name: str | None = None
    address: str | None = None
    district: str | None = None
    lat: float | None = None
    lon: float | None = None


class StateUpdate(BaseModel):
    value: int = Field(ge=0, le=1)
