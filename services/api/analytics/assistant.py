"""Deterministic read-only answers. No language model."""

from __future__ import annotations

import re
from typing import Any

from analytics.risk import mission_risk


def answer(snapshot: dict[str, Any], text: str) -> dict[str, Any]:
    query = text.strip()
    lowered = query.lower()
    mission = _id(query, "MSN")
    tail = _id(query, "TAIL")
    if mission and "why" in lowered or lowered.startswith("explain"):
        return {"intent": "explain_mission", "mission_id": mission, "freshness": _fresh(snapshot)}
    if "duty" in lowered or "fatigue" in lowered:
        hot = sorted(snapshot["crew"], key=lambda row: float(row["fatigue_index"]), reverse=True)[:5]
        return {
            "intent": "crew_near_limit",
            "crew": [{"id": row["id"], "fatigue_index": row["fatigue_index"], "hours_24h": row["hours_24h"]} for row in hot],
            "freshness": _fresh(snapshot),
        }
    if "weather" in lowered:
        return {"intent": "weather", "cells": snapshot["weather"][:8], "freshness": _fresh(snapshot)}
    if tail:
        craft = next((row for row in snapshot["aircraft"] if row["tail"] == tail), None)
        return {"intent": "tail_status", "aircraft": craft, "freshness": _fresh(snapshot)}
    if mission:
        found = next((row for row in snapshot["missions"] if row["id"] == mission), None)
        risk = mission_risk(snapshot, found) if found else None
        return {"intent": "mission_status", "mission": found, "risk": risk, "freshness": _fresh(snapshot)}
    if "ready" in lowered or "status" in lowered:
        fmc = sum(1 for row in snapshot["aircraft"] if row["status"] == "FMC")
        return {
            "intent": "status",
            "aircraft_fmc": fmc,
            "aircraft_total": len(snapshot["aircraft"]),
            "crew_ready": sum(1 for row in snapshot["crew"] if row["status"] == "AVAILABLE"),
            "freshness": _fresh(snapshot),
        }
    return {
        "intent": "unknown",
        "message": "Ask for a tail, a mission, crew near the duty limit, or the weather.",
        "freshness": _fresh(snapshot),
    }


def _id(text: str, prefix: str) -> str | None:
    match = re.search(rf"{prefix}-\d+", text.upper())
    return match.group(0) if match else None


def _fresh(snapshot: dict[str, Any]) -> str:
    return str(snapshot.get("now") or "")
