use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use validator::{Validate, ValidationErrors};

use crate::{
    auth::{create_access_token, AuthUser},
    error::AppError,
    models::User,
    response::ApiResponse,
    AppState,
};

const STARTER_DECK: [(&str, i32); 2] = [("基础攻击", 6), ("防御姿态", 6)];

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 64), custom(function = "validate_username"))]
    username: String,
    #[validate(length(min = 8, max = 128))]
    password: String,
    #[validate(email)]
    email: Option<String>,
    #[validate(length(min = 1, max = 64))]
    player_name: Option<String>,
    #[serde(default = "default_avatar_gender")]
    avatar_gender: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct PublicUser {
    id: i64,
    username: String,
    email: Option<String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct RegisterData {
    access_token: String,
    token_type: &'static str,
    user: PublicUser,
    player_id: i64,
}

#[derive(Debug, Serialize)]
pub(crate) struct TokenData {
    access_token: String,
    token_type: &'static str,
}

#[derive(Debug, Serialize)]
pub(crate) struct UserProfile {
    id: i64,
    username: String,
    email: Option<String>,
    created_at: DateTime<Utc>,
    last_login_at: Option<DateTime<Utc>>,
}

fn default_avatar_gender() -> String {
    "female".to_owned()
}

fn validate_username(value: &str) -> Result<(), validator::ValidationError> {
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
    {
        Ok(())
    } else {
        Err(validator::ValidationError::new("username"))
    }
}

pub(crate) async fn register(
    State(state): State<AppState>,
    payload: Result<Json<RegisterRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<ApiResponse<RegisterData>>), AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate(&payload)?;
    if payload.avatar_gender != "female" && payload.avatar_gender != "male" {
        return Err(AppError::validation_field(
            "avatar_gender",
            "literal_error",
            "Input should be 'female' or 'male'",
            Value::String(payload.avatar_gender),
        ));
    }

    let username = payload.username.trim().to_lowercase();
    let email = payload.email.map(|value| value.to_lowercase());
    let player_name = payload
        .player_name
        .unwrap_or_else(|| username.clone())
        .trim()
        .to_owned();

    let duplicate = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM users WHERE username = $1 OR ($2::text IS NOT NULL AND email = $2) LIMIT 1",
    )
    .bind(&username)
    .bind(&email)
    .fetch_optional(state.pool())
    .await?;
    if duplicate.is_some() {
        return Err(AppError::new(StatusCode::CONFLICT, "用户名或邮箱已存在"));
    }

    let passwords = state.passwords().clone();
    let password = payload.password;
    let password_hash = tokio::task::spawn_blocking(move || passwords.hash(&password))
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "password hashing task failed");
            AppError::new(StatusCode::INTERNAL_SERVER_ERROR, "服务器内部错误")
        })??;

    let mut transaction = state.pool().begin().await?;
    let first_map = sqlx::query_as::<_, (i64, Value)>(
        "SELECT id, resource_json FROM map_data ORDER BY id LIMIT 1",
    )
    .fetch_optional(&mut *transaction)
    .await?;
    let (current_map, position_x, position_y) = first_map
        .as_ref()
        .map(|(id, resource)| {
            let spawn = resource.get("spawn");
            (
                Some(*id),
                spawn
                    .and_then(|value| value.get("x"))
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0),
                spawn
                    .and_then(|value| value.get("y"))
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0),
            )
        })
        .unwrap_or((None, 0.0, 0.0));

    let user_id = sqlx::query_scalar::<_, i64>(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(&username)
    .bind(&email)
    .bind(password_hash)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| registration_database_error(error, "用户名或邮箱已存在"))?;

    let player_id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO players (
            user_id, name, avatar_gender, level, exp, hp, attack, defense, gold,
            current_map, position_x, position_y, day_index, minute_of_day
        ) VALUES ($1, $2, $3, 1, 0, 75, 10, 5, 300, $4, $5, $6, 1, 480)
        RETURNING id"#,
    )
    .bind(user_id)
    .bind(&player_name)
    .bind(&payload.avatar_gender)
    .bind(current_map)
    .bind(position_x)
    .bind(position_y)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| registration_database_error(error, "账号或角色名称冲突"))?;

    let template_rows = sqlx::query_as::<_, (i64, String)>(
        "SELECT id, name FROM card_templates WHERE name = ANY($1::text[])",
    )
    .bind(STARTER_DECK.map(|(name, _)| name))
    .fetch_all(&mut *transaction)
    .await?;
    let missing: Vec<&str> = STARTER_DECK
        .iter()
        .filter_map(|(name, _)| {
            (!template_rows.iter().any(|(_, value)| value == name)).then_some(*name)
        })
        .collect();
    if !missing.is_empty() {
        return Err(AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("初始套牌缺少卡牌模板：{}", missing.join(", ")),
        ));
    }

    let deck_id = sqlx::query_scalar::<_, i64>(
        "INSERT INTO decks (player_id, name, is_active) VALUES ($1, '初始套牌', TRUE) RETURNING id",
    )
    .bind(player_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|error| registration_database_error(error, "账号或角色名称冲突"))?;

    for (template_name, amount) in STARTER_DECK {
        let template_id = template_rows
            .iter()
            .find_map(|(id, name)| (name == template_name).then_some(*id))
            .expect("missing templates checked above");
        let card_id = sqlx::query_scalar::<_, i64>(
            "INSERT INTO player_cards (player_id, card_template_id, count) VALUES ($1, $2, $3) RETURNING id",
        )
        .bind(player_id)
        .bind(template_id)
        .bind(amount)
        .fetch_one(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO deck_cards (deck_id, card_id, player_id, amount) VALUES ($1, $2, $3, $4)",
        )
        .bind(deck_id)
        .bind(card_id)
        .bind(player_id)
        .bind(amount)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;
    let access_token = create_access_token(&state, user_id)?;
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::with_message(
            RegisterData {
                access_token,
                token_type: "bearer",
                user: PublicUser {
                    id: user_id,
                    username,
                    email,
                },
                player_id,
            },
            "注册成功",
        )),
    ))
}

pub(crate) async fn login(
    State(state): State<AppState>,
    payload: Result<Json<LoginRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<TokenData>>, AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    let username = payload.username.trim().to_lowercase();
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, email, created_at, last_login_at FROM users WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(state.pool())
    .await?;
    let candidate_hash = user.as_ref().map(|value| value.password_hash.clone());
    let passwords = state.passwords().clone();
    let password = payload.password;
    let password_valid =
        tokio::task::spawn_blocking(move || passwords.verify(&password, candidate_hash.as_deref()))
            .await
            .map_err(|error| {
                tracing::error!(error = %error, "password verification task failed");
                AppError::new(StatusCode::INTERNAL_SERVER_ERROR, "服务器内部错误")
            })?;
    let user = user
        .filter(|_| password_valid)
        .ok_or_else(|| AppError::new(StatusCode::UNAUTHORIZED, "用户名或密码错误"))?;

    sqlx::query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(user.id)
        .execute(state.pool())
        .await?;
    Ok(Json(ApiResponse::with_message(
        TokenData {
            access_token: create_access_token(&state, user.id)?,
            token_type: "bearer",
        },
        "登录成功",
    )))
}

pub(crate) async fn profile(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<ApiResponse<UserProfile>>, AppError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, email, created_at, last_login_at FROM users WHERE id = $1",
    )
    .bind(user.id)
    .fetch_one(state.pool())
    .await?;
    Ok(Json(ApiResponse::ok(UserProfile {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
    })))
}

fn validate<T: Validate>(payload: &T) -> Result<(), AppError> {
    payload.validate().map_err(validator_rejection)
}

pub(crate) fn json_rejection(error: JsonRejection) -> AppError {
    AppError::validation(json!([{
        "type": "json_invalid",
        "loc": ["body"],
        "msg": error.body_text(),
        "input": null,
    }]))
}

pub(crate) fn validator_rejection(errors: ValidationErrors) -> AppError {
    let details = errors
        .field_errors()
        .iter()
        .flat_map(|(field, errors)| {
            errors.iter().map(move |error| {
                json!({
                    "type": error.code.as_ref(),
                    "loc": ["body", *field],
                    "msg": error
                        .message
                        .as_ref()
                        .map(ToString::to_string)
                        .unwrap_or_else(|| error.code.to_string()),
                    "input": null,
                })
            })
        })
        .collect();
    AppError::validation(Value::Array(details))
}

fn registration_database_error(error: sqlx::Error, conflict_message: &'static str) -> AppError {
    if error
        .as_database_error()
        .and_then(|value| value.code())
        .as_deref()
        == Some("23505")
    {
        AppError::new(StatusCode::CONFLICT, conflict_message)
    } else {
        AppError::database(error)
    }
}
