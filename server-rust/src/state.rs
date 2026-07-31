use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Instant,
};

use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::{ai::AiClient, auth::PasswordService, config::Settings};

#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    pub settings: Settings,
    pub pool: PgPool,
    pub passwords: PasswordService,
    pub ai: AiClient,
    pub dialogue_requests: Mutex<HashMap<(i64, i64), Instant>>,
}

impl AppState {
    pub async fn connect(settings: Settings) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(settings.database_max_connections)
            .acquire_timeout(settings.database_acquire_timeout())
            .connect(&settings.database_url)
            .await?;
        sqlx::query("SELECT 1").execute(&pool).await?;
        Ok(Self::new(settings, pool))
    }

    pub fn new(settings: Settings, pool: PgPool) -> Self {
        Self {
            inner: Arc::new(AppStateInner {
                settings,
                pool,
                passwords: PasswordService::new(),
                ai: AiClient::new(),
                dialogue_requests: Mutex::new(HashMap::new()),
            }),
        }
    }

    pub fn settings(&self) -> &Settings {
        &self.inner.settings
    }
    pub fn pool(&self) -> &PgPool {
        &self.inner.pool
    }
    pub fn passwords(&self) -> &PasswordService {
        &self.inner.passwords
    }
    pub fn ai(&self) -> &AiClient {
        &self.inner.ai
    }
    pub fn dialogue_requests(&self) -> &Mutex<HashMap<(i64, i64), Instant>> {
        &self.inner.dialogue_requests
    }
}
