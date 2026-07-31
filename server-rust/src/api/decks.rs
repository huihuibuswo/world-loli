use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::StatusCode,
    response::Response,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, Postgres, Transaction};

use crate::{
    api::auth::json_rejection, auth::AuthPlayer, error::AppError, response::ApiResponse, AppState,
};

#[derive(Debug, FromRow)]
struct DeckRow {
    id: i64,
    name: String,
    is_active: bool,
}

#[derive(Debug, FromRow, Serialize)]
struct DeckCardData {
    card_id: i64,
    template_id: i64,
    name: String,
    cost: i32,
    level: i32,
    amount: i32,
}

#[derive(Debug, Serialize)]
pub(crate) struct DeckData {
    id: i64,
    name: String,
    is_active: bool,
    cards: Vec<DeckCardData>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DeckCreateRequest {
    name: String,
    #[serde(default)]
    is_active: bool,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DeckUpdateRequest {
    name: Option<String>,
    is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct DeckCardRequest {
    card_id: i64,
    #[serde(default = "default_amount")]
    amount: i32,
}

pub(crate) async fn list_decks(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Vec<DeckData>>>, AppError> {
    let rows = sqlx::query_as::<_, DeckRow>(
        "SELECT id, name, is_active FROM decks WHERE player_id = $1 ORDER BY id",
    )
    .bind(player.id)
    .fetch_all(state.pool())
    .await?;
    let mut decks = Vec::with_capacity(rows.len());
    for deck in rows {
        let cards = sqlx::query_as::<_, DeckCardData>(
            r#"SELECT deck_card.card_id, template.id AS template_id, template.name,
                      template.cost, card.level, deck_card.amount
               FROM deck_cards deck_card
               JOIN player_cards card ON card.id = deck_card.card_id
               JOIN card_templates template ON template.id = card.card_template_id
               WHERE deck_card.deck_id = $1
               ORDER BY deck_card.card_id"#,
        )
        .bind(deck.id)
        .fetch_all(state.pool())
        .await?;
        decks.push(DeckData {
            id: deck.id,
            name: deck.name,
            is_active: deck.is_active,
            cards,
        });
    }
    Ok(Json(ApiResponse::ok(decks)))
}

pub(crate) async fn create_deck(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<DeckCreateRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<ApiResponse<DeckData>>), AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_name(&payload.name, "name")?;
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    if payload.is_active {
        sqlx::query("UPDATE decks SET is_active = FALSE WHERE player_id = $1")
            .bind(player.id)
            .execute(&mut *tx)
            .await?;
    }
    let deck_id = sqlx::query_scalar::<_, i64>(
        "INSERT INTO decks (player_id, name, is_active) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(player.id)
    .bind(payload.name.trim())
    .bind(payload.is_active)
    .fetch_one(&mut *tx)
    .await
    .map_err(deck_conflict)?;
    let data = deck_data_tx(&mut tx, deck_id).await?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::with_message(data, "套牌已创建")),
    ))
}

pub(crate) async fn update_deck(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(deck_id): Path<String>,
    payload: Result<Json<DeckUpdateRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<DeckData>>, AppError> {
    let deck_id = parse_path_integer(deck_id, "deck_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    if let Some(name) = payload.name.as_ref() {
        validate_name(name, "name")?;
    }
    let mut tx = state.pool().begin().await?;
    lock_player(&mut tx, player.id).await?;
    require_owned_deck(&mut tx, player.id, deck_id).await?;
    if payload.is_active == Some(true) {
        sqlx::query("UPDATE decks SET is_active = FALSE WHERE player_id = $1")
            .bind(player.id)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query(
        "UPDATE decks SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3",
    )
    .bind(payload.name.map(|name| name.trim().to_owned()))
    .bind(payload.is_active)
    .bind(deck_id)
    .execute(&mut *tx)
    .await
    .map_err(deck_conflict)?;
    let data = deck_data_tx(&mut tx, deck_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "套牌已更新")))
}

pub(crate) async fn delete_deck(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(deck_id): Path<String>,
) -> Result<Response, AppError> {
    let deck_id = parse_path_integer(deck_id, "deck_id")?;
    let result = sqlx::query("DELETE FROM decks WHERE id = $1 AND player_id = $2")
        .bind(deck_id)
        .bind(player.id)
        .execute(state.pool())
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::new(StatusCode::NOT_FOUND, "套牌不存在"));
    }
    Ok(Response::builder()
        .status(StatusCode::NO_CONTENT)
        .body(axum::body::Body::empty())
        .expect("valid empty response"))
}

pub(crate) async fn add_deck_card(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(deck_id): Path<String>,
    payload: Result<Json<DeckCardRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<DeckData>>, AppError> {
    let deck_id = parse_path_integer(deck_id, "deck_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_card_request(&payload)?;
    let mut tx = state.pool().begin().await?;
    require_owned_deck(&mut tx, player.id, deck_id).await?;
    let count = sqlx::query_scalar::<_, i32>(
        "SELECT count FROM player_cards WHERE id = $1 AND player_id = $2",
    )
    .bind(payload.card_id)
    .bind(player.id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌不存在"))?;
    if payload.amount > count {
        return Err(AppError::new(StatusCode::CONFLICT, "加入数量超过拥有数量"));
    }
    sqlx::query(
        r#"INSERT INTO deck_cards (deck_id, card_id, player_id, amount)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (deck_id, card_id) DO UPDATE SET amount = EXCLUDED.amount"#,
    )
    .bind(deck_id)
    .bind(payload.card_id)
    .bind(player.id)
    .bind(payload.amount)
    .execute(&mut *tx)
    .await?;
    let data = deck_data_tx(&mut tx, deck_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "套牌卡牌已更新")))
}

pub(crate) async fn remove_deck_card(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(deck_id): Path<String>,
    payload: Result<Json<DeckCardRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<DeckData>>, AppError> {
    let deck_id = parse_path_integer(deck_id, "deck_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_card_request(&payload)?;
    let mut tx = state.pool().begin().await?;
    require_owned_deck(&mut tx, player.id, deck_id).await?;
    let result = sqlx::query("DELETE FROM deck_cards WHERE deck_id = $1 AND card_id = $2")
        .bind(deck_id)
        .bind(payload.card_id)
        .execute(&mut *tx)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::new(StatusCode::NOT_FOUND, "套牌中不存在该卡牌"));
    }
    let data = deck_data_tx(&mut tx, deck_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "卡牌已移出套牌")))
}

async fn require_owned_deck(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    deck_id: i64,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM decks WHERE id = $1 AND player_id = $2 FOR UPDATE",
    )
    .bind(deck_id)
    .bind(player_id)
    .fetch_optional(&mut **tx)
    .await?;
    if exists.is_none() {
        return Err(AppError::new(StatusCode::NOT_FOUND, "套牌不存在"));
    }
    Ok(())
}

async fn deck_data_tx(
    tx: &mut Transaction<'_, Postgres>,
    deck_id: i64,
) -> Result<DeckData, AppError> {
    let deck = sqlx::query_as::<_, DeckRow>("SELECT id, name, is_active FROM decks WHERE id = $1")
        .bind(deck_id)
        .fetch_one(&mut **tx)
        .await?;
    let cards = sqlx::query_as::<_, DeckCardData>(
        r#"SELECT deck_card.card_id, template.id AS template_id, template.name,
                  template.cost, card.level, deck_card.amount
           FROM deck_cards deck_card
           JOIN player_cards card ON card.id = deck_card.card_id
           JOIN card_templates template ON template.id = card.card_template_id
           WHERE deck_card.deck_id = $1 ORDER BY deck_card.card_id"#,
    )
    .bind(deck_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(DeckData {
        id: deck.id,
        name: deck.name,
        is_active: deck.is_active,
        cards,
    })
}

fn validate_name(name: &str, field: &str) -> Result<(), AppError> {
    let length = name.chars().count();
    if length < 1 {
        return Err(AppError::validation_field(
            field,
            "string_too_short",
            "String should have at least 1 character",
            json!(name),
        ));
    }
    if length > 64 {
        return Err(AppError::validation_field(
            field,
            "string_too_long",
            "String should have at most 64 characters",
            json!(name),
        ));
    }
    Ok(())
}

fn validate_card_request(payload: &DeckCardRequest) -> Result<(), AppError> {
    if payload.card_id <= 0 {
        return Err(AppError::validation_field(
            "card_id",
            "greater_than",
            "Input should be greater than 0",
            json!(payload.card_id),
        ));
    }
    if payload.amount < 1 {
        return Err(AppError::validation_field(
            "amount",
            "greater_than_equal",
            "Input should be greater than or equal to 1",
            json!(payload.amount),
        ));
    }
    if payload.amount > 99 {
        return Err(AppError::validation_field(
            "amount",
            "less_than_equal",
            "Input should be less than or equal to 99",
            json!(payload.amount),
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

fn parse_path_integer(value: String, field: &str) -> Result<i64, AppError> {
    value
        .parse()
        .map_err(|_| AppError::validation_path_integer(field, value))
}

fn deck_conflict(error: sqlx::Error) -> AppError {
    if error
        .as_database_error()
        .and_then(|value| value.code())
        .as_deref()
        == Some("23505")
    {
        AppError::new(StatusCode::CONFLICT, "套牌名称已存在")
    } else {
        AppError::database(error)
    }
}

fn default_amount() -> i32 {
    1
}

#[cfg(test)]
mod tests {
    use axum::{body::to_bytes, response::IntoResponse};
    use serde_json::Value;

    use super::{validate_card_request, validate_name, DeckCardRequest};

    async fn error_type(error: crate::error::AppError) -> String {
        let response = error.into_response();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let value: Value = serde_json::from_slice(&bytes).unwrap();
        value["data"][0]["type"].as_str().unwrap().to_owned()
    }

    #[tokio::test]
    async fn deck_name_bounds_have_distinct_validation_types() {
        assert_eq!(
            error_type(validate_name("", "name").unwrap_err()).await,
            "string_too_short"
        );
        assert_eq!(
            error_type(validate_name(&"x".repeat(65), "name").unwrap_err()).await,
            "string_too_long"
        );
    }

    #[tokio::test]
    async fn deck_amount_bounds_have_distinct_validation_types() {
        let low = DeckCardRequest {
            card_id: 1,
            amount: 0,
        };
        let high = DeckCardRequest {
            card_id: 1,
            amount: 100,
        };
        assert_eq!(
            error_type(validate_card_request(&low).unwrap_err()).await,
            "greater_than_equal"
        );
        assert_eq!(
            error_type(validate_card_request(&high).unwrap_err()).await,
            "less_than_equal"
        );
    }
}
