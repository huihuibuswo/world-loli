use axum::{
    http::{header, HeaderName, HeaderValue, Method},
    routing::{get, post},
    Router,
};
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};

use crate::{api, AppState};

pub fn build_app(state: AppState) -> Router {
    let request_id_header = HeaderName::from_static("x-request-id");
    Router::new()
        .route("/health/live", get(api::health::live))
        .route("/health/ready", get(api::health::ready))
        .nest(
            "/api/v1",
            Router::new()
                .route("/auth/register", post(api::auth::register))
                .route("/auth/login", post(api::auth::login))
                .route("/auth/profile", get(api::auth::profile))
                .route(
                    "/player/profile",
                    get(api::player::get_profile).put(api::player::update_profile),
                )
                .route(
                    "/player/location",
                    get(api::player::get_location).post(api::player::save_location),
                )
                .route(
                    "/save",
                    get(api::save::load_save).post(api::save::save_game),
                )
                .route("/map/:map_id", get(api::world::get_map))
                .route("/map/:map_id/objects", get(api::world::get_map_objects))
                .route("/map/:map_id/plants", get(api::plants::list_map_plants))
                .route("/map/enter", post(api::world::enter_map))
                .route("/plants/inventory", get(api::plants::list_inventory))
                .route("/plants/collect", post(api::plants::collect))
                .route("/npc/:npc_id", get(api::world::get_npc))
                .route(
                    "/npc/:npc_id/chat",
                    get(api::world::get_npc_chat).post(api::world::post_npc_chat),
                )
                .route("/npc/:npc_id/affection", get(api::world::get_npc_affection))
                .route("/npc/:npc_id/service", get(api::world::get_npc_service))
                .route(
                    "/npc/:npc_id/shop/purchase",
                    post(api::world::purchase_shop),
                )
                .route(
                    "/npc/:npc_id/training/upgrade",
                    post(api::world::upgrade_training),
                )
                .route(
                    "/npc/:npc_id/gifts",
                    get(api::world::get_npc_gifts).post(api::world::give_npc_gift),
                )
                .route("/npc/dialog", post(api::world::npc_dialog))
                .route("/npc/action", post(api::world::npc_action))
                .route("/npc/battle", post(api::battle::npc_battle))
                .route("/spirits", get(api::catalog::list_spirits))
                .route(
                    "/spirit-fragments",
                    get(api::catalog::list_spirit_fragments),
                )
                .route(
                    "/spirit-fragments/:spirit_template_id/compose",
                    post(api::catalog::compose_spirit),
                )
                .route("/spirits/:spirit_id", get(api::catalog::get_spirit))
                .route(
                    "/spirits/:spirit_id/gifts",
                    get(api::plants::spirit_gift_options).post(api::plants::give_spirit_gift),
                )
                .route(
                    "/spirits/:spirit_id/affection",
                    post(api::catalog::add_affection),
                )
                .route(
                    "/spirits/:spirit_id/level",
                    post(api::catalog::level_spirit),
                )
                .route(
                    "/spirits/:spirit_id/growth",
                    get(api::catalog::get_spirit_growth),
                )
                .route("/cards", get(api::catalog::list_cards))
                .route("/cards/:card_id", get(api::catalog::get_card))
                .route("/cards/:card_id/upgrade", post(api::catalog::upgrade_card))
                .route(
                    "/cards/:card_id/effects",
                    get(api::catalog::get_card_effects),
                )
                .route(
                    "/decks",
                    get(api::decks::list_decks).post(api::decks::create_deck),
                )
                .route(
                    "/decks/:deck_id",
                    axum::routing::put(api::decks::update_deck).delete(api::decks::delete_deck),
                )
                .route(
                    "/decks/:deck_id/cards",
                    post(api::decks::add_deck_card).delete(api::decks::remove_deck_card),
                )
                .route("/quests", get(api::quests::list_quests))
                .route("/quests/:quest_id/accept", post(api::quests::accept_quest))
                .route(
                    "/quests/:quest_id/complete",
                    post(api::quests::complete_quest),
                )
                .route(
                    "/quests/:quest_id/progress",
                    get(api::quests::quest_progress),
                )
                .route("/opening", get(api::opening::get_opening))
                .route("/opening/start", post(api::opening::start_opening))
                .route("/opening/complete", post(api::opening::complete_opening))
                .route("/opening/action", post(api::opening::opening_action))
                .route(
                    "/opening/moon-trace/action",
                    post(api::opening::moon_trace_action),
                )
                .route("/battle/create", post(api::battle::create_battle))
                .route("/battle/current", get(api::battle::current_battle))
                .route("/battle/:battle_id", get(api::battle::get_battle))
                .route("/battle/:battle_id/play-card", post(api::battle::play_card))
                .route("/battle/:battle_id/end-turn", post(api::battle::end_turn))
                .route("/battle/:battle_id/surrender", post(api::battle::surrender))
                .route("/battle/:battle_id/result", get(api::battle::battle_result)),
        )
        .layer(PropagateRequestIdLayer::new(request_id_header.clone()))
        .layer(SetRequestIdLayer::new(request_id_header, MakeRequestUuid))
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer(state.settings().cors_origin_list()))
        .with_state(state)
}

fn cors_layer(origins: Vec<String>) -> CorsLayer {
    let origins: Vec<HeaderValue> = origins
        .into_iter()
        .map(|origin| origin.parse().expect("CORS origins validated at startup"))
        .collect();
    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
}
