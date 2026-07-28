from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr | None = None
    player_name: str | None = Field(default=None, min_length=1, max_length=64)
    avatar_gender: Literal["female", "male"] = "female"


class LoginRequest(BaseModel):
    username: str
    password: str


class PlayerUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class LocationRequest(BaseModel):
    map_id: int = Field(gt=0)
    position_x: float = Field(allow_inf_nan=False)
    position_y: float = Field(allow_inf_nan=False)


class MapEnterRequest(BaseModel):
    map_id: int = Field(gt=0)


class NpcInteractionRequest(BaseModel):
    npc_id: int = Field(gt=0)
    action: str | None = Field(default=None, max_length=64)


class NpcChatRequest(BaseModel):
    request_id: UUID
    message: str = Field(min_length=1, max_length=2000)
    conversation_version: int = Field(default=0, ge=0)


class AiDialogueOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str = Field(min_length=1, max_length=2000)
    suggested_replies: list[str] = Field(min_length=2, max_length=2)


class AiBattleOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card_template_ids: list[int] = Field(default_factory=list, max_length=20)
    battle_line: str | None = Field(default=None, max_length=200)


class SpiritAffectionRequest(BaseModel):
    source: Literal["dialog", "battle", "quest"] = "dialog"


class PlantCollectRequest(BaseModel):
    map_id: int = Field(gt=0)
    node_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class SpiritGiftRequest(BaseModel):
    plant_template_id: int = Field(gt=0)


class NpcGiftRequest(BaseModel):
    plant_template_id: int | None = Field(default=None, gt=0)
    item_template_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_gift_kind(self):
        if (self.plant_template_id is None) == (self.item_template_id is None):
            raise ValueError("植物或杂货礼物必须且只能选择一种")
        return self


class NpcShopPurchaseRequest(BaseModel):
    shop_item_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=99)


class NpcTrainingUpgradeRequest(BaseModel):
    card_id: int = Field(gt=0)
    levels: int = Field(default=1, ge=1, le=10)


class SpiritLevelRequest(BaseModel):
    levels: int = Field(default=1, ge=1, le=10)


class CardUpgradeRequest(BaseModel):
    levels: int = Field(default=1, ge=1, le=10)


class DeckCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    is_active: bool = False


class DeckUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    is_active: bool | None = None


class DeckCardRequest(BaseModel):
    card_id: int = Field(gt=0)
    amount: int = Field(default=1, ge=1, le=99)


class BattleCreateRequest(BaseModel):
    enemy_id: int = Field(gt=0)


class PlayCardRequest(BaseModel):
    card_id: int = Field(gt=0)
    expected_version: int = Field(ge=1)


class EndTurnRequest(BaseModel):
    expected_version: int = Field(ge=1)


class OpeningVillageActionRequest(BaseModel):
    action: Literal["accept_village_preparation"]
    npc_id: int = Field(gt=0)


class OpeningActionRequest(BaseModel):
    action: Literal["accept_stage1", "confirm_guide", "inspect_evidence", "report_stage1"]
    npc_id: int | None = Field(default=None, gt=0)
    evidence_id: str | None = Field(
        default=None,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )


class QuestProgressRequest(BaseModel):
    progress: dict[str, Any] = Field(default_factory=dict)
