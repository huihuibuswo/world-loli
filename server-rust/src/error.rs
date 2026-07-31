use axum::{
    http::{header::WWW_AUTHENTICATE, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

use crate::response::ApiResponse;

#[derive(Debug)]
pub struct AppError {
    status: StatusCode,
    message: String,
    data: Value,
    authenticate: bool,
}

impl AppError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            data: Value::Null,
            authenticate: false,
        }
    }

    pub fn validation(data: Value) -> Self {
        Self {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            message: "请求参数无效".to_owned(),
            data,
            authenticate: false,
        }
    }

    pub fn validation_field(
        field: &str,
        error_type: &str,
        message: impl Into<String>,
        input: Value,
    ) -> Self {
        Self::validation(json!([{
            "type": error_type,
            "loc": ["body", field],
            "msg": message.into(),
            "input": input,
        }]))
    }

    pub fn validation_path_integer(field: &str, input: String) -> Self {
        Self::validation(json!([{
            "type": "int_parsing",
            "loc": ["path", field],
            "msg": "Input should be a valid integer, unable to parse string as an integer",
            "input": input,
        }]))
    }

    pub fn validation_body(error_type: &str, message: impl Into<String>, input: Value) -> Self {
        Self::validation(json!([{
            "type": error_type,
            "loc": ["body"],
            "msg": message.into(),
            "input": input,
        }]))
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: message.into(),
            data: Value::Null,
            authenticate: true,
        }
    }

    pub fn database(error: sqlx::Error) -> Self {
        tracing::error!(error = %error, "database operation failed");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "服务器内部错误")
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let mut response = (
            self.status,
            Json(ApiResponse {
                code: self.status.as_u16(),
                message: self.message,
                data: self.data,
            }),
        )
            .into_response();
        if self.authenticate {
            response
                .headers_mut()
                .insert(WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
        }
        response
    }
}

impl From<sqlx::Error> for AppError {
    fn from(value: sqlx::Error) -> Self {
        Self::database(value)
    }
}
