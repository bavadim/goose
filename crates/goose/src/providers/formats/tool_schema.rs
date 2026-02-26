use serde_json::{json, Value};

pub fn validate_tool_schemas(tools: &mut [Value]) {
    for tool in tools.iter_mut() {
        if let Some(function) = tool.get_mut("function") {
            if let Some(parameters) = function.get_mut("parameters") {
                if parameters.is_object() {
                    ensure_valid_json_schema(parameters);
                }
            }
        }
    }
}

pub fn normalize_responses_tool_schemas(tools: &mut [Value]) {
    for tool in tools.iter_mut() {
        if let Some(parameters) = tool.get_mut("parameters") {
            if parameters.is_object() {
                normalize_schema_for_compatible_provider(parameters);
                ensure_valid_json_schema(parameters);
            }
        }
    }
}

fn normalize_schema_for_compatible_provider(schema: &mut Value) {
    let defs = schema.get("$defs").cloned();
    normalize_schema_node(schema, defs.as_ref());
}

fn normalize_schema_node(schema: &mut Value, defs: Option<&Value>) {
    let Some(obj) = schema.as_object_mut() else {
        return;
    };

    if let Some(reference) = obj.get("$ref").and_then(Value::as_str) {
        if let Some(resolved) = resolve_local_ref(defs, reference) {
            *schema = resolved;
            normalize_schema_node(schema, defs);
            return;
        }
    }

    obj.remove("$schema");
    obj.remove("$id");
    obj.remove("title");
    obj.remove("$defs");

    collapse_nullable_type(obj);

    if let Some(properties) = obj.get_mut("properties").and_then(Value::as_object_mut) {
        for property_schema in properties.values_mut() {
            normalize_schema_node(property_schema, defs);
        }
    }

    if let Some(items) = obj.get_mut("items") {
        match items {
            Value::Object(_) => normalize_schema_node(items, defs),
            Value::Array(arr) => {
                for item in arr.iter_mut() {
                    normalize_schema_node(item, defs);
                }
            }
            _ => {}
        }
    }

    if let Some(additional) = obj.get_mut("additionalProperties") {
        if additional.is_object() {
            normalize_schema_node(additional, defs);
        }
    }
}

fn resolve_local_ref(defs: Option<&Value>, reference: &str) -> Option<Value> {
    let defs = defs?.as_object()?;
    let key = reference.strip_prefix("#/$defs/")?;
    defs.get(key).cloned()
}

fn collapse_nullable_type(obj: &mut serde_json::Map<String, Value>) {
    let Some(typ) = obj.get_mut("type") else {
        return;
    };
    let Value::Array(types) = typ else {
        return;
    };

    let mut non_null_types: Vec<String> = types
        .iter()
        .filter_map(Value::as_str)
        .filter(|t| *t != "null")
        .map(str::to_string)
        .collect();

    if non_null_types.len() == 1 {
        *typ = Value::String(non_null_types.remove(0));
    } else if non_null_types.len() > 1 {
        *typ = Value::String(non_null_types.remove(0));
    } else {
        *typ = Value::String("string".to_string());
    }
}

fn ensure_valid_json_schema(schema: &mut Value) {
    if let Some(params_obj) = schema.as_object_mut() {
        let is_object_type = params_obj
            .get("type")
            .and_then(|t| t.as_str())
            .is_none_or(|t| t == "object");

        if is_object_type {
            params_obj.entry("properties").or_insert_with(|| json!({}));
            params_obj.entry("required").or_insert_with(|| json!([]));
            params_obj.entry("type").or_insert_with(|| json!("object"));

            if let Some(properties) = params_obj.get_mut("properties") {
                if let Some(properties_obj) = properties.as_object_mut() {
                    for prop in properties_obj.values_mut() {
                        if prop.is_object()
                            && prop.get("type").and_then(|t| t.as_str()) == Some("object")
                        {
                            ensure_valid_json_schema(prop);
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_responses_tool_schemas_inlines_defs_and_nullable_types() {
        let mut tools = vec![json!({
            "type": "function",
            "name": "test",
            "parameters": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "title": "Root",
                "type": "object",
                "properties": {
                    "extension_name": {
                        "type": ["string", "null"]
                    },
                    "action": {
                        "$ref": "#/$defs/ManageExtensionAction"
                    }
                },
                "$defs": {
                    "ManageExtensionAction": {
                        "type": "string",
                        "enum": ["enable", "disable"]
                    }
                },
                "required": ["action"]
            }
        })];

        normalize_responses_tool_schemas(&mut tools);

        let params = &tools[0]["parameters"];
        assert!(params.get("$schema").is_none());
        assert!(params.get("title").is_none());
        assert!(params.get("$defs").is_none());
        assert_eq!(params["properties"]["extension_name"]["type"], "string");
        assert_eq!(params["properties"]["action"]["type"], "string");
        assert_eq!(
            params["properties"]["action"]["enum"],
            json!(["enable", "disable"])
        );
    }

    #[test]
    fn test_validate_tool_schemas_adds_missing_object_fields() {
        let mut actual = vec![json!({
            "type": "function",
            "function": {
                "name": "test_func",
                "description": "test description",
                "parameters": {
                    "type": "object"
                }
            }
        })];

        validate_tool_schemas(&mut actual);
        let params = &actual[0]["function"]["parameters"];
        assert_eq!(params["type"], "object");
        assert_eq!(params["properties"], json!({}));
        assert_eq!(params["required"], json!([]));
    }
}
