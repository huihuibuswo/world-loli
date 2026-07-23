from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.responses import abort, ok
from app.core.security import (
    create_access_token,
    dummy_password_hash,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models import (
    CardSpiritTemplate,
    CardTemplate,
    Deck,
    DeckCard,
    MapData,
    Player,
    PlayerCard,
    PlayerCardSpirit,
    User,
)
from app.schemas import LoginRequest, RegisterRequest


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    username = payload.username.strip().lower()
    email = str(payload.email).lower() if payload.email else None
    duplicate = db.scalar(
        select(User).where(or_(User.username == username, User.email == email if email else False))
    )
    if duplicate is not None:
        abort(409, "用户名或邮箱已存在")

    first_map = db.scalar(select(MapData).order_by(MapData.id))
    spawn = (first_map.resource_json or {}).get("spawn", {}) if first_map else {}
    user = User(username=username, email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    player = Player(
        user_id=user.id,
        name=(payload.player_name or username).strip(),
        avatar_gender=payload.avatar_gender,
        current_map=first_map.id if first_map else None,
        position_x=float(spawn.get("x", 0)),
        position_y=float(spawn.get("y", 0)),
    )
    db.add(player)
    db.flush()
    starter_spirit = db.scalar(
        select(CardSpiritTemplate).where(CardSpiritTemplate.name == "狼娘·露娜")
    )
    if starter_spirit is not None:
        db.add(PlayerCardSpirit(player_id=player.id, spirit_template_id=starter_spirit.id))
    starter_templates = db.scalars(select(CardTemplate).order_by(CardTemplate.id).limit(2)).all()
    starter_deck = Deck(player_id=player.id, name="初始套牌", is_active=True)
    db.add(starter_deck)
    db.flush()
    for template in starter_templates:
        card = PlayerCard(player_id=player.id, card_template_id=template.id, count=2)
        db.add(card)
        db.flush()
        db.add(
            DeckCard(
                deck_id=starter_deck.id,
                card_id=card.id,
                player_id=player.id,
                amount=2,
            )
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        abort(409, "账号或角色名称冲突")

    return ok(
        {
            "access_token": create_access_token(user.id),
            "token_type": "bearer",
            "user": {"id": user.id, "username": user.username, "email": user.email},
            "player_id": player.id,
        },
        "注册成功",
    )


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.username == payload.username.strip().lower()))
    candidate_hash = user.password_hash if user is not None else dummy_password_hash
    password_valid = verify_password(payload.password, candidate_hash)
    if user is None or not password_valid:
        abort(401, "用户名或密码错误")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return ok(
        {"access_token": create_access_token(user.id), "token_type": "bearer"},
        "登录成功",
    )


@router.get("/profile")
def profile(user: User = Depends(get_current_user)) -> dict:
    return ok(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at,
            "last_login_at": user.last_login_at,
        }
    )
