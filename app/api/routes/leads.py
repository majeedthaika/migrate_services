"""Migration request leads endpoint."""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter()

# Store leads in a JSON file (in production, use a database)
LEADS_FILE = Path(__file__).parent.parent.parent.parent / "data" / "leads.json"


class MigrationRequest(BaseModel):
    """Migration request from landing page."""
    email: EmailStr
    company: str
    sourceService: str
    targetService: str
    estimatedRecords: Optional[str] = None
    notes: Optional[str] = None


class MigrationRequestResponse(BaseModel):
    """Response after submitting a migration request."""
    id: str
    message: str


def load_leads() -> list:
    """Load leads from JSON file."""
    if not LEADS_FILE.exists():
        LEADS_FILE.parent.mkdir(parents=True, exist_ok=True)
        LEADS_FILE.write_text("[]")
        return []
    try:
        return json.loads(LEADS_FILE.read_text())
    except json.JSONDecodeError:
        return []


def save_leads(leads: list) -> None:
    """Save leads to JSON file."""
    LEADS_FILE.parent.mkdir(parents=True, exist_ok=True)
    LEADS_FILE.write_text(json.dumps(leads, indent=2, default=str))


@router.post("", response_model=MigrationRequestResponse)
async def submit_migration_request(request: MigrationRequest):
    """Submit a new migration request (lead capture)."""
    leads = load_leads()

    # Generate a simple ID
    lead_id = f"lead_{len(leads) + 1}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    lead = {
        "id": lead_id,
        "email": request.email,
        "company": request.company,
        "source_service": request.sourceService,
        "target_service": request.targetService,
        "estimated_records": request.estimatedRecords,
        "notes": request.notes,
        "created_at": datetime.utcnow().isoformat(),
        "status": "new",
    }

    leads.append(lead)
    save_leads(leads)

    return MigrationRequestResponse(
        id=lead_id,
        message="Thank you! We'll review your migration request and get back to you within 24 hours."
    )


@router.get("")
async def list_migration_requests():
    """List all migration requests (admin endpoint)."""
    return load_leads()
