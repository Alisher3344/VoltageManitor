from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..deps import CurrentUser, SessionDep, require_permission
from ..models import Role, User
from ..rbac import Permission
from ..schemas import Token, UserCreate, UserOut
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
):
    user = await session.scalar(select(User).where(User.username == form.username))
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login yoki parol noto'g'ri",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Foydalanuvchi faol emas")

    token = create_access_token(user.id, user.role.name)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Permission.USER_MANAGE))],
)
async def create_user(payload: UserCreate, session: SessionDep):
    role = await session.scalar(select(Role).where(Role.name == payload.role))
    if role is None:
        raise HTTPException(status_code=400, detail=f"Rol topilmadi: {payload.role}")

    from ..security import hash_password

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Bunday login yoki email mavjud")
    await session.refresh(user)
    return user


@router.get(
    "/users",
    response_model=list[UserOut],
    dependencies=[Depends(require_permission(Permission.USER_MANAGE))],
)
async def list_users(session: SessionDep):
    return (await session.scalars(select(User).order_by(User.id))).all()
