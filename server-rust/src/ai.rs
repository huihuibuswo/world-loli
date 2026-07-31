use std::{collections::HashMap, time::Duration};

use serde_json::{json, Value};
use thiserror::Error;

use crate::config::Settings;

const MAX_AI_RESPONSE_BYTES: usize = 64 * 1024;
const MAX_AI_DIAGNOSTIC_FIELD_CHARS: usize = 64;

#[derive(Clone)]
pub struct AiClient {
    client: reqwest::Client,
}

#[derive(Debug, Error)]
pub enum AiProviderError {
    #[error("AI service is not configured")]
    Unconfigured,
    #[error("AI request failed ({category})")]
    Request { category: &'static str },
    #[error("AI service returned HTTP {http_status}")]
    Status {
        http_status: u16,
        provider_error_type: Option<String>,
        provider_error_code: Option<String>,
        provider_request_id: Option<String>,
    },
    #[error("AI response structure is invalid")]
    Response,
    #[error("AI response content is invalid")]
    Content,
}

#[derive(Debug)]
pub struct AiCompletion {
    pub data: Value,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
}

impl AiProviderError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Unconfigured => "unconfigured",
            Self::Request { .. } => "request",
            Self::Status { .. } => "status",
            Self::Response => "response",
            Self::Content => "content",
        }
    }

    pub fn http_status(&self) -> u16 {
        match self {
            Self::Status { http_status, .. } => *http_status,
            _ => 0,
        }
    }

    pub fn request_category(&self) -> &'static str {
        match self {
            Self::Request { category } => category,
            _ => "",
        }
    }

    pub fn provider_error_type(&self) -> &str {
        match self {
            Self::Status {
                provider_error_type,
                ..
            } => provider_error_type.as_deref().unwrap_or(""),
            _ => "",
        }
    }

    pub fn provider_error_code(&self) -> &str {
        match self {
            Self::Status {
                provider_error_code,
                ..
            } => provider_error_code.as_deref().unwrap_or(""),
            _ => "",
        }
    }

    pub fn provider_request_id(&self) -> &str {
        match self {
            Self::Status {
                provider_request_id,
                ..
            } => provider_request_id.as_deref().unwrap_or(""),
            _ => "",
        }
    }
}

impl AiClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .expect("valid AI HTTP client configuration"),
        }
    }

    pub async fn complete_json(
        &self,
        settings: &Settings,
        messages: Vec<Value>,
        timeout_seconds: f64,
        temperature: f64,
    ) -> Result<AiCompletion, AiProviderError> {
        if !settings.ai_configured() {
            return Err(AiProviderError::Unconfigured);
        }
        let endpoint = format!(
            "{}/chat/completions",
            settings.ai_base_url.trim().trim_end_matches('/')
        );
        let mut response = self
            .client
            .post(endpoint)
            .bearer_auth(settings.ai_api_key.as_deref().unwrap_or_default())
            .timeout(Duration::from_secs_f64(timeout_seconds))
            .json(&json!({
                "model": settings.ai_model,
                "messages": messages,
                "temperature": temperature,
                "response_format": {"type": "json_object"},
            }))
            .send()
            .await
            .map_err(|error| AiProviderError::Request {
                category: request_error_category(&error),
            })?;
        if !response.status().is_success() {
            let http_status = response.status().as_u16();
            let provider_request_id = response
                .headers()
                .get("x-request-id")
                .or_else(|| response.headers().get("request-id"))
                .and_then(|value| value.to_str().ok())
                .and_then(safe_diagnostic_field);
            let error_body = read_response_bytes(&mut response).await.ok();
            let (provider_error_type, provider_error_code) = error_body
                .as_deref()
                .and_then(provider_error_fields)
                .unwrap_or_default();
            return Err(AiProviderError::Status {
                http_status,
                provider_error_type,
                provider_error_code,
                provider_request_id,
            });
        }
        let bytes = read_response_bytes(&mut response).await?;
        let body: Value = serde_json::from_slice(&bytes).map_err(|_| AiProviderError::Response)?;
        let content = body
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .ok_or(AiProviderError::Response)?;
        let data = decode_json_object(content)?;
        let usage = body.get("usage").and_then(Value::as_object);
        Ok(AiCompletion {
            data,
            prompt_tokens: usage
                .and_then(|value| value.get("prompt_tokens"))
                .and_then(Value::as_i64)
                .unwrap_or(0),
            completion_tokens: usage
                .and_then(|value| value.get("completion_tokens"))
                .and_then(Value::as_i64)
                .unwrap_or(0),
        })
    }
}

fn request_error_category(error: &reqwest::Error) -> &'static str {
    if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_body() {
        "body"
    } else {
        "transport"
    }
}

async fn read_response_bytes(
    response: &mut reqwest::Response,
) -> Result<Vec<u8>, AiProviderError> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_AI_RESPONSE_BYTES as u64)
    {
        return Err(AiProviderError::Response);
    }
    let mut bytes = Vec::with_capacity(
        response
            .content_length()
            .unwrap_or_default()
            .min(MAX_AI_RESPONSE_BYTES as u64) as usize,
    );
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| AiProviderError::Response)?
    {
        if chunk.len() > MAX_AI_RESPONSE_BYTES.saturating_sub(bytes.len()) {
            return Err(AiProviderError::Response);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn provider_error_fields(bytes: &[u8]) -> Option<(Option<String>, Option<String>)> {
    let body: Value = serde_json::from_slice(bytes).ok()?;
    let error = body.get("error")?.as_object()?;
    Some((
        error
            .get("type")
            .and_then(Value::as_str)
            .and_then(safe_diagnostic_field),
        error
            .get("code")
            .and_then(Value::as_str)
            .and_then(safe_diagnostic_field),
    ))
}

fn safe_diagnostic_field(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty()
        || value.chars().count() > MAX_AI_DIAGNOSTIC_FIELD_CHARS
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._:-".contains(character))
    {
        return None;
    }
    Some(value.to_owned())
}

impl Default for AiClient {
    fn default() -> Self {
        Self::new()
    }
}

fn content_text(content: &Value) -> Result<String, AiProviderError> {
    if let Some(text) = content.as_str() {
        return Ok(text.to_owned());
    }
    let parts = content.as_array().ok_or(AiProviderError::Content)?;
    Ok(parts
        .iter()
        .filter_map(Value::as_object)
        .filter(|part| {
            part.get("type")
                .and_then(Value::as_str)
                .is_none_or(|kind| kind == "text")
        })
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect())
}

fn decode_json_object(content: &Value) -> Result<Value, AiProviderError> {
    let mut text = content_text(content)?.trim().to_owned();
    if text.starts_with("```") {
        let mut lines: Vec<&str> = text.lines().collect();
        if lines.first().is_some_and(|line| line.starts_with("```")) {
            lines.remove(0);
        }
        if lines.last().is_some_and(|line| line.trim() == "```") {
            lines.pop();
        }
        text = lines.join("\n").trim().to_owned();
    }
    let value: Value = serde_json::from_str(&text).map_err(|_| AiProviderError::Content)?;
    if !value.is_object() {
        return Err(AiProviderError::Content);
    }
    Ok(value)
}

pub fn maximal_legal_sequence(sequence: &[i64], candidates: &[Value], energy: i64) -> bool {
    let mut counts = HashMap::<i64, i64>::new();
    let mut costs = HashMap::<i64, i64>::new();
    for candidate in candidates {
        let Some(id) = candidate.get("card_template_id").and_then(Value::as_i64) else {
            continue;
        };
        let Some(cost) = candidate.get("cost").and_then(Value::as_i64) else {
            continue;
        };
        counts.insert(
            id,
            candidate
                .get("available_copies")
                .and_then(Value::as_i64)
                .unwrap_or(0),
        );
        costs.insert(id, cost);
    }
    let mut remaining = energy;
    for id in sequence {
        let count = counts.get_mut(id);
        let cost = costs.get(id).copied().unwrap_or(remaining + 1);
        if count.as_deref().copied().unwrap_or(0) <= 0 || cost > remaining {
            return false;
        }
        *count.expect("count checked") -= 1;
        remaining -= cost;
    }
    !counts
        .iter()
        .any(|(id, count)| *count > 0 && costs.get(id).is_some_and(|cost| *cost <= remaining))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::SocketAddr;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
        task::JoinHandle,
    };

    fn settings(base_url: String) -> Settings {
        Settings {
            app_name: "test".to_owned(),
            environment: "test".to_owned(),
            database_url: "postgresql://localhost/test".to_owned(),
            jwt_secret: "test-secret-with-at-least-32-characters".to_owned(),
            jwt_algorithm: "HS256".to_owned(),
            access_token_minutes: 120,
            cors_origins: "http://localhost:5173".to_owned(),
            bind_address: "127.0.0.1:0".parse().unwrap(),
            database_max_connections: 1,
            database_acquire_timeout_seconds: 1,
            ai_memory_retention_days: 90,
            ai_enabled: true,
            ai_dialogue_enabled: true,
            ai_battle_enabled: true,
            ai_base_url: base_url,
            ai_api_key: Some("test-key".to_owned()),
            ai_model: "test-model".to_owned(),
            ai_dialogue_timeout_seconds: 8.0,
            ai_battle_timeout_seconds: 2.0,
            ai_max_input_chars: 500,
            ai_max_reply_chars: 400,
            ai_memory_recent_turns: 8,
            ai_memory_summary_chars: 1200,
            ai_dialogue_min_interval_seconds: 1.5,
            ai_blocked_terms: String::new(),
        }
    }

    async fn mock_server(
        status: &'static str,
        body: impl Into<String>,
        delay: Duration,
    ) -> (String, JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address: SocketAddr = listener.local_addr().unwrap();
        let body = body.into();
        let task = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = vec![0_u8; 16 * 1024];
            let size = stream.read(&mut request).await.unwrap();
            tokio::time::sleep(delay).await;
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(response.as_bytes()).await;
            String::from_utf8_lossy(&request[..size]).into_owned()
        });
        (format!("http://{address}/v1"), task)
    }

    #[test]
    fn decodes_fenced_json_and_rejects_non_object() {
        assert_eq!(
            decode_json_object(&json!("```json\n{\"reply\":\"你好\"}\n```")).unwrap()["reply"],
            "你好"
        );
        assert!(decode_json_object(&json!("[1,2]")).is_err());
    }

    #[test]
    fn sequence_must_use_all_affordable_cards() {
        let candidates = vec![
            json!({"card_template_id":1,"cost":1,"available_copies":2}),
            json!({"card_template_id":2,"cost":2,"available_copies":1}),
        ];
        assert!(maximal_legal_sequence(&[2, 1], &candidates, 3));
        assert!(!maximal_legal_sequence(&[1], &candidates, 3));
        assert!(!maximal_legal_sequence(&[9], &candidates, 3));
    }

    #[tokio::test]
    async fn client_handles_success_status_invalid_content_and_timeout() {
        let body = r#"{"choices":[{"message":{"content":"```json\n{\"reply\":\"你好\"}\n```"}}],"usage":{"prompt_tokens":3,"completion_tokens":5}}"#;
        let (base_url, request) = mock_server("200 OK", body, Duration::ZERO).await;
        let completion = AiClient::new()
            .complete_json(
                &settings(base_url),
                vec![json!({"role":"user","content":"你好"})],
                1.0,
                0.5,
            )
            .await
            .unwrap();
        assert_eq!(completion.data["reply"], "你好");
        assert_eq!(completion.prompt_tokens, 3);
        let request = request.await.unwrap();
        assert!(request
            .to_ascii_lowercase()
            .contains("authorization: bearer test-key"));
        assert!(request.contains("\"response_format\":{\"type\":\"json_object\"}"));

        let provider_error = r#"{"error":{"message":"API key sk-secret is invalid","type":"invalid_request_error","code":"invalid_api_key"}}"#;
        let (base_url, _) =
            mock_server("500 Internal Server Error", provider_error, Duration::ZERO).await;
        let error = AiClient::new()
            .complete_json(&settings(base_url), vec![], 1.0, 0.0)
            .await
            .unwrap_err();
        assert_eq!(error.kind(), "status");
        assert_eq!(error.http_status(), 500);
        assert_eq!(error.provider_error_type(), "invalid_request_error");
        assert_eq!(error.provider_error_code(), "invalid_api_key");
        assert!(!format!("{error:?}").contains("sk-secret"));

        let invalid = r#"{"choices":[{"message":{"content":"not-json"}}]}"#;
        let (base_url, _) = mock_server("200 OK", invalid, Duration::ZERO).await;
        assert!(matches!(
            AiClient::new()
                .complete_json(&settings(base_url), vec![], 1.0, 0.0)
                .await,
            Err(AiProviderError::Content)
        ));

        let (base_url, _) = mock_server("200 OK", body, Duration::from_millis(100)).await;
        assert!(matches!(
            AiClient::new()
                .complete_json(&settings(base_url), vec![], 0.01, 0.0)
                .await,
            Err(AiProviderError::Request {
                category: "timeout"
            })
        ));

        let (base_url, _) = mock_server(
            "200 OK",
            "x".repeat(MAX_AI_RESPONSE_BYTES + 1),
            Duration::ZERO,
        )
        .await;
        assert!(matches!(
            AiClient::new()
                .complete_json(&settings(base_url), vec![], 1.0, 0.0)
                .await,
            Err(AiProviderError::Response)
        ));
    }

    #[tokio::test]
    async fn client_does_not_follow_provider_redirects() {
        let target = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let target_address = target.local_addr().unwrap();
        let target_task = tokio::spawn(async move {
            tokio::time::timeout(Duration::from_millis(200), target.accept())
                .await
                .is_ok()
        });

        let redirect = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let redirect_address = redirect.local_addr().unwrap();
        let redirect_task = tokio::spawn(async move {
            let (mut stream, _) = redirect.accept().await.unwrap();
            let mut request = vec![0_u8; 4096];
            let _ = stream.read(&mut request).await.unwrap();
            let response = format!(
                "HTTP/1.1 302 Found\r\nLocation: http://{target_address}/captured\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            );
            stream.write_all(response.as_bytes()).await.unwrap();
        });

        let result = AiClient::new()
            .complete_json(
                &settings(format!("http://{redirect_address}/v1")),
                vec![json!({"role":"user","content":"private prompt"})],
                1.0,
                0.0,
            )
            .await;
        assert!(matches!(
            result,
            Err(AiProviderError::Status {
                http_status: 302,
                ..
            })
        ));
        redirect_task.await.unwrap();
        assert!(!target_task.await.unwrap());
    }
}
