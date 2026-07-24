from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MapData(Base):
    __tablename__ = "map_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    map_name: Mapped[str] = mapped_column(String(128), unique=True)
    map_type: Mapped[str] = mapped_column(String(32))
    level_limit: Mapped[int] = mapped_column(Integer, default=1)
    resource_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(64))
    avatar_gender: Mapped[str] = mapped_column(String(8), default="female")
    level: Mapped[int] = mapped_column(Integer, default=1)
    exp: Mapped[int] = mapped_column(BigInteger, default=0)
    hp: Mapped[int] = mapped_column(Integer, default=100)
    attack: Mapped[int] = mapped_column(Integer, default=10)
    defense: Mapped[int] = mapped_column(Integer, default=5)
    gold: Mapped[int] = mapped_column(BigInteger, default=0)
    current_map: Mapped[int | None] = mapped_column(ForeignKey("map_data.id", ondelete="SET NULL"))
    position_x: Mapped[float] = mapped_column(Float, default=0)
    position_y: Mapped[float] = mapped_column(Float, default=0)


class CardSpiritTemplate(Base):
    __tablename__ = "card_spirit_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    race: Mapped[str] = mapped_column(String(64))
    rarity: Mapped[str] = mapped_column(String(32))
    type: Mapped[str] = mapped_column(String(32))
    story: Mapped[str] = mapped_column(Text, default="")
    avatar: Mapped[str | None] = mapped_column(Text)
    base_skill: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    awakening_skill: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class PlayerCardSpirit(Base):
    __tablename__ = "player_card_spirits"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    spirit_template_id: Mapped[int] = mapped_column(
        ForeignKey("card_spirit_templates.id", ondelete="RESTRICT")
    )
    level: Mapped[int] = mapped_column(Integer, default=1)
    affection: Mapped[int] = mapped_column(Integer, default=0)
    exp: Mapped[int] = mapped_column(BigInteger, default=0)
    awaken_level: Mapped[int] = mapped_column(Integer, default=0)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlayerCardSpiritFragment(Base):
    __tablename__ = "player_card_spirit_fragments"
    __table_args__ = (
        UniqueConstraint(
            "player_id",
            "spirit_template_id",
            name="uq_player_card_spirit_fragments_player_template",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    spirit_template_id: Mapped[int] = mapped_column(
        ForeignKey("card_spirit_templates.id", ondelete="RESTRICT")
    )
    amount: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CardTemplate(Base):
    __tablename__ = "card_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    type: Mapped[str] = mapped_column(String(32))
    cost: Mapped[int] = mapped_column(Integer, default=0)
    rarity: Mapped[str] = mapped_column(String(32))
    source_spirit_id: Mapped[int | None] = mapped_column(
        ForeignKey("card_spirit_templates.id", ondelete="SET NULL")
    )
    effect_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    upgrade_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class PlayerCard(Base):
    __tablename__ = "player_cards"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    card_template_id: Mapped[int] = mapped_column(
        ForeignKey("card_templates.id", ondelete="RESTRICT")
    )
    level: Mapped[int] = mapped_column(Integer, default=1)
    count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class DeckCard(Base):
    __tablename__ = "deck_cards"

    deck_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    card_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(BigInteger)
    amount: Mapped[int] = mapped_column(Integer, default=1)


class AffectionRecord(Base):
    __tablename__ = "affection_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_card_spirit_id: Mapped[int] = mapped_column(
        ForeignKey("player_card_spirits.id", ondelete="CASCADE"), unique=True
    )
    affection_value: Mapped[int] = mapped_column(Integer, default=0)
    interaction_count: Mapped[int] = mapped_column(Integer, default=0)
    last_interaction_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Inventory(Base):
    __tablename__ = "inventories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    item_id: Mapped[int] = mapped_column(BigInteger)
    item_type: Mapped[str] = mapped_column(String(32))
    amount: Mapped[int] = mapped_column(Integer, default=1)


class PlantTemplate(Base):
    __tablename__ = "plant_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    rarity: Mapped[str] = mapped_column(String(32))
    base_affection: Mapped[int] = mapped_column(Integer)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str | None] = mapped_column(Text)
    respawn_seconds: Mapped[int] = mapped_column(Integer)


class ItemTemplate(Base):
    __tablename__ = "item_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    category: Mapped[str] = mapped_column(String(32))
    rarity: Mapped[str] = mapped_column(String(32))
    base_affection: Mapped[int] = mapped_column(Integer, default=1)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str | None] = mapped_column(Text)
    stack_limit: Mapped[int] = mapped_column(Integer, default=99)


class PlayerPlantNode(Base):
    __tablename__ = "player_plant_nodes"

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    map_id: Mapped[int] = mapped_column(
        ForeignKey("map_data.id", ondelete="CASCADE"), primary_key=True
    )
    node_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plant_template_id: Mapped[int] = mapped_column(
        ForeignKey("plant_templates.id", ondelete="RESTRICT")
    )
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SpiritGiftPreference(Base):
    __tablename__ = "spirit_gift_preferences"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    spirit_template_id: Mapped[int] = mapped_column(
        ForeignKey("card_spirit_templates.id", ondelete="CASCADE")
    )
    plant_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant_templates.id", ondelete="CASCADE")
    )
    tag: Mapped[str | None] = mapped_column(String(32))
    preference: Mapped[str] = mapped_column(String(16))
    dialogue: Mapped[str | None] = mapped_column(Text)


class SpiritGiftRecord(Base):
    __tablename__ = "spirit_gift_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    player_card_spirit_id: Mapped[int] = mapped_column(
        ForeignKey("player_card_spirits.id", ondelete="CASCADE")
    )
    plant_template_id: Mapped[int] = mapped_column(
        ForeignKey("plant_templates.id", ondelete="RESTRICT")
    )
    affection_gained: Mapped[int] = mapped_column(Integer)
    gifted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class NpcTemplate(Base):
    __tablename__ = "npc_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    type: Mapped[str] = mapped_column(String(32))
    story: Mapped[str] = mapped_column(Text, default="")
    battle_deck: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    reward: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    is_card_spirit: Mapped[bool] = mapped_column(Boolean, default=False)


class NpcAiConversation(Base):
    __tablename__ = "npc_ai_conversations"
    __table_args__ = (
        UniqueConstraint("player_id", "npc_id", name="uq_npc_ai_conversations_player_npc"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    npc_id: Mapped[int] = mapped_column(ForeignKey("npc_templates.id", ondelete="CASCADE"))
    summary: Mapped[str] = mapped_column(Text, default="")
    recent_turns: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    last_interacted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlayerNpcAffection(Base):
    __tablename__ = "player_npc_affection"

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    npc_id: Mapped[int] = mapped_column(
        ForeignKey("npc_templates.id", ondelete="CASCADE"), primary_key=True
    )
    points: Mapped[int] = mapped_column(Integer, default=0)
    conversation_count: Mapped[int] = mapped_column(Integer, default=0)
    battle_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlayerNpcAffectionReward(Base):
    __tablename__ = "player_npc_affection_rewards"
    __table_args__ = (
        UniqueConstraint(
            "player_id",
            "npc_id",
            "milestone_level",
            name="uq_player_npc_affection_rewards_milestone",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    npc_id: Mapped[int] = mapped_column(ForeignKey("npc_templates.id", ondelete="CASCADE"))
    milestone_level: Mapped[int] = mapped_column(Integer)
    reward_type: Mapped[str] = mapped_column(String(24))
    card_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("card_templates.id", ondelete="RESTRICT")
    )
    spirit_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("card_spirit_templates.id", ondelete="RESTRICT")
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class NpcGiftRecord(Base):
    __tablename__ = "npc_gift_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    npc_id: Mapped[int] = mapped_column(ForeignKey("npc_templates.id", ondelete="CASCADE"))
    plant_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant_templates.id", ondelete="RESTRICT")
    )
    item_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("item_templates.id", ondelete="RESTRICT")
    )
    preference: Mapped[str] = mapped_column(String(16))
    affection_gained: Mapped[int] = mapped_column(Integer)
    gifted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Quest(Base):
    __tablename__ = "quests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(32))
    reward_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    issuer_npc_id: Mapped[int | None] = mapped_column(
        ForeignKey("npc_templates.id", ondelete="SET NULL")
    )


class NpcShopItem(Base):
    __tablename__ = "npc_shop_items"
    __table_args__ = (
        UniqueConstraint("npc_id", "item_template_id", name="uq_npc_shop_item"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    npc_id: Mapped[int] = mapped_column(ForeignKey("npc_templates.id", ondelete="CASCADE"))
    item_template_id: Mapped[int] = mapped_column(
        ForeignKey("item_templates.id", ondelete="RESTRICT")
    )
    price: Mapped[int] = mapped_column(Integer)
    stock_limit: Mapped[int] = mapped_column(Integer, default=5)
    unlock_level: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class NpcPurchaseRecord(Base):
    __tablename__ = "npc_purchase_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    shop_item_id: Mapped[int] = mapped_column(
        ForeignKey("npc_shop_items.id", ondelete="CASCADE")
    )
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlayerQuest(Base):
    __tablename__ = "player_quests"

    player_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    quest_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    status: Mapped[str] = mapped_column(String(24), default="not_started")
    progress: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class BattleRecord(Base):
    __tablename__ = "battle_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    enemy_id: Mapped[int] = mapped_column(BigInteger)
    result: Mapped[str] = mapped_column(String(24))
    turn_count: Mapped[int] = mapped_column(Integer)
    reward_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NpcFirstVictoryReward(Base):
    __tablename__ = "npc_first_victory_rewards"

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    npc_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    card_template_id: Mapped[int] = mapped_column(
        ForeignKey("card_templates.id", ondelete="RESTRICT")
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ActiveBattle(Base):
    __tablename__ = "active_battles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    enemy_id: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(24), default="active")
    state_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
