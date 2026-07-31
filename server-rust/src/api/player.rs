use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use validator::Validate;

use crate::{
    api::auth::{json_rejection, validator_rejection},
    auth::AuthPlayer,
    error::AppError,
    models::PlayerData,
    response::ApiResponse,
    AppState,
};

const PLAYER_SELECT: &str = r#"SELECT
    id, name, avatar_gender, level, exp, hp, attack, defense, gold,
    current_map, position_x, position_y, day_index, minute_of_day
    FROM players WHERE id = $1"#;

#[derive(Debug, Deserialize, Validate)]
pub struct PlayerUpdateRequest {
    #[validate(length(min = 1, max = 64))]
    name: String,
}

#[derive(Debug, Deserialize)]
pub struct LocationRequest {
    map_id: i64,
    position_x: f64,
    position_y: f64,
}

#[derive(Debug, Serialize)]
pub struct LocationData {
    map_id: Option<i64>,
    position_x: f64,
    position_y: f64,
}

pub async fn get_profile(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<PlayerData>>, AppError> {
    Ok(Json(ApiResponse::ok(
        fetch_player(&state, player.id).await?,
    )))
}

pub async fn update_profile(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<PlayerUpdateRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<PlayerData>>, AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    payload.validate().map_err(validator_rejection)?;
    let result = sqlx::query("UPDATE players SET name = $1 WHERE id = $2")
        .bind(payload.name.trim())
        .bind(player.id)
        .execute(state.pool())
        .await;
    if let Err(error) = result {
        if error
            .as_database_error()
            .and_then(|value| value.code())
            .as_deref()
            == Some("23505")
        {
            return Err(AppError::new(StatusCode::CONFLICT, "角色名称已存在"));
        }
        return Err(AppError::database(error));
    }
    Ok(Json(ApiResponse::with_message(
        fetch_player(&state, player.id).await?,
        "角色信息已更新",
    )))
}

pub async fn get_location(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<LocationData>>, AppError> {
    let data = fetch_player(&state, player.id).await?;
    Ok(Json(ApiResponse::ok(LocationData {
        map_id: data.current_map,
        position_x: data.position_x,
        position_y: data.position_y,
    })))
}

pub async fn save_location(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<LocationRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<LocationData>>, AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    let mut validation_errors = Vec::new();
    if payload.map_id <= 0 {
        validation_errors.push(json!({
            "type": "greater_than",
            "loc": ["body", "map_id"],
            "msg": "Input should be greater than 0",
            "input": payload.map_id,
        }));
    }
    for (field, value) in [
        ("position_x", payload.position_x),
        ("position_y", payload.position_y),
    ] {
        if !value.is_finite() {
            validation_errors.push(json!({
                "type": "finite_number",
                "loc": ["body", field],
                "msg": "Input should be a finite number",
                "input": null,
            }));
        }
    }
    if !validation_errors.is_empty() {
        return Err(AppError::validation(Value::Array(validation_errors)));
    }
    let current_map =
        sqlx::query_scalar::<_, Option<i64>>("SELECT current_map FROM players WHERE id = $1")
            .bind(player.id)
            .fetch_one(state.pool())
            .await?;
    if current_map != Some(payload.map_id) {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "请先通过地图进入接口切换区域",
        ));
    }
    let resource =
        sqlx::query_scalar::<_, Value>("SELECT resource_json FROM map_data WHERE id = $1")
            .bind(payload.map_id)
            .fetch_optional(state.pool())
            .await?
            .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "地图不存在"))?;
    if let Some(bounds) = resource.get("bounds") {
        let min_x = bounds.get("min_x").and_then(Value::as_f64).unwrap_or(0.0);
        let max_x = bounds.get("max_x").and_then(Value::as_f64).unwrap_or(0.0);
        let min_y = bounds.get("min_y").and_then(Value::as_f64).unwrap_or(0.0);
        let max_y = bounds.get("max_y").and_then(Value::as_f64).unwrap_or(0.0);
        if payload.position_x < min_x
            || payload.position_x > max_x
            || payload.position_y < min_y
            || payload.position_y > max_y
        {
            return Err(AppError::new(
                StatusCode::UNPROCESSABLE_ENTITY,
                "坐标超出地图边界",
            ));
        }
    }
    sqlx::query("UPDATE players SET position_x = $1, position_y = $2 WHERE id = $3")
        .bind(payload.position_x)
        .bind(payload.position_y)
        .bind(player.id)
        .execute(state.pool())
        .await?;
    Ok(Json(ApiResponse::with_message(
        LocationData {
            map_id: current_map,
            position_x: payload.position_x,
            position_y: payload.position_y,
        },
        "位置已保存",
    )))
}

pub(crate) async fn fetch_player(state: &AppState, player_id: i64) -> Result<PlayerData, AppError> {
    sqlx::query_as::<_, PlayerData>(PLAYER_SELECT)
        .bind(player_id)
        .fetch_one(state.pool())
        .await
        .map_err(AppError::from)
}
