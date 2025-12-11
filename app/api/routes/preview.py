"""Preview transformation endpoints."""

from fastapi import APIRouter, HTTPException

from ..models import PreviewRequest, PreviewResponse
from ...models.record import SourceRecord
from ...models.schema import EntityMapping, FieldMapping
from ...services.transformer import TransformEngine
from ...services.validator import RecordValidator

router = APIRouter()


@router.post("", response_model=PreviewResponse)
async def preview_transformation(data: PreviewRequest):
    """Preview a single record transformation."""
    try:
        # Create source record
        source_record = SourceRecord(
            id=data.source_record.get("id", "preview"),
            source_service=data.source_service,
            source_entity=data.source_entity,
            data=data.source_record,
        )

        # Build field mappings
        field_mappings = []
        for fm in data.field_mappings:
            field_mappings.append(FieldMapping(
                source_field=fm.source_field,
                target_field=fm.target_field,
                transform=fm.transform,
                config=fm.config,
            ))

        # Create entity mapping
        entity_mapping = EntityMapping(
            source_service=data.source_service,
            source_entity=data.source_entity,
            target_service=data.target_service,
            target_entity=data.target_entity,
            field_mappings=field_mappings,
        )

        # Transform
        transformer = TransformEngine()
        transformed = transformer.transform_record(
            source_records=[source_record],
            mapping=entity_mapping,
            target_service=data.target_service,
            target_entity=data.target_entity,
        )

        # Validate (basic validation)
        validation_errors = []
        is_valid = True

        if transformed.validation_errors:
            validation_errors = [str(e) for e in transformed.validation_errors]
            is_valid = False

        return PreviewResponse(
            source_data=data.source_record,
            transformed_data=transformed.data,
            validation_errors=validation_errors,
            is_valid=is_valid,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch")
async def preview_batch_transformation(data: list[PreviewRequest]):
    """Preview multiple record transformations."""
    results = []
    for item in data:
        try:
            result = await preview_transformation(item)
            results.append(result)
        except HTTPException as e:
            results.append(PreviewResponse(
                source_data=item.source_record,
                transformed_data={},
                validation_errors=[e.detail],
                is_valid=False,
            ))

    return results
