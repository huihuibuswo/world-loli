use std::cmp::Reverse;

use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Postgres, Row, Transaction};

use crate::{
    api::auth::json_rejection, auth::AuthPlayer, error::AppError, response::ApiResponse, AppState,
};

#[derive(Debug, Deserialize)]
pub(crate) struct PlantCollectRequest {
    map_id: i64,
    node_id: String,
}
#[derive(Debug, Deserialize)]
pub(crate) struct SpiritGiftRequest {
    plant_template_id: i64,
}

pub(crate) async fn list_map_plants(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(map_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<Value>>>, AppError> {
    let map_id = parse_path_integer(map_id, "map_id")?;
    let current =
        sqlx::query_scalar::<_, Option<i64>>("SELECT current_map FROM players WHERE id=$1")
            .bind(player.id)
            .fetch_one(state.pool())
            .await?;
    if current != Some(map_id) {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "只能查看当前地图的植物",
        ));
    }
    let resource = sqlx::query_scalar::<_, Value>("SELECT resource_json FROM map_data WHERE id=$1")
        .bind(map_id)
        .fetch_optional(state.pool())
        .await?
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "地图不存在"))?;
    let states = sqlx::query(
        "SELECT node_id,available_at FROM player_plant_nodes WHERE player_id=$1 AND map_id=$2",
    )
    .bind(player.id)
    .bind(map_id)
    .fetch_all(state.pool())
    .await?;
    let mut result = Vec::new();
    for node in resource
        .get("objects")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|node| node.get("type").and_then(Value::as_str) == Some("collectible_plant"))
    {
        let Some(template_id) = node.get("template_id").and_then(Value::as_i64) else {
            continue;
        };
        let Some(template)=sqlx::query("SELECT id,name,rarity,base_affection,tags,description,icon,respawn_seconds FROM plant_templates WHERE id=$1").bind(template_id).fetch_optional(state.pool()).await? else{continue};
        let node_id = node.get("node_id").map(python_string).unwrap_or_default();
        let available_at = states
            .iter()
            .find(|row| row.get::<String, _>("node_id") == node_id)
            .map(|row| row.get::<DateTime<Utc>, _>("available_at"));
        let mut value = node.as_object().cloned().unwrap_or_default();
        for (key, val) in plant_data(&template, None)
            .as_object()
            .cloned()
            .unwrap_or_default()
        {
            value.insert(key, val);
        }
        value.insert("template_id".to_owned(), json!(template_id));
        value.insert(
            "available".to_owned(),
            json!(available_at.is_none_or(|at| at <= Utc::now())),
        );
        value.insert("available_at".to_owned(), json!(available_at));
        result.push(Value::Object(value));
    }
    Ok(Json(ApiResponse::ok(result)))
}

pub(crate) async fn list_inventory(
    State(state): State<AppState>,
    player: AuthPlayer,
) -> Result<Json<ApiResponse<Vec<Value>>>, AppError> {
    let rows=sqlx::query("SELECT template.id,template.name,template.rarity,template.base_affection,template.tags,template.description,template.icon,template.respawn_seconds,inventory.amount FROM inventories inventory JOIN plant_templates template ON template.id=inventory.item_id WHERE inventory.player_id=$1 AND inventory.item_type='plant' AND inventory.amount>0 ORDER BY template.rarity DESC,template.id").bind(player.id).fetch_all(state.pool()).await?;
    Ok(Json(ApiResponse::ok(
        rows.iter()
            .map(|row| plant_data(row, Some(row.get("amount"))))
            .collect(),
    )))
}

pub(crate) async fn collect(
    State(state): State<AppState>,
    player: AuthPlayer,
    payload: Result<Json<PlantCollectRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let Json(payload) = payload.map_err(json_rejection)?;
    validate_collect(&payload)?;
    let mut tx = state.pool().begin().await?;
    let current = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT current_map FROM players WHERE id=$1 FOR UPDATE",
    )
    .bind(player.id)
    .fetch_one(&mut *tx)
    .await?;
    if current != Some(payload.map_id) {
        return Err(AppError::new(StatusCode::CONFLICT, "该植物不在当前地图"));
    }
    let resource = sqlx::query_scalar::<_, Value>("SELECT resource_json FROM map_data WHERE id=$1")
        .bind(payload.map_id)
        .fetch_optional(&mut *tx)
        .await?;
    let node = resource
        .as_ref()
        .and_then(|value| value.get("objects"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find(|node| {
            node.get("type").and_then(Value::as_str) == Some("collectible_plant")
                && node.get("node_id").map(python_string).as_deref()
                    == Some(payload.node_id.as_str())
        })
        .cloned();
    let template_id = node
        .as_ref()
        .and_then(|node| node.get("template_id"))
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "采集点不存在"))?;
    let template=sqlx::query("SELECT id,name,rarity,base_affection,tags,description,icon,respawn_seconds FROM plant_templates WHERE id=$1").bind(template_id).fetch_optional(&mut *tx).await?.ok_or_else(||AppError::new(StatusCode::NOT_FOUND,"植物不存在"))?;
    let available_at=sqlx::query_scalar::<_,DateTime<Utc>>("SELECT available_at FROM player_plant_nodes WHERE player_id=$1 AND map_id=$2 AND node_id=$3 FOR UPDATE").bind(player.id).bind(payload.map_id).bind(&payload.node_id).fetch_optional(&mut *tx).await?;
    let now = Utc::now();
    if available_at.is_some_and(|at| at > now) {
        return Err(AppError::new(StatusCode::CONFLICT, "植物尚未刷新"));
    }
    let amount=sqlx::query_scalar::<_,i32>("SELECT amount FROM inventories WHERE player_id=$1 AND item_id=$2 AND item_type='plant' FOR UPDATE").bind(player.id).bind(template_id).fetch_optional(&mut *tx).await?.unwrap_or(0);
    if amount >= 99 {
        return Err(AppError::new(
            StatusCode::CONFLICT,
            "该植物已达到背包堆叠上限，请先整理背包",
        ));
    }
    let next_amount = amount + 1;
    sqlx::query("INSERT INTO inventories (player_id,item_id,item_type,amount) VALUES ($1,$2,'plant',1) ON CONFLICT (player_id,item_id,item_type) DO UPDATE SET amount=inventories.amount+1").bind(player.id).bind(template_id).execute(&mut *tx).await?;
    let respawn: i32 = template.get("respawn_seconds");
    let next_at = now + chrono::Duration::seconds(i64::from(respawn));
    sqlx::query("INSERT INTO player_plant_nodes (player_id,map_id,node_id,plant_template_id,available_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (player_id,map_id,node_id) DO UPDATE SET plant_template_id=$4,available_at=$5").bind(player.id).bind(payload.map_id).bind(&payload.node_id).bind(template_id).bind(next_at).execute(&mut *tx).await?;
    record_quest_objective(&mut tx, player.id, "collect_plant", 1, None, None, false).await?;
    let name: String = template.get("name");
    let data = json!({"map_id":payload.map_id,"node_id":payload.node_id,"available":false,"available_at":next_at,"plant":plant_data(&template,Some(next_amount))});
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(
        data,
        format!("获得 {name} ×1"),
    )))
}

pub(crate) async fn spirit_gift_options(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(spirit_id): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let spirit_id = parse_path_integer(spirit_id, "spirit_id")?;
    let template_id = owned_spirit_template(state.pool(), player.id, spirit_id).await?;
    let prefs = preference_rows(state.pool(), template_id).await?;
    let rows=sqlx::query("SELECT template.id,template.name,template.rarity,template.base_affection,template.tags,template.description,template.icon,template.respawn_seconds,inventory.amount FROM inventories inventory JOIN plant_templates template ON template.id=inventory.item_id WHERE inventory.player_id=$1 AND inventory.item_type='plant' AND inventory.amount>0").bind(player.id).fetch_all(state.pool()).await?;
    let used:i64=sqlx::query_scalar("SELECT COUNT(*) FROM spirit_gift_records WHERE player_card_spirit_id=$1 AND gifted_at>=date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AND gifted_at<(date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai')+INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai'").bind(spirit_id).fetch_one(state.pool()).await?;
    let mut plants = rows
        .iter()
        .map(|row| {
            let pref = spirit_preference(row, &prefs).0;
            let id: i64 = row.get("id");
            (preference_rank(&pref), id, {
                let mut value = plant_data(row, Some(row.get("amount")));
                value
                    .as_object_mut()
                    .unwrap()
                    .insert("preference".to_owned(), json!(pref));
                value
            })
        })
        .collect::<Vec<_>>();
    plants.sort_by_key(|(rank, id, _)| (Reverse(*rank), *id));
    Ok(Json(ApiResponse::ok(
        json!({"remaining_gifts":(5-used).max(0),"plants":plants.into_iter().map(|(_,_,value)|value).collect::<Vec<_>>() }),
    )))
}

pub(crate) async fn give_spirit_gift(
    State(state): State<AppState>,
    player: AuthPlayer,
    Path(spirit_id): Path<String>,
    payload: Result<Json<SpiritGiftRequest>, JsonRejection>,
) -> Result<Json<ApiResponse<Value>>, AppError> {
    let spirit_id = parse_path_integer(spirit_id, "spirit_id")?;
    let Json(payload) = payload.map_err(json_rejection)?;
    if payload.plant_template_id <= 0 {
        return Err(AppError::validation_field(
            "plant_template_id",
            "greater_than",
            "Input should be greater than 0",
            json!(payload.plant_template_id),
        ));
    }
    let mut tx = state.pool().begin().await?;
    let spirit=sqlx::query("SELECT spirit_template_id,affection FROM player_card_spirits WHERE id=$1 AND player_id=$2 FOR UPDATE").bind(spirit_id).bind(player.id).fetch_optional(&mut *tx).await?.ok_or_else(||AppError::new(StatusCode::NOT_FOUND,"卡牌精灵不存在"))?;
    let affection: i32 = spirit.get("affection");
    if affection >= 100 {
        return Err(AppError::new(StatusCode::CONFLICT, "羁绊已达到上限"));
    }
    let template=sqlx::query("SELECT id,name,rarity,base_affection,tags,description,icon,respawn_seconds FROM plant_templates WHERE id=$1").bind(payload.plant_template_id).fetch_optional(&mut *tx).await?.ok_or_else(||AppError::new(StatusCode::NOT_FOUND,"植物不存在"))?;
    let amount=sqlx::query_scalar::<_,i32>("SELECT amount FROM inventories WHERE player_id=$1 AND item_id=$2 AND item_type='plant' FOR UPDATE").bind(player.id).bind(payload.plant_template_id).fetch_optional(&mut *tx).await?.unwrap_or(0);
    if amount < 1 {
        return Err(AppError::new(StatusCode::CONFLICT, "背包中没有该植物"));
    }
    let used:i64=sqlx::query_scalar("SELECT COUNT(*) FROM spirit_gift_records WHERE player_card_spirit_id=$1 AND gifted_at>=date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AND gifted_at<(date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai')+INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai'").bind(spirit_id).fetch_one(&mut *tx).await?;
    if used >= 5 {
        return Err(AppError::new(
            StatusCode::TOO_MANY_REQUESTS,
            "该卡灵今天已经收下 5 份植物礼物",
        ));
    }
    let prefs = preference_rows_tx(&mut tx, spirit.get("spirit_template_id")).await?;
    let (preference, special) = spirit_preference(&template, &prefs);
    let base: i32 = template.get("base_affection");
    let raw = if preference == "disliked" {
        1
    } else {
        base + match preference.as_str() {
            "favorite" => 2,
            "liked" => 1,
            _ => 0,
        }
    };
    let gain = raw.clamp(1, 6).min(100 - affection);
    let next = affection + gain;
    sqlx::query("UPDATE player_card_spirits SET affection=$1 WHERE id=$2")
        .bind(next)
        .bind(spirit_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE inventories SET amount=amount-1 WHERE player_id=$1 AND item_id=$2 AND item_type='plant'").bind(player.id).bind(payload.plant_template_id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO affection_records (player_card_spirit_id,affection_value,interaction_count) VALUES ($1,$2,0) ON CONFLICT (player_card_spirit_id) DO UPDATE SET affection_value=$2").bind(spirit_id).bind(next).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO spirit_gift_records (player_id,player_card_spirit_id,plant_template_id,affection_gained,gifted_at) VALUES ($1,$2,$3,$4,NOW())").bind(player.id).bind(spirit_id).bind(payload.plant_template_id).bind(gain).execute(&mut *tx).await?;
    let dialogue = spirit_gift_dialogue(&preference, special);
    let data = json!({"spirit_id":spirit_id,"plant_template_id":payload.plant_template_id,"preference":preference,"affection_gained":gain,"affection":next,"remaining_amount":amount-1,"remaining_gifts":5-used-1,"dialogue":dialogue});
    tx.commit().await?;
    Ok(Json(ApiResponse::with_message(data, "礼物已送出")))
}

pub(crate) async fn record_quest_objective(
    tx: &mut Transaction<'_, Postgres>,
    player_id: i64,
    objective: &str,
    amount: i32,
    target_field: Option<&str>,
    target_name: Option<&str>,
    absolute: bool,
) -> Result<(), AppError> {
    let rows=sqlx::query("SELECT progress.quest_id,progress.progress,quest.reward_json FROM player_quests progress JOIN quests quest ON quest.id=progress.quest_id WHERE progress.player_id=$1 AND progress.status='active' FOR UPDATE OF progress").bind(player_id).fetch_all(&mut **tx).await?;
    for row in rows {
        let config: Value = row.get("reward_json");
        if config.get("objective").and_then(Value::as_str) != Some(objective) {
            continue;
        }
        if let Some(field) = target_field {
            if config.get(field).map(python_string).unwrap_or_default() != target_name.unwrap_or("")
            {
                continue;
            }
        }
        let target = config
            .get("amount")
            .and_then(Value::as_i64)
            .unwrap_or(1)
            .max(1) as i32;
        let mut progress: Value = row.get("progress");
        if !progress.is_object() {
            progress = json!({});
        }
        let current = progress
            .get("current")
            .and_then(Value::as_i64)
            .unwrap_or(0)
            .max(0) as i32;
        let next = if absolute {
            current.max(amount)
        } else {
            current + amount.max(0)
        };
        let object = progress.as_object_mut().unwrap();
        object.insert("objective".to_owned(), json!(objective));
        object.insert("current".to_owned(), json!(next.min(target)));
        object.insert("target".to_owned(), json!(target));
        object.insert("ready".to_owned(), json!(next >= target));
        sqlx::query("UPDATE player_quests SET progress=$1 WHERE player_id=$2 AND quest_id=$3")
            .bind(progress)
            .bind(player_id)
            .bind(row.get::<i64, _>("quest_id"))
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

fn plant_data(row: &sqlx::postgres::PgRow, amount: Option<i32>) -> Value {
    let mut value = json!({"id":row.get::<i64,_>("id"),"name":row.get::<String,_>("name"),"rarity":row.get::<String,_>("rarity"),"base_affection":row.get::<i32,_>("base_affection"),"tags":row.get::<Value,_>("tags"),"description":row.get::<String,_>("description"),"icon":row.get::<Option<String>,_>("icon"),"respawn_seconds":row.get::<i32,_>("respawn_seconds")});
    if let Some(amount) = amount {
        value
            .as_object_mut()
            .unwrap()
            .insert("amount".to_owned(), json!(amount));
    }
    value
}
async fn owned_spirit_template(
    pool: &sqlx::PgPool,
    player_id: i64,
    spirit_id: i64,
) -> Result<i64, AppError> {
    sqlx::query_scalar(
        "SELECT spirit_template_id FROM player_card_spirits WHERE id=$1 AND player_id=$2",
    )
    .bind(spirit_id)
    .bind(player_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::new(StatusCode::NOT_FOUND, "卡牌精灵不存在"))
}
async fn preference_rows(
    pool: &sqlx::PgPool,
    template_id: i64,
) -> Result<Vec<sqlx::postgres::PgRow>, AppError> {
    Ok(sqlx::query("SELECT plant_template_id,tag,preference,dialogue FROM spirit_gift_preferences WHERE spirit_template_id=$1").bind(template_id).fetch_all(pool).await?)
}
async fn preference_rows_tx(
    tx: &mut Transaction<'_, Postgres>,
    template_id: i64,
) -> Result<Vec<sqlx::postgres::PgRow>, AppError> {
    Ok(sqlx::query("SELECT plant_template_id,tag,preference,dialogue FROM spirit_gift_preferences WHERE spirit_template_id=$1").bind(template_id).fetch_all(&mut **tx).await?)
}
fn spirit_preference(
    template: &sqlx::postgres::PgRow,
    prefs: &[sqlx::postgres::PgRow],
) -> (String, Option<String>) {
    let id: i64 = template.get("id");
    let tags: Value = template.get("tags");
    let mut matched = prefs
        .iter()
        .filter(|row| {
            row.get::<Option<i64>, _>("plant_template_id") == Some(id)
                || row.get::<Option<String>, _>("tag").is_some_and(|tag| {
                    tags.as_array()
                        .is_some_and(|values| values.contains(&json!(tag)))
                })
        })
        .collect::<Vec<_>>();
    matched.sort_by_key(|row| Reverse(preference_rank(&row.get::<String, _>("preference"))));
    matched.first().map_or(("neutral".to_owned(), None), |row| {
        (row.get("preference"), row.get("dialogue"))
    })
}
fn preference_rank(value: &str) -> i32 {
    match value {
        "favorite" => 3,
        "liked" => 2,
        "neutral" => 1,
        _ => 0,
    }
}
fn spirit_gift_dialogue(preference: &str, special: Option<String>) -> String {
    special
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            match preference {
                "favorite" => "这是她最喜欢的礼物！",
                "liked" => "她看起来很喜欢这份礼物。",
                "disliked" => "她礼貌地收下了礼物，似乎不太合口味。",
                _ => "她收下了你的礼物。",
            }
            .to_owned()
        })
}
fn validate_collect(payload: &PlantCollectRequest) -> Result<(), AppError> {
    if payload.map_id <= 0 {
        return Err(AppError::validation_field(
            "map_id",
            "greater_than",
            "Input should be greater than 0",
            json!(payload.map_id),
        ));
    }
    if payload.node_id.is_empty() {
        return Err(AppError::validation_field(
            "node_id",
            "string_too_short",
            "String should have at least 1 character",
            json!(payload.node_id),
        ));
    }
    if payload.node_id.chars().count() > 64 {
        return Err(AppError::validation_field(
            "node_id",
            "string_too_long",
            "String should have at most 64 characters",
            json!(payload.node_id),
        ));
    }
    if !payload
        .node_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(AppError::validation_field(
            "node_id",
            "string_pattern_mismatch",
            "String should match pattern '^[A-Za-z0-9_-]+$'",
            json!(payload.node_id),
        ));
    }
    Ok(())
}
fn python_string(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        Value::Null => "None".to_owned(),
        other => other.to_string(),
    }
}
fn parse_path_integer(value: String, field: &str) -> Result<i64, AppError> {
    value
        .parse()
        .map_err(|_| AppError::validation_path_integer(field, value))
}

#[cfg(test)]
mod tests {
    use axum::{body::to_bytes, response::IntoResponse};
    use serde_json::Value;

    use super::{spirit_gift_dialogue, validate_collect, PlantCollectRequest};

    async fn node_error_type(node_id: String) -> String {
        let error = validate_collect(&PlantCollectRequest { map_id: 1, node_id }).unwrap_err();
        let bytes = to_bytes(error.into_response().into_body(), usize::MAX)
            .await
            .unwrap();
        let value: Value = serde_json::from_slice(&bytes).unwrap();
        value["data"][0]["type"].as_str().unwrap().to_owned()
    }

    #[tokio::test]
    async fn node_id_validation_distinguishes_length_and_pattern() {
        assert_eq!(node_error_type(String::new()).await, "string_too_short");
        assert_eq!(node_error_type("x".repeat(65)).await, "string_too_long");
        assert_eq!(
            node_error_type("bad node".to_owned()).await,
            "string_pattern_mismatch"
        );
    }

    #[test]
    fn empty_special_gift_dialogue_uses_python_fallback() {
        assert_eq!(
            spirit_gift_dialogue("favorite", Some(String::new())),
            "这是她最喜欢的礼物！"
        );
        assert_eq!(
            spirit_gift_dialogue("liked", Some("自定义对白".to_owned())),
            "自定义对白"
        );
    }
}
