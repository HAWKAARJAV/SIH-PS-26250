"""Validated operational event payloads — unknown shapes return 422, never 500."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, TypeAdapter, field_validator


class TailPayload(BaseModel):
    tail: str = Field(min_length=1)


class CrewPayload(BaseModel):
    crew_id: str = Field(min_length=1)


class BasePayload(BaseModel):
    base_id: str = Field(min_length=1)
    status: str | None = None
    closures: list[dict[str, Any]] | None = None


class WeatherPayload(BaseModel):
    base_id: str = Field(min_length=1)
    ceiling_ft: int = Field(ge=0)
    vis_m: int = Field(ge=0)
    freshness: str = "FRESH"


class ThreatPayload(BaseModel):
    id: str | None = None
    kind: str = "pressure-ring"
    lat: float = 15.0
    lon: float = 65.4
    radius_nm: float = Field(gt=0)
    existence_p: float = Field(ge=0, le=1)


class AirspacePayload(BaseModel):
    block_id: str
    owner: str | None = None


class EventIn(BaseModel):
    type: str
    severity: str = "CAUTION"
    confidence: float = Field(default=0.9, ge=0, le=1)
    payload: dict[str, Any]

    @field_validator("severity")
    @classmethod
    def severity_ok(cls, value: str) -> str:
        allowed = {"ADVISORY", "CAUTION", "WARNING", "CRITICAL"}
        if value not in allowed:
            raise ValueError("severity must be ADVISORY, CAUTION, WARNING or CRITICAL")
        return value

    def validated_payload(self) -> dict[str, Any]:
        kind = self.type
        payload = self.payload
        if kind in {"AIRCRAFT_NMC", "AIRCRAFT_RTS", "AIRCRAFT_PMC"}:
            return TailPayload.model_validate(payload).model_dump()
        if kind == "CREW_UNAVAILABLE":
            return CrewPayload.model_validate(payload).model_dump()
        if kind in {"BASE_CLOSED", "BASE_STATUS"}:
            return BasePayload.model_validate(payload).model_dump()
        if kind in {"WEATHER_DEGRADATION", "WEATHER_UPDATE"}:
            return WeatherPayload.model_validate(payload).model_dump()
        if kind in {"THREAT_EXPANSION", "THREAT_UPDATE"}:
            return ThreatPayload.model_validate(payload).model_dump()
        if kind == "AIRSPACE_BLOCKED":
            return AirspacePayload.model_validate(payload).model_dump()
        if kind in {"STORE_SHORTAGE", "TASK_PRIORITY_CHANGE", "NEW_TASK", "FEED_STALE"}:
            return payload
        raise ValueError(f"Unknown event type: {kind}")


EVENT_ADAPTER = TypeAdapter(EventIn)
