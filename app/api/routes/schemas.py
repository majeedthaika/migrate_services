"""Schema management endpoints."""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from ..models import SchemaInferRequest, SchemaInferResponse, EntitySchema, FieldSchema

router = APIRouter()

# Predefined schemas for common services
PREDEFINED_SCHEMAS = {
    "stripe": {
        "Customer": EntitySchema(
            service="stripe",
            entity="Customer",
            fields=[
                FieldSchema(name="id", type="string", required=True, description="Stripe customer ID"),
                FieldSchema(name="email", type="string", required=True, description="Customer email"),
                FieldSchema(name="name", type="string", required=False, description="Customer name"),
                FieldSchema(name="phone", type="string", required=False, description="Phone number"),
                FieldSchema(name="description", type="string", required=False, description="Description"),
                FieldSchema(name="created", type="integer", required=False, description="Unix timestamp"),
                FieldSchema(name="metadata", type="object", required=False, description="Metadata"),
                FieldSchema(name="address", type="object", required=False, description="Address object"),
                FieldSchema(name="balance", type="integer", required=False, description="Balance in cents"),
                FieldSchema(name="currency", type="string", required=False, description="Currency code"),
            ]
        ),
        "Subscription": EntitySchema(
            service="stripe",
            entity="Subscription",
            fields=[
                FieldSchema(name="id", type="string", required=True, description="Subscription ID"),
                FieldSchema(name="customer", type="string", required=True, description="Customer ID"),
                FieldSchema(name="status", type="string", required=True, description="Status"),
                FieldSchema(name="plan", type="object", required=False, description="Plan details"),
                FieldSchema(name="current_period_start", type="integer", required=False, description="Period start"),
                FieldSchema(name="current_period_end", type="integer", required=False, description="Period end"),
                FieldSchema(name="cancel_at_period_end", type="boolean", required=False, description="Cancel flag"),
                FieldSchema(name="trial_start", type="integer", required=False, description="Trial start"),
                FieldSchema(name="trial_end", type="integer", required=False, description="Trial end"),
            ]
        ),
    },
    "salesforce": {
        "Account": EntitySchema(
            service="salesforce",
            entity="Account",
            fields=[
                FieldSchema(name="Id", type="string", required=True, description="Salesforce ID"),
                FieldSchema(name="Name", type="string", required=True, description="Account name"),
                FieldSchema(name="Email", type="string", required=False, description="Email"),
                FieldSchema(name="Phone", type="string", required=False, description="Phone"),
                FieldSchema(name="Website", type="string", required=False, description="Website"),
                FieldSchema(name="Industry", type="string", required=False, description="Industry"),
                FieldSchema(name="BillingStreet", type="string", required=False, description="Street"),
                FieldSchema(name="BillingCity", type="string", required=False, description="City"),
                FieldSchema(name="BillingState", type="string", required=False, description="State"),
                FieldSchema(name="BillingCountry", type="string", required=False, description="Country"),
                FieldSchema(name="BillingPostalCode", type="string", required=False, description="Postal code"),
            ]
        ),
        "Contact": EntitySchema(
            service="salesforce",
            entity="Contact",
            fields=[
                FieldSchema(name="Id", type="string", required=True, description="Contact ID"),
                FieldSchema(name="FirstName", type="string", required=False, description="First name"),
                FieldSchema(name="LastName", type="string", required=True, description="Last name"),
                FieldSchema(name="Email", type="string", required=False, description="Email"),
                FieldSchema(name="Phone", type="string", required=False, description="Phone"),
                FieldSchema(name="AccountId", type="string", required=False, description="Account ID"),
            ]
        ),
    },
    "chargebee": {
        "Customer": EntitySchema(
            service="chargebee",
            entity="Customer",
            fields=[
                FieldSchema(name="id", type="string", required=True, description="Customer ID"),
                FieldSchema(name="email", type="string", required=True, description="Email"),
                FieldSchema(name="first_name", type="string", required=False, description="First name"),
                FieldSchema(name="last_name", type="string", required=False, description="Last name"),
                FieldSchema(name="company", type="string", required=False, description="Company"),
                FieldSchema(name="phone", type="string", required=False, description="Phone"),
                FieldSchema(name="billing_address", type="object", required=False, description="Billing address"),
                FieldSchema(name="meta_data", type="object", required=False, description="Metadata"),
                FieldSchema(name="auto_collection", type="string", required=False, description="Auto collection"),
                FieldSchema(name="taxability", type="string", required=False, description="Taxability"),
            ]
        ),
        "Subscription": EntitySchema(
            service="chargebee",
            entity="Subscription",
            fields=[
                FieldSchema(name="id", type="string", required=True, description="Subscription ID"),
                FieldSchema(name="customer_id", type="string", required=True, description="Customer ID"),
                FieldSchema(name="plan_id", type="string", required=True, description="Plan ID"),
                FieldSchema(name="status", type="string", required=True, description="Status"),
                FieldSchema(name="start_date", type="integer", required=False, description="Start date"),
                FieldSchema(name="trial_start", type="integer", required=False, description="Trial start"),
                FieldSchema(name="trial_end", type="integer", required=False, description="Trial end"),
                FieldSchema(name="current_term_start", type="integer", required=False, description="Term start"),
                FieldSchema(name="current_term_end", type="integer", required=False, description="Term end"),
            ]
        ),
    },
}


@router.get("")
async def list_schemas():
    """List all available schemas."""
    result = {}
    for service, entities in PREDEFINED_SCHEMAS.items():
        result[service] = list(entities.keys())
    return {"schemas": result}


@router.get("/{service}")
async def get_service_schemas(service: str):
    """Get all schemas for a service."""
    if service not in PREDEFINED_SCHEMAS:
        raise HTTPException(status_code=404, detail=f"Service '{service}' not found")
    return {"service": service, "entities": list(PREDEFINED_SCHEMAS[service].keys())}


@router.get("/{service}/{entity}")
async def get_entity_schema(service: str, entity: str):
    """Get schema for a specific entity."""
    if service not in PREDEFINED_SCHEMAS:
        raise HTTPException(status_code=404, detail=f"Service '{service}' not found")
    if entity not in PREDEFINED_SCHEMAS[service]:
        raise HTTPException(status_code=404, detail=f"Entity '{entity}' not found in service '{service}'")
    return PREDEFINED_SCHEMAS[service][entity]


@router.post("/infer", response_model=SchemaInferResponse)
async def infer_schema(data: SchemaInferRequest):
    """Infer schema from sample data."""
    if not data.data:
        raise HTTPException(status_code=400, detail="No data provided")

    # Analyze sample data to infer schema
    fields = []
    sample_values = {}

    # Collect all unique fields from all records
    all_fields: Dict[str, set] = {}
    for record in data.data:
        for key, value in record.items():
            if key not in all_fields:
                all_fields[key] = set()
            all_fields[key].add(type(value).__name__)

    # Build field schema
    for field_name, types in all_fields.items():
        # Determine most common type
        type_priority = ["str", "int", "float", "bool", "list", "dict", "NoneType"]
        field_type = "string"
        for t in type_priority:
            if t in types:
                type_map = {
                    "str": "string",
                    "int": "integer",
                    "float": "number",
                    "bool": "boolean",
                    "list": "array",
                    "dict": "object",
                    "NoneType": "string",
                }
                field_type = type_map.get(t, "string")
                break

        # Check if required (present in all records)
        required = all(field_name in record for record in data.data)

        fields.append(FieldSchema(
            name=field_name,
            type=field_type,
            required=required,
            description=f"Auto-inferred from {len(data.data)} samples",
        ))

        # Get sample value
        for record in data.data:
            if field_name in record and record[field_name] is not None:
                sample_values[field_name] = record[field_name]
                break

    schema = EntitySchema(
        service=data.service,
        entity=data.entity,
        fields=fields,
    )

    return SchemaInferResponse(schema=schema, sample_values=sample_values)
