use axum::{body::Bytes, extract::State, Json};
use serde::Deserialize;
use serde_json::Value;

use crate::{
    api::player::fetch_player,
    auth::AuthPlayer,
    error::AppError,
    models::{
        CardSnapshot, DeckCardSnapshot, DeckRow, DeckSnapshot, QuestSnapshot, SaveSnapshot,
        SpiritSnapshot,
    },
    response::ApiResponse,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct SaveGameRequest {
    day_index: Option<i32>,
    minute_of_day: Option<i32>,
}

pub async fn load_save(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<SaveSnapshot>>, AppError> {
    Ok(Json(ApiResponse::ok(snapshot(&state, player.id).await?)))
}

pub async fn save_game(
    State(state): State<AppState>,
    player: AuthPlayer,
    body: Bytes,
) -> Result<Json<ApiResponse<SaveSnapshot>>, AppError> {
    let payload = parse_payload(&body)?;
    if let Some(payload) = payload {
        if payload.day_index.is_some_and(|value| value < 1)
            || payload
                .minute_of_day
                .is_some_and(|value| !(0..1440).contains(&value))
        {
            let (field, input) = if payload.day_index.is_some_and(|value| value < 1) {
                (
                    "day_index",
                    payload.day_index.map(Value::from).unwrap_or(Value::Null),
                )
            } else {
                (
                    "minute_of_day",
                    payload
                        .minute_of_day
                        .map(Value::from)
                        .unwrap_or(Value::Null),
                )
            };
            return Err(AppError::validation_field(
                field,
                "value_error",
                "Input is outside the allowed range",
                input,
            ));
        }
        sqlx::query(
            "UPDATE players SET day_index = COALESCE($1, day_index), minute_of_day = COALESCE($2, minute_of_day) WHERE id = $3",
        )
        .bind(payload.day_index)
        .bind(payload.minute_of_day)
        .bind(player.id)
        .execute(state.pool())
        .await?;
    }
    Ok(Json(ApiResponse::with_message(
        snapshot(&state, player.id).await?,
        "存档已同步",
    )))
}

fn parse_payload(body: &[u8]) -> Result<Option<SaveGameRequest>, AppError> {
    if body.is_empty() {
        return Ok(None);
    }
    serde_json::from_slice::<Option<SaveGameRequest>>(body).map_err(|error| {
        AppError::validation(serde_json::json!([{
            "type": "json_invalid",
            "loc": ["body"],
            "msg": error.to_string(),
            "input": null,
        }]))
    })
}

async fn snapshot(state: &AppState, player_id: i64) -> Result<SaveSnapshot, AppError> {
    let player = fetch_player(state, player_id).await?;
    let spirits = sqlx::query_as::<_, SpiritSnapshot>(
        r#"SELECT id, spirit_template_id, level, exp, affection, awaken_level
           FROM player_card_spirits WHERE player_id = $1 ORDER BY id"#,
    )
    .bind(player_id)
    .fetch_all(state.pool())
    .await?;
    let cards = sqlx::query_as::<_, CardSnapshot>(
        r#"SELECT id, card_template_id, level, count
           FROM player_cards WHERE player_id = $1 ORDER BY id"#,
    )
    .bind(player_id)
    .fetch_all(state.pool())
    .await?;
    let deck_rows = sqlx::query_as::<_, DeckRow>(
        "SELECT id, name, is_active FROM decks WHERE player_id = $1 ORDER BY id",
    )
    .bind(player_id)
    .fetch_all(state.pool())
    .await?;
    let mut decks = Vec::with_capacity(deck_rows.len());
    for deck in deck_rows {
        let deck_cards = sqlx::query_as::<_, DeckCardSnapshot>(
            r#"SELECT dc.card_id, ct.id AS template_id, ct.name, ct.cost, pc.level, dc.amount
               FROM deck_cards dc
               JOIN player_cards pc ON pc.id = dc.card_id
               JOIN card_templates ct ON ct.id = pc.card_template_id
               WHERE dc.deck_id = $1
               ORDER BY dc.card_id"#,
        )
        .bind(deck.id)
        .fetch_all(state.pool())
        .await?;
        decks.push(DeckSnapshot {
            id: deck.id,
            name: deck.name,
            is_active: deck.is_active,
            cards: deck_cards,
        });
    }
    let quests = sqlx::query_as::<_, QuestSnapshot>(
        "SELECT quest_id, status, progress FROM player_quests WHERE player_id = $1 ORDER BY quest_id",
    )
    .bind(player_id)
    .fetch_all(state.pool())
    .await?;
    Ok(SaveSnapshot {
        player,
        spirits,
        cards,
        decks,
        quests,
    })
}

#[cfg(test)]
mod tests {
    use super::parse_payload;

    #[test]
    fn accepts_empty_and_null_save_payloads() {
        assert!(parse_payload(b"").unwrap().is_none());
        assert!(parse_payload(b"null").unwrap().is_none());
        assert!(parse_payload(br#"{}"#).unwrap().is_some());
    }
}
