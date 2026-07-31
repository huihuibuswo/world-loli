use std::time::{SystemTime, UNIX_EPOCH};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::{header::AUTHORIZATION, request::Parts},
};
use jsonwebtoken::{
    decode, encode, Algorithm as JwtAlgorithm, DecodingKey, EncodingKey, Header, Validation,
};
use serde::{Deserialize, Serialize};

use crate::{error::AppError, models::CurrentPlayer, AppState};

#[derive(Clone)]
pub struct PasswordService {
    argon2: Argon2<'static>,
    dummy_hash: String,
}

impl Default for PasswordService {
    fn default() -> Self {
        Self::new()
    }
}

impl PasswordService {
    pub fn new() -> Self {
        let params = Params::new(65_536, 3, 4, Some(32)).expect("valid Argon2 parameters");
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let dummy_hash = hash_with(&argon2, "not-a-real-user-password")
            .expect("dummy password hashing must succeed");
        Self { argon2, dummy_hash }
    }

    pub fn hash(&self, password: &str) -> Result<String, AppError> {
        hash_with(&self.argon2, password).map_err(|error| {
            tracing::error!(error = %error, "password hashing failed");
            AppError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "服务器内部错误",
            )
        })
    }

    pub fn verify(&self, password: &str, encoded: Option<&str>) -> bool {
        let candidate = encoded.unwrap_or(&self.dummy_hash);
        PasswordHash::new(candidate).ok().is_some_and(|hash| {
            self.argon2
                .verify_password(password.as_bytes(), &hash)
                .is_ok()
        })
    }
}

fn hash_with(argon2: &Argon2<'_>, password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    iat: usize,
    exp: usize,
}

pub fn create_access_token(state: &AppState, user_id: i64) -> Result<String, AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| {
            AppError::new(
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "服务器内部错误",
            )
        })?
        .as_secs() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        iat: now,
        exp: now + state.settings().access_token_minutes as usize * 60,
    };
    encode(
        &Header::new(JwtAlgorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.settings().jwt_secret.as_bytes()),
    )
    .map_err(|error| {
        tracing::error!(error = %error, "JWT encoding failed");
        AppError::new(
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            "服务器内部错误",
        )
    })
}

fn decode_user_id(state: &AppState, token: &str) -> Result<i64, AppError> {
    let validation = Validation::new(JwtAlgorithm::HS256);
    let token = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.settings().jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| AppError::unauthorized("无效或已过期的访问令牌"))?;
    token
        .claims
        .sub
        .parse()
        .map_err(|_| AppError::unauthorized("无效或已过期的访问令牌"))
}

#[derive(Debug)]
pub struct AuthUser {
    pub id: i64,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(state);
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| AppError::unauthorized("Not authenticated"))?;
        let token =
            bearer_token(header).ok_or_else(|| AppError::unauthorized("Not authenticated"))?;
        let user_id = decode_user_id(&state, token)?;
        let exists = sqlx::query_scalar::<_, i64>("SELECT id FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(state.pool())
            .await?
            .is_some();
        if !exists {
            return Err(AppError::unauthorized("用户不存在"));
        }
        Ok(Self { id: user_id })
    }
}

fn bearer_token(header: &str) -> Option<&str> {
    let (scheme, token) = header.split_once(' ')?;
    (scheme.eq_ignore_ascii_case("bearer") && !token.is_empty()).then_some(token)
}

#[derive(Debug)]
pub struct AuthPlayer {
    pub id: i64,
    pub user_id: i64,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthPlayer
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        let state = AppState::from_ref(state);
        let player = sqlx::query_as::<_, CurrentPlayer>(
            "SELECT id, user_id FROM players WHERE user_id = $1 ORDER BY id LIMIT 1",
        )
        .bind(user.id)
        .fetch_optional(state.pool())
        .await?
        .ok_or_else(|| AppError::new(axum::http::StatusCode::NOT_FOUND, "玩家角色不存在"))?;
        Ok(Self {
            id: player.id,
            user_id: player.user_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::bearer_token;

    #[test]
    fn bearer_scheme_is_case_insensitive_like_fastapi() {
        assert_eq!(bearer_token("Bearer token"), Some("token"));
        assert_eq!(bearer_token("bearer token"), Some("token"));
        assert_eq!(bearer_token("Basic token"), None);
        assert_eq!(bearer_token("Bearer "), None);
    }
}
