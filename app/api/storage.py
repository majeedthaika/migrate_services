"""In-memory storage for migrations and mappings."""

import json
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime
import uuid

from .models import (
    MigrationCreate,
    MigrationUpdate,
    MigrationResponse,
    MigrationStatusEnum,
    MappingSaveRequest,
    MappingResponse,
)

# Path to mappings directory
MAPPINGS_DIR = Path(__file__).parent.parent.parent / "mappings"


class MigrationStorage:
    """In-memory storage for migrations."""

    def __init__(self):
        self._migrations: Dict[str, MigrationResponse] = {}

    def create(self, data: MigrationCreate) -> MigrationResponse:
        migration_id = str(uuid.uuid4())
        now = datetime.utcnow()

        migration = MigrationResponse(
            id=migration_id,
            name=data.name,
            description=data.description,
            status=MigrationStatusEnum.DRAFT,
            sources=data.sources,
            target_service=data.target_service,
            target_site=data.target_site,
            entity_mappings=data.entity_mappings,
            dry_run=data.dry_run,
            batch_size=data.batch_size,
            created_at=now,
            updated_at=now,
        )

        self._migrations[migration_id] = migration
        return migration

    def get(self, migration_id: str) -> Optional[MigrationResponse]:
        return self._migrations.get(migration_id)

    def list_all(self) -> list[MigrationResponse]:
        return list(self._migrations.values())

    def update(self, migration_id: str, data: MigrationUpdate) -> Optional[MigrationResponse]:
        migration = self._migrations.get(migration_id)
        if not migration:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(migration, key):
                setattr(migration, key, value)

        migration.updated_at = datetime.utcnow()
        self._migrations[migration_id] = migration
        return migration

    def delete(self, migration_id: str) -> bool:
        if migration_id in self._migrations:
            del self._migrations[migration_id]
            return True
        return False

    def update_status(self, migration_id: str, status: MigrationStatusEnum) -> Optional[MigrationResponse]:
        migration = self._migrations.get(migration_id)
        if not migration:
            return None

        migration.status = status
        migration.updated_at = datetime.utcnow()

        if status == MigrationStatusEnum.EXTRACTING and not migration.started_at:
            migration.started_at = datetime.utcnow()
        elif status in (MigrationStatusEnum.COMPLETED, MigrationStatusEnum.FAILED, MigrationStatusEnum.CANCELLED):
            migration.completed_at = datetime.utcnow()

        self._migrations[migration_id] = migration
        return migration


class MappingStorage:
    """In-memory storage for saved mappings."""

    def __init__(self):
        self._mappings: Dict[str, MappingResponse] = {}
        self._load_from_files()

    def _load_from_files(self):
        """Load mappings from JSON files in the mappings directory."""
        if not MAPPINGS_DIR.exists():
            return

        for json_file in MAPPINGS_DIR.glob("*.json"):
            try:
                with open(json_file, "r") as f:
                    data = json.load(f)

                # Extract entity mappings from the file
                if "mappings" in data:
                    for entity_name, entity_mapping in data["mappings"].items():
                        mapping_id = f"{json_file.stem}_{entity_name}"

                        # Parse source and target
                        source_parts = entity_mapping.get("source", "").split(".")
                        target_parts = entity_mapping.get("target", "").split(".")

                        source_service = source_parts[0] if len(source_parts) > 0 else ""
                        source_entity = source_parts[1] if len(source_parts) > 1 else entity_name
                        target_service = target_parts[0] if len(target_parts) > 0 else ""
                        target_entity = target_parts[1] if len(target_parts) > 1 else entity_name

                        # Convert field mappings to the expected format
                        field_mappings = []
                        for fm in entity_mapping.get("field_mappings", []):
                            field_mappings.append({
                                "source_field": fm.get("source_field") or "",
                                "target_field": fm.get("target_field") or "",
                                "transform": fm.get("transform", "direct"),
                                "transform_config": fm.get("transform_config", {}),
                                "notes": fm.get("notes") or "",
                                "source": fm.get("source") or "",  # For multi-source mappings
                            })

                        mapping = MappingResponse(
                            id=mapping_id,
                            name=f"{data.get('name', json_file.stem)} - {entity_name}",
                            source_service=source_service,
                            source_entity=source_entity,
                            target_service=target_service,
                            target_entity=target_entity,
                            field_mappings=field_mappings,
                            created_at=datetime.utcnow(),
                            additional_sources=entity_mapping.get("additional_sources", []),
                        )

                        self._mappings[mapping_id] = mapping
            except Exception as e:
                print(f"Error loading mapping file {json_file}: {e}")

    def create(self, data: MappingSaveRequest) -> MappingResponse:
        mapping_id = str(uuid.uuid4())
        now = datetime.utcnow()

        mapping = MappingResponse(
            id=mapping_id,
            name=data.name,
            source_service=data.source_service,
            source_entity=data.source_entity,
            target_service=data.target_service,
            target_entity=data.target_entity,
            field_mappings=data.field_mappings,
            created_at=now,
        )

        self._mappings[mapping_id] = mapping
        return mapping

    def get(self, mapping_id: str) -> Optional[MappingResponse]:
        return self._mappings.get(mapping_id)

    def list_all(self) -> list[MappingResponse]:
        return list(self._mappings.values())

    def delete(self, mapping_id: str) -> bool:
        if mapping_id in self._mappings:
            del self._mappings[mapping_id]
            return True
        return False


# Global storage instances
migration_storage = MigrationStorage()
mapping_storage = MappingStorage()
