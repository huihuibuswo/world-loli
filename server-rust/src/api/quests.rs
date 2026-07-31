use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Row, Transaction};

use crate::{auth::AuthPlayer, error::AppError, response::ApiResponse, AppState};

pub(crate) async fn list_quests(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Vec<Value>>>, AppError> {
    let rows = sqlx::query(
        r#"SELECT quest.id, quest.title, quest.description, quest.type, quest.reward_json,
                  progress.status, progress.progress
           FROM quests quest LEFT JOIN player_quests progress
             ON progress.quest_id = quest.id AND progress.player_id = $1
           ORDER BY quest.id"#,
    )
    .bind(player.id)
    .fetch_all(state.pool())
    .await?;
    Ok(Json(ApiResponse::ok(rows.iter().map(quest_data).collect())))
}

pub(crate) async fn accept_quest(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(quest_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let quest_id = parse_path_integer(quest_id, "quest_id")?;
    let mut tx = state.pool().begin().await?;
    require_quest(&mut tx, quest_id).await?;
    lock_player(&mut tx, player.id).await?;
    let current = sqlx::query_scalar::<_, String>(
        "SELECT status FROM player_quests WHERE player_id = $1 AND quest_id = $2 FOR UPDATE",
    )
    .bind(player.id)
    .bind(quest_id)
    .fetch_optional(&mut *tx)
    .await?;
    if current
        .as_deref()
        .is_some_and(|status| status != "not_started")
    {
        return Err(AppError::new(StatusCode::CONFLICT, "任务已经领取"));
    }
    sqlx::query(
        r#"INSERT INTO player_quests (player_id, quest_id, status, progress)
           VALUES ($1, $2, 'active', '{}'::jsonb)
           ON CONFLICT (player_id, quest_id) DO UPDATE SET status = 'active'"#,
    )
    .bind(player.id)
    .bind(quest_id)
    .execute(&mut *tx)
    .await?;
    let data = fetch_quest_data(&mut tx, player.id, quest_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "任务已领取")))
}

pub(crate) async fn complete_quest(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(quest_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let quest_id = parse_path_integer(quest_id, "quest_id")?;
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    let quest = sqlx::query("SELECT reward_json FROM quests WHERE id = $1")
        .bind(quest_id)
        .fetch_optional(&mut *tx)
        .await?;
    let progress = sqlx::query(
        "SELECT status, progress FROM player_quests WHERE player_id = $1 AND quest_id = $2 FOR UPDATE",
    )
    .bind(player.id)
    .bind(quest_id)
    .fetch_optional(&mut *tx)
    .await?;
    let (quest, progress) = match (quest, progress) {
        (Some(quest), Some(progress)) => (quest, progress),
        _ => return Err(AppError::new(StatusCode::NOT_FOUND, "任务不存在或尚未领取")),
    };
    let status: String = progress.get("status");
    if status == "completed" {
        return Err(AppError::new(StatusCode::CONFLICT, "任务已经完成"));
    }
    let progress_json: Value = progress.get("progress");
    if status != "active"
        || !progress_json
            .get("ready")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    {
        return Err(AppError::new(StatusCode::CONFLICT, "任务条件尚未完成"));
    }
    let reward: Value = quest.get("reward_json");
    let gold = reward
        .get("gold")
        .and_then(Value::as_i64)
        .unwrap_or(0)
        .clamp(0, 1_000_000);
    sqlx::query("UPDATE players SET gold = gold + $1 WHERE id = $2")
        .bind(gold)
        .bind(player.id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "UPDATE player_quests SET status = 'completed' WHERE player_id = $1 AND quest_id = $2",
    )
    .bind(player.id)
    .bind(quest_id)
    .execute(&mut *tx)
    .await?;
    let data = fetch_quest_data(&mut tx, player.id, quest_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "任务已完成")))
}

pub(crate) async fn quest_progress(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(quest_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let quest_id = parse_path_integer(quest_id, "quest_id")?;
    let mut tx = state.pool().begin().await?;
    require_quest(&mut tx, quest_id).await?;
    let data = fetch_quest_data(&mut tx, player.id, quest_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::ok(data)))
}

async fn require_quest(tx: &mut Transaction<'_, Postgres>, quest_id: i64) -> Result<(), AppError> {
    if sqlx::query_scalar::<_, i64>("SELECT id FROM quests WHERE id = $1")
        .bind(quest_id)
        .fetch_optional(&mut **tx)
        .await?
        .is_none()
    {
        return Err(AppError::new(StatusCode::NOT_FOUND, "任务不存在"));
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

async fn fetch_quest_data(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    quest_id: i64,
) -> Result<Value, AppError> {
    let row = sqlx::query(
        r#"SELECT quest.id, quest.title, quest.description, quest.type, quest.reward_json,
                  progress.status, progress.progress
           FROM quests quest LEFT JOIN player_quests progress
             ON progress.quest_id = quest.id AND progress.player_id = $1
           WHERE quest.id = $2"#,
    )
    .bind(player_id)
    .bind(quest_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(quest_data(&row))
}

fn quest_data(row: &sqlx::postgres::PgRow) -> Value {
    json!({
        "id": row.get::<i64, _>("id"),
        "title": row.get::<String, _>("title"),
        "description": row.get::<String, _>("description"),
        "type": row.get::<String, _>("type"),
        "reward": row.get::<Value, _>("reward_json"),
        "status": row.get::<Option<String>, _>("status").unwrap_or_else(|| "not_started".to_owned()),
        "progress": row.get::<Option<Value>, _>("progress").unwrap_or_else(|| json!({})),
    })
}

fn parse_path_integer(value: String, field: &str) -> Result<i64, AppError> {
    value
        .parse()
        .map_err(|_| AppError::validation_path_integer(field, value))
}
