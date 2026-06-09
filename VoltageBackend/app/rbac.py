"""Role-Based Access Control (RBAC).

Rollar Postgres'da `roles` jadvalida saqlanadi. Har bir rolga tegishli
ruxsatlar (permissions) shu yerda, kodda belgilangan — bu standart RBAC modeli:
role -> permissions to'plami.
"""
from enum import StrEnum


class Permission(StrEnum):
    DEVICE_READ = "device:read"      # holatlarni ko'rish (monitor uchun ochiq)
    DEVICE_WRITE = "device:write"    # qurilma holatini o'zgartirish (yoniq/o'chiq)
    DEVICE_EDIT = "device:edit"      # mavjud qurilma nomi/rasmini tahrirlash
    DEVICE_MANAGE = "device:manage"  # qo'shish / o'chirish / joylashuvni o'zgartirish
    USER_MANAGE = "user:manage"      # foydalanuvchilarni boshqarish


class RoleName(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    RoleName.ADMIN: {
        Permission.DEVICE_READ,
        Permission.DEVICE_WRITE,
        Permission.DEVICE_EDIT,
        Permission.DEVICE_MANAGE,
        Permission.USER_MANAGE,
    },
    RoleName.OPERATOR: {
        Permission.DEVICE_READ,
        Permission.DEVICE_WRITE,
        Permission.DEVICE_EDIT,
    },
    RoleName.VIEWER: {
        Permission.DEVICE_READ,
    },
}

# Boshlang'ich rollar (seed) — (nom, tavsif)
DEFAULT_ROLES: list[tuple[str, str]] = [
    (RoleName.ADMIN, "To'liq huquq: qurilmalar va foydalanuvchilar"),
    (RoleName.OPERATOR, "Qurilmalarni boshqarish va holatni o'zgartirish"),
    (RoleName.VIEWER, "Faqat ko'rish"),
]


def role_has_permission(role_name: str, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role_name, set())
