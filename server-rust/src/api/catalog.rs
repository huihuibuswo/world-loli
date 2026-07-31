use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};

use crate::{
    api::auth::json_rejection, auth::AuthPlayer, error::AppError, response::ApiResponse, AppState,
};

const FRAGMENT_TARGET: i32 = 30;

#[derive(Debug, FromRow, Serialize)]
pub(crate) struct SpiritData {
    id: i64,
    template_id: i64,
    name: String,
    race: String,
    rarity: String,
    #[serde(rename = "type")]
    spirit_type: String,
    story: String,
    avatar: Option<String>,
    base_skill: Value,
    awakening_skill: Value,
    level: i32,
    exp: i64,
    affection: i32,
    awaken_level: i32,
    interaction_available_at: Option<DateTime<Utc>>,
    acquired_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize)]
pub(crate) struct FragmentData {
    template_id: i64,
    name: String,
    race: String,
    rarity: String,
    #[serde(rename = "type")]
    spirit_type: String,
    story: String,
    avatar: Option<String>,
    fragment_count: i32,
    fragment_target: i32,
    can_compose: bool,
    owned_spirit_id: Option<i64>,
}

#[derive(Debug, FromRow, Serialize)]
pub(crate) struct CardData {
    id: i64,
    template_id: i64,
    name: String,
    #[serde(rename = "type")]
    card_type: String,
    cost: i32,
    rarity: String,
    source_spirit_id: Option<i64>,
    effect: Value,
    upgrade: Value,
    level: i32,
    count: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SpiritAffectionRequest {
    #[serde(default = "default_source")]
    source: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct LevelsRequest {
    #[serde(default = "default_levels")]
    levels: i32,
}

pub(crate) async fn list_spirits(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Vec<SpiritData>>>, AppError> {
    let rows = sqlx::query_as::<_, SpiritData>(spirit_query(false))
        .bind(player.id)
        .fetch_all(state.pool())
        .await?;
    Ok(Json(ApiResponse::ok(rows)))
}

pub(crate) async fn get_spirit(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(spirit_id): Path<String>,
) -> Result<Json<ApiResponse<SpiritData>>, AppError> {
    let spirit_id = parse_path_integer(spirit_id, "spirit_id")?;
    let row = sqlx::query_as::<_, SpiritData>(spirit_query(true))
        .bind(player.id)
        .bind(spirit_id)
        .fetch_optional(state.pool())
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌精灵不存在"))?;
    Ok(Json(ApiResponse::ok(row)))
}

pub(crate) async fn list_spirit_fragments(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Vec<FragmentData>>>, AppError> {
    let rows = sqlx::query_as::<_, FragmentData>(
        r#"SELECT
            template.id AS template_id, template.name, template.race, template.rarity,
            template.type AS spirit_type, template.story, template.avatar,
            fragment.amount AS fragment_count, $2::integer AS fragment_target,
            (owned.id IS NULL AND fragment.amount >= $2) AS can_compose,
            owned.id AS owned_spirit_id
        FROM player_card_spirit_fragments fragment
        JOIN card_spirit_templates template ON template.id = fragment.spirit_template_id
        LEFT JOIN player_card_spirits owned
          ON owned.player_id = $1 AND owned.spirit_template_id = fragment.spirit_template_id
        WHERE fragment.player_id = $1
        ORDER BY template.id"#,
    )
    .bind(player.id)
    .bind(FRAGMENT_TARGET)
    .fetch_all(state.pool())
    .await?;
    Ok(Json(ApiResponse::ok(rows)))
}

pub(crate) async fn get_spirit_growth(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(spirit_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let spirit_id = parse_path_integer(spirit_id, "spirit_id")?;
    #[derive(FromRow)]
    struct Growth {
        level: i32,
        exp: i64,
        affection: i32,
        awaken_level: i32,
    }
    let row = sqlx::query_as::<_, Growth>(
        "SELECT level, exp, affection, awaken_level FROM player_card_spirits WHERE id = $1 AND player_id = $2",
    )
    .bind(spirit_id)
    .bind(player.id)
    .fetch_optional(state.pool())
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌精灵不存在"))?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "level": row.level,
        "exp": row.exp,
        "next_level_exp": i64::from(row.level) * 100,
        "affection": row.affection,
        "awaken_level": row.awaken_level,
    }))))
}

pub(crate) async fn list_cards(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Vec<CardData>>>, AppError> {
    let rows = sqlx::query_as::<_, CardData>(card_query(false))
        .bind(player.id)
        .fetch_all(state.pool())
        .await?;
    Ok(Json(ApiResponse::ok(rows)))
}

pub(crate) async fn get_card(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(card_id): Path<String>,
) -> Result<Json<ApiResponse<CardData>>, AppError> {
    let card_id = parse_path_integer(card_id, "card_id")?;
    let row = sqlx::query_as::<_, CardData>(card_query(true))
        .bind(player.id)
        .bind(card_id)
        .fetch_optional(state.pool())
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌不存在"))?;
    Ok(Json(ApiResponse::ok(row)))
}

pub(crate) async fn get_card_effects(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(card_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let card_id = parse_path_integer(card_id, "card_id")?;
    #[derive(FromRow)]
    struct Effects {
        card_id: i64,
        effect: Value,
        upgrade: Value,
    }
    let row = sqlx::query_as::<_, Effects>(
        r#"SELECT card.id AS card_id, template.effect_json AS effect, template.upgrade_json AS upgrade
           FROM player_cards card
           JOIN card_templates template ON template.id = card.card_template_id
           WHERE card.player_id = $1 AND card.id = $2"#,
    )
    .bind(player.id)
    .bind(card_id)
    .fetch_optional(state.pool())
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌不存在"))?;
    Ok(Json(ApiResponse::ok(serde_json::json!({
        "card_id": row.card_id,
        "effect": row.effect,
        "upgrade": row.upgrade,
    }))))
}

pub(crate) async fn compose_spirit(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(template_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let template_id = parse_path_integer(template_id, "spirit_template_id")?;
    let mut tx = state.pool().begin().await?;
    let fragment = sqlx::query_scalar::<_, i32>("SELECT amount FROM player_card_spirit_fragments WHERE player_id=$1 AND spirit_template_id=$2 FOR UPDATE").bind(player.id).bind(template_id).fetch_optional(&mut *tx).await?;
    let owned = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM player_card_spirits WHERE player_id=$1 AND spirit_template_id=$2",
    )
    .bind(player.id)
    .bind(template_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(spirit_id) = owned {
        let data = json!({"spirit_id":spirit_id,"template_id":template_id,"fragment_count":fragment.unwrap_or(0),"fragment_target":FRAGMENT_TARGET,"composed":false});
        tx.commit().await?;
        return Ok(Json(ApiResponse::with_message(data, "已拥有该卡灵")));
    }
    let amount = fragment.unwrap_or(0);
    if amount < FRAGMENT_TARGET {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            format!("卡灵碎片不足，需要集齐 {FRAGMENT_TARGET} 枚"),
        ));
    }
    let inserted=sqlx::query_scalar::<_,i64>("INSERT INTO player_card_spirits (player_id,spirit_template_id) VALUES ($1,$2) ON CONFLICT (player_id,spirit_template_id) DO NOTHING RETURNING id").bind(player.id).bind(template_id).fetch_optional(&mut *tx).await?;
    let spirit_id = if let Some(spirit_id) = inserted {
        spirit_id
    } else {
        let owned = sqlx::query_scalar::<_, i64>(
            "SELECT id FROM player_card_spirits WHERE player_id=$1 AND spirit_template_id=$2",
        )
        .bind(player.id)
        .bind(template_id)
        .fetch_optional(&mut *tx)
        .await?;
        let spirit_id = owned.ok_or_else(|| {
            AppError::new(StatusCode::CONFLICT, "卡灵合成状态已变化，请刷新后重试")
        })?;
        let data = json!({"spirit_id":spirit_id,"template_id":template_id,"fragment_count":amount,"fragment_target":FRAGMENT_TARGET,"composed":false});
        tx.commit().await?;
        return Ok(Json(ApiResponse::with_message(data, "已拥有该卡灵")));
    };
    sqlx::query("UPDATE player_card_spirit_fragments SET amount=amount-$1,updated_at=NOW() WHERE player_id=$2 AND spirit_template_id=$3").bind(FRAGMENT_TARGET).bind(player.id).bind(template_id).execute(&mut *tx).await?;
    let data = json!({"spirit_id":spirit_id,"template_id":template_id,"fragment_count":amount-FRAGMENT_TARGET,"fragment_target":FRAGMENT_TARGET,"composed":true});
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "卡灵合成成功")))
}

pub(crate) async fn add_affection(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(spirit_id): Path<String>,
    payload: Result<Json<SpiritAffectionRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<SpiritData>>, AppError> {
    let spirit_id = parse_path_integer(spirit_id, "spirit_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    let points = match payload.source.as_str() {
        "dialog" => 1,
        "battle" => 2,
        "quest" => 5,
        _ => {
            return Err(AppError::validation_field(
                "source",
                "literal_error",
                "Input should be 'dialog', 'battle' or 'quest'",
                json!(payload.source),
            ))
        }
    };
    let mut tx = state.pool().begin().await?;
    let affection = sqlx::query_scalar::<_, i32>(
        "SELECT affection FROM player_card_spirits WHERE id=$1 AND player_id=$2 FOR UPDATE",
    )
    .bind(spirit_id)
    .bind(player.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌精灵不存在"))?;
    if affection >= 100 {
        return Err(AppError::new(StatusCode::CONFLICT, "羁绊已达到上限"));
    }
    let last = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
        "SELECT last_interaction_time FROM affection_records WHERE player_card_spirit_id=$1",
    )
    .bind(spirit_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    if last.is_some_and(|value| Utc::now().signed_duration_since(value).num_seconds() < 60) {
        return Err(AppError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "互动过于频繁，请稍后再试",
        ));
    }
    let next = (affection + points).min(100);
    sqlx::query("UPDATE player_card_spirits SET affection=$1 WHERE id=$2")
        .bind(next)
        .bind(spirit_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO affection_records (player_card_spirit_id,affection_value,interaction_count,last_interaction_time) VALUES ($1,$2,1,NOW()) ON CONFLICT (player_card_spirit_id) DO UPDATE SET affection_value=$2,interaction_count=affection_records.interaction_count+1,last_interaction_time=NOW()").bind(spirit_id).bind(next).execute(&mut *tx).await?;
    let data = spirit_data_tx(&mut tx, player.id, spirit_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "好感度已提升")))
}

pub(crate) async fn level_spirit(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(spirit_id): Path<String>,
    payload: Result<Json<LevelsRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<SpiritData>>, AppError> {
    let spirit_id = parse_path_integer(spirit_id, "spirit_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_levels(payload.levels)?;
    let mut tx = state.pool().begin().await?;
    let row = sqlx::query_as::<_, (i32, i64)>(
        "SELECT level,exp FROM player_card_spirits WHERE id=$1 AND player_id=$2 FOR UPDATE",
    )
    .bind(spirit_id)
    .bind(player.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌精灵不存在"))?;
    let cost: i64 = (row.0..row.0 + payload.levels)
        .map(|level| i64::from(level) * 100)
        .sum();
    if row.1 < cost {
        return Err(AppError::new(StatusCode::CONFLICT, "卡牌精灵经验不足"));
    }
    sqlx::query("UPDATE player_card_spirits SET level=level+$1,exp=exp-$2 WHERE id=$3")
        .bind(payload.levels)
        .bind(cost)
        .bind(spirit_id)
        .execute(&mut *tx)
        .await?;
    let data = spirit_data_tx(&mut tx, player.id, spirit_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "卡牌精灵已升级")))
}

pub(crate) async fn upgrade_card(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(card_id): Path<String>,
    payload: Result<Json<LevelsRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<CardData>>, AppError> {
    let card_id = parse_path_integer(card_id, "card_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_levels(payload.levels)?;
    let mut tx = state.pool().begin().await?;
    let gold = sqlx::query_scalar::<_, i64>("SELECT gold FROM players WHERE id=$1 FOR UPDATE")
        .bind(player.id)
        .fetch_one(&mut *tx)
        .await?;
    let row=sqlx::query_as::<_,(i32,Value)>("SELECT card.level,template.upgrade_json FROM player_cards card JOIN card_templates template ON template.id=card.card_template_id WHERE card.id=$1 AND card.player_id=$2 FOR UPDATE OF card").bind(card_id).bind(player.id).fetch_optional(&mut *tx).await?.ok_or_else(||AppError::new(StatusCode::NOT_FOUND,"卡牌不存在"))?;
    if !["damage_per_level", "shield_per_level"].iter().any(|key| {
        row.1
            .get(key)
            .and_then(Value::as_i64)
            .is_some_and(|value| value > 0)
    }) {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "该卡牌当前没有可提升的效果",
        ));
    }
    let cost: i64 = (row.0..row.0 + payload.levels)
        .map(|level| i64::from(level) * 100)
        .sum();
    if gold < cost {
        return Err(AppError::new(StatusCode::CONFLICT, "金币不足"));
    }
    sqlx::query("UPDATE players SET gold=gold-$1 WHERE id=$2")
        .bind(cost)
        .bind(player.id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE player_cards SET level=level+$1 WHERE id=$2")
        .bind(payload.levels)
        .bind(card_id)
        .execute(&mut *tx)
        .await?;
    let data = card_data_tx(&mut tx, player.id, card_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "卡牌已升级")))
}

async fn spirit_data_tx(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    spirit_id: i64,
) -> Result<SpiritData, AppError> {
    sqlx::query_as::<_, SpiritData>(spirit_query(true))
        .bind(player_id)
        .bind(spirit_id)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::from)
}
async fn card_data_tx(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    card_id: i64,
) -> Result<CardData, AppError> {
    sqlx::query_as::<_, CardData>(card_query(true))
        .bind(player_id)
        .bind(card_id)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::from)
}
fn validate_levels(levels: i32) -> Result<(), AppError> {
    if levels < 1 {
        Err(AppError::validation_field(
            "levels",
            "greater_than_equal",
            "Input should be greater than or equal to 1",
            json!(levels),
        ))
    } else if levels > 10 {
        Err(AppError::validation_field(
            "levels",
            "less_than_equal",
            "Input should be less than or equal to 10",
            json!(levels),
        ))
    } else {
        Ok(())
    }
}
fn default_levels() -> i32 {
    1
}
fn default_source() -> String {
    "dialog".to_owned()
}

fn spirit_query(single: bool) -> &'static str {
    if single {
        r#"SELECT
            spirit.id, template.id AS template_id, template.name, template.race,
            template.rarity, template.type AS spirit_type, template.story, template.avatar,
            template.base_skill, template.awakening_skill, spirit.level, spirit.exp,
            spirit.affection, spirit.awaken_level,
            affection.last_interaction_time + INTERVAL '60 seconds' AS interaction_available_at,
            spirit.acquired_at
        FROM player_card_spirits spirit
        JOIN card_spirit_templates template ON template.id = spirit.spirit_template_id
        LEFT JOIN affection_records affection ON affection.player_card_spirit_id = spirit.id
        WHERE spirit.player_id = $1 AND spirit.id = $2"#
    } else {
        r#"SELECT
            spirit.id, template.id AS template_id, template.name, template.race,
            template.rarity, template.type AS spirit_type, template.story, template.avatar,
            template.base_skill, template.awakening_skill, spirit.level, spirit.exp,
            spirit.affection, spirit.awaken_level,
            affection.last_interaction_time + INTERVAL '60 seconds' AS interaction_available_at,
            spirit.acquired_at
        FROM player_card_spirits spirit
        JOIN card_spirit_templates template ON template.id = spirit.spirit_template_id
        LEFT JOIN affection_records affection ON affection.player_card_spirit_id = spirit.id
        WHERE spirit.player_id = $1
        ORDER BY spirit.id"#
    }
}

fn card_query(single: bool) -> &'static str {
    if single {
        r#"SELECT
            card.id, template.id AS template_id, template.name, template.type AS card_type,
            template.cost, template.rarity, template.source_spirit_id,
            template.effect_json AS effect, template.upgrade_json AS upgrade,
            card.level, card.count, card.created_at
        FROM player_cards card
        JOIN card_templates template ON template.id = card.card_template_id
        WHERE card.player_id = $1 AND card.id = $2"#
    } else {
        r#"SELECT
            card.id, template.id AS template_id, template.name, template.type AS card_type,
            template.cost, template.rarity, template.source_spirit_id,
            template.effect_json AS effect, template.upgrade_json AS upgrade,
            card.level, card.count, card.created_at
        FROM player_cards card
        JOIN card_templates template ON template.id = card.card_template_id
        WHERE card.player_id = $1
        ORDER BY card.id"#
    }
}

fn parse_path_integer(value: String, field: &str) -> Result<i64, AppError> {
    value
        .parse()
        .map_err(|_| AppError::validation_path_integer(field, value))
}
