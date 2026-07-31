use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sqlx::{FromRow, Postgres, Transaction};

use crate::{
    api::auth::json_rejection, auth::AuthPlayer, error::AppError, response::ApiResponse, AppState,
};

const STORY_KEY: &str = "opening_moon_scar";
const STORY_TITLE: &str = "雾中月痕";
const LUNA_NAME: &str = "狼娘·露娜";
const LUNA_CARD_NAME: &str = "月牙撕裂";
const GUIDE_NAME: &str = "森林向导";
const CHIEF_NAME: &str = "晨曦村村长";
const SHADOW_NAME: &str = "雾痕兽影";
const VILLAGE_NAME: &str = "晨曦村";
const FOREST_NAME: &str = "微光森林";
const TASK_TITLES: [&str; 3] = ["村道补给", "林缘踏查", "实战准备"];
const OPENING_STAGES: [&str; 6] = [
    "arrival",
    "meet_chief",
    "prepare",
    "forest_signal",
    "return_village",
    "complete",
];
const MOON_TRACE_STAGES: [&str; 6] = [
    "moon_trace_accept",
    "moon_trace_guide",
    "moon_trace_evidence",
    "moon_trace_battle",
    "moon_trace_return",
    "moon_trace_stage1_complete",
];
const EVIDENCE: [(&str, &str, &str); 3] = [
    (
        "moonlight_flora",
        "异常闭合的月光植物",
        "花瓣在雾流逆转时同时闭合，根部没有自然病变。",
    ),
    (
        "broken_wolf_tracks",
        "突然中断的狼族足迹",
        "足迹在开阔地中央消失，没有折返或跃离痕迹。",
    ),
    (
        "broken_moon_mist_core",
        "附着断月纹的雾核",
        "雾核表面排列着无法自然形成的断月纹。",
    ),
];

#[derive(Debug, Deserialize)]
pub(crate) struct OpeningVillageActionRequest {
    action: String,
    npc_id: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct OpeningActionRequest {
    action: String,
    npc_id: Option<i64>,
    evidence_id: Option<String>,
}

#[derive(Debug, FromRow, Clone)]
struct ProgressRow {
    stage: String,
    data_json: Value,
    completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct TaskRow {
    id: i64,
    title: String,
    description: String,
    reward_json: Value,
    status: Option<String>,
    progress: Option<Value>,
}

pub(crate) async fn get_opening(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let mut tx = state.pool().begin().await?;
    let data = opening_data(&mut tx, player.id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::ok(data)))
}

pub(crate) async fn start_opening(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    if lock_progress(&mut tx, player.id).await?.is_none() {
        sqlx::query(
            "INSERT INTO player_story_progress (player_id, story_key, stage, data_json) VALUES ($1, $2, 'meet_chief', '{}'::jsonb)",
        )
        .bind(player.id)
        .bind(STORY_KEY)
        .execute(&mut *tx)
        .await?;
    }
    let data = opening_data(&mut tx, player.id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "序章已开始")))
}

pub(crate) async fn opening_action(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<OpeningVillageActionRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_village_action(&payload)?;
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    let progress = lock_progress(&mut tx, player.id)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::CONFLICT, "请先观看冷开场并进入晨曦村"))?;
    require_npc(&mut tx, payload.npc_id, CHIEF_NAME).await?;
    if current_map_name(&mut tx, player.id).await?.as_deref() != Some(VILLAGE_NAME) {
        return Err(AppError::new(StatusCode::CONFLICT, "请在晨曦村与村长交谈"));
    }
    if progress.stage == "meet_chief" {
        for task in load_tasks(&mut tx, player.id).await? {
            sqlx::query(
                r#"INSERT INTO player_quests (player_id, quest_id, status, progress)
                   VALUES ($1, $2, 'active', '{}'::jsonb)
                   ON CONFLICT (player_id, quest_id) DO UPDATE
                   SET status = CASE WHEN player_quests.status = 'not_started' THEN 'active' ELSE player_quests.status END"#,
            )
            .bind(player.id)
            .bind(task.id)
            .execute(&mut *tx)
            .await?;
        }
        sqlx::query(
            "UPDATE player_story_progress SET stage = 'prepare', updated_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND story_key = $2",
        )
        .bind(player.id)
        .bind(STORY_KEY)
        .execute(&mut *tx)
        .await?;
    } else if !matches!(
        progress.stage.as_str(),
        "prepare" | "forest_signal" | "return_village" | "complete"
    ) {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "当前阶段不能领取入村准备任务",
        ));
    }
    let data = opening_data(&mut tx, player.id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "入村准备任务已领取")))
}

pub(crate) async fn moon_trace_action(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<OpeningActionRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_moon_action(&payload)?;
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    let progress = lock_progress(&mut tx, player.id).await?;
    let progress = progress
        .filter(|value| value.stage == "complete")
        .ok_or_else(|| AppError::new(StatusCode::CONFLICT, "请先完成露娜返村疗养剧情"))?;
    let map_name = current_map_name(&mut tx, player.id).await?;
    let moon_stage = moon_trace_stage(Some(&progress));
    let mut data = object_data(progress.data_json.clone());

    match payload.action.as_str() {
        "accept_stage1" => {
            require_npc_optional(&mut tx, payload.npc_id, LUNA_NAME).await?;
            if map_name.as_deref() != Some(VILLAGE_NAME) {
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "请在晨曦村疗养点与露娜交谈",
                ));
            }
            if moon_stage == Some("moon_trace_accept") {
                data.insert("moon_trace_stage".to_owned(), json!("moon_trace_guide"));
                data.insert("moon_trace_stage1_accepted".to_owned(), json!(true));
            }
        }
        "confirm_guide" => {
            require_npc_optional(&mut tx, payload.npc_id, GUIDE_NAME).await?;
            if map_name.as_deref() != Some(VILLAGE_NAME) {
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "请在晨曦村向森林向导确认位置",
                ));
            }
            if moon_stage == Some("moon_trace_guide") {
                data.insert("moon_trace_stage".to_owned(), json!("moon_trace_evidence"));
                data.insert("moon_trace_guide_confirmed".to_owned(), json!(true));
            } else if moon_stage == Some("moon_trace_accept") {
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "请先向疗养中的露娜接取《逆流雾源》",
                ));
            }
        }
        "inspect_evidence" => {
            let evidence_id = payload
                .evidence_id
                .as_deref()
                .ok_or_else(|| AppError::new(StatusCode::UNPROCESSABLE_ENTITY, "调查证据不存在"))?;
            if !is_evidence(evidence_id) {
                return Err(AppError::new(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "调查证据不存在",
                ));
            }
            if map_name.as_deref() != Some(FOREST_NAME) {
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "请前往微光森林调查证据",
                ));
            }
            let mut completed = normalized_evidence(data.get("moon_trace_evidence"));
            if !matches!(
                moon_stage,
                Some("moon_trace_evidence") | Some("moon_trace_battle")
            ) {
                if completed.iter().any(|item| item == evidence_id)
                    && matches!(
                        moon_stage,
                        Some("moon_trace_return") | Some("moon_trace_stage1_complete")
                    )
                {
                    let result = opening_data(&mut tx, player.id).await?;
                    tx.commit().await?;
                    return Ok(Json(ApiResponse::with_message(result, "月痕追迹已更新")));
                }
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "当前阶段不能调查该证据",
                ));
            }
            if !completed.iter().any(|item| item == evidence_id) {
                completed.push(evidence_id.to_owned());
                completed.sort();
            }
            data.insert("moon_trace_evidence".to_owned(), json!(completed));
            if normalized_evidence(data.get("moon_trace_evidence")).len() == EVIDENCE.len() {
                data.insert("moon_trace_stage".to_owned(), json!("moon_trace_battle"));
                data.insert("moon_trace_evidence_completed".to_owned(), json!(true));
            }
        }
        "report_stage1" => {
            require_npc_optional(&mut tx, payload.npc_id, LUNA_NAME).await?;
            if map_name.as_deref() != Some(VILLAGE_NAME) {
                return Err(AppError::new(
                    StatusCode::CONFLICT,
                    "请返回晨曦村疗养点向露娜回报",
                ));
            }
            if moon_stage == Some("moon_trace_return") {
                data.insert(
                    "moon_trace_stage".to_owned(),
                    json!("moon_trace_stage1_complete"),
                );
                data.insert("moon_trace_stage1_completed".to_owned(), json!(true));
                data.insert(
                    "moon_trace_next_objective".to_owned(),
                    json!("追查操纵断月纹的人"),
                );
            } else if moon_stage != Some("moon_trace_stage1_complete") {
                return Err(AppError::new(StatusCode::CONFLICT, "请先完成雾痕兽影调查"));
            }
        }
        _ => unreachable!("action validated before dispatch"),
    }

    sqlx::query(
        "UPDATE player_story_progress SET data_json = $1, updated_at = CURRENT_TIMESTAMP WHERE player_id = $2 AND story_key = $3",
    )
    .bind(Value::Object(data))
    .bind(player.id)
    .bind(STORY_KEY)
    .execute(&mut *tx)
    .await?;
    let result = opening_data(&mut tx, player.id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(result, "月痕追迹已更新")))
}

pub(crate) async fn complete_opening(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    let mut progress = lock_progress(&mut tx, player.id)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::CONFLICT, "序章尚未开始"))?;
    let mut contract_reward = None;
    if matches!(progress.stage.as_str(), "return_village" | "complete")
        && !progress
            .data_json
            .get("luna_contract_completed")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    {
        contract_reward = Some(grant_luna_contract(&mut tx, player.id).await?);
        let mut data = object_data(progress.data_json);
        data.insert("luna_battle_completed".to_owned(), json!(true));
        data.insert("luna_contract_completed".to_owned(), json!(true));
        data.insert("luna_contract_version".to_owned(), json!(1));
        progress.data_json = Value::Object(data);
        sqlx::query(
            "UPDATE player_story_progress SET data_json = $1, updated_at = CURRENT_TIMESTAMP WHERE player_id = $2 AND story_key = $3",
        )
        .bind(&progress.data_json)
        .bind(player.id)
        .bind(STORY_KEY)
        .execute(&mut *tx)
        .await?;
    }
    if progress.stage == "complete" {
        let mut result = object_data(opening_data(&mut tx, player.id).await?);
        result.insert("completed_now".to_owned(), json!(false));
        result.insert("gold_reward".to_owned(), json!(0));
        if let Some(reward) = contract_reward {
            result.insert("contract_reward".to_owned(), reward);
        }
        tx.commit().await?;
        return Ok(Json(ApiResponse::with_message(
            Value::Object(result),
            "序章已完成",
        )));
    }
    if progress.stage != "return_village" {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "尚未取得露娜的月痕线索",
        ));
    }
    if current_map_name(&mut tx, player.id).await?.as_deref() != Some(VILLAGE_NAME) {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "请先返回晨曦村向村长汇报",
        ));
    }
    let tasks = load_tasks(&mut tx, player.id).await?;
    let mut total_gold = 0_i64;
    for task in tasks {
        if !task_ready(&task) {
            return Err(AppError::new(
                StatusCode::CONFLICT,
                format!("任务「{}」尚未完成", task.title),
            ));
        }
        if task.status.as_deref() != Some("completed") {
            total_gold += task
                .reward_json
                .get("gold")
                .and_then(Value::as_i64)
                .unwrap_or(0)
                .clamp(0, 1_000_000);
            sqlx::query(
                "UPDATE player_quests SET status = 'completed' WHERE player_id = $1 AND quest_id = $2",
            )
            .bind(player.id)
            .bind(task.id)
            .execute(&mut *tx)
            .await?;
        }
    }
    sqlx::query("UPDATE players SET gold = gold + $1 WHERE id = $2")
        .bind(total_gold)
        .bind(player.id)
        .execute(&mut *tx)
        .await?;
    let mut data = object_data(progress.data_json);
    data.insert("main_quest".to_owned(), json!("月痕追迹"));
    data.insert("luna_injured".to_owned(), json!(true));
    data.insert("luna_recovery_state".to_owned(), json!("recuperating"));
    data.insert("luna_returning_to_village".to_owned(), json!(false));
    data.insert("moon_trace_stage".to_owned(), json!("moon_trace_accept"));
    sqlx::query(
        "UPDATE player_story_progress SET stage = 'complete', completed_at = CURRENT_TIMESTAMP, data_json = $1, updated_at = CURRENT_TIMESTAMP WHERE player_id = $2 AND story_key = $3",
    )
    .bind(Value::Object(data))
    .bind(player.id)
    .bind(STORY_KEY)
    .execute(&mut *tx)
    .await?;
    let mut result = object_data(opening_data(&mut tx, player.id).await?);
    result.insert("completed_now".to_owned(), json!(true));
    result.insert("gold_reward".to_owned(), json!(total_gold));
    result.insert("completion_dialogue".to_owned(), completion_dialogue());
    if let Some(reward) = contract_reward {
        result.insert("contract_reward".to_owned(), reward);
    }
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(
        Value::Object(result),
        "序章已完成",
    )))
}

async fn opening_data(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<Value, AppError> {
    let progress = load_progress(tx, player_id).await?;
    let tasks = load_tasks(tx, player_id).await?;
    let stage = effective_stage(progress.as_ref(), &tasks);
    let map_name = current_map_name(tx, player_id).await?;
    let (luna_enemy_id, shadow_enemy_id) = npc_story_ids(tx).await?;
    let data = progress
        .as_ref()
        .map(|value| &value.data_json)
        .unwrap_or(&Value::Null);
    let moon_stage = moon_trace_stage(progress.as_ref());
    let evidence_ids = normalized_evidence(data.get("moon_trace_evidence"));
    let main_quest = moon_stage.map(|moon_stage| {
        json!({
            "title": "月痕追迹",
            "chapter": "逆流雾源",
            "stage": moon_stage,
            "objective": moon_trace_objective(moon_stage, evidence_ids.len()),
            "evidence": EVIDENCE.iter().map(|(id, name, description)| json!({
                "id": id,
                "name": name,
                "description": description,
                "completed": evidence_ids.iter().any(|value| value == id),
            })).collect::<Vec<_>>(),
            "evidence_count": evidence_ids.len(),
            "evidence_target": EVIDENCE.len(),
            "shadow_completed": data.get("moon_trace_shadow_completed").and_then(Value::as_bool).unwrap_or(false),
            "stage1_completed": moon_stage == "moon_trace_stage1_complete",
        })
    });
    Ok(json!({
        "story_key": STORY_KEY,
        "title": STORY_TITLE,
        "stage": stage,
        "started": progress.is_some(),
        "completed": stage == "complete",
        "completed_at": progress.as_ref().and_then(|value| value.completed_at),
        "objective": objective(stage, map_name.as_deref()),
        "tasks": tasks.iter().map(task_data).collect::<Vec<_>>(),
        "luna_enemy_id": luna_enemy_id,
        "shadow_enemy_id": shadow_enemy_id,
        "can_battle_luna": stage == "forest_signal" && map_name.as_deref() == Some(FOREST_NAME),
        "can_complete": stage == "return_village" && map_name.as_deref() == Some(VILLAGE_NAME),
        "intro_lines": [
            "微光森林深处，雾逆着树梢的风向流动。",
            "银色狼耳少女捂着受伤的肩侧，踉跄着停在残缺月牙刻痕前。",
            "断月纹仍在追赶她，失控月痕正沿旧伤侵入意识。",
            "“不是野兽的味道……断月纹还在追我。”",
            "同一时刻，你沿着东侧村道抵达晨曦村。",
        ],
        "main_quest": main_quest,
    }))
}

async fn load_progress(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<Option<ProgressRow>, AppError> {
    Ok(sqlx::query_as::<_, ProgressRow>(
        "SELECT stage, data_json, completed_at FROM player_story_progress WHERE player_id = $1 AND story_key = $2",
    )
    .bind(player_id)
    .bind(STORY_KEY)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn lock_progress(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<Option<ProgressRow>, AppError> {
    Ok(sqlx::query_as::<_, ProgressRow>(
        "SELECT stage, data_json, completed_at FROM player_story_progress WHERE player_id = $1 AND story_key = $2 FOR UPDATE",
    )
    .bind(player_id)
    .bind(STORY_KEY)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn load_tasks(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<Vec<TaskRow>, AppError> {
    let mut rows = sqlx::query_as::<_, TaskRow>(
        r#"SELECT quest.id, quest.title, quest.description, quest.reward_json,
                  progress.status, progress.progress
           FROM quests AS quest
           LEFT JOIN player_quests AS progress
             ON progress.quest_id = quest.id AND progress.player_id = $1
           WHERE quest.title = ANY($2::text[])"#,
    )
    .bind(player_id)
    .bind(TASK_TITLES)
    .fetch_all(&mut **tx)
    .await?;
    if rows.len() != TASK_TITLES.len()
        || TASK_TITLES
            .iter()
            .any(|title| !rows.iter().any(|row| row.title == *title))
    {
        return Err(AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "序章依赖的村长任务配置不完整",
        ));
    }
    let mut ordered = Vec::with_capacity(TASK_TITLES.len());
    for title in TASK_TITLES {
        let index = rows
            .iter()
            .position(|row| row.title == title)
            .expect("task presence checked above");
        ordered.push(rows.swap_remove(index));
    }
    Ok(ordered)
}

async fn current_map_name(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar::<_, String>(
        "SELECT map.map_name FROM players AS player JOIN map_data AS map ON map.id = player.current_map WHERE player.id = $1",
    )
    .bind(player_id)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn npc_story_ids(
    tx: &mut Transaction<'_, Postgres>,
) -> Result<(Option<i64>, Option<i64>), AppError> {
    let rows = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, name FROM npc_templates WHERE name = ANY($1::text[])",
    )
    .bind([LUNA_NAME, SHADOW_NAME])
    .fetch_all(&mut **tx)
    .await?;
    Ok((
        rows.iter()
            .find_map(|(id, name)| (name == LUNA_NAME).then_some(*id)),
        rows.iter()
            .find_map(|(id, name)| (name == SHADOW_NAME).then_some(*id)),
    ))
}

async fn require_npc(
    tx: &mut Transaction<'_, Postgres>,
    npc_id: i64,
    expected_name: &str,
) -> Result<(), AppError> {
    require_npc_optional(tx, Some(npc_id), expected_name).await
}

async fn require_npc_optional(
    tx: &mut Transaction<'_, Postgres>,
    npc_id: Option<i64>,
    expected_name: &str,
) -> Result<(), AppError> {
    let name = if let Some(npc_id) = npc_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM npc_templates WHERE id = $1")
            .bind(npc_id)
            .fetch_optional(&mut **tx)
            .await?
    } else {
        None
    };
    if name.as_deref() != Some(expected_name) {
        return Err(AppError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "剧情互动目标不匹配",
        ));
    }
    Ok(())
}

async fn lock_player(tx: &mut Transaction<'_, Postgres>, player_id: i64) -> Result<(), AppError> {
    sqlx::query("SELECT id FROM players WHERE id = $1 FOR UPDATE")
        .bind(player_id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(())
}

pub(crate) async fn grant_luna_contract(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
) -> Result<Value, AppError> {
    let spirit = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, name FROM card_spirit_templates WHERE name = $1",
    )
    .bind(LUNA_NAME)
    .fetch_optional(&mut **tx)
    .await?;
    let card = sqlx::query_as::<_, (i64, String, Option<i64>)>(
        "SELECT id, name, source_spirit_id FROM card_templates WHERE name = $1",
    )
    .bind(LUNA_CARD_NAME)
    .fetch_optional(&mut **tx)
    .await?;
    let (spirit_template_id, spirit_name) = spirit.ok_or_else(missing_contract_template)?;
    let (card_template_id, card_name, source_spirit_id) =
        card.ok_or_else(missing_contract_template)?;
    if source_spirit_id != Some(spirit_template_id) {
        return Err(AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "月牙撕裂未绑定露娜卡灵模板",
        ));
    }
    let active_deck_id = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM decks WHERE player_id = $1 AND is_active = TRUE FOR UPDATE",
    )
    .bind(player_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::CONFLICT, "请先设置一副启用套牌再完成露娜契约"))?;
    let inserted_spirit_id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO player_card_spirits (player_id, spirit_template_id)
           VALUES ($1, $2) ON CONFLICT (player_id, spirit_template_id) DO NOTHING RETURNING id"#,
    )
    .bind(player_id)
    .bind(spirit_template_id)
    .fetch_optional(&mut **tx)
    .await?;
    let spirit_created = inserted_spirit_id.is_some();
    let spirit_id = if let Some(id) = inserted_spirit_id {
        id
    } else {
        sqlx::query_scalar::<_, i64>(
            "SELECT id FROM player_card_spirits WHERE player_id = $1 AND spirit_template_id = $2",
        )
        .bind(player_id)
        .bind(spirit_template_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::new(StatusCode::INTERNAL_SERVER_ERROR, "露娜卡灵发放失败"))?
    };
    let card_row = sqlx::query_as::<_, (i64, i32)>(
        r#"INSERT INTO player_cards (player_id, card_template_id, level, count)
           VALUES ($1, $2, 1, 2)
           ON CONFLICT (player_id, card_template_id, level) DO UPDATE
           SET count = GREATEST(player_cards.count, 2)
           RETURNING id, count"#,
    )
    .bind(player_id)
    .bind(card_template_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::INTERNAL_SERVER_ERROR, "月牙撕裂发放失败"))?;
    let previous_deck_amount = sqlx::query_scalar::<_, i32>(
        "SELECT amount FROM deck_cards WHERE deck_id = $1 AND card_id = $2 FOR UPDATE",
    )
    .bind(active_deck_id)
    .bind(card_row.0)
    .fetch_optional(&mut **tx)
    .await?;
    let deck_amount = sqlx::query_scalar::<_, i32>(
        r#"INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
           VALUES ($1, $2, $3, 2)
           ON CONFLICT (deck_id, card_id) DO UPDATE SET amount = GREATEST(deck_cards.amount, 2)
           RETURNING amount"#,
    )
    .bind(active_deck_id)
    .bind(card_row.0)
    .bind(player_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "月牙撕裂加入启用套牌失败",
        )
    })?;
    Ok(contract_reward_projection(
        spirit_id,
        spirit_template_id,
        spirit_name,
        spirit_created,
        card_row.0,
        card_template_id,
        card_name,
        card_row.1,
        deck_amount,
        previous_deck_amount,
    ))
}

pub(crate) async fn validate_story_battle(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    enemy_name: &str,
    enemy_reward: &Value,
) -> Result<(), AppError> {
    let gate = enemy_reward
        .get("story_gate")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if gate.is_empty() {
        return Ok(());
    }
    if gate != STORY_KEY {
        return Err(AppError::new(StatusCode::FORBIDDEN, "该剧情战斗尚未开放"));
    }
    let progress = lock_progress(tx, player_id).await?;
    let tasks = load_tasks(tx, player_id).await?;
    let stage = effective_stage(progress.as_ref(), &tasks);
    let map_name = current_map_name(tx, player_id).await?;
    if enemy_name == LUNA_NAME {
        if progress.is_none() || stage != "forest_signal" {
            return Err(AppError::new(
                StatusCode::CONFLICT,
                "请先完成晨曦村的入村准备",
            ));
        }
        if map_name.as_deref() != Some(FOREST_NAME) {
            return Err(AppError::new(
                StatusCode::CONFLICT,
                "需要在微光森林的月光空地发起这场战斗",
            ));
        }
        sqlx::query(
            "UPDATE player_story_progress SET stage = 'forest_signal', updated_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND story_key = $2",
        )
        .bind(player_id)
        .bind(STORY_KEY)
        .execute(&mut **tx)
        .await?;
        return Ok(());
    }
    if enemy_name == SHADOW_NAME {
        if moon_trace_stage(progress.as_ref()) != Some("moon_trace_battle") {
            return Err(AppError::new(
                StatusCode::CONFLICT,
                "请先完成三处固定证据调查",
            ));
        }
        if map_name.as_deref() != Some(FOREST_NAME) {
            return Err(AppError::new(
                StatusCode::CONFLICT,
                "需要在微光森林发起雾痕兽影战斗",
            ));
        }
        return Ok(());
    }
    Err(AppError::new(StatusCode::FORBIDDEN, "剧情战斗目标不匹配"))
}

pub(crate) fn opening_battle_intro(enemy_name: &str, enemy_reward: &Value) -> Option<Value> {
    if enemy_reward.get("story_gate").and_then(Value::as_str) != Some(STORY_KEY) {
        return None;
    }
    if enemy_name == SHADOW_NAME {
        return Some(json!({
            "story_key": STORY_KEY,
            "event": "moon_trace_shadow",
            "message": "三处固定证据共鸣，污染凝成了雾痕兽影。",
            "dialogue": [
                {"speaker":"系统","text":"三处证据同时发出银白微光，雾核凝成一头没有气味的兽影。"},
                {"speaker":"主角","text":"它在模仿狼族的力量。击散它，才能留下完整的断月纹记录。"},
            ],
        }));
    }
    (enemy_name == LUNA_NAME).then(|| json!({
        "story_key": STORY_KEY,
        "event": "luna_resonance",
        "message": "负伤露娜把玩家误认为污染源，要求用基础卡牌的稳定回路证明清白。",
        "dialogue": [
            {"speaker":"露娜","text":"别靠近！你身上的月牙共鸣正在牵动我的旧伤。你和雾袭者是什么关系？"},
            {"speaker":"主角","text":"我刚离开晨曦村，也在追查逆流的雾。你已经受伤了，先停下来。"},
            {"speaker":"露娜","text":"相同的纹路刚刚伤了我和狼族领地。用你的基础卡牌证明这道回路没有污染。"},
        ],
    }))
}

pub(crate) async fn mark_opening_battle_complete(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    enemy_name: &str,
    enemy_reward: &Value,
    result: &str,
) -> Result<Option<Value>, AppError> {
    if enemy_reward.get("story_gate").and_then(Value::as_str) != Some(STORY_KEY) {
        return Ok(None);
    }
    let Some(progress) = lock_progress(tx, player_id).await? else {
        return Ok(None);
    };
    if result != "victory" {
        return Ok(None);
    }
    if enemy_name == SHADOW_NAME {
        let moon_stage = moon_trace_stage(Some(&progress));
        if !matches!(
            moon_stage,
            Some("moon_trace_battle")
                | Some("moon_trace_return")
                | Some("moon_trace_stage1_complete")
        ) {
            return Ok(None);
        }
        if moon_stage == Some("moon_trace_battle") {
            let mut data = object_data(progress.data_json);
            data.insert("moon_trace_stage".to_owned(), json!("moon_trace_return"));
            data.insert("moon_trace_shadow_completed".to_owned(), json!(true));
            data.insert(
                "moon_trace_investigation_record".to_owned(),
                json!("断月纹排列记录"),
            );
            sqlx::query(
                "UPDATE player_story_progress SET data_json=$1,updated_at=CURRENT_TIMESTAMP WHERE player_id=$2 AND story_key=$3",
            )
            .bind(Value::Object(data))
            .bind(player_id)
            .bind(STORY_KEY)
            .execute(&mut **tx)
            .await?;
        }
        return Ok(Some(json!({
            "story_key": STORY_KEY,
            "stage": "complete",
            "event": "moon_trace_shadow",
            "message": "雾痕兽影已经消散，确定性调查记录已保存。返回晨曦村向露娜回报。",
            "dialogue": [
                {"speaker":"系统","text":"雾痕兽影崩解，留下无法自然形成的断月纹排列。调查记录已保存。"},
                {"speaker":"主角","text":"证据已经足够。该回晨曦村向露娜回报了。"},
            ],
        })));
    }
    if enemy_name != LUNA_NAME {
        return Ok(None);
    }
    if progress.stage == "complete" {
        return Ok(Some(json!({"story_key":STORY_KEY,"stage":"complete"})));
    }
    let contract_reward = grant_luna_contract(tx, player_id).await?;
    let mut data = object_data(progress.data_json);
    data.insert("luna_battle_completed".to_owned(), json!(true));
    data.insert("luna_contract_completed".to_owned(), json!(true));
    data.insert("luna_contract_version".to_owned(), json!(1));
    data.insert("luna_injured".to_owned(), json!(true));
    data.insert(
        "luna_recovery_state".to_owned(),
        json!("returning_to_village"),
    );
    data.insert("luna_returning_to_village".to_owned(), json!(true));
    data.insert("main_quest".to_owned(), json!("月痕追迹"));
    sqlx::query(
        "UPDATE player_story_progress SET stage='return_village',data_json=$1,updated_at=CURRENT_TIMESTAMP WHERE player_id=$2 AND story_key=$3",
    )
    .bind(Value::Object(data))
    .bind(player_id)
    .bind(STORY_KEY)
    .execute(&mut **tx)
    .await?;
    Ok(Some(json!({
        "story_key": STORY_KEY,
        "stage": "return_village",
        "event": "luna_contract",
        "reward_kind": "fixed_newbie_reward",
        "message": "露娜把自身月痕凝成共鸣卡灵投影。完整「狼娘·露娜」卡灵与「月牙撕裂」×2 已加入收藏和启用套牌；实体露娜仍需带回村疗伤。",
        "dialogue": [
            {"speaker":"露娜","text":"咳……旧伤裂开了。月痕还在吞噬我的意识……"},
            {"speaker":"主角","text":"别再动了。我会用基础卡牌的共鸣先稳住它。"},
            {"speaker":"露娜","text":"你的回路没有污染……是我认错了人。可我已经走不回安全的地方。"},
            {"speaker":"露娜","text":"收下这道月痕。它会化成我的卡灵投影，代替现在的我与你并肩。"},
            {"speaker":"露娜","text":"污染源还在森林深处……替我追下去。这是我交给你的长期委托——月痕追迹。"},
            {"speaker":"主角","text":"先别说了。我带你回晨曦村疗伤。"},
            {"speaker":"露娜","text":"那就……拜托你了。"},
        ],
        "contract_reward": contract_reward,
    })))
}

fn missing_contract_template() -> AppError {
    AppError::new(
        StatusCode::INTERNAL_SERVER_ERROR,
        "露娜契约依赖的卡灵或卡牌模板不存在",
    )
}

#[allow(clippy::too_many_arguments)]
fn contract_reward_projection(
    spirit_id: i64,
    spirit_template_id: i64,
    spirit_name: String,
    spirit_created: bool,
    card_id: i64,
    card_template_id: i64,
    card_name: String,
    card_count: i32,
    deck_amount: i32,
    previous_deck_amount: Option<i32>,
) -> Value {
    json!({
        "spirit": {
            "id": spirit_id,
            "template_id": spirit_template_id,
            "name": spirit_name,
            "created": spirit_created,
        },
        "card": {
            "id": card_id,
            "template_id": card_template_id,
            "name": card_name,
            "count": card_count,
            "deck_amount": deck_amount,
            "added_to_active_deck": previous_deck_amount.is_none_or(|amount| amount < 2),
        },
    })
}

fn validate_village_action(payload: &OpeningVillageActionRequest) -> Result<(), AppError> {
    if payload.action != "accept_village_preparation" {
        return Err(AppError::validation_field(
            "action",
            "literal_error",
            "Input should be 'accept_village_preparation'",
            json!(payload.action),
        ));
    }
    if payload.npc_id <= 0 {
        return Err(AppError::validation_field(
            "npc_id",
            "greater_than",
            "Input should be greater than 0",
            json!(payload.npc_id),
        ));
    }
    Ok(())
}

fn validate_moon_action(payload: &OpeningActionRequest) -> Result<(), AppError> {
    if !matches!(
        payload.action.as_str(),
        "accept_stage1" | "confirm_guide" | "inspect_evidence" | "report_stage1"
    ) {
        return Err(AppError::validation_field(
            "action",
            "literal_error",
            "Input should be 'accept_stage1', 'confirm_guide', 'inspect_evidence' or 'report_stage1'",
            json!(payload.action),
        ));
    }
    if payload.npc_id.is_some_and(|value| value <= 0) {
        return Err(AppError::validation_field(
            "npc_id",
            "greater_than",
            "Input should be greater than 0",
            json!(payload.npc_id),
        ));
    }
    if let Some(value) = payload.evidence_id.as_deref() {
        if value.chars().count() > 64 {
            return Err(AppError::validation_field(
                "evidence_id",
                "string_too_long",
                "String should have at most 64 characters",
                json!(value),
            ));
        }
        if value.is_empty()
            || !value
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
        {
            return Err(AppError::validation_field(
                "evidence_id",
                "string_pattern_mismatch",
                "String should match pattern '^[A-Za-z0-9_-]+$'",
                json!(value),
            ));
        }
    }
    Ok(())
}

fn task_ready(task: &TaskRow) -> bool {
    task.status.as_deref() == Some("completed")
        || task
            .progress
            .as_ref()
            .and_then(|value| value.get("ready"))
            .and_then(Value::as_bool)
            .unwrap_or(false)
}

fn effective_stage<'a>(progress: Option<&'a ProgressRow>, tasks: &[TaskRow]) -> &'a str {
    let Some(progress) = progress else {
        return "arrival";
    };
    let stage = if OPENING_STAGES.contains(&progress.stage.as_str()) {
        progress.stage.as_str()
    } else {
        "arrival"
    };
    if stage == "prepare" && tasks.iter().all(task_ready) {
        "forest_signal"
    } else {
        stage
    }
}

fn moon_trace_stage(progress: Option<&ProgressRow>) -> Option<&str> {
    let progress = progress.filter(|value| value.stage == "complete")?;
    let stage = progress
        .data_json
        .get("moon_trace_stage")
        .and_then(Value::as_str)
        .unwrap_or("moon_trace_accept");
    Some(if MOON_TRACE_STAGES.contains(&stage) {
        stage
    } else {
        "moon_trace_accept"
    })
}

fn normalized_evidence(value: Option<&Value>) -> Vec<String> {
    let mut values: Vec<String> = value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|value| is_evidence(value))
        .map(ToOwned::to_owned)
        .collect();
    values.sort();
    values.dedup();
    values
}

fn is_evidence(value: &str) -> bool {
    EVIDENCE.iter().any(|(id, _, _)| *id == value)
}

fn task_data(task: &TaskRow) -> Value {
    let state = task.progress.as_ref().unwrap_or(&Value::Null);
    json!({
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status.as_deref().unwrap_or("not_started"),
        "ready": task_ready(task),
        "current": state.get("current").and_then(Value::as_i64).unwrap_or(0).max(0),
        "target": state.get("target").and_then(Value::as_i64).unwrap_or(1).max(1),
    })
}

fn objective(stage: &str, current_map_name: Option<&str>) -> Value {
    match stage {
        "arrival" => json!({"title":"抵达晨曦村","description":"听村长说明入村准备，开始序章。"}),
        "meet_chief" => {
            json!({"title":"与晨曦村村长对话","description":"前往村庄中央与村长交谈，领取三项入村准备。"})
        }
        "prepare" => {
            json!({"title":"完成入村准备","description":"准备暖茶、完成训练切磋，并记录一次植物采集。"})
        }
        "forest_signal" => {
            json!({"title":"调查月光空地","description":"前往微光森林西北侧的月光空地，与狼娘·露娜交谈。"})
        }
        "return_village" => json!({
            "title":"带露娜返回晨曦村疗伤",
            "description": if current_map_name == Some(VILLAGE_NAME) {
                "露娜已抵达晨曦村。请让村长和向导安排疗养。"
            } else {
                "护送负伤的实体露娜返回晨曦村疗养点。"
            },
        }),
        _ => {
            json!({"title":"月痕追迹","description":"序章已完成。前往疗养点继续露娜托付的长期调查。"})
        }
    }
}

fn moon_trace_objective(stage: &str, evidence_count: usize) -> Value {
    match stage {
        "moon_trace_accept" => {
            json!({"title":"与疗养中的露娜交谈","description":"前往晨曦村东侧疗养点，接取《逆流雾源》。"})
        }
        "moon_trace_guide" => {
            json!({"title":"向森林向导确认雾流","description":"请向导标记第二处雾流逆转位置。"})
        }
        "moon_trace_evidence" => {
            json!({"title":format!("调查三处固定证据（{evidence_count}/3）"),"description":"前往微光森林调查月光植物、狼族足迹与断月雾核。"})
        }
        "moon_trace_battle" => {
            json!({"title":"击败雾痕兽影","description":"三处证据已经共鸣。击败污染凝成的兽影并保存调查记录。"})
        }
        "moon_trace_return" => {
            json!({"title":"返回晨曦村向露娜回报","description":"把断月纹调查记录交给疗养中的露娜。"})
        }
        _ => {
            json!({"title":"追查操纵断月纹的人","description":"《逆流雾源》已完成。露娜疗养期间，继续追查幕后操纵者。"})
        }
    }
}

fn completion_dialogue() -> Value {
    json!([
        {"speaker":"村长","text":"先救人，再谈月痕。向导，把东侧疗养间打开。"},
        {"speaker":"森林向导","text":"她会留在疗养点稳定旧伤，短时间内不能再进入森林。"},
        {"speaker":"露娜","text":"实体的我会留在这里疗养。卡灵投影仍会代替现在的我与你并肩。"},
        {"speaker":"露娜","text":"等我醒来，到疗养点找我。第二处逆流雾源还需要确认。"},
        {"speaker":"系统","text":"序章《雾中月痕》完成。长期主线《月痕追迹》已发布。"},
    ])
}

fn object_data(value: Value) -> Map<String, Value> {
    value.as_object().cloned().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(status: Option<&str>, progress: Value) -> TaskRow {
        TaskRow {
            id: 1,
            title: "村道补给".to_owned(),
            description: String::new(),
            reward_json: json!({}),
            status: status.map(ToOwned::to_owned),
            progress: Some(progress),
        }
    }

    #[test]
    fn ready_tasks_promote_prepare_to_effective_forest_stage() {
        let progress = ProgressRow {
            stage: "prepare".to_owned(),
            data_json: json!({}),
            completed_at: None,
        };
        let tasks = vec![
            task(Some("active"), json!({"ready":true})),
            task(Some("completed"), json!({})),
            task(Some("active"), json!({"ready":true})),
        ];
        assert_eq!(effective_stage(Some(&progress), &tasks), "forest_signal");
    }

    #[test]
    fn evidence_is_filtered_sorted_and_deduplicated() {
        let value = json!([
            "moonlight_flora",
            "unknown",
            "broken_wolf_tracks",
            "moonlight_flora"
        ]);
        assert_eq!(
            normalized_evidence(Some(&value)),
            vec!["broken_wolf_tracks", "moonlight_flora"]
        );
    }

    #[test]
    fn contract_projection_reports_idempotent_deck_state() {
        let value = contract_reward_projection(
            1,
            2,
            LUNA_NAME.to_owned(),
            false,
            3,
            4,
            LUNA_CARD_NAME.to_owned(),
            2,
            2,
            Some(2),
        );
        assert_eq!(value["spirit"]["created"], false);
        assert_eq!(value["card"]["added_to_active_deck"], false);
    }

    #[test]
    fn invalid_moon_action_fields_are_rejected() {
        let payload = OpeningActionRequest {
            action: "unknown".to_owned(),
            npc_id: None,
            evidence_id: None,
        };
        assert!(validate_moon_action(&payload).is_err());
        let payload = OpeningActionRequest {
            action: "inspect_evidence".to_owned(),
            npc_id: Some(0),
            evidence_id: Some("bad value".to_owned()),
        };
        assert!(validate_moon_action(&payload).is_err());
    }
}
