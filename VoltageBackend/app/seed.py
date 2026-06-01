"""Idempotent seed: rollarni va (ixtiyoriy) bootstrap admin'ni yaratadi.

Startupda chaqiriladi. Jadvallar Alembic migratsiyalari orqali yaratiladi.
"""
import logging

from sqlalchemy import select

from .config import settings
from .database import async_session_factory
from .models import Role, User
from .rbac import DEFAULT_ROLES, RoleName
from .security import hash_password

log = logging.getLogger("voltage.seed")


async def seed_roles_and_admin() -> None:
    async with async_session_factory() as session:
        # --- Rollar ---
        existing = {r.name for r in (await session.scalars(select(Role))).all()}
        for name, desc in DEFAULT_ROLES:
            if name not in existing:
                session.add(Role(name=name, description=desc))
        await session.commit()

        # --- Bootstrap admin ---
        if settings.admin_username and settings.admin_password:
            user = await session.scalar(
                select(User).where(User.username == settings.admin_username)
            )
            if user is None:
                admin_role = await session.scalar(
                    select(Role).where(Role.name == RoleName.ADMIN)
                )
                session.add(
                    User(
                        username=settings.admin_username,
                        email=settings.admin_email,
                        hashed_password=hash_password(settings.admin_password),
                        role_id=admin_role.id,
                        is_active=True,
                    )
                )
                await session.commit()
                log.info("Bootstrap admin yaratildi: %s", settings.admin_username)
