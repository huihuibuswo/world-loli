use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub code: u16,
    pub message: String,
    pub data: T,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            code: 0,
            message: "ok".to_owned(),
            data,
        }
    }

    pub fn with_message(data: T, message: impl Into<String>) -> Self {
        Self {
            code: 0,
            message: message.into(),
            data,
        }
    }
}
