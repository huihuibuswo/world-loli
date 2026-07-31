use std::{cmp::Ordering, collections::HashMap};

use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::StatusCode,
    Json,
};
use rand::Rng;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, Postgres, Row, Transaction};

use crate::{
    ai::maximal_legal_sequence,
    api::{auth::json_rejection, opening, plants::record_quest_objective},
    auth::AuthPlayer,
    error::AppError,
    response::ApiResponse,
    AppState,
};

const MAX_EFFECT_VALUE: i64 = 1_000_000;
const MAX_ENEMY_DECK_SIZE: usize = 60;
const DEFEAT_GOLD_PENALTY: i64 = 30;
const FRAGMENT_TARGET: i32 = 30;

#[derive(Debug, Deserialize)]
pub(crate) struct BattleCreateRequest {
    enemy_id: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct NpcBattleRequest {
    npc_id: i64,
    #[allow(dead_code)]
    action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct PlayCardRequest {
    card_id: i64,
    expected_version: i32,
}

#[derive(Debug, Deserialize)]
pub(crate) struct EndTurnRequest {
    expected_version: i32,
}

#[derive(Debug, FromRow, Clone)]
struct BattleRow {
    id: i64,
    enemy_id: i64,
    status: String,
    state_json: Value,
    version: i32,
}

#[derive(Debug, FromRow, Clone)]
struct EnemyRow {
    id: i64,
    name: String,
    battle_deck: Value,
    reward: Value,
}

#[derive(Debug, FromRow, Clone)]
struct CardTemplateRow {
    id: i64,
    name: String,
    card_type: String,
    cost: i32,
    source_spirit_id: Option<i64>,
    effect_json: Value,
    upgrade_json: Value,
}

#[derive(Debug, Clone, Copy)]
struct PlayerCombat {
    hp: i32,
    defense: i32,
    gold: i64,
}

#[derive(Debug, Clone)]
struct EnemyDecision {
    card_template_ids: Vec<i64>,
    battle_line: Option<String>,
}

#[derive(Debug, Clone)]
struct EnemyTurnContext {
    enemy_id: i64,
    enemy_name: String,
    battle_enabled: bool,
    battle_style: String,
    state: Value,
    candidates: Vec<Value>,
    fallback: Vec<i64>,
}

pub(crate) async fn npc_battle(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<NpcBattleRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_positive(payload.npc_id, "npc_id")?;
    if payload
        .action
        .as_ref()
        .is_some_and(|value| value.chars().count() > 64)
    {
        return Err(AppError::validation_field(
            "action",
            "string_too_long",
            "String should have at most 64 characters",
            json!(payload.action),
        ));
    }
    create_battle_inner(&state, player.id, payload.npc_id).await
}

pub(crate) async fn create_battle(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<BattleCreateRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_positive(payload.enemy_id, "enemy_id")?;
    create_battle_inner(&state, player.id, payload.enemy_id).await
}

async fn create_battle_inner(
    state: &AppState,
    player_id: i64,
    enemy_id: i64,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), AppError> {
    let mut tx = state.pool().begin().await?;
    let player = lock_player(&mut tx, player_id).await?;
    if sqlx::query_scalar::<_, i64>(
        "SELECT id FROM active_battles WHERE player_id=$1 AND status='active' LIMIT 1",
    )
    .bind(player_id)
    .fetch_optional(&mut *tx)
    .await?
    .is_some()
    {
        return Err(AppError::new(StatusCode::CONFLICT, "已有进行中的战斗"));
    }
    let enemy = load_enemy(&mut tx, enemy_id)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "敌人不存在"))?;
    opening::validate_story_battle(&mut tx, player_id, &enemy.name, &enemy.reward).await?;
    let (enemy_config, enemy_deck, _) = validated_enemy_deck(&mut tx, &enemy).await?;
    let active_deck_id =
        sqlx::query_scalar::<_, i64>("SELECT id FROM decks WHERE player_id=$1 AND is_active=TRUE")
            .bind(player_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(|| AppError::new(StatusCode::CONFLICT, "请先设置一副启用套牌"))?;
    let rows = sqlx::query(
        r#"SELECT deck_card.card_id, deck_card.amount, template.source_spirit_id
           FROM deck_cards AS deck_card
           JOIN player_cards AS card ON card.id=deck_card.card_id
           JOIN card_templates AS template ON template.id=card.card_template_id
           WHERE deck_card.deck_id=$1 AND deck_card.player_id=$2
           ORDER BY deck_card.card_id"#,
    )
    .bind(active_deck_id)
    .bind(player_id)
    .fetch_all(&mut *tx)
    .await?;
    let mut draw_pile = Vec::new();
    let mut spirit_template_ids = Vec::new();
    for row in rows {
        let card_id: i64 = row.get("card_id");
        let amount: i32 = row.get("amount");
        draw_pile.extend(std::iter::repeat_n(card_id, amount.max(0) as usize));
        if let Some(template_id) = row.get::<Option<i64>, _>("source_spirit_id") {
            if !spirit_template_ids.contains(&template_id) {
                spirit_template_ids.push(template_id);
            }
        }
    }
    if draw_pile.is_empty() {
        return Err(AppError::new(StatusCode::CONFLICT, "启用套牌中没有卡牌"));
    }
    spirit_template_ids.sort_unstable();
    let enemy_hp = bounded_int_default(enemy_config.get("hp"), 30, 1, MAX_EFFECT_VALUE);
    let enemy_energy = bounded_int_default(enemy_config.get("energy"), 3, 1, 20);
    let enemy_hand_size = bounded_int_default(enemy_config.get("hand_size"), 5, 1, 20);
    let seed = rand::thread_rng().gen_range(0..=i64::MAX) as u64;
    let mut state = json!({
        "battle_seed": seed,
        "player_shuffle_count": 0,
        "enemy_shuffle_count": 0,
        "current_turn": 1,
        "energy": 3,
        "player_state": {"hp":player.hp,"max_hp":player.hp,"shield":0},
        "enemy_state": {
            "name":enemy.name,
            "sprite":enemy.reward.get("sprite").and_then(Value::as_str).unwrap_or("npc-trainer"),
            "hp":enemy_hp,"max_hp":enemy_hp,"shield":0
        },
        "hand_cards": [],
        "draw_pile": draw_pile,
        "discard_cards": [],
        "enemy_energy": enemy_energy,
        "enemy_max_energy": enemy_energy,
        "enemy_hand_size": enemy_hand_size,
        "enemy_hand_cards": [],
        "enemy_draw_pile": enemy_deck,
        "enemy_discard_cards": [],
        "buffs": [],
        "debuffs": [],
        "spirit_template_ids": spirit_template_ids,
    });
    if let Some(intro) = opening::opening_battle_intro(&enemy.name, &enemy.reward) {
        state["story_intro"] = intro;
    }
    shuffle_pile(&mut state, "draw_pile", "player");
    shuffle_pile(&mut state, "enemy_draw_pile", "enemy");
    draw_to_hand(&mut state);
    draw_enemy_to_hand(&mut state);
    let battle = sqlx::query_as::<_, BattleRow>(
        r#"INSERT INTO active_battles (player_id,enemy_id,state_json)
           VALUES ($1,$2,$3) RETURNING id,enemy_id,status,state_json,version"#,
    )
    .bind(player_id)
    .bind(enemy.id)
    .bind(state)
    .fetch_one(&mut *tx)
    .await?;
    let data = battle_data(&battle);
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::with_message(data, "战斗已创建")),
    ))
}

pub(crate) async fn current_battle(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let battle = sqlx::query_as::<_, BattleRow>(
        "SELECT id,enemy_id,status,state_json,version FROM active_battles WHERE player_id=$1 AND status='active' LIMIT 1",
    )
    .bind(player.id)
    .fetch_optional(state.pool())
    .await?;
    Ok(Json(ApiResponse::ok(
        battle.as_ref().map(battle_data).unwrap_or(Value::Null),
    )))
}

pub(crate) async fn get_battle(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(battle_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let battle_id = parse_path_integer(battle_id, "battle_id")?;
    let battle = owned_battle_pool(state.pool(), player.id, battle_id).await?;
    Ok(Json(ApiResponse::ok(battle_data(&battle))))
}

pub(crate) async fn battle_result(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(battle_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let battle_id = parse_path_integer(battle_id, "battle_id")?;
    let battle = owned_battle_pool(state.pool(), player.id, battle_id).await?;
    if battle.status == "active" {
        return Err(AppError::new(StatusCode::CONFLICT, "战斗尚未结束"));
    }
    Ok(Json(ApiResponse::ok(json!({
        "battle_id":battle.id,
        "result":battle.status,
        "reward":battle.state_json.get("reward").cloned().unwrap_or_else(||json!({})),
        "penalty":battle.state_json.get("penalty").cloned().unwrap_or(Value::Null),
        "defeat_reason":battle.state_json.get("defeat_reason").cloned().unwrap_or(Value::Null),
        "affection_result":battle.state_json.get("affection_result").cloned().unwrap_or(Value::Null),
    }))))
}

pub(crate) async fn play_card(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(battle_id): Path<String>,
    payload: Result<Json<PlayCardRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let battle_id = parse_path_integer(battle_id, "battle_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_positive(payload.card_id, "card_id")?;
    validate_version(payload.expected_version)?;
    let mut tx = state.pool().begin().await?;
    let player_data = lock_player(&mut tx, player.id).await?;
    let mut battle = lock_owned_battle(&mut tx, player.id, battle_id).await?;
    check_active_version(&battle, payload.expected_version)?;
    let mut state_json = battle.state_json.clone();
    let hand = int_array(&state_json, "hand_cards");
    if !hand.contains(&payload.card_id) {
        return Err(AppError::new(StatusCode::CONFLICT, "该卡牌不在当前手牌中"));
    }
    let row = sqlx::query(
        r#"SELECT card.level, spirit.affection, template.id, template.name,
                  template.type AS card_type, template.cost, template.source_spirit_id,
                  template.effect_json, template.upgrade_json
           FROM player_cards AS card
           JOIN card_templates AS template ON template.id=card.card_template_id
           LEFT JOIN player_card_spirits AS spirit
             ON spirit.player_id=card.player_id AND spirit.spirit_template_id=template.source_spirit_id
           WHERE card.id=$1 AND card.player_id=$2"#,
    )
    .bind(payload.card_id)
    .bind(player.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌不存在"))?;
    let template = CardTemplateRow {
        id: row.get("id"),
        name: row.get("name"),
        card_type: row.get("card_type"),
        cost: row.get("cost"),
        source_spirit_id: row.get("source_spirit_id"),
        effect_json: row.get("effect_json"),
        upgrade_json: row.get("upgrade_json"),
    };
    let energy = state_int(&state_json, "energy");
    if energy < i64::from(template.cost) {
        return Err(AppError::new(StatusCode::CONFLICT, "能量不足"));
    }
    let level: i32 = row.get("level");
    let mut damage = bounded_int(template.effect_json.get("damage"), 0, MAX_EFFECT_VALUE)
        + i64::from(level - 1).max(0)
            * bounded_int(template.upgrade_json.get("damage_per_level"), 0, 100_000);
    let shield = bounded_int(template.effect_json.get("shield"), 0, MAX_EFFECT_VALUE)
        + i64::from(level - 1).max(0)
            * bounded_int(template.upgrade_json.get("shield_per_level"), 0, 100_000);
    if template.source_spirit_id.is_some() {
        if let Some(affection) = row.get::<Option<i32>, _>("affection") {
            damage = damage_with_affection(damage, affection);
        }
    }
    let resolved = apply_card_effect(
        &mut state_json,
        &template,
        "player",
        Some(damage),
        Some(shield),
        player_data.defense,
    );
    set_state_int(&mut state_json, "energy", energy - i64::from(template.cost));
    remove_first(&mut state_json, "hand_cards", payload.card_id);
    push_int(&mut state_json, "discard_cards", payload.card_id);
    state_json["last_action"] = json!({
        "type":"play_card","card_id":payload.card_id,"card_template_id":template.id,
        "card_name":template.name,"damage":resolved.damage,"blocked":resolved.blocked,"shield":resolved.shield,
    });
    battle.version += 1;
    if nested_int(&state_json, "enemy_state", "hp") == 0 {
        complete_battle(
            &mut tx,
            player.id,
            player_data,
            &mut battle,
            &mut state_json,
            "victory",
            None,
        )
        .await?;
    }
    persist_battle(&mut tx, &battle, &state_json).await?;
    battle.state_json = state_json;
    let data = battle_data(&battle);
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "卡牌已使用")))
}

pub(crate) async fn end_turn(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(battle_id): Path<String>,
    payload: Result<Json<EndTurnRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let battle_id = parse_path_integer(battle_id, "battle_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_version(payload.expected_version)?;
    let mut snapshot_tx = state.pool().begin().await?;
    let mut snapshot = owned_battle_tx(&mut snapshot_tx, player.id, battle_id).await?;
    check_active_version(&snapshot, payload.expected_version)?;
    let enemy = load_enemy(&mut snapshot_tx, snapshot.enemy_id)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "敌人不存在"))?;
    let (_, _, templates) =
        ensure_enemy_deck_state(&mut snapshot_tx, &enemy, &mut snapshot.state_json).await?;
    let context = enemy_turn_context(&enemy, &snapshot.state_json, &templates);
    snapshot_tx.commit().await?;

    let ai_decision = choose_enemy_cards(&state, &context).await;

    let mut tx = state.pool().begin().await?;
    let player_data = lock_player(&mut tx, player.id).await?;
    let mut battle = lock_owned_battle(&mut tx, player.id, battle_id).await?;
    check_active_version(&battle, payload.expected_version)?;
    let enemy = load_enemy(&mut tx, battle.enemy_id)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "敌人不存在"))?;
    let (_, _, templates) =
        ensure_enemy_deck_state(&mut tx, &enemy, &mut battle.state_json).await?;
    let mut state_json = battle.state_json.clone();
    let max_energy = state_int(&state_json, "enemy_max_energy");
    set_state_int(&mut state_json, "enemy_energy", max_energy);
    let fallback = deterministic_enemy_sequence(
        &int_array(&state_json, "enemy_hand_cards"),
        max_energy,
        &templates,
        &state_json,
        enemy.battle_deck.get("action_weights"),
    );
    let candidates = enemy_candidates(&state_json, &templates);
    let decision = ai_decision
        .filter(|value| maximal_legal_sequence(&value.card_template_ids, &candidates, max_energy))
        .unwrap_or(EnemyDecision {
            card_template_ids: fallback,
            battle_line: None,
        });
    let mut actions = Vec::new();
    for template_id in decision.card_template_ids {
        let Some(template) = templates.get(&template_id) else {
            continue;
        };
        let energy = state_int(&state_json, "enemy_energy");
        if !int_array(&state_json, "enemy_hand_cards").contains(&template_id)
            || i64::from(template.cost) > energy
        {
            break;
        }
        set_state_int(
            &mut state_json,
            "enemy_energy",
            energy - i64::from(template.cost),
        );
        remove_first(&mut state_json, "enemy_hand_cards", template_id);
        push_int(&mut state_json, "enemy_discard_cards", template_id);
        let resolved = apply_card_effect(
            &mut state_json,
            template,
            "enemy",
            None,
            None,
            player_data.defense,
        );
        actions.push(json!({
            "card_template_id":template.id,"name":template.name,"type":template.card_type,
            "cost":template.cost,"damage":resolved.damage,"blocked":resolved.blocked,"shield":resolved.shield,
        }));
        if nested_int(&state_json, "player_state", "hp") == 0 {
            break;
        }
    }
    let damage: i64 = actions
        .iter()
        .filter_map(|v| v.get("damage")?.as_i64())
        .sum();
    let blocked: i64 = actions
        .iter()
        .filter_map(|v| v.get("blocked")?.as_i64())
        .sum();
    let shield: i64 = actions
        .iter()
        .filter_map(|v| v.get("shield")?.as_i64())
        .sum();
    state_json["last_action"] = json!({
        "type":"enemy_cards","cards":actions,"damage":damage,"blocked":blocked,
        "shield":shield,"battle_line":decision.battle_line,
    });
    battle.version += 1;
    if nested_int(&state_json, "player_state", "hp") == 0 {
        complete_battle(
            &mut tx,
            player.id,
            player_data,
            &mut battle,
            &mut state_json,
            "defeat",
            Some("knockout"),
        )
        .await?;
    } else {
        let next_turn = state_int(&state_json, "current_turn") + 1;
        set_state_int(&mut state_json, "current_turn", next_turn);
        set_state_int(&mut state_json, "energy", 3);
        draw_to_hand(&mut state_json);
        draw_enemy_to_hand(&mut state_json);
    }
    persist_battle(&mut tx, &battle, &state_json).await?;
    battle.state_json = state_json;
    let data = battle_data(&battle);
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "回合已结束")))
}

pub(crate) async fn surrender(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(battle_id): Path<String>,
    payload: Result<Json<EndTurnRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let battle_id = parse_path_integer(battle_id, "battle_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_version(payload.expected_version)?;
    let mut tx = state.pool().begin().await?;
    let player_data = lock_player(&mut tx, player.id).await?;
    let mut battle = lock_owned_battle(&mut tx, player.id, battle_id).await?;
    check_active_version(&battle, payload.expected_version)?;
    let mut state_json = battle.state_json.clone();
    state_json["last_action"] = json!({"type":"surrender"});
    battle.version += 1;
    complete_battle(
        &mut tx,
        player.id,
        player_data,
        &mut battle,
        &mut state_json,
        "defeat",
        Some("surrender"),
    )
    .await?;
    persist_battle(&mut tx, &battle, &state_json).await?;
    battle.state_json = state_json;
    let data = battle_data(&battle);
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(
        data,
        "已退出战斗并按失败结算",
    )))
}

async fn lock_player(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<PlayerCombat, AppError> {
    let row = sqlx::query("SELECT hp,defense,gold FROM players WHERE id=$1 FOR UPDATE")
        .bind(player_id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(PlayerCombat {
        hp: row.get("hp"),
        defense: row.get("defense"),
        gold: row.get("gold"),
    })
}

async fn load_enemy(
    tx: &mut Transaction<'_, Postgres>,
    enemy_id: i64,
) -> Result<Option<EnemyRow>, AppError> {
    Ok(sqlx::query_as::<_, EnemyRow>(
        "SELECT id,name,battle_deck,reward FROM npc_templates WHERE id=$1",
    )
    .bind(enemy_id)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn owned_battle_pool(
    pool: &sqlx::PgPool,
    player_id: i64,
    battle_id: i64,
) -> Result<BattleRow, AppError> {
    sqlx::query_as::<_, BattleRow>(
        "SELECT id,enemy_id,status,state_json,version FROM active_battles WHERE id=$1 AND player_id=$2",
    )
    .bind(battle_id)
    .bind(player_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "战斗不存在"))
}

async fn owned_battle_tx(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    battle_id: i64,
) -> Result<BattleRow, AppError> {
    sqlx::query_as::<_, BattleRow>(
        "SELECT id,enemy_id,status,state_json,version FROM active_battles WHERE id=$1 AND player_id=$2",
    )
    .bind(battle_id)
    .bind(player_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "战斗不存在"))
}

async fn lock_owned_battle(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    battle_id: i64,
) -> Result<BattleRow, AppError> {
    sqlx::query_as::<_, BattleRow>(
        "SELECT id,enemy_id,status,state_json,version FROM active_battles WHERE id=$1 AND player_id=$2 FOR UPDATE",
    )
    .bind(battle_id)
    .bind(player_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "战斗不存在"))
}

async fn persist_battle(
    tx: &mut Transaction<'_, Postgres>,
    battle: &BattleRow,
    state: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE active_battles SET status=$1,state_json=$2,version=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4",
    )
    .bind(&battle.status)
    .bind(state)
    .bind(battle.version)
    .bind(battle.id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn check_active_version(battle: &BattleRow, expected_version: i32) -> Result<(), AppError> {
    if battle.status != "active" {
        return Err(AppError::new(StatusCode::CONFLICT, "战斗已经结束"));
    }
    if battle.version != expected_version {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "战斗状态已更新，请刷新后重试",
        ));
    }
    Ok(())
}

async fn validated_enemy_deck(
    tx: &mut Transaction<'_, Postgres>,
    enemy: &EnemyRow,
) -> Result<(Value, Vec<i64>, HashMap<i64, CardTemplateRow>), AppError> {
    let rows = enemy
        .battle_deck
        .get("cards")
        .and_then(Value::as_array)
        .filter(|rows| !rows.is_empty())
        .ok_or_else(|| {
            AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的敌方卡组未配置", enemy.name),
            )
        })?;
    let mut expanded = Vec::new();
    for row in rows {
        if !row.is_object() {
            return Err(AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的敌方卡组格式无效", enemy.name),
            ));
        }
        let template_id = row.get("card_template_id").and_then(Value::as_i64);
        let amount = row.get("amount").and_then(Value::as_i64);
        if template_id.is_none_or(|value| value <= 0)
            || amount.is_none_or(|value| !(1..=20).contains(&value))
        {
            return Err(AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的敌方卡组数量或卡牌引用无效", enemy.name),
            ));
        }
        expanded.extend(std::iter::repeat_n(
            template_id.expect("validated"),
            amount.expect("validated") as usize,
        ));
    }
    if expanded.len() > MAX_ENEMY_DECK_SIZE {
        return Err(AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{} 的敌方卡组超过 {MAX_ENEMY_DECK_SIZE} 张上限", enemy.name),
        ));
    }
    let mut unique = expanded.clone();
    unique.sort_unstable();
    unique.dedup();
    let templates = sqlx::query_as::<_, CardTemplateRow>(
        r#"SELECT id,name,type AS card_type,cost,source_spirit_id,effect_json,upgrade_json
           FROM card_templates WHERE id=ANY($1::bigint[])"#,
    )
    .bind(&unique)
    .fetch_all(&mut **tx)
    .await?;
    if templates.len() != unique.len() {
        return Err(AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{} 的敌方卡组引用了不存在的卡牌", enemy.name),
        ));
    }
    if !templates
        .iter()
        .any(|template| template.source_spirit_id.is_some())
    {
        return Err(AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{} 的敌方卡组缺少角色签名卡", enemy.name),
        ));
    }
    for template in &templates {
        let effect = template.effect_json.as_object();
        let supported = effect.is_some_and(|effect| {
            !effect.is_empty()
                && effect
                    .keys()
                    .all(|key| matches!(key.as_str(), "damage" | "shield"))
                && ["damage", "shield"]
                    .iter()
                    .any(|key| bounded_int(template.effect_json.get(*key), 0, MAX_EFFECT_VALUE) > 0)
        });
        if !supported {
            return Err(AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的卡牌「{}」包含未支持的效果", enemy.name, template.name),
            ));
        }
        if template.cost < 0 || i64::from(template.cost) > MAX_EFFECT_VALUE {
            return Err(AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的卡牌「{}」费用无效", enemy.name, template.name),
            ));
        }
    }
    Ok((
        enemy.battle_deck.clone(),
        expanded,
        templates.into_iter().map(|item| (item.id, item)).collect(),
    ))
}

async fn ensure_enemy_deck_state(
    tx: &mut Transaction<'_, Postgres>,
    enemy: &EnemyRow,
    state: &mut Value,
) -> Result<(Value, Vec<i64>, HashMap<i64, CardTemplateRow>), AppError> {
    let (config, expanded, templates) = validated_enemy_deck(tx, enemy).await?;
    let runtime_valid = ["enemy_hand_cards", "enemy_draw_pile", "enemy_discard_cards"]
        .iter()
        .all(|key| state.get(*key).is_some_and(Value::is_array));
    if !runtime_valid {
        state["enemy_hand_cards"] = json!([]);
        state["enemy_draw_pile"] = json!(expanded);
        state["enemy_discard_cards"] = json!([]);
    } else {
        let mut runtime = Vec::new();
        for key in ["enemy_hand_cards", "enemy_draw_pile", "enemy_discard_cards"] {
            runtime.extend(int_array(state, key));
        }
        let mut expected = expanded.clone();
        runtime.sort_unstable();
        expected.sort_unstable();
        if runtime != expected {
            return Err(AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的敌方卡组运行状态无效", enemy.name),
            ));
        }
    }
    let max_energy = bounded_int_default(config.get("energy"), 3, 1, 20);
    set_state_int(state, "enemy_max_energy", max_energy);
    set_state_int(
        state,
        "enemy_hand_size",
        bounded_int_default(config.get("hand_size"), 5, 1, 20),
    );
    let current = state
        .get("enemy_energy")
        .map_or(max_energy, |value| bounded_int(Some(value), 0, max_energy));
    set_state_int(state, "enemy_energy", current);
    ensure_nested_int(state, "player_state", "shield", 0);
    ensure_nested_int(state, "enemy_state", "shield", 0);
    draw_enemy_to_hand(state);
    Ok((config, expanded, templates))
}

#[derive(Debug, Clone, Copy)]
struct ResolvedEffect {
    damage: i64,
    blocked: i64,
    shield: i64,
}

fn apply_card_effect(
    state: &mut Value,
    template: &CardTemplateRow,
    actor: &str,
    damage: Option<i64>,
    shield: Option<i64>,
    player_defense: i32,
) -> ResolvedEffect {
    let mut damage = damage
        .unwrap_or_else(|| bounded_int(template.effect_json.get("damage"), 0, MAX_EFFECT_VALUE));
    let shield = shield
        .unwrap_or_else(|| bounded_int(template.effect_json.get("shield"), 0, MAX_EFFECT_VALUE));
    if actor == "enemy" && damage > 0 {
        damage = (damage - i64::from(player_defense.max(0)) / 2).max(1);
    }
    let (source, target) = if actor == "player" {
        ("player_state", "enemy_state")
    } else {
        ("enemy_state", "player_state")
    };
    let target_shield = nested_int(state, target, "shield");
    let blocked = target_shield.min(damage);
    let dealt = damage - blocked;
    set_nested_int(state, target, "shield", target_shield - blocked);
    set_nested_int(
        state,
        target,
        "hp",
        (nested_int(state, target, "hp") - dealt).max(0),
    );
    if shield > 0 {
        set_nested_int(
            state,
            source,
            "shield",
            nested_int(state, source, "shield") + shield,
        );
    }
    ResolvedEffect {
        damage: dealt,
        blocked,
        shield,
    }
}

fn deterministic_enemy_sequence(
    hand_cards: &[i64],
    energy: i64,
    templates: &HashMap<i64, CardTemplateRow>,
    state: &Value,
    action_weights: Option<&Value>,
) -> Vec<i64> {
    let mut remaining = hand_cards.to_vec();
    let mut sequence = Vec::new();
    let mut energy = energy.clamp(0, MAX_EFFECT_VALUE);
    let damage_weight = bounded_weight(action_weights.and_then(|v| v.get("damage")), 1.0);
    let shield_weight = bounded_weight(action_weights.and_then(|v| v.get("shield")), 1.0);
    let mut player_effective_hp =
        nested_int(state, "player_state", "hp") + nested_int(state, "player_state", "shield");
    let enemy_hp = nested_int(state, "enemy_state", "hp");
    let enemy_max_hp = nested_int(state, "enemy_state", "max_hp");
    let ratio = if enemy_max_hp > 0 {
        enemy_hp as f64 / enemy_max_hp as f64
    } else {
        1.0
    };
    let pressure = ((0.5 - ratio) / 0.5).clamp(0.0, 1.0);
    let mut projected_shield = nested_int(state, "enemy_state", "shield");
    loop {
        let chosen = remaining
            .iter()
            .filter_map(|id| templates.get(id))
            .filter(|template| i64::from(template.cost) <= energy)
            .max_by(|left, right| {
                enemy_score(
                    left,
                    player_effective_hp,
                    projected_shield,
                    pressure,
                    damage_weight,
                    shield_weight,
                )
                .partial_cmp(&enemy_score(
                    right,
                    player_effective_hp,
                    projected_shield,
                    pressure,
                    damage_weight,
                    shield_weight,
                ))
                .unwrap_or(Ordering::Equal)
                .then_with(|| left.cost.cmp(&right.cost))
                .then_with(|| right.id.cmp(&left.id))
            })
            .cloned();
        let Some(chosen) = chosen else {
            return sequence;
        };
        let damage = bounded_int(chosen.effect_json.get("damage"), 0, MAX_EFFECT_VALUE);
        let shield = bounded_int(chosen.effect_json.get("shield"), 0, MAX_EFFECT_VALUE);
        projected_shield += shield;
        player_effective_hp = (player_effective_hp - damage).max(0);
        sequence.push(chosen.id);
        if let Some(index) = remaining.iter().position(|id| *id == chosen.id) {
            remaining.remove(index);
        }
        energy -= i64::from(chosen.cost);
    }
}

fn enemy_candidates(state: &Value, templates: &HashMap<i64, CardTemplateRow>) -> Vec<Value> {
    let mut counts = HashMap::<i64, i64>::new();
    for id in int_array(state, "enemy_hand_cards") {
        *counts.entry(id).or_default() += 1;
    }
    let mut candidates = counts
        .into_iter()
        .filter_map(|(id, available_copies)| {
            let template = templates.get(&id)?;
            let damage = bounded_int(template.effect_json.get("damage"), 0, MAX_EFFECT_VALUE);
            let shield = bounded_int(template.effect_json.get("shield"), 0, MAX_EFFECT_VALUE);
            let tags = [
                (damage > 0).then_some("damage"),
                (shield > 0).then_some("shield"),
            ]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();
            Some(json!({
                "card_template_id": template.id,
                "name": template.name,
                "cost": template.cost,
                "type": template.card_type,
                "damage": damage,
                "shield": shield,
                "tags": tags,
                "available_copies": available_copies,
            }))
        })
        .collect::<Vec<_>>();
    candidates.sort_by_key(|value| value["card_template_id"].as_i64().unwrap_or_default());
    candidates
}

fn enemy_turn_context(
    enemy: &EnemyRow,
    state: &Value,
    templates: &HashMap<i64, CardTemplateRow>,
) -> EnemyTurnContext {
    let mut state = state.clone();
    let max_energy = state_int(&state, "enemy_max_energy");
    set_state_int(&mut state, "enemy_energy", max_energy);
    let fallback = deterministic_enemy_sequence(
        &int_array(&state, "enemy_hand_cards"),
        max_energy,
        templates,
        &state,
        enemy.battle_deck.get("action_weights"),
    );
    let profile = enemy.reward.get("ai_profile").and_then(Value::as_object);
    EnemyTurnContext {
        enemy_id: enemy.id,
        enemy_name: enemy.name.clone(),
        battle_enabled: profile
            .and_then(|value| value.get("battle_enabled"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        battle_style: profile
            .and_then(|value| value.get("battle_style"))
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("选择稳妥且合法的行动")
            .chars()
            .take(400)
            .collect(),
        candidates: enemy_candidates(&state, templates),
        state,
        fallback,
    }
}

async fn choose_enemy_cards(state: &AppState, context: &EnemyTurnContext) -> Option<EnemyDecision> {
    if !state.settings().ai_enabled
        || !state.settings().ai_battle_enabled
        || !state.settings().ai_configured()
        || !context.battle_enabled
        || context.candidates.is_empty()
    {
        return None;
    }
    let system = format!(
        "你正在为回合制卡牌游戏中的敌方「{}」选择出牌顺序。战斗风格：{}。只能从候选 card_template_id 中选择，允许同一卡牌按 available_copies 重复出现。必须连续出牌，直到能量耗尽或剩余卡牌都无法支付。必须依据候选中的实际 damage、shield、cost 数值判断，不能只看名称、类型或标签。敌方生命较高或已有护盾时，优先造成有效伤害。仅当敌方生命较低且现有护盾不足时，才提高防御优先级，不得机械地见到防御牌就先选。若为耗尽能量必须打出多张纯防御牌，也应避免把它们排在更有效的攻击之前。不得创建卡牌、效果、目标、伤害、生命、能量、奖励或其他数值。只返回 JSON：{{\"card_template_ids\":[1,2],\"battle_line\":\"不超过80字的可选角色台词\"}}。",
        context.enemy_name, context.battle_style
    );
    let user = json!({
        "turn": context.state.get("current_turn"),
        "player_hp": context.state.get("player_state").and_then(|v| v.get("hp")),
        "player_max_hp": context.state.get("player_state").and_then(|v| v.get("max_hp")),
        "player_shield": context.state.get("player_state").and_then(|v| v.get("shield")).cloned().unwrap_or_else(|| json!(0)),
        "enemy_hp": context.state.get("enemy_state").and_then(|v| v.get("hp")),
        "enemy_max_hp": context.state.get("enemy_state").and_then(|v| v.get("max_hp")),
        "enemy_shield": context.state.get("enemy_state").and_then(|v| v.get("shield")).cloned().unwrap_or_else(|| json!(0)),
        "enemy_energy": context.state.get("enemy_energy"),
        "candidates": context.candidates,
    });
    let completion = match state
        .ai()
        .complete_json(
            state.settings(),
            vec![
                json!({"role":"system","content":system}),
                json!({"role":"user","content":user.to_string()}),
            ],
            state.settings().ai_battle_timeout_seconds,
            0.3,
        )
        .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(
                enemy_id = context.enemy_id,
                reason = error.kind(),
                "ai battle fallback"
            );
            return None;
        }
    };
    let Some(decision) = valid_battle_output(&completion.data) else {
        tracing::warn!(
            enemy_id = context.enemy_id,
            reason = "output",
            "ai battle fallback"
        );
        return None;
    };
    let energy = state_int(&context.state, "enemy_energy");
    if !maximal_legal_sequence(&decision.card_template_ids, &context.candidates, energy)
        || starts_with_needless_defense(
            &decision.card_template_ids,
            &context.candidates,
            &context.fallback,
        )
    {
        tracing::warn!(
            enemy_id = context.enemy_id,
            reason = "sequence",
            "ai battle fallback"
        );
        return None;
    }
    tracing::info!(
        enemy_id = context.enemy_id,
        card_count = decision.card_template_ids.len(),
        prompt_tokens = completion.prompt_tokens,
        completion_tokens = completion.completion_tokens,
        "ai battle succeeded"
    );
    Some(decision)
}

fn valid_battle_output(value: &Value) -> Option<EnemyDecision> {
    let object = value.as_object()?;
    if object
        .keys()
        .any(|key| key != "card_template_ids" && key != "battle_line")
    {
        return None;
    }
    let values = object.get("card_template_ids")?.as_array()?;
    if values.len() > 20 {
        return None;
    }
    let card_template_ids = values
        .iter()
        .map(Value::as_i64)
        .collect::<Option<Vec<_>>>()?;
    let battle_line = match object.get("battle_line") {
        None | Some(Value::Null) => None,
        Some(value) => {
            let text = value.as_str()?;
            if text.chars().count() > 200 {
                return None;
            }
            let text = text.trim().chars().take(80).collect::<String>();
            (!text.is_empty()).then_some(text)
        }
    };
    Some(EnemyDecision {
        card_template_ids,
        battle_line,
    })
}

fn starts_with_needless_defense(sequence: &[i64], candidates: &[Value], fallback: &[i64]) -> bool {
    let (Some(selected_id), Some(baseline_id)) = (sequence.first(), fallback.first()) else {
        return false;
    };
    let selected = candidates
        .iter()
        .find(|value| value["card_template_id"].as_i64() == Some(*selected_id));
    let baseline = candidates
        .iter()
        .find(|value| value["card_template_id"].as_i64() == Some(*baseline_id));
    let selected_damage = selected
        .and_then(|v| v["damage"].as_i64())
        .unwrap_or(0)
        .max(0);
    let selected_shield = selected
        .and_then(|v| v["shield"].as_i64())
        .unwrap_or(0)
        .max(0);
    let baseline_damage = baseline
        .and_then(|v| v["damage"].as_i64())
        .unwrap_or(0)
        .max(0);
    selected_damage == 0 && selected_shield > 0 && baseline_damage > 0
}

fn enemy_score(
    template: &CardTemplateRow,
    player_effective_hp: i64,
    projected_shield: i64,
    pressure: f64,
    damage_weight: f64,
    shield_weight: f64,
) -> f64 {
    let damage = bounded_int(template.effect_json.get("damage"), 0, MAX_EFFECT_VALUE);
    let shield = bounded_int(template.effect_json.get("shield"), 0, MAX_EFFECT_VALUE);
    let lethal = if damage > 0 && damage >= player_effective_hp {
        1_000_000.0
    } else {
        0.0
    };
    let gap = (shield - projected_shield).max(0);
    let need = if shield > 0 {
        gap as f64 / shield as f64
    } else {
        0.0
    };
    lethal
        + damage as f64 * damage_weight
        + shield as f64 * shield_weight * need * (0.25 + 1.5 * pressure)
}

fn shuffle_pile(state: &mut Value, pile_key: &str, side: &str) {
    let Some(seed) = state.get("battle_seed").and_then(Value::as_u64) else {
        return;
    };
    let counter_key = format!("{side}_shuffle_count");
    let count = state_int(state, &counter_key).clamp(0, MAX_EFFECT_VALUE);
    let digest = Sha256::digest(format!("{seed}:{side}:{count}").as_bytes());
    let derived = u64::from_be_bytes(digest[..8].try_into().expect("sha prefix length"));
    let mut pile = int_array(state, pile_key);
    python_shuffle(&mut pile, derived);
    state[pile_key] = json!(pile);
    set_state_int(state, &counter_key, count + 1);
}

fn draw_to_hand(state: &mut Value) {
    draw_side(
        state,
        "hand_cards",
        "draw_pile",
        "discard_cards",
        5,
        "player",
    );
}

fn python_shuffle<T>(values: &mut [T], seed: u64) {
    let mut random = PythonRandom::new(seed);
    for index in (1..values.len()).rev() {
        let chosen = random.rand_below(index + 1);
        values.swap(index, chosen);
    }
}

struct PythonRandom {
    state: [u32; 624],
    index: usize,
}

impl PythonRandom {
    fn new(seed: u64) -> Self {
        let mut random = Self {
            state: [0; 624],
            index: 624,
        };
        random.init_genrand(19_650_218);
        let low = seed as u32;
        let high = (seed >> 32) as u32;
        let key: Vec<u32> = if high == 0 {
            vec![low]
        } else {
            vec![low, high]
        };
        let mut i = 1_usize;
        let mut j = 0_usize;
        for _ in 0..624 {
            let previous = random.state[i - 1];
            random.state[i] = (random.state[i]
                ^ (previous ^ (previous >> 30)).wrapping_mul(1_664_525))
            .wrapping_add(key[j])
            .wrapping_add(j as u32);
            i += 1;
            j += 1;
            if i >= 624 {
                random.state[0] = random.state[623];
                i = 1;
            }
            if j >= key.len() {
                j = 0;
            }
        }
        for _ in 0..623 {
            let previous = random.state[i - 1];
            random.state[i] = (random.state[i]
                ^ (previous ^ (previous >> 30)).wrapping_mul(1_566_083_941))
            .wrapping_sub(i as u32);
            i += 1;
            if i >= 624 {
                random.state[0] = random.state[623];
                i = 1;
            }
        }
        random.state[0] = 0x8000_0000;
        random.index = 624;
        random
    }

    fn init_genrand(&mut self, seed: u32) {
        self.state[0] = seed;
        for index in 1..624 {
            let previous = self.state[index - 1];
            self.state[index] = 1_812_433_253_u32
                .wrapping_mul(previous ^ (previous >> 30))
                .wrapping_add(index as u32);
        }
    }

    fn next_u32(&mut self) -> u32 {
        if self.index >= 624 {
            for index in 0..624 {
                let value = (self.state[index] & 0x8000_0000)
                    | (self.state[(index + 1) % 624] & 0x7fff_ffff);
                let mut twisted = value >> 1;
                if value & 1 != 0 {
                    twisted ^= 0x9908_b0df;
                }
                self.state[index] = self.state[(index + 397) % 624] ^ twisted;
            }
            self.index = 0;
        }
        let mut value = self.state[self.index];
        self.index += 1;
        value ^= value >> 11;
        value ^= (value << 7) & 0x9d2c_5680;
        value ^= (value << 15) & 0xefc6_0000;
        value ^= value >> 18;
        value
    }

    fn rand_below(&mut self, upper: usize) -> usize {
        let bits = usize::BITS - upper.leading_zeros();
        loop {
            let value = (self.next_u32() >> (32 - bits)) as usize;
            if value < upper {
                return value;
            }
        }
    }
}

fn draw_enemy_to_hand(state: &mut Value) {
    let size = state_int(state, "enemy_hand_size").clamp(1, 20) as usize;
    draw_side(
        state,
        "enemy_hand_cards",
        "enemy_draw_pile",
        "enemy_discard_cards",
        size,
        "enemy",
    );
}

fn draw_side(
    state: &mut Value,
    hand_key: &str,
    draw_key: &str,
    discard_key: &str,
    size: usize,
    side: &str,
) {
    let mut hand = int_array(state, hand_key);
    let mut draw = int_array(state, draw_key);
    let mut discard = int_array(state, discard_key);
    while hand.len() < size {
        if draw.is_empty() {
            if discard.is_empty() {
                break;
            }
            draw.append(&mut discard);
            state[draw_key] = json!(draw);
            shuffle_pile(state, draw_key, side);
            draw = int_array(state, draw_key);
        }
        hand.push(draw.remove(0));
    }
    state[hand_key] = json!(hand);
    state[draw_key] = json!(draw);
    state[discard_key] = json!(discard);
}

fn battle_data(battle: &BattleRow) -> Value {
    let mut state = battle.state_json.as_object().cloned().unwrap_or_default();
    let enemy_hand = take_array_len(&mut state, "enemy_hand_cards");
    let enemy_draw = take_array_len(&mut state, "enemy_draw_pile");
    let enemy_discard = take_array_len(&mut state, "enemy_discard_cards");
    state.remove("battle_seed");
    state.remove("player_shuffle_count");
    state.remove("enemy_shuffle_count");
    state.insert("enemy_hand_count".to_owned(), json!(enemy_hand));
    state.insert("enemy_draw_count".to_owned(), json!(enemy_draw));
    state.insert("enemy_discard_count".to_owned(), json!(enemy_discard));
    let mut result = Map::new();
    result.insert("battle_id".to_owned(), json!(battle.id));
    result.insert("enemy_id".to_owned(), json!(battle.enemy_id));
    result.insert("status".to_owned(), json!(battle.status));
    result.insert("version".to_owned(), json!(battle.version));
    result.extend(state);
    Value::Object(result)
}

fn take_array_len(state: &mut Map<String, Value>, key: &str) -> usize {
    state
        .remove(key)
        .and_then(|value| value.as_array().map(Vec::len))
        .unwrap_or(0)
}

async fn complete_battle(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    player: PlayerCombat,
    battle: &mut BattleRow,
    state: &mut Value,
    result: &str,
    defeat_reason: Option<&str>,
) -> Result<(), AppError> {
    let enemy = load_enemy(tx, battle.enemy_id).await?;
    let mut reward = json!({});
    let mut penalty = Value::Null;
    let mut affection_result = Value::Null;
    let is_monster = enemy.as_ref().is_some_and(|enemy| {
        enemy
            .battle_deck
            .get("monster_rank")
            .is_some_and(|value| !value.is_null())
    });
    if result == "victory" && !is_monster {
        if let Some(enemy) = enemy.as_ref() {
            affection_result = apply_battle_affection(tx, player_id, enemy).await?;
            if let Some(first_card) = affection_result
                .get("rewards")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .find(|item| {
                    item.get("type").and_then(Value::as_str) == Some("card")
                        && item.get("milestone_level").and_then(Value::as_i64) == Some(1)
                })
            {
                reward = json!({
                    "first_battle":true,
                    "card":{
                        "template_id":first_card["template_id"],
                        "name":first_card["name"],
                        "count":first_card["count"],
                    },
                    "first_victory":true,
                });
            }
        }
    }
    if result == "victory" {
        if let Some(enemy) = enemy.as_ref() {
            record_quest_objective(
                tx,
                player_id,
                "battle_npc",
                1,
                Some("npc_name"),
                Some(&enemy.name),
                false,
            )
            .await?;
            if let Some(opening_reward) = opening::mark_opening_battle_complete(
                tx,
                player_id,
                &enemy.name,
                &enemy.reward,
                result,
            )
            .await?
            {
                reward["opening"] = opening_reward;
            } else if let Some(fragment) = grant_monster_fragments(tx, player_id, enemy).await? {
                reward["fragment"] = fragment;
            }
        }
    } else {
        let gold_before = player.gold.max(0);
        let gold_lost = gold_before.min(DEFEAT_GOLD_PENALTY);
        let remaining = gold_before - gold_lost;
        sqlx::query("UPDATE players SET gold=$1 WHERE id=$2")
            .bind(remaining)
            .bind(player_id)
            .execute(&mut **tx)
            .await?;
        penalty = json!({"gold_lost":gold_lost,"gold_remaining":remaining});
    }
    battle.status = result.to_owned();
    state["result"] = json!(result);
    state["reward"] = reward.clone();
    state["penalty"] = penalty.clone();
    state["defeat_reason"] = defeat_reason.map_or(Value::Null, |value| json!(value));
    state["affection_result"] = affection_result;
    let settlement = if penalty.is_null() {
        reward
    } else {
        json!({"penalty":penalty})
    };
    sqlx::query(
        "INSERT INTO battle_records (player_id,enemy_id,result,turn_count,reward_json) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(player_id)
    .bind(battle.enemy_id)
    .bind(result)
    .bind(state_int(state, "current_turn").max(1) as i32)
    .bind(settlement)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn grant_monster_fragments(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    enemy: &EnemyRow,
) -> Result<Option<Value>, AppError> {
    let rank = enemy.battle_deck.get("monster_rank");
    let spirit_id = enemy
        .battle_deck
        .get("spirit_template_id")
        .and_then(Value::as_i64);
    if rank.is_none_or(Value::is_null) && spirit_id.is_none() {
        return Ok(None);
    }
    let drop_amount = match rank.and_then(Value::as_str) {
        Some("normal") => 1,
        Some("elite") => 2,
        Some("boss") => 3,
        _ => {
            return Err(AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的怪物卡灵碎片配置无效", enemy.name),
            ))
        }
    };
    let spirit_id = spirit_id.ok_or_else(|| {
        AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("{} 的怪物卡灵碎片配置无效", enemy.name),
        )
    })?;
    let name =
        sqlx::query_scalar::<_, String>("SELECT name FROM card_spirit_templates WHERE id=$1")
            .bind(spirit_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| {
                AppError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("{} 的怪物卡灵模板不存在", enemy.name),
                )
            })?;
    let count = sqlx::query_scalar::<_, i32>(
        r#"INSERT INTO player_card_spirit_fragments (player_id,spirit_template_id,amount)
           VALUES ($1,$2,$3) ON CONFLICT (player_id,spirit_template_id) DO UPDATE
           SET amount=player_card_spirit_fragments.amount+$3,updated_at=CURRENT_TIMESTAMP
           RETURNING amount"#,
    )
    .bind(player_id)
    .bind(spirit_id)
    .bind(drop_amount)
    .fetch_one(&mut **tx)
    .await?;
    Ok(Some(json!({
        "template_id":spirit_id,"name":name,"fragment_delta":drop_amount,
        "fragment_count":count,"fragment_target":FRAGMENT_TARGET,"can_compose":count>=FRAGMENT_TARGET,
    })))
}

async fn apply_battle_affection(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    enemy: &EnemyRow,
) -> Result<Value, AppError> {
    sqlx::query(
        "INSERT INTO player_npc_affection (player_id,npc_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    )
    .bind(player_id)
    .bind(enemy.id)
    .execute(&mut **tx)
    .await?;
    let row = sqlx::query(
        "SELECT points,conversation_count,battle_count FROM player_npc_affection WHERE player_id=$1 AND npc_id=$2 FOR UPDATE",
    )
    .bind(player_id)
    .bind(enemy.id)
    .fetch_one(&mut **tx)
    .await?;
    let before: i32 = row.get("points");
    let conversations: i32 = row.get("conversation_count");
    let battles: i32 = row.get("battle_count");
    let first = battles == 0;
    let gain = if first { (1 - before).max(0) } else { 5 };
    let after = (before + gain).min(100);
    sqlx::query(
        "UPDATE player_npc_affection SET points=$1,battle_count=battle_count+1,updated_at=CURRENT_TIMESTAMP WHERE player_id=$2 AND npc_id=$3",
    )
    .bind(after)
    .bind(player_id)
    .bind(enemy.id)
    .execute(&mut **tx)
    .await?;
    let old_level = affection_level(before);
    let new_level = affection_level(after);
    let mut milestones: Vec<i32> = ((old_level + 1).max(2)..=new_level).collect();
    if first && new_level >= 1 {
        milestones.insert(0, 1);
    }
    let mut rewards = Vec::new();
    for level in milestones {
        if let Some(reward) = grant_affection_milestone(tx, player_id, enemy, level).await? {
            rewards.push(reward);
        }
    }
    let claimed: Vec<i32> = sqlx::query_scalar(
        "SELECT milestone_level FROM player_npc_affection_rewards WHERE player_id=$1 AND npc_id=$2 ORDER BY milestone_level",
    )
    .bind(player_id)
    .bind(enemy.id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(json!({
        "points_before":before,"points_after":after,"points_gained":after-before,
        "old_level":old_level,"new_level":new_level,"leveled_up":new_level>old_level,
        "rewards":rewards,
        "affection":affection_projection(enemy.id,after,conversations,battles+1,claimed),
    }))
}

async fn grant_affection_milestone(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    enemy: &EnemyRow,
    level: i32,
) -> Result<Option<Value>, AppError> {
    if level < 5 {
        let template_id = enemy
            .reward
            .get("first_victory_card_template_id")
            .and_then(Value::as_i64)
            .ok_or_else(|| {
                AppError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("{} 的专属卡牌奖励未配置", enemy.name),
                )
            })?;
        let name = sqlx::query_scalar::<_, String>("SELECT name FROM card_templates WHERE id=$1")
            .bind(template_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| {
                AppError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("{} 的专属卡牌奖励未配置", enemy.name),
                )
            })?;
        let inserted = sqlx::query_scalar::<_, i64>(
            r#"INSERT INTO player_npc_affection_rewards
               (player_id,npc_id,milestone_level,reward_type,card_template_id)
               VALUES ($1,$2,$3,'card',$4) ON CONFLICT DO NOTHING RETURNING id"#,
        )
        .bind(player_id)
        .bind(enemy.id)
        .bind(level)
        .bind(template_id)
        .fetch_optional(&mut **tx)
        .await?;
        if inserted.is_none() {
            return Ok(None);
        }
        sqlx::query(
            r#"INSERT INTO player_cards (player_id,card_template_id,level,count)
               VALUES ($1,$2,1,1) ON CONFLICT (player_id,card_template_id,level)
               DO UPDATE SET count=player_cards.count+1"#,
        )
        .bind(player_id)
        .bind(template_id)
        .execute(&mut **tx)
        .await?;
        if level == 1 {
            sqlx::query(
                "INSERT INTO npc_first_victory_rewards (player_id,npc_id,card_template_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
            )
            .bind(player_id)
            .bind(enemy.id)
            .bind(template_id)
            .execute(&mut **tx)
            .await?;
        }
        return Ok(Some(json!({
            "milestone_level":level,"type":"card","template_id":template_id,"name":name,"count":1,
        })));
    }
    let template_id = enemy
        .reward
        .get("affection_profile")
        .and_then(|value| value.get("card_spirit_template_id"))
        .and_then(Value::as_i64)
        .ok_or_else(|| {
            AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("{} 的卡灵奖励未配置", enemy.name),
            )
        })?;
    let name =
        sqlx::query_scalar::<_, String>("SELECT name FROM card_spirit_templates WHERE id=$1")
            .bind(template_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| {
                AppError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("{} 的卡灵奖励未配置", enemy.name),
                )
            })?;
    let inserted = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO player_npc_affection_rewards
           (player_id,npc_id,milestone_level,reward_type,spirit_template_id)
           VALUES ($1,$2,$3,'card_spirit',$4) ON CONFLICT DO NOTHING RETURNING id"#,
    )
    .bind(player_id)
    .bind(enemy.id)
    .bind(level)
    .bind(template_id)
    .fetch_optional(&mut **tx)
    .await?;
    if inserted.is_none() {
        return Ok(None);
    }
    sqlx::query(
        "INSERT INTO player_card_spirits (player_id,spirit_template_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    )
    .bind(player_id)
    .bind(template_id)
    .execute(&mut **tx)
    .await?;
    Ok(Some(json!({
        "milestone_level":level,"type":"card_spirit","template_id":template_id,"name":name,"count":1,
    })))
}

fn affection_projection(
    npc_id: i64,
    points: i32,
    conversation_count: i32,
    battle_count: i32,
    claimed: Vec<i32>,
) -> Value {
    let level = affection_level(points);
    let thresholds = [0, 20, 40, 60, 80];
    let current = thresholds[(level - 1) as usize];
    let next = (level < 5).then(|| thresholds[level as usize]);
    let progress = next.map_or(1.0, |next| {
        f64::from(points - current) / f64::from(next - current)
    });
    json!({
        "npc_id":npc_id,"points":points,"level":level,"max_points":100,
        "current_level_points":current,"next_level_points":next,
        "points_to_next":next.map_or(0,|next|(next-points).max(0)),
        "level_progress":(progress*10_000.0).round()/10_000.0,
        "conversation_count":conversation_count,"battle_count":battle_count,
        "claimed_milestones":claimed,
    })
}

fn affection_level(points: i32) -> i32 {
    match points.clamp(0, 100) {
        0..=19 => 1,
        20..=39 => 2,
        40..=59 => 3,
        60..=79 => 4,
        _ => 5,
    }
}

fn damage_with_affection(damage: i64, affection: i32) -> i64 {
    if affection <= 0 || damage <= 0 {
        return damage;
    }
    let percent = match affection {
        0..=20 => 5,
        21..=50 => 10,
        51..=80 => 20,
        _ => 30,
    };
    damage + (damage * percent / 100).max(1)
}

fn bounded_int(value: Option<&Value>, minimum: i64, maximum: i64) -> i64 {
    value
        .and_then(|value| {
            value.as_bool().map(i64::from).or_else(|| {
                value
                    .as_i64()
                    .or_else(|| value.as_f64().map(|value| value as i64))
                    .or_else(|| value.as_str()?.parse().ok())
            })
        })
        .unwrap_or(minimum)
        .clamp(minimum, maximum)
}

fn bounded_int_default(value: Option<&Value>, default: i64, minimum: i64, maximum: i64) -> i64 {
    value.map_or(default.clamp(minimum, maximum), |value| {
        bounded_int(Some(value), minimum, maximum)
    })
}

fn bounded_weight(value: Option<&Value>, default: f64) -> f64 {
    value
        .and_then(|value| {
            value
                .as_f64()
                .or_else(|| value.as_str()?.parse::<f64>().ok())
        })
        .filter(|value| value.is_finite())
        .unwrap_or(default)
        .clamp(0.0, 10.0)
}

fn state_int(state: &Value, key: &str) -> i64 {
    bounded_int(state.get(key), 0, MAX_EFFECT_VALUE)
}

fn set_state_int(state: &mut Value, key: &str, value: i64) {
    state[key] = json!(value);
}

fn nested_int(state: &Value, object: &str, key: &str) -> i64 {
    bounded_int(
        state.get(object).and_then(|value| value.get(key)),
        0,
        MAX_EFFECT_VALUE,
    )
}

fn set_nested_int(state: &mut Value, object: &str, key: &str, value: i64) {
    if !state.get(object).is_some_and(Value::is_object) {
        state[object] = json!({});
    }
    state[object][key] = json!(value);
}

fn ensure_nested_int(state: &mut Value, object: &str, key: &str, default: i64) {
    if state.get(object).and_then(|value| value.get(key)).is_none() {
        set_nested_int(state, object, key, default);
    }
}

fn int_array(state: &Value, key: &str) -> Vec<i64> {
    state
        .get(key)
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_i64)
        .collect()
}

fn remove_first(state: &mut Value, key: &str, target: i64) {
    let mut values = int_array(state, key);
    if let Some(index) = values.iter().position(|value| *value == target) {
        values.remove(index);
    }
    state[key] = json!(values);
}

fn push_int(state: &mut Value, key: &str, value: i64) {
    let mut values = int_array(state, key);
    values.push(value);
    state[key] = json!(values);
}

fn validate_positive(value: i64, field: &str) -> Result<(), AppError> {
    if value <= 0 {
        return Err(AppError::validation_field(
            field,
            "greater_than",
            "Input should be greater than 0",
            json!(value),
        ));
    }
    Ok(())
}

fn validate_version(value: i32) -> Result<(), AppError> {
    if value < 1 {
        return Err(AppError::validation_field(
            "expected_version",
            "greater_than_equal",
            "Input should be greater than or equal to 1",
            json!(value),
        ));
    }
    Ok(())
}

fn parse_path_integer(value: String, field: &str) -> Result<i64, AppError> {
    value
        .parse()
        .map_err(|_| AppError::validation_path_integer(field, value))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn template(id: i64, cost: i32, damage: i64, shield: i64) -> CardTemplateRow {
        CardTemplateRow {
            id,
            name: format!("card-{id}"),
            card_type: "attack".to_owned(),
            cost,
            source_spirit_id: Some(1),
            effect_json: json!({"damage":damage,"shield":shield}),
            upgrade_json: json!({}),
        }
    }

    #[test]
    fn public_projection_hides_enemy_runtime_state() {
        let battle = BattleRow {
            id: 1,
            enemy_id: 2,
            status: "active".to_owned(),
            version: 1,
            state_json: json!({
                "battle_seed":42,"player_shuffle_count":1,"enemy_shuffle_count":1,
                "enemy_hand_cards":[1,2],"enemy_draw_pile":[3],"enemy_discard_cards":[4,5,6]
            }),
        };
        let data = battle_data(&battle);
        assert!(data.get("battle_seed").is_none());
        assert!(data.get("enemy_hand_cards").is_none());
        assert_eq!(data["enemy_hand_count"], 2);
        assert_eq!(data["enemy_discard_count"], 3);
    }

    #[test]
    fn deterministic_enemy_prefers_lethal_damage() {
        let templates = HashMap::from([(1, template(1, 1, 5, 0)), (2, template(2, 1, 0, 20))]);
        let state = json!({
            "player_state":{"hp":5,"shield":0},
            "enemy_state":{"hp":10,"max_hp":30,"shield":0}
        });
        assert_eq!(
            deterministic_enemy_sequence(&[2, 1], 1, &templates, &state, None),
            vec![1]
        );
    }

    #[test]
    fn stale_or_finished_battle_is_rejected() {
        let mut battle = BattleRow {
            id: 1,
            enemy_id: 2,
            status: "active".to_owned(),
            state_json: json!({}),
            version: 3,
        };
        assert!(check_active_version(&battle, 2).is_err());
        battle.status = "defeat".to_owned();
        assert!(check_active_version(&battle, 3).is_err());
    }

    #[test]
    fn seeded_shuffle_is_reproducible() {
        let mut left = json!({"battle_seed":7,"player_shuffle_count":0,"draw_pile":[1,2,3,4,5]});
        let mut right = left.clone();
        shuffle_pile(&mut left, "draw_pile", "player");
        shuffle_pile(&mut right, "draw_pile", "player");
        assert_eq!(left, right);
    }

    #[test]
    fn shuffle_matches_python_random_for_integer_seed() {
        let mut values: Vec<i32> = (0..10).collect();
        python_shuffle(&mut values, 1_234_567_890_123_456_789);
        assert_eq!(values, vec![6, 5, 8, 7, 3, 9, 4, 0, 1, 2]);
        let mut small: Vec<i32> = (0..10).collect();
        python_shuffle(&mut small, 7);
        assert_eq!(small, vec![8, 3, 1, 4, 7, 0, 9, 6, 2, 5]);
        let mut minimum: Vec<i32> = (0..10).collect();
        python_shuffle(&mut minimum, 0);
        assert_eq!(minimum, vec![7, 8, 1, 5, 3, 4, 2, 0, 9, 6]);
        let mut maximum: Vec<i32> = (0..10).collect();
        python_shuffle(&mut maximum, i64::MAX as u64);
        assert_eq!(maximum, vec![4, 1, 9, 8, 6, 0, 3, 7, 2, 5]);
    }

    #[test]
    fn pure_enemy_shield_does_not_deal_damage() {
        let guard = template(1, 1, 0, 5);
        let mut state = json!({
            "player_state":{"hp":75,"shield":0},
            "enemy_state":{"hp":10,"max_hp":10,"shield":0}
        });
        let resolved = apply_card_effect(&mut state, &guard, "enemy", None, None, 20);
        assert_eq!(resolved.damage, 0);
        assert_eq!(state["player_state"]["hp"], 75);
        assert_eq!(state["enemy_state"]["shield"], 5);
    }

    #[test]
    fn missing_enemy_config_uses_python_defaults() {
        let config = json!({});
        assert_eq!(
            bounded_int_default(config.get("hp"), 30, 1, MAX_EFFECT_VALUE),
            30
        );
        assert_eq!(bounded_int_default(config.get("energy"), 3, 1, 20), 3);
        assert_eq!(bounded_int_default(config.get("hand_size"), 5, 1, 20), 5);

        let invalid = json!("invalid");
        assert_eq!(bounded_int_default(Some(&invalid), 3, 1, 20), 1);
    }

    #[test]
    fn deterministic_enemy_balances_low_hp_guard_pressure() {
        let attack = template(101, 1, 8, 0);
        let guard = template(102, 1, 0, 5);
        let signature = template(103, 2, 16, 0);
        let templates = HashMap::from([(101, attack), (102, guard), (103, signature)]);
        let healthy = json!({
            "player_state":{"hp":75,"shield":0},
            "enemy_state":{"hp":60,"max_hp":60,"shield":0}
        });
        assert_eq!(
            deterministic_enemy_sequence(
                &[101, 102, 103],
                3,
                &templates,
                &healthy,
                Some(&json!({"damage":1.25,"shield":0.55}))
            ),
            vec![103, 101]
        );
        let low = json!({
            "player_state":{"hp":75,"shield":0},
            "enemy_state":{"hp":10,"max_hp":60,"shield":0}
        });
        assert_eq!(
            deterministic_enemy_sequence(
                &[101, 102],
                1,
                &templates,
                &low,
                Some(&json!({"damage":0.75,"shield":1.2}))
            ),
            vec![102]
        );
    }

    #[test]
    fn enemy_candidates_include_python_effect_tags() {
        let templates = HashMap::from([
            (1, template(1, 1, 8, 0)),
            (2, template(2, 1, 0, 5)),
            (3, template(3, 2, 4, 3)),
        ]);
        let candidates = enemy_candidates(
            &json!({"enemy_hand_cards":[1,2,3],"enemy_energy":3}),
            &templates,
        );
        assert_eq!(candidates[0]["tags"], json!(["damage"]));
        assert_eq!(candidates[1]["tags"], json!(["shield"]));
        assert_eq!(candidates[2]["tags"], json!(["damage", "shield"]));
    }
}
