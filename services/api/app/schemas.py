"""Shared API request models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AssignmentRowIn(BaseModel):
    mission_id: str
    slot: int = 0
    tail: str
    crew_ids: list[str]
    load_out: str
    start: str
    end: str
    duration_min: int = Field(ge=1)
    base_launch: str
    base_recover: str
    tanker_id: str | None = None
    frozen: bool = False


class AssignmentListIn(BaseModel):
    assignments: list[AssignmentRowIn]

    def as_dicts(self) -> list[dict[str, Any]]:
        return [row.model_dump() for row in self.assignments]
