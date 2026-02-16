use super::api_client::{ApiClient, AuthMethod};
use super::base::{ConfigKey, Provider, ProviderDef, ProviderMetadata, ProviderUsage};
use super::errors::ProviderError;
use super::formats::openai_responses::{
    create_responses_request, get_responses_usage, responses_api_to_message,
    responses_api_to_streaming_message, ResponsesApiResponse,
};
use super::openai_compatible::{handle_response_openai_compat, handle_status_openai_compat};
use super::retry::ProviderRetry;
use crate::conversation::message::Message;
use crate::model::ModelConfig;
use crate::providers::base::MessageStream;
use crate::providers::utils::RequestLog;
use anyhow::Result;
use async_stream::try_stream;
use async_trait::async_trait;
use futures::future::BoxFuture;
use futures::{StreamExt, TryStreamExt};
use std::io;
use tokio::pin;
use tokio_util::codec::{FramedRead, LinesCodec};
use tokio_util::io::StreamReader;

use rmcp::model::Tool;

const COMPRESSA_PROVIDER_NAME: &str = "compressa";
const COMPRESSA_DEFAULT_MODEL: &str = "compressa/default";
const COMPRESSA_DOC_URL: &str = "http://console.insightstream.ru";

#[derive(Debug, serde::Serialize)]
pub struct CompressaProvider {
    #[serde(skip)]
    api_client: ApiClient,
    model: ModelConfig,
}

impl CompressaProvider {
    pub async fn from_env(model: ModelConfig) -> Result<Self> {
        let config = crate::config::Config::global();
        let host: String = config
            .get_param("COMPRESSA_HOST")
            .unwrap_or_else(|_| "http://console.insightstream.ru".to_string());
        let api_key: Option<String> = config.get_secret("COMPRESSA_API_KEY").ok();
        let timeout_secs: u64 = config.get_param("COMPRESSA_TIMEOUT").unwrap_or(600);

        let auth = match api_key {
            Some(key) if !key.is_empty() => AuthMethod::BearerToken(key),
            _ => AuthMethod::NoAuth,
        };
        let api_client =
            ApiClient::with_timeout(host, auth, std::time::Duration::from_secs(timeout_secs))?;

        Ok(Self { api_client, model })
    }

    async fn post_responses(
        &self,
        session_id: Option<&str>,
        payload: &serde_json::Value,
    ) -> Result<serde_json::Value, ProviderError> {
        let response = self
            .api_client
            .response_post(session_id, "v1/responses", payload)
            .await?;
        handle_response_openai_compat(response).await
    }
}

impl ProviderDef for CompressaProvider {
    type Provider = Self;

    fn metadata() -> ProviderMetadata {
        ProviderMetadata::new(
            COMPRESSA_PROVIDER_NAME,
            "Compressa",
            "Responses API compatible provider",
            COMPRESSA_DEFAULT_MODEL,
            vec![],
            COMPRESSA_DOC_URL,
            vec![
                ConfigKey::new("COMPRESSA_API_KEY", false, true, None),
                ConfigKey::new(
                    "COMPRESSA_HOST",
                    true,
                    false,
                    Some("http://console.insightstream.ru"),
                ),
                ConfigKey::new("COMPRESSA_TIMEOUT", false, false, Some("600")),
            ],
        )
        .with_unlisted_models()
    }

    fn from_env(
        model: ModelConfig,
        _extensions: Vec<crate::config::ExtensionConfig>,
    ) -> BoxFuture<'static, Result<Self::Provider>> {
        Box::pin(Self::from_env(model))
    }
}

#[async_trait]
impl Provider for CompressaProvider {
    fn get_name(&self) -> &str {
        COMPRESSA_PROVIDER_NAME
    }

    fn get_model_config(&self) -> ModelConfig {
        self.model.clone()
    }

    async fn complete_with_model(
        &self,
        session_id: Option<&str>,
        model_config: &ModelConfig,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
    ) -> Result<(Message, ProviderUsage), ProviderError> {
        let payload = create_responses_request(model_config, system, messages, tools)?;
        let mut log = RequestLog::start(model_config, &payload)?;

        let json_response = self
            .with_retry(|| async {
                let payload_clone = payload.clone();
                self.post_responses(session_id, &payload_clone).await
            })
            .await
            .inspect_err(|e| {
                let _ = log.error(e);
            })?;

        let response: ResponsesApiResponse = serde_json::from_value(json_response.clone())
            .map_err(|e| {
                ProviderError::ExecutionError(format!(
                    "Failed to parse responses API response: {}",
                    e
                ))
            })?;

        let message = responses_api_to_message(&response)?;
        let usage = get_responses_usage(&response);
        let model = response.model.clone();

        log.write(&json_response, Some(&usage))?;
        Ok((message, ProviderUsage::new(model, usage)))
    }

    async fn fetch_supported_models(&self) -> Result<Vec<String>, ProviderError> {
        let response = self
            .api_client
            .request(None, "v1/models")
            .response_get()
            .await?;
        let json = handle_response_openai_compat(response).await?;
        let data = json.get("data").and_then(|v| v.as_array()).ok_or_else(|| {
            ProviderError::UsageError("Missing data field in JSON response".into())
        })?;

        let mut models: Vec<String> = data
            .iter()
            .filter_map(|m| m.get("id").and_then(|v| v.as_str()).map(str::to_string))
            .collect();
        models.sort();
        Ok(models)
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    async fn stream(
        &self,
        session_id: &str,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
    ) -> Result<MessageStream, ProviderError> {
        let mut payload = create_responses_request(&self.model, system, messages, tools)?;
        payload["stream"] = serde_json::Value::Bool(true);
        let mut log = RequestLog::start(&self.model, &payload)?;

        let response = self
            .with_retry(|| async {
                let payload_clone = payload.clone();
                let resp = self
                    .api_client
                    .response_post(Some(session_id), "v1/responses", &payload_clone)
                    .await?;
                handle_status_openai_compat(resp).await
            })
            .await
            .inspect_err(|e| {
                let _ = log.error(e);
            })?;

        let stream = response.bytes_stream().map_err(io::Error::other);

        Ok(Box::pin(try_stream! {
            let stream_reader = StreamReader::new(stream);
            let framed = FramedRead::new(stream_reader, LinesCodec::new()).map_err(anyhow::Error::from);

            let message_stream = responses_api_to_streaming_message(framed);
            pin!(message_stream);
            while let Some(message) = message_stream.next().await {
                let (message, usage) = message.map_err(|e| ProviderError::RequestFailed(format!("Stream decode error: {}", e)))?;
                log.write(&message, usage.as_ref().map(|f| f.usage).as_ref())?;
                yield (message, usage);
            }
        }))
    }
}
