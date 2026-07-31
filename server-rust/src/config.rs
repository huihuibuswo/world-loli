use std::{net::SocketAddr, time::Duration};

use axum::http::HeaderValue;

use serde::Deserialize;
use thiserror::Error;

#[derive(Clone, Deserialize)]
pub struct Settings {
    #[serde(default = "default_app_name")]
    pub app_name: String,
    #[serde(default = "default_environment")]
    pub environment: String,
    pub database_url: String,
    pub jwt_secret: String,
    #[serde(default = "default_jwt_algorithm")]
    pub jwt_algorithm: String,
    #[serde(default = "default_access_token_minutes")]
    pub access_token_minutes: u64,
    #[serde(default = "default_cors_origins")]
    pub cors_origins: String,
    #[serde(default = "default_bind_address")]
    pub bind_address: SocketAddr,
    #[serde(default = "default_database_max_connections")]
    pub database_max_connections: u32,
    #[serde(default = "default_database_acquire_timeout_seconds")]
    pub database_acquire_timeout_seconds: u64,
    #[serde(default = "default_ai_memory_retention_days")]
    pub ai_memory_retention_days: i32,
    #[serde(default)]
    pub ai_enabled: bool,
    #[serde(default)]
    pub ai_dialogue_enabled: bool,
    #[serde(default)]
    pub ai_battle_enabled: bool,
    #[serde(default = "default_ai_base_url")]
    pub ai_base_url: String,
    #[serde(default)]
    pub ai_api_key: Option<String>,
    #[serde(default)]
    pub ai_model: String,
    #[serde(default = "default_ai_dialogue_timeout_seconds")]
    pub ai_dialogue_timeout_seconds: f64,
    #[serde(default = "default_ai_battle_timeout_seconds")]
    pub ai_battle_timeout_seconds: f64,
    #[serde(default = "default_ai_max_input_chars")]
    pub ai_max_input_chars: usize,
    #[serde(default = "default_ai_max_reply_chars")]
    pub ai_max_reply_chars: usize,
    #[serde(default = "default_ai_memory_recent_turns")]
    pub ai_memory_recent_turns: usize,
    #[serde(default = "default_ai_memory_summary_chars")]
    pub ai_memory_summary_chars: usize,
    #[serde(default = "default_ai_dialogue_min_interval_seconds")]
    pub ai_dialogue_min_interval_seconds: f64,
    #[serde(default)]
    pub ai_blocked_terms: String,
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("failed to load configuration: {0}")]
    Load(#[from] config::ConfigError),
    #[error("JWT_SECRET must contain at least 32 characters")]
    WeakJwtSecret,
    #[error("JWT_ALGORITHM must be HS256")]
    UnsupportedJwtAlgorithm,
    #[error("ACCESS_TOKEN_MINUTES must be between 5 and 1440")]
    InvalidAccessTokenMinutes,
    #[error("DATABASE_MAX_CONNECTIONS must be greater than zero")]
    InvalidDatabasePoolSize,
    #[error("CORS_ORIGINS contains an invalid origin: {0}")]
    InvalidCorsOrigin(String),
    #[error("AI_MEMORY_RETENTION_DAYS must be between 1 and 3650")]
    InvalidAiMemoryRetentionDays,
    #[error("invalid AI configuration value: {0}")]
    InvalidAiConfiguration(&'static str),
}

impl Settings {
    pub fn load() -> Result<Self, SettingsError> {
        let mut settings: Self = config::Config::builder()
            .add_source(config::Environment::default().try_parsing(true))
            .build()?
            .try_deserialize()?;

        settings.database_url = normalize_database_url(&settings.database_url);
        settings.validate()?;
        Ok(settings)
    }

    pub fn database_acquire_timeout(&self) -> Duration {
        Duration::from_secs(self.database_acquire_timeout_seconds)
    }

    pub fn cors_origin_list(&self) -> Vec<String> {
        self.cors_origins
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .collect()
    }

    pub fn ai_configured(&self) -> bool {
        self.ai_api_key
            .as_ref()
            .is_some_and(|value| !value.is_empty())
            && !self.ai_model.trim().is_empty()
            && !self.ai_base_url.trim().is_empty()
    }

    pub fn ai_blocked_term_list(&self) -> Vec<String> {
        self.ai_blocked_terms
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_lowercase)
            .collect()
    }

    fn validate(&self) -> Result<(), SettingsError> {
        if self.jwt_secret.chars().count() < 32 {
            return Err(SettingsError::WeakJwtSecret);
        }
        if self.jwt_algorithm != "HS256" {
            return Err(SettingsError::UnsupportedJwtAlgorithm);
        }
        if !(5..=1440).contains(&self.access_token_minutes) {
            return Err(SettingsError::InvalidAccessTokenMinutes);
        }
        if self.database_max_connections == 0 {
            return Err(SettingsError::InvalidDatabasePoolSize);
        }
        if !(1..=3650).contains(&self.ai_memory_retention_days) {
            return Err(SettingsError::InvalidAiMemoryRetentionDays);
        }
        if !(1.0..=30.0).contains(&self.ai_dialogue_timeout_seconds) {
            return Err(SettingsError::InvalidAiConfiguration(
                "AI_DIALOGUE_TIMEOUT_SECONDS",
            ));
        }
        if !(0.5..=10.0).contains(&self.ai_battle_timeout_seconds) {
            return Err(SettingsError::InvalidAiConfiguration(
                "AI_BATTLE_TIMEOUT_SECONDS",
            ));
        }
        if !(50..=2000).contains(&self.ai_max_input_chars)
            || !(50..=2000).contains(&self.ai_max_reply_chars)
            || !(2..=20).contains(&self.ai_memory_recent_turns)
            || !(200..=4000).contains(&self.ai_memory_summary_chars)
            || !(0.0..=60.0).contains(&self.ai_dialogue_min_interval_seconds)
        {
            return Err(SettingsError::InvalidAiConfiguration("AI_LIMITS"));
        }
        if self.ai_configured() {
            validate_ai_base_url(&self.ai_base_url)?;
        }
        for origin in self.cors_origin_list() {
            HeaderValue::from_str(&origin)
                .map_err(|_| SettingsError::InvalidCorsOrigin(origin.clone()))?;
        }
        Ok(())
    }
}

fn validate_ai_base_url(value: &str) -> Result<(), SettingsError> {
    let url = reqwest::Url::parse(value.trim())
        .map_err(|_| SettingsError::InvalidAiConfiguration("AI_BASE_URL"))?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(SettingsError::InvalidAiConfiguration("AI_BASE_URL"));
    }
    Ok(())
}

pub fn normalize_database_url(value: &str) -> String {
    value.replacen("postgresql+psycopg://", "postgresql://", 1)
}

fn default_app_name() -> String {
    "斗萝大陆 API".to_owned()
}
fn default_environment() -> String {
    "development".to_owned()
}
fn default_jwt_algorithm() -> String {
    "HS256".to_owned()
}
fn default_access_token_minutes() -> u64 {
    120
}
fn default_cors_origins() -> String {
    "http://localhost:5173".to_owned()
}
fn default_bind_address() -> SocketAddr {
    "0.0.0.0:8000".parse().expect("valid bind address")
}
fn default_database_max_connections() -> u32 {
    10
}
fn default_database_acquire_timeout_seconds() -> u64 {
    10
}
fn default_ai_memory_retention_days() -> i32 {
    90
}
fn default_ai_base_url() -> String {
    "https://api.openai.com/v1".to_owned()
}
fn default_ai_dialogue_timeout_seconds() -> f64 {
    8.0
}
fn default_ai_battle_timeout_seconds() -> f64 {
    2.0
}
fn default_ai_max_input_chars() -> usize {
    500
}
fn default_ai_max_reply_chars() -> usize {
    400
}
fn default_ai_memory_recent_turns() -> usize {
    8
}
fn default_ai_memory_summary_chars() -> usize {
    1200
}
fn default_ai_dialogue_min_interval_seconds() -> f64 {
    1.5
}

#[cfg(test)]
mod tests {
    use super::{
        default_ai_base_url, normalize_database_url, validate_ai_base_url, Settings, SettingsError,
    };

    #[test]
    fn accepts_existing_sqlalchemy_database_url() {
        assert_eq!(
            normalize_database_url("postgresql+psycopg://world:secret@postgres/world"),
            "postgresql://world:secret@postgres/world"
        );
    }

    #[test]
    fn ai_base_url_rejects_unsafe_request_targets() {
        assert!(validate_ai_base_url("https://api.example.test/v1").is_ok());
        assert!(validate_ai_base_url("http://127.0.0.1:11434/v1").is_ok());
        for value in [
            "file:///tmp/provider",
            "https://user:secret@api.example.test/v1",
            "https://api.example.test/v1?target=internal",
            "https://api.example.test/v1#fragment",
        ] {
            assert!(validate_ai_base_url(value).is_err(), "{value}");
        }
    }

    #[test]
    fn rejects_invalid_cors_origin_during_startup_validation() {
        let settings = Settings {
            app_name: "test".to_owned(),
            environment: "test".to_owned(),
            database_url: "postgresql://localhost/world".to_owned(),
            jwt_secret: "test-secret-with-at-least-32-characters".to_owned(),
            jwt_algorithm: "HS256".to_owned(),
            access_token_minutes: 120,
            cors_origins: "http://localhost:5173,invalid\norigin".to_owned(),
            bind_address: "127.0.0.1:0".parse().unwrap(),
            database_max_connections: 1,
            database_acquire_timeout_seconds: 1,
            ai_memory_retention_days: 90,
            ai_enabled: false,
            ai_dialogue_enabled: false,
            ai_battle_enabled: false,
            ai_base_url: default_ai_base_url(),
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

        assert!(matches!(
            settings.validate(),
            Err(SettingsError::InvalidCorsOrigin(_))
        ));
    }

    #[test]
    fn rejects_invalid_ai_memory_retention() {
        let settings = Settings {
            app_name: "test".to_owned(),
            environment: "test".to_owned(),
            database_url: "postgresql://localhost/world".to_owned(),
            jwt_secret: "test-secret-with-at-least-32-characters".to_owned(),
            jwt_algorithm: "HS256".to_owned(),
            access_token_minutes: 120,
            cors_origins: "http://localhost:5173".to_owned(),
            bind_address: "127.0.0.1:0".parse().unwrap(),
            database_max_connections: 1,
            database_acquire_timeout_seconds: 1,
            ai_memory_retention_days: 0,
            ai_enabled: false,
            ai_dialogue_enabled: false,
            ai_battle_enabled: false,
            ai_base_url: default_ai_base_url(),
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

        assert!(matches!(
            settings.validate(),
            Err(SettingsError::InvalidAiMemoryRetentionDays)
        ));
    }
}
