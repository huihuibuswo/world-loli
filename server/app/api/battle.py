from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_player
from app.core.responses import abort, ok
from app.db import get_db
from app.models import Player
from app.schemas import BattleCreateRequest, EndTurnRequest, PlayCardRequest
from app.services.battle_service import (
    battle_data,
    create_battle,
    end_turn,
    get_active_battle,
    get_owned_battle,
    play_card,
    prepare_enemy_turn,
    surrender_battle,
)
from app.services.battle_ai_service import choose_enemy_cards


router = APIRouter(prefix="/battle", tags=["battle"])


@router.post("/create", status_code=201)
def create(
    payload: BattleCreateRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    return ok(battle_data(create_battle(db, player, payload.enemy_id)), "战斗已创建")


@router.get("/current")
def get_current_battle(
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    battle = get_active_battle(db, player.id)
    return ok(battle_data(battle) if battle is not None else None)


@router.get("/{battle_id}")
def get_battle(
    battle_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    return ok(battle_data(get_owned_battle(db, player.id, battle_id)))


@router.post("/{battle_id}/play-card")
def use_card(
    battle_id: int,
    payload: PlayCardRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    battle = play_card(db, player, battle_id, payload.card_id, payload.expected_version)
    return ok(battle_data(battle), "卡牌已使用")


@router.post("/{battle_id}/end-turn")
def finish_turn(
    battle_id: int,
    payload: EndTurnRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    context = prepare_enemy_turn(db, player, battle_id, payload.expected_version)
    decision = choose_enemy_cards(context)
    battle = end_turn(
        db,
        player,
        battle_id,
        payload.expected_version,
        list(decision["card_template_ids"]),
        decision.get("battle_line"),
    )
    return ok(battle_data(battle), "回合已结束")


@router.post("/{battle_id}/surrender")
def surrender(
    battle_id: int,
    payload: EndTurnRequest,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    battle = surrender_battle(db, player, battle_id, payload.expected_version)
    return ok(battle_data(battle), "已退出战斗并按失败结算")


@router.get("/{battle_id}/result")
def get_result(
    battle_id: int,
    player: Player = Depends(get_current_player),
    db: Session = Depends(get_db),
) -> dict:
    battle = get_owned_battle(db, player.id, battle_id)
    if battle.status == "active":
        abort(409, "战斗尚未结束")
    return ok(
        {
            "battle_id": battle.id,
            "result": battle.status,
            "reward": battle.state_json.get("reward", {}),
            "penalty": battle.state_json.get("penalty"),
            "defeat_reason": battle.state_json.get("defeat_reason"),
            "affection_result": battle.state_json.get("affection_result"),
        }
    )
