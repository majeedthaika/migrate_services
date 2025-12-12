"""AI-powered endpoints for schema and mapping transformations."""

import json
import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import httpx

router = APIRouter()


class ParseAPIDocsRequest(BaseModel):
    """Request to parse API documentation."""
    docs_url: str
    api_key: Optional[str] = None
    instructions: str = ""


class TransformRequest(BaseModel):
    """Request to transform input data into schema or mapping."""
    input_data: Any
    input_type: str  # file, api, screenshot, url, manual
    output_type: str  # schema, mapping
    instructions: str = ""
    existing_schemas: list[dict] = []
    service_name: str = ""
    entity_name: str = ""


class ScrapeURLRequest(BaseModel):
    """Request to scrape a URL for schema information."""
    url: str
    selector: Optional[str] = None
    instructions: str = ""


class SuggestMappingsRequest(BaseModel):
    """Request to suggest field mappings between schemas."""
    source_schema: dict
    target_schema: dict
    existing_mappings: list[dict] = []


@router.post("/parse-api-docs")
async def parse_api_docs(request: ParseAPIDocsRequest):
    """Parse API documentation to extract schema information."""
    try:
        headers = {}
        if request.api_key:
            headers["Authorization"] = f"Bearer {request.api_key}"

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(request.docs_url, headers=headers)
            response.raise_for_status()

            content = response.text
            content_type = response.headers.get("content-type", "")

            # Try to parse as OpenAPI/Swagger JSON
            if "json" in content_type or request.docs_url.endswith(".json"):
                try:
                    spec = json.loads(content)
                    return parse_openapi_spec(spec)
                except json.JSONDecodeError:
                    pass

            # Return raw content for AI processing
            return {
                "raw_content": content[:10000],  # Limit content size
                "content_type": content_type,
                "url": request.docs_url,
            }

    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch API docs: {str(e)}")


def parse_openapi_spec(spec: dict) -> dict:
    """Parse OpenAPI/Swagger spec to extract schema information."""
    schemas = []

    # OpenAPI 3.x schemas
    if "components" in spec and "schemas" in spec.get("components", {}):
        for name, schema_def in spec["components"]["schemas"].items():
            fields = []
            properties = schema_def.get("properties", {})
            required_fields = schema_def.get("required", [])

            for field_name, field_def in properties.items():
                fields.append({
                    "name": field_name,
                    "type": map_openapi_type(field_def.get("type", "string")),
                    "required": field_name in required_fields,
                    "description": field_def.get("description", ""),
                })

            schemas.append({
                "entity": name,
                "description": schema_def.get("description", ""),
                "fields": fields,
            })

    # Swagger 2.x definitions
    elif "definitions" in spec:
        for name, schema_def in spec["definitions"].items():
            fields = []
            properties = schema_def.get("properties", {})
            required_fields = schema_def.get("required", [])

            for field_name, field_def in properties.items():
                fields.append({
                    "name": field_name,
                    "type": map_openapi_type(field_def.get("type", "string")),
                    "required": field_name in required_fields,
                    "description": field_def.get("description", ""),
                })

            schemas.append({
                "entity": name,
                "description": schema_def.get("description", ""),
                "fields": fields,
            })

    return {"schemas": schemas, "spec_version": spec.get("openapi", spec.get("swagger", "unknown"))}


def map_openapi_type(openapi_type: str) -> str:
    """Map OpenAPI types to our schema types."""
    type_map = {
        "string": "string",
        "integer": "integer",
        "number": "number",
        "boolean": "boolean",
        "array": "array",
        "object": "object",
    }
    return type_map.get(openapi_type, "string")


@router.post("/extract-from-image")
async def extract_from_image(
    file: UploadFile = File(...),
    instructions: str = Form("")
):
    """Extract schema or mapping information from an image using AI vision."""
    # Read image file
    contents = await file.read()

    # For now, return a placeholder - in production this would use Claude's vision API
    # or another vision model to extract schema information from screenshots

    # Mock response for demonstration
    return {
        "extracted_text": "Schema extraction from images requires vision AI integration",
        "suggested_schema": {
            "service": "extracted",
            "entity": "Entity",
            "fields": [
                {"name": "id", "type": "string", "required": True, "description": "Primary identifier"},
                {"name": "name", "type": "string", "required": False, "description": "Name field"},
            ]
        }
    }


@router.post("/scrape-url")
async def scrape_url(request: ScrapeURLRequest):
    """Scrape a URL using browser automation to extract schema information."""
    # This would integrate with browser-use or playwright for actual scraping
    # For now, return a placeholder response

    return {
        "url": request.url,
        "extracted_data": {
            "message": "Web scraping requires browser-use integration",
            "suggested_schema": {
                "service": "scraped",
                "entity": "Entity",
                "fields": [
                    {"name": "id", "type": "string", "required": True, "description": "ID field"},
                ]
            }
        }
    }


@router.post("/transform")
async def transform_data(request: TransformRequest):
    """Transform input data into a schema or mapping using AI."""

    # Infer schema from data
    if request.output_type == "schema":
        schema = infer_schema_from_data(
            request.input_data,
            request.service_name or "service",
            request.entity_name or "Entity",
            request.instructions
        )
        return {"schema": schema}

    # Generate mapping from data
    elif request.output_type == "mapping":
        mapping = infer_mapping_from_data(
            request.input_data,
            request.existing_schemas,
            request.instructions
        )
        return {"mapping": mapping}

    raise HTTPException(status_code=400, detail="Invalid output_type")


@router.post("/suggest-mappings")
async def suggest_mappings(request: SuggestMappingsRequest):
    """Suggest field mappings between source and target schemas using AI."""

    source_fields = request.source_schema.get("fields", [])
    target_fields = request.target_schema.get("fields", [])

    # Simple field matching based on name similarity
    suggested_mappings = []
    mapped_source_fields = set()

    for target_field in target_fields:
        target_name = target_field.get("name", "").lower()
        target_type = target_field.get("type", "string")
        best_match = None
        best_score = 0

        for source_field in source_fields:
            if source_field.get("name") in mapped_source_fields:
                continue

            source_name = source_field.get("name", "").lower()
            source_type = source_field.get("type", "string")

            # Calculate similarity score
            score = 0

            # Exact match
            if source_name == target_name:
                score = 100
            # Partial match
            elif source_name in target_name or target_name in source_name:
                score = 70
            # Common field name patterns
            elif any(pattern in source_name and pattern in target_name
                     for pattern in ["id", "name", "email", "phone", "address", "date", "time", "created", "updated"]):
                score = 50
            # Type compatibility bonus
            if source_type == target_type:
                score += 10

            if score > best_score:
                best_score = score
                best_match = source_field

        if best_match and best_score >= 40:
            transform = "direct"
            config = {}

            # Suggest transformations based on field types
            source_type = best_match.get("type", "string")

            if "name" in target_name and "name" in best_match.get("name", "").lower():
                if "first" in target_name:
                    transform = "split_name"
                    config = {"part": "first"}
                elif "last" in target_name:
                    transform = "split_name"
                    config = {"part": "last"}
            elif source_type in ["integer", "timestamp"] and "date" in target_name:
                transform = "format_date"
                config = {"format": "ISO"}

            suggested_mappings.append({
                "source_field": best_match.get("name"),
                "target_field": target_field.get("name"),
                "transform": transform,
                "config": config
            })
            mapped_source_fields.add(best_match.get("name"))

    return {"mappings": suggested_mappings}


def infer_schema_from_data(
    data: Any,
    service: str,
    entity: str,
    instructions: str = ""
) -> dict:
    """Infer a schema from sample data."""

    fields = []

    # Handle array of objects
    if isinstance(data, list) and len(data) > 0:
        sample = data[0]
    elif isinstance(data, dict):
        sample = data
    else:
        sample = {}

    for key, value in sample.items() if isinstance(sample, dict) else []:
        field_type = infer_field_type(value)
        fields.append({
            "name": key,
            "type": field_type,
            "required": value is not None,
            "description": f"Field {key}"
        })

    return {
        "service": service,
        "entity": entity,
        "fields": fields,
        "description": f"Schema for {service}.{entity}"
    }


def infer_mapping_from_data(
    data: Any,
    existing_schemas: list[dict],
    instructions: str = ""
) -> dict:
    """Infer a mapping from data."""

    # If data is already a mapping structure, return it
    if isinstance(data, dict):
        if "source_service" in data and "target_service" in data:
            return data
        if "field_mappings" in data:
            return {
                "source_service": data.get("source_service", "source"),
                "source_entity": data.get("source_entity", "Entity"),
                "target_service": data.get("target_service", "target"),
                "target_entity": data.get("target_entity", "Entity"),
                "field_mappings": data.get("field_mappings", [])
            }

    # Return empty mapping structure
    return {
        "source_service": "source",
        "source_entity": "Entity",
        "target_service": "target",
        "target_entity": "Entity",
        "field_mappings": []
    }


def infer_field_type(value: Any) -> str:
    """Infer field type from a sample value."""
    if value is None:
        return "string"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    return "string"
