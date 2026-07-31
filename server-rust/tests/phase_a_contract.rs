use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::Value;
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
async fn liveness_does_not_depend_on_database() {
    let response = build_app(test_state())
        .oneshot(
            Request::builder()
                .uri("/health/live")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn protected_endpoint_keeps_authentication_envelope_and_header() {
    let response = build_app(test_state())
        .oneshot(
            Request::builder()
                .uri("/api/v1/player/profile")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        response.headers().get("www-authenticate").unwrap(),
        "Bearer"
    );
}

#[tokio::test]
async fn invalid_registration_uses_validation_envelope() {
    let response = build_app(test_state())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"username":"x","password":"short"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["code"], 422);
    assert_eq!(body["message"], "请求参数无效");
    assert!(body["data"].is_array());
    assert_eq!(body["data"][0]["loc"][0], "body");
}
