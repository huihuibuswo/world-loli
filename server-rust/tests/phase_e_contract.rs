use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;
use world_loli_server::{build_app, AppState, Settings};

fn test_state() -> AppState {
    let settings = Settings {
        app_name: "test".to_owned(),
        environment: "test".to_owned(),
        database_url: "postgresql://world:world@127.0.0.1/world".to_owned(),
        jwt_secret: "test-secret-with-at-least-32-characters".to_owned(),
        jwt_algorithm: "HS256".to_owned(),
        access_token_minutes: 120,
        cors_origins: "http://localhost:5173".to_owned(),
        bind_address: "127.0.0.1:0".parse().unwrap(),
        database_max_connections: 1,
        database_acquire_timeout_seconds: 1,
        ai_memory_retention_days: 90,
        ai_enabled: false,
        ai_dialogue_enabled: false,
        ai_battle_enabled: false,
        ai_base_url: "https://api.openai.com/v1".to_owned(),
        ai_api_key: None,
        ai_model: String::new(),
        ai_dialogue_timeout_seconds: 8.0,
        ai_battle_timeout_seconds: 2.0,
        ai_max_input_chars: 500,
        ai_max_reply_chars: 400,
        ai_memory_recent_turns: 8,
        ai_memory_summary_chars: 1200,
        ai_dialogue_min_interval_seconds: 1.5,
        ai_blocked_terms: String::new(),
    };
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy(&settings.database_url)
        .unwrap();
    AppState::new(settings, pool)
}

#[tokio::test]
async fn phase_e_battle_routes_require_authentication() {
    for (method, path) in [
        ("POST", "/api/v1/npc/battle"),
        ("POST", "/api/v1/battle/create"),
        ("GET", "/api/v1/battle/current"),
        ("GET", "/api/v1/battle/1"),
        ("POST", "/api/v1/battle/1/play-card"),
        ("POST", "/api/v1/battle/1/end-turn"),
        ("POST", "/api/v1/battle/1/surrender"),
        ("GET", "/api/v1/battle/1/result"),
    ] {
        let response = build_app(test_state())
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(path)
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "{method} {path}"
        );
    }
}
