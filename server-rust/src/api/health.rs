use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::{error::AppError, AppState};

pub async fn live() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

pub async fn ready(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    sqlx::query("SELECT 1").execute(state.pool()).await?;
    Ok(Json(json!({"status": "ready"})))
}
