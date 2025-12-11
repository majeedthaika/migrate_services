"""Server-Sent Events for real-time migration progress."""

import asyncio
import json
from typing import Dict, Set
from datetime import datetime
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

router = APIRouter()


class MigrationProgressManager:
    """Manages SSE connections and progress updates for migrations."""

    def __init__(self):
        self._queues: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, migration_id: str) -> asyncio.Queue:
        """Subscribe to progress updates for a migration."""
        if migration_id not in self._queues:
            self._queues[migration_id] = set()

        queue = asyncio.Queue()
        self._queues[migration_id].add(queue)
        return queue

    def unsubscribe(self, migration_id: str, queue: asyncio.Queue):
        """Unsubscribe from progress updates."""
        if migration_id in self._queues:
            self._queues[migration_id].discard(queue)
            if not self._queues[migration_id]:
                del self._queues[migration_id]

    async def _broadcast(self, migration_id: str, event: dict):
        """Broadcast an event to all subscribers."""
        if migration_id not in self._queues:
            return

        for queue in self._queues[migration_id]:
            await queue.put(event)

    async def send_progress(
        self,
        migration_id: str,
        phase: str,
        records_processed: int,
        records_succeeded: int,
        records_failed: int,
        total_records: int = None,
        message: str = None,
    ):
        """Send a progress update."""
        event = {
            "type": "progress",
            "phase": phase,
            "records_processed": records_processed,
            "records_succeeded": records_succeeded,
            "records_failed": records_failed,
            "total_records": total_records,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self._broadcast(migration_id, event)

    async def send_step_complete(
        self,
        migration_id: str,
        step_name: str,
        records_processed: int,
        records_succeeded: int,
        records_failed: int,
    ):
        """Send a step completion event."""
        event = {
            "type": "step_complete",
            "step_name": step_name,
            "records_processed": records_processed,
            "records_succeeded": records_succeeded,
            "records_failed": records_failed,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self._broadcast(migration_id, event)

    async def send_error(self, migration_id: str, error: str):
        """Send an error event."""
        event = {
            "type": "error",
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self._broadcast(migration_id, event)

    async def send_complete(
        self,
        migration_id: str,
        total_processed: int,
        total_succeeded: int,
        total_failed: int,
    ):
        """Send a completion event."""
        event = {
            "type": "complete",
            "total_processed": total_processed,
            "total_succeeded": total_succeeded,
            "total_failed": total_failed,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await self._broadcast(migration_id, event)


# Global progress manager
migration_progress = MigrationProgressManager()


@router.get("/migration/{migration_id}")
async def migration_events(migration_id: str):
    """SSE endpoint for migration progress updates."""

    async def event_generator():
        queue = migration_progress.subscribe(migration_id)
        try:
            # Send initial connection event
            yield {
                "event": "connected",
                "data": json.dumps({"migration_id": migration_id}),
            }

            while True:
                try:
                    # Wait for events with timeout
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {
                        "event": event.get("type", "message"),
                        "data": json.dumps(event),
                    }

                    # Stop streaming on complete or error
                    if event.get("type") in ("complete", "error"):
                        break

                except asyncio.TimeoutError:
                    # Send keepalive
                    yield {
                        "event": "keepalive",
                        "data": json.dumps({"timestamp": datetime.utcnow().isoformat()}),
                    }

        finally:
            migration_progress.unsubscribe(migration_id, queue)

    return EventSourceResponse(event_generator())
