"""Feed policy and fused snapshot."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def apply_feed_policy(world: dict[str, Any]) -> dict[str, Any]:
    data = deepcopy(world)
    sources = {row["id"]: row for row in data.get("sources", [])}
    if _degraded(sources, "MSS"):
        for craft in data["aircraft"]:
            craft["freshness"] = "STALE"
            if craft["status"] == "FMC":
                craft["effective_status"] = "PMC"
    if _degraded(sources, "MET"):
        for row in data["weather"]:
            row["freshness"] = "STALE"
    if _degraded(sources, "TIP"):
        for row in data["threats"]:
            row["freshness"] = "STALE"
            row["radius_nm"] = round(float(row["radius_nm"]) * 1.25, 1)
    if _degraded(sources, "CRFR"):
        for row in data["crew"]:
            row["freshness"] = "STALE"
            row["hours_24h"] = round(float(row["hours_24h"]) + 0.5, 2)
    return data


def _degraded(sources: dict[str, Any], source_id: str) -> bool:
    row = sources.get(source_id) or {}
    return bool(row.get("degraded")) or row.get("status") == "DEGRADED"
