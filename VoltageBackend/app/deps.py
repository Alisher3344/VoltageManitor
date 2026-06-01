from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_session
from .models import User
from .rbac import Permission, role_has_permission
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis


RedisDep = Annotated[aioredis.Redis, Depends(get_redis)]


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: SessionDep,
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Yaroqsiz yoki muddati o'tgan token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except Exception:
        raise cred_exc

    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise cred_exc
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_permission(permission: Permission):
    """RBAC dependency fabrikasi: berilgan ruxsatni talab qiladi."""

    async def checker(user: CurrentUser) -> User:
        if not role_has_permission(user.role.name, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"'{permission}' ruxsati yo'q (rol: {user.role.name})",
            )
        return user

    return checker
