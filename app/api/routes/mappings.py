"""Mapping management endpoints."""

from fastapi import APIRouter, HTTPException

from ..models import MappingSaveRequest, MappingResponse, MappingListResponse
from ..storage import mapping_storage

router = APIRouter()


@router.post("", response_model=MappingResponse)
async def save_mapping(data: MappingSaveRequest):
    """Save a new mapping configuration."""
    return mapping_storage.create(data)


@router.get("", response_model=MappingListResponse)
async def list_mappings():
    """List all saved mappings."""
    mappings = mapping_storage.list_all()
    return MappingListResponse(mappings=mappings, total=len(mappings))


@router.get("/{mapping_id}", response_model=MappingResponse)
async def get_mapping(mapping_id: str):
    """Get a specific mapping."""
    mapping = mapping_storage.get(mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.delete("/{mapping_id}")
async def delete_mapping(mapping_id: str):
    """Delete a mapping."""
    if not mapping_storage.delete(mapping_id):
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"status": "deleted"}


# Predefined transformation types
TRANSFORM_TYPES = [
    {
        "name": "direct",
        "description": "Copy value as-is",
        "config_schema": {},
    },
    {
        "name": "prefix_add",
        "description": "Add a prefix to the value",
        "config_schema": {"prefix": {"type": "string", "required": True}},
    },
    {
        "name": "prefix_strip",
        "description": "Remove a prefix from the value",
        "config_schema": {"prefix": {"type": "string", "required": True}},
    },
    {
        "name": "split_name",
        "description": "Split a full name into parts",
        "config_schema": {"part": {"type": "string", "enum": ["first", "last", "middle"], "required": True}},
    },
    {
        "name": "enum_map",
        "description": "Map enum values to different values",
        "config_schema": {"mapping": {"type": "object", "required": True}},
    },
    {
        "name": "iso_to_unix",
        "description": "Convert ISO date to Unix timestamp",
        "config_schema": {},
    },
    {
        "name": "unix_to_iso",
        "description": "Convert Unix timestamp to ISO date",
        "config_schema": {},
    },
    {
        "name": "country_code",
        "description": "Convert country name to ISO code",
        "config_schema": {},
    },
    {
        "name": "currency_convert",
        "description": "Convert currency amounts",
        "config_schema": {
            "from_cents": {"type": "boolean", "required": False},
            "to_cents": {"type": "boolean", "required": False},
        },
    },
    {
        "name": "concat",
        "description": "Concatenate multiple fields",
        "config_schema": {
            "fields": {"type": "array", "required": True},
            "separator": {"type": "string", "required": False, "default": " "},
        },
    },
    {
        "name": "template",
        "description": "Apply string template",
        "config_schema": {"template": {"type": "string", "required": True}},
    },
    {
        "name": "default",
        "description": "Set a default value if source is empty",
        "config_schema": {"value": {"type": "any", "required": True}},
    },
    {
        "name": "computed",
        "description": "Compute value from Python expression",
        "config_schema": {"expression": {"type": "string", "required": True}},
    },
    {
        "name": "uppercase",
        "description": "Convert to uppercase",
        "config_schema": {},
    },
    {
        "name": "lowercase",
        "description": "Convert to lowercase",
        "config_schema": {},
    },
    {
        "name": "trim",
        "description": "Trim whitespace",
        "config_schema": {},
    },
    {
        "name": "nested_get",
        "description": "Get value from nested path",
        "config_schema": {"path": {"type": "string", "required": True}},
    },
]


@router.get("/transforms/types")
async def list_transform_types():
    """List all available transformation types."""
    return {"transforms": TRANSFORM_TYPES}
