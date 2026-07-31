use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::FromRow;

#[derive(Debug, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub email: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct PlayerData {
    pub id: i64,
    pub name: String,
    pub avatar_gender: String,
    pub level: i32,
    pub exp: i64,
    pub hp: i32,
    pub attack: i32,
    pub defense: i32,
    pub gold: i64,
    pub current_map: Option<i64>,
    pub position_x: f64,
    pub position_y: f64,
    pub day_index: i32,
    pub minute_of_day: i32,
}

#[derive(Debug, FromRow)]
pub struct CurrentPlayer {
    pub id: i64,
    pub user_id: i64,
}

#[derive(Debug, FromRow, Serialize)]
pub struct SpiritSnapshot {
    pub id: i64,
    pub spirit_template_id: i64,
    pub level: i32,
    pub exp: i64,
    pub affection: i32,
    pub awaken_level: i32,
}

#[derive(Debug, FromRow, Serialize)]
pub struct CardSnapshot {
    pub id: i64,
    pub card_template_id: i64,
    pub level: i32,
    pub count: i32,
}

#[derive(Debug, FromRow, Serialize)]
pub struct QuestSnapshot {
    pub quest_id: i64,
    pub status: String,
    pub progress: Value,
}

#[derive(Debug, FromRow)]
pub struct DeckRow {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
}

#[derive(Debug, FromRow, Serialize)]
pub struct DeckCardSnapshot {
    pub card_id: i64,
    pub template_id: i64,
    pub name: String,
    pub cost: i32,
    pub level: i32,
    pub amount: i32,
}

#[derive(Debug, Serialize)]
pub struct DeckSnapshot {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
    pub cards: Vec<DeckCardSnapshot>,
}

#[derive(Debug, Serialize)]
pub struct SaveSnapshot {
    pub player: PlayerData,
    pub spirits: Vec<SpiritSnapshot>,
    pub cards: Vec<CardSnapshot>,
    pub decks: Vec<DeckSnapshot>,
    pub quests: Vec<QuestSnapshot>,
}

pub const PLAYER_COLUMNS: &str = r#"
    id, name, avatar_gender, level, exp, hp, attack, defense, gold,
    current_map, position_x, position_y, day_index, minute_of_day
"#;
